"""
Upscayl Modern Python Engine: Unified PyTorch / CUDA, Spandrel, and SeedVR2 Backend.
Supports:
  - ByteDance SeedVR2 (3B, 7B, 7B-sharp, FP16, FP8, GGUF) via diffusion DiT + VAE
  - Universal SOTA Transformers (DAT, DAT-2, FaceUpDAT, HAT, OmniSR, SwinIR) via Spandrel
  - SOTA CNNs (Real-ESRGAN, UltraSharp, Remacri, NMKD, AnimeSharp, SPAN, Compact) via Spandrel
  - Smooth Hann-cosine feathered tiled inference for large images
  - Compatible CLI arguments and progress protocol for Upscayl Electron frontend
  - Adaptive smart batch upscaling with per-image model mapping and GPU weight caching
"""

import sys
import os
import argparse
import glob
from pathlib import Path
import math
import time
import json
from typing import Optional, Any, Tuple

# Ensure UTF-8 output on Windows
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
sys.stderr.reconfigure(encoding="utf-8", errors="replace")

def log_progress(pct: float):
    """Format expected by Upscayl: e.g. 25.50%"""
    clamped = max(0.0, min(100.0, pct))
    msg = f"{clamped:.2f}%"
    print(msg, file=sys.stderr, flush=True)
    print(msg, file=sys.stdout, flush=True)

def find_model_file(model_name: str, search_dirs: list[str]) -> Optional[str]:
    """Finds a model file by name or path across known model directories."""
    # Check if exact path provided
    if os.path.isfile(model_name):
        return model_name
    
    # Extensions to test
    valid_exts = [".pth", ".safetensors", ".pt", ".bin", ".onnx"]
    clean_name = model_name
    for ext in valid_exts:
        if clean_name.lower().endswith(ext):
            clean_name = clean_name[:-len(ext)]
            break

    for d in search_dirs:
        if not d or not os.path.exists(d):
            continue
        # Direct check
        for ext in ["", ".pth", ".safetensors", ".pt", ".onnx", ".bin"]:
            candidate = os.path.join(d, model_name + ext)
            if os.path.isfile(candidate):
                return candidate
            candidate = os.path.join(d, clean_name + ext)
            if os.path.isfile(candidate):
                return candidate
        
        # Recursive check inside subdirectories (like upscale_models, SEEDVR2)
        for root, _, files in os.walk(d):
            for f in files:
                f_lower = f.lower()
                clean_lower = clean_name.lower()
                if f_lower == clean_lower or f_lower.startswith(clean_lower):
                    for ext in valid_exts:
                        if f_lower.endswith(ext):
                            return os.path.join(root, f)
    return None

def run_spandrel_upscale(
    input_path: str,
    output_path: str,
    model_path: str,
    target_scale: Optional[float] = None,
    custom_width: Optional[int] = None,
    tile_size: int = 1024,
    tile_overlap: int = 48,
    device: str = "cuda",
    cached_model_tuple: Optional[Tuple[Any, Any, Any]] = None
) -> Tuple[Any, Any, Any]:
    import torch
    import torchvision.transforms.functional as TF
    from PIL import Image
    import spandrel

    device_obj = torch.device(device if torch.cuda.is_available() else "cpu")

    if cached_model_tuple is not None:
        model, model_desc, dtype = cached_model_tuple
    else:
        print(f"Loading model via Spandrel: {model_path}", file=sys.stderr, flush=True)
        print(f"Loading neural model: {os.path.basename(model_path)}", file=sys.stdout, flush=True)
        loader = spandrel.ModelLoader(device=device)
        model_desc = loader.load_from_file(model_path)
        
        # Determine supported dtype
        model = model_desc.model.to(device_obj).eval()
        use_half = False
        try:
            if hasattr(model_desc, "supports_half") and model_desc.supports_half:
                model = model.half()
                use_half = True
        except Exception:
            use_half = False

        dtype = torch.float16 if use_half else torch.float32

    img = Image.open(input_path).convert("RGB")
    w, h = img.size
    native_scale = getattr(model_desc, "scale", 4)
    print(f"Input: {w}x{h}, Model Native Scale: {native_scale}x, Target Scale: {target_scale}x", file=sys.stderr, flush=True)

    log_progress(10.0)

    # Tiled inference for large images
    needs_tiling = (tile_size > 0) and (w > tile_size or h > tile_size)

    if not needs_tiling:
        tensor = TF.to_tensor(img).unsqueeze(0).to(device_obj, dtype=dtype)
        with torch.inference_mode():
            out_tensor = model(tensor)
        out_tensor = out_tensor.squeeze(0).clamp(0, 1).float().cpu()
        out_img = TF.to_pil_image(out_tensor)
        log_progress(80.0)
    else:
        # Perform tiled processing with Hann-cosine feathered blending to eliminate tile borders
        print(f"Performing tiled inference (tile_size={tile_size}, overlap={tile_overlap})", file=sys.stderr, flush=True)
        out_w = w * native_scale
        out_h = h * native_scale
        out_canvas = torch.zeros((3, out_h, out_w), dtype=torch.float32)
        weight_canvas = torch.zeros((1, out_h, out_w), dtype=torch.float32)

        stride = tile_size - tile_overlap
        x_steps = math.ceil((w - tile_size) / stride) + 1 if w > tile_size else 1
        y_steps = math.ceil((h - tile_size) / stride) + 1 if h > tile_size else 1
        total_tiles = x_steps * y_steps
        current_tile = 0

        for yi in range(y_steps):
            y1 = min(yi * stride, max(0, h - tile_size))
            y2 = min(y1 + tile_size, h)
            for xi in range(x_steps):
                x1 = min(xi * stride, max(0, w - tile_size))
                x2 = min(x1 + tile_size, w)

                tile = img.crop((x1, y1, x2, y2))
                tile_tensor = TF.to_tensor(tile).unsqueeze(0).to(device_obj, dtype=dtype)
                with torch.inference_mode():
                    out_tile = model(tile_tensor).squeeze(0).float().cpu()

                # Destination coordinates
                dx1, dy1 = x1 * native_scale, y1 * native_scale
                dx2, dy2 = x2 * native_scale, y2 * native_scale

                # Cosine-feathered blending mask
                th, tw = out_tile.shape[1], out_tile.shape[2]
                mask = torch.ones((1, th, tw), dtype=torch.float32)
                feather = tile_overlap * native_scale
                if feather > 0:
                    # Hann window ramp: 0.5 * (1 - cos(pi * t))
                    ramp = 0.5 - 0.5 * torch.cos(torch.linspace(0, math.pi, feather))
                    if xi > 0:
                        mask[:, :, :feather] *= ramp
                    if xi < x_steps - 1:
                        mask[:, :, -feather:] *= ramp.flip(0)
                    if yi > 0:
                        mask[:, :feather, :] *= ramp.unsqueeze(1)
                    if yi < y_steps - 1:
                        mask[:, -feather:, :] *= ramp.flip(0).unsqueeze(1)

                out_canvas[:, dy1:dy2, dx1:dx2] += out_tile * mask
                weight_canvas[:, dy1:dy2, dx1:dx2] += mask

                current_tile += 1
                pct = 10.0 + (current_tile / total_tiles) * 70.0
                print(f"Tiled inference: processing tile {current_tile}/{total_tiles}", file=sys.stdout, flush=True)
                log_progress(pct)

        out_canvas = out_canvas / weight_canvas.clamp(min=1e-5)
        out_img = TF.to_pil_image(out_canvas.clamp(0, 1))

    # Handle resizing if target scale or custom width differ
    if custom_width and custom_width > 0:
        if out_img.width != custom_width:
            print("Resizing to custom width...", flush=True)
            new_h = int(round(out_img.height * (custom_width / out_img.width)))
            out_img = out_img.resize((custom_width, new_h), Image.Resampling.LANCZOS)
    elif target_scale and abs(target_scale - native_scale) > 0.01:
        print(f"Resizing to target scale {target_scale}x...", flush=True)
        target_w = int(round(w * target_scale))
        target_h = int(round(h * target_scale))
        out_img = out_img.resize((target_w, target_h), Image.Resampling.LANCZOS)

    log_progress(95.0)
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    out_img.save(output_path)
    log_progress(100.0)
    print(f"Upscale complete! Saved to {output_path}", file=sys.stderr, flush=True)

    return (model, model_desc, dtype)

def run_seedvr2_upscale(
    input_path: str,
    output_path: str,
    dit_model: str,
    resolution: Optional[int] = None,
    target_scale: float = 4.0,
    custom_width: Optional[int] = None,
    color_correction: str = "lab",
    vae_tiled: Optional[bool] = None
):
    import subprocess
    from PIL import Image

    seedvr_cli = r"D:\_krea2\custom_nodes\seedvr2_videoupscaler\inference_cli.py"
    python_exe = sys.executable

    # Read input dimensions to prevent catastrophic downscaling
    with Image.open(input_path) as in_im:
        in_w, in_h = in_im.size

    in_short = min(in_w, in_h)

    # Calculate optimal target short-edge resolution:
    # 1. Never downscale the user's input below its native short edge (unless > 2160)
    # 2. Clamped up to 2160p (4K short edge) for DiT processing
    if resolution is None or resolution <= 0:
        desired_res = int(round(in_short * target_scale))
        if in_short >= 2160:
            target_res = 2160
        else:
            target_res = min(2160, max(in_short, desired_res))
    else:
        target_res = resolution

    print(f"[SeedVR2 Engine] Input: {in_w}x{in_h} (short: {in_short}px) -> SeedVR2 DiT resolution: {target_res}px", file=sys.stderr, flush=True)

    # Extract model basename if path given
    dit_name = os.path.basename(dit_model)
    if not dit_name.endswith(".safetensors") and not dit_name.endswith(".gguf"):
        # Match against known names
        candidates = [
            "seedvr2_ema_7b_fp16.safetensors",
            "seedvr2_ema_3b_fp16.safetensors",
            "seedvr2_ema_7b_sharp_fp16.safetensors",
            "seedvr2_ema_3b_fp8_e4m3fn.safetensors",
        ]
        matched = False
        for c in candidates:
            if dit_name.lower() in c.lower():
                dit_name = c
                matched = True
                break
        if not matched:
            dit_name = "seedvr2_ema_7b_fp16.safetensors"

    # Search for directory that actually holds this model file
    model_dirs = [
        r"C:\models\SEEDVR2",
        r"D:\_krea2\models\SEEDVR2",
        r"E:\models\SEEDVR2",
        r"D:\models\SEEDVR2"
    ]
    model_dir = None
    for md in model_dirs:
        if os.path.exists(os.path.join(md, dit_name)):
            model_dir = md
            break
    if not model_dir:
        for md in model_dirs:
            if os.path.exists(md):
                model_dir = md
                break

    # Determine VAE tiling:
    # VAE latent tiling is the primary cause of 512px grid seam lines.
    # On GPUs with 16GB+ VRAM (RTX 3090 24GB), single images up to 2160p fit comfortably without tiling.
    if vae_tiled is None:
        vae_tiled = (target_res > 2160)

    cmd = [
        python_exe,
        seedvr_cli,
        input_path,
        "--output", output_path,
        "--dit_model", dit_name,
        "--resolution", str(target_res),
        "--batch_size", "1",  # Crucial: 1-frame batch eliminates 3D temporal convolutions and duplicates
        "--color_correction", color_correction,
        "--output_format", "png"
    ]
    if model_dir:
        cmd.extend(["--model_dir", model_dir])
    if vae_tiled:
        cmd.extend([
            "--vae_encode_tiled",
            "--vae_decode_tiled",
            "--vae_encode_tile_size", "2048",
            "--vae_encode_tile_overlap", "256",
            "--vae_decode_tile_size", "2048",
            "--vae_decode_tile_overlap", "256",
        ])

    print(f"Launching SeedVR2: {' '.join(cmd)}", file=sys.stderr, flush=True)
    log_progress(10.0)

    env = os.environ.copy()
    env["PYTHONUTF8"] = "1"
    env["PYTHONIOENCODING"] = "utf-8"

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env
    )

    for line in proc.stdout:
        print(line, end="", file=sys.stderr, flush=True)
        print(line, end="", file=sys.stdout, flush=True)
        if "Phase 1:" in line:
            log_progress(25.0)
        elif "Phase 2:" in line:
            log_progress(50.0)
        elif "Phase 3:" in line:
            log_progress(75.0)
        elif "Phase 4:" in line:
            log_progress(90.0)

    proc.wait()
    if proc.returncode != 0:
        raise RuntimeError(f"SeedVR2 exited with code {proc.returncode}")

    # SeedVR2 CLI saves to auto-generated path or output directory; ensure output_path has the file
    out_dir = os.path.dirname(os.path.abspath(output_path))
    input_stem = Path(input_path).stem
    if not os.path.exists(output_path):
        candidates = glob.glob(os.path.join(out_dir, f"{input_stem}*"))
        if candidates:
            newest = max(candidates, key=os.path.getmtime)
            if newest != output_path:
                import shutil
                shutil.move(newest, output_path)

    # Post-process dimensions if needed:
    # Ensure final output matches requested custom_width or target_scale
    if os.path.exists(output_path):
        with Image.open(output_path) as out_im:
            curr_w, curr_h = out_im.size
            need_resize = False
            final_w, final_h = curr_w, curr_h
            if custom_width and custom_width > 0:
                final_w = custom_width
                final_h = int(round(in_h * (custom_width / in_w)))
                need_resize = (curr_w != final_w or curr_h != final_h)
            elif target_scale and target_scale > 1.0:
                final_w = int(round(in_w * target_scale))
                final_h = int(round(in_h * target_scale))
                need_resize = (curr_w != final_w or curr_h != final_h)

            if need_resize:
                print(f"Post-resizing SeedVR2 output ({curr_w}x{curr_h}) to target ({final_w}x{final_h})...", file=sys.stderr, flush=True)
                out_im = out_im.resize((final_w, final_h), Image.Resampling.LANCZOS)
                out_im.save(output_path)

    log_progress(100.0)

def main():
    parser = argparse.ArgumentParser(description="Upscayl Modern Python Engine")
    parser.add_argument("-i", "--input", required=True, help="Input file or folder")
    parser.add_argument("-o", "--output", required=True, help="Output file or folder")
    parser.add_argument("-m", "--models_path", default="", help="Models search path")
    parser.add_argument("-n", "--model_name", required=True, help="Model name or file")
    parser.add_argument("-s", "--scale", default="4", help="Scale factor")
    parser.add_argument("-w", "--custom_width", default="", help="Custom width in px")
    parser.add_argument("-f", "--format", default="png", help="Output format (png, jpg, webp)")
    parser.add_argument("-c", "--compression", default="0", help="Compression level")
    parser.add_argument("-t", "--tile_size", default="1024", help="Tile size (0 to disable)")
    parser.add_argument("-g", "--gpu_id", default="0", help="GPU device ID")
    parser.add_argument("-x", "--tta", action="store_true", help="TTA mode")
    parser.add_argument("--resolution", default=None, help="Target resolution for SeedVR2 (default: auto)")
    parser.add_argument("--color_correction", default="lab", help="Color correction for SeedVR2")
    parser.add_argument("--model_mapping", default=None, help="JSON file mapping filenames to specific models")

    args = parser.parse_args()

    # Search paths for models
    search_dirs = [
        args.models_path,
        r"C:\models\upscale_models",
        r"C:\models\SEEDVR2",
        r"D:\_krea2\models\SEEDVR2",
        r"D:\models\upscale_models",
        r"E:\models\upscale_models",
        r"E:\models\SEEDVR2",
        r"C:\models",
        r"D:\models",
        r"E:\models"
    ]

    target_scale = float(args.scale) if args.scale else 4.0
    custom_w = int(args.custom_width) if args.custom_width and args.custom_width.isdigit() else None
    tile_sz = int(args.tile_size) if args.tile_size and args.tile_size.isdigit() else 1024

    # Load model mapping if provided
    model_mapping = {}
    if args.model_mapping and os.path.isfile(args.model_mapping):
        try:
            with open(args.model_mapping, "r", encoding="utf-8") as f:
                model_mapping = json.load(f)
            print(f"Loaded model mapping with {len(model_mapping)} per-file rules.", file=sys.stderr, flush=True)
        except Exception as e:
            print(f"Warning: Failed to parse model_mapping file: {e}", file=sys.stderr, flush=True)

    # Determine if input is a single file or a folder
    if os.path.isfile(args.input):
        inputs = [(args.input, args.output)]
    elif os.path.isdir(args.input):
        os.makedirs(args.output, exist_ok=True)
        valid_exts = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}
        files = [f for f in os.listdir(args.input) if Path(f).suffix.lower() in valid_exts]
        inputs = [
            (
                os.path.join(args.input, f),
                os.path.join(args.output, f"{Path(f).stem}_upscayled.{args.format}")
            )
            for f in files
        ]
    else:
        raise FileNotFoundError(f"Input path does not exist: {args.input}")

    total_images = len(inputs)
    spandrel_model_cache = {}  # Cache loaded models on GPU to avoid reloading weights repeatedly

    for idx, (in_file, out_file) in enumerate(inputs):
        in_stem = Path(in_file).name
        # Resolve model for this specific image:
        assigned_model = (
            model_mapping.get(in_stem)
            or model_mapping.get(in_file)
            or args.model_name
        )

        if assigned_model.lower() == "auto":
            try:
                from classifier_service import classify_image
                clf = classify_image(in_file)
                assigned_model = clf.get("suggestedModel", "4xRealWebPhoto_v4_dat2")
            except Exception:
                assigned_model = "4xRealWebPhoto_v4_dat2"

        print(f"[{idx+1}/{total_images}] Processing {in_stem} with model '{assigned_model}'", file=sys.stdout, flush=True)
        print(f"[{idx+1}/{total_images}] Processing {in_file} -> {out_file}", file=sys.stderr, flush=True)

        is_seedvr = "seedvr" in assigned_model.lower() or "seed" in assigned_model.lower()

        if is_seedvr:
            res = int(args.resolution) if args.resolution and args.resolution.isdigit() else None
            run_seedvr2_upscale(
                input_path=in_file,
                output_path=out_file,
                dit_model=assigned_model,
                resolution=res,
                target_scale=target_scale,
                custom_width=custom_w,
                color_correction=args.color_correction
            )
        else:
            model_file = find_model_file(assigned_model, search_dirs)
            if not model_file:
                raise FileNotFoundError(f"Could not locate model '{assigned_model}' in search paths.")
            
            cached_tuple = spandrel_model_cache.get(model_file)
            loaded_tuple = run_spandrel_upscale(
                input_path=in_file,
                output_path=out_file,
                model_path=model_file,
                target_scale=target_scale,
                custom_width=custom_w,
                tile_size=tile_sz,
                cached_model_tuple=cached_tuple
            )
            if cached_tuple is None and model_file:
                spandrel_model_cache[model_file] = loaded_tuple

        # Report batch progress
        batch_pct = ((idx + 1) / total_images) * 100.0
        log_progress(batch_pct)

    log_progress(100.0)

if __name__ == "__main__":
    main()

<div align="center">

# 🆙 Upscayl Next-Gen: Revived with State-of-the-Art AI

#### The Ultimate AI Image Upscaler — Powered by ByteDance SeedVR2 DiT, DAT-2 Transformers & Universal PyTorch / CUDA

Upscayl has been completely revived and modernized. Moving beyond legacy NCNN Vulkan, Upscayl now features a dual-engine architecture capable of running generative diffusion transformers, state-of-the-art super-resolution transformers, and universal PyTorch models with Tensor Core acceleration.

[![GitHub license](https://img.shields.io/github/license/cccgi/Upscayl?style=for-the-badge)](https://github.com/cccgi/Upscayl/blob/main/LICENSE)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20Linux%20%7C%20macOS-blue?style=for-the-badge)]()
[![CUDA](https://img.shields.io/badge/Accelerated-NVIDIA%20CUDA%20%7C%20Tensor%20Cores-76B900?style=for-the-badge&logo=nvidia)]()

</div>

---

## 🌟 What's New: Top Modern Features

### 1. 🪄 Smart Image Detection & Auto-Algorithm Recommendation
Upscayl now features a real-time pixel analysis engine that inspects your image the moment you select it in Step 1:
- **Human Portrait & Skin Detection**: Scans skin chromaticity and facial density. Recommends **SeedVR2 7B Sharp** for natural skin pores, iris clarity, and fine hair.
- **Real-World Photography**: Detects natural gradations and complex textures. Recommends **DAT-2 (RealWebPhoto v4)** for peak structural fidelity and zero hallucination.
- **Anime & Digital Art**: Detects cell-shaded palettes and line art boundaries. Recommends **4x-AnimeSharp** for razor-sharp outlines without ringing.
- **Compression Artifact Detection**: Detects JPEG DCT blockiness and noise. Recommends **SeedVR2 3B (FP16)** to reconstruct missing high-frequency details.
- **Auto-Apply Toggle**: Automatically selects the best model for your image upon selection, or lets you apply recommendations manually with a single click.

### 2. ✨ ByteDance SeedVR2 Diffusion Engine (DiT + VAE)
Full native integration with ByteDance's groundbreaking **SeedVR2** generative restoration pipeline:
- **Diffusion Transformer (DiT)** architecture running in FP16 or FP8.
- **Euler Sampler** with perceptual **LAB color space correction**.
- Tiled VAE encoding/decoding for seamless gigapixel scaling.
- Truly restores missing micro-textures (hair strands, fabric weaves, skin pores) rather than merely sharpening blurred pixels.

### 3. ⚡ SOTA Transformer & Fast Super-Resolution (via Spandrel)
Integrated with the **Spandrel 0.4.2** universal neural network runner:
- **DAT & DAT-2 (Dual Aggregation Transformer)**: The reigning state of the art in PSNR and structural fidelity.
- **Universal PyTorch Checkpoint Support**: Load any `.pth`, `.safetensors`, `.pt`, or `.onnx` model natively on CUDA.
- **Tiled Blending**: Seamless linear feathering between tiles prevents seams and out-of-memory errors on massive images.

### 4. 🗂️ Modernized Model Selector Drawer
- **SOTA Priority Sorting**: The latest diffusion and transformer models are pinned to the top of the selection drawer with informative badges and technical descriptions.
- **Collapsible Legacy Section**: Legacy Vulkan NCNN models (`Upscayl Standard`, `Upscayl Lite`, etc.) are neatly organized into an expandable section at the bottom.

### 5. 🚀 Cleaned & Modernized Onboarding Wizard
- Outdated YouTube embeds and external tracking have been removed from the introductory wizard.
- Replaced with native, modern feature cards introducing modern AI capabilities and workflows.

---

## 🏆 Supported Model Architectures

| Category | Model Name | Architecture | Best Used For |
| :--- | :--- | :--- | :--- |
| **Generative DiT** | **SeedVR2 7B Sharp (FP16)** | Diffusion DiT + VAE | Maximum photorealism, portraits, facial reconstruction & fine texture generation. |
| **Generative DiT** | **SeedVR2 3B (FP16 / FP8)** | Diffusion DiT + VAE | Fast generative restoration, compressed/low-res photos, balanced VRAM footprint. |
| **SOTA Transformer** | **4x RealWebPhoto v4 (DAT-2)** | Dual Aggregation Transformer | Peak fidelity, natural sharpness, architecture, nature, zero hallucination. |
| **SOTA Transformer** | **4x FaceUp DAT** | DAT Transformer | Portrait enhancement, clean skin details without distortion. |
| **SOTA Transformer** | **4x Lexica DAT2** | DAT-2 Transformer | Digital artwork, high-detail CG renders, modern photography. |
| **Super-Resolution** | **4x-UltraSharp** | ESRGAN / PyTorch | Universal high-clarity upscaler for general graphics and photography. |
| **Super-Resolution** | **4x Remacri** | ESRGAN / PyTorch | Natural foliage, outdoor scenes, organic textures. |
| **Super-Resolution** | **4x-AnimeSharp** | ESRGAN / PyTorch | Anime line work, illustrations, digital paintings. |
| **Legacy NCNN** | **Upscayl Standard / Lite** | Real-ESRGAN NCNN | Fast Vulkan fallback for low-spec systems without PyTorch. |

---

## 📁 Automatic Model Directory Discovery

Upscayl automatically searches and aggregates models from standard local directories without requiring manual configuration:
- `C:\models\upscale_models`
- `C:\models\SEEDVR2`
- `D:\_krea2\models\SEEDVR2`
- `E:\models\upscale_models`
- `E:\models\SEEDVR2`
- `D:\models\upscale_models`
- Any custom directory selected in Settings

---

## 🛠️ Requirements & Setup

### Prerequisites
- **Node.js**: v18+ (tested on Node v24)
- **NVIDIA GPU** (recommended): RTX 20xx / 30xx / 40xx / 50xx with CUDA support
- **Python Environment**: Python 3.10+ with `torch`, `torchvision`, and `spandrel` installed (e.g. from ComfyUI / conda / venv).

### Running in Development
```powershell
# Install Node dependencies
npm install --legacy-peer-deps

# Build Next.js and compile TypeScript
npm run build

# Start the application
npm run dev
```

### Building for Production
```powershell
npm run pack-app
# or for an installer:
npm run dist:win
```

---

## 📜 Credits & Acknowledgments
- **Upscayl Original Team**: Nayam Amarshe & contributors for the foundational Electron / Next.js app.
- **ByteDance Seed**: For the incredible [SeedVR2](https://github.com/ByteDance-Seed/SeedVR) generative model.
- **ChaiNNer & Spandrel Team**: For the universal PyTorch model loader [Spandrel](https://github.com/chaiNNer-org/spandrel).
- **Zheng Chen et al.**: For Dual Aggregation Transformer ([DAT / DAT-2](https://github.com/z-x-yang/DAT)).
- **OpenModelDB Community**: For world-class fine-tuned upscaling checkpoints.

---

<div align="center">
  <b>Revived & maintained by <a href="https://github.com/cccgi">cccgi</a></b>
</div>

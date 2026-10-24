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

### 1. 🪄 Deep Vision AI Detection & Model Auto-Selection
Upscayl features an intelligent neural vision classifier powered by **Ultralytics YOLOv8** and **OpenAI CLIP (ViT-B/32)** that scans your image the moment you select it in Step 1:
- **Human Portraits & Headshots**: YOLOv8 deep face detection ensures 100% precision with zero false positives. Automatically recommends **SeedVR2 7B Sharp** for natural skin pores, iris clarity, and fine hair.
- **Commercial Apparel, Fashion & Products**: Detects merchandise, clothing, and products on clean or textured backdrops. Recommends **DAT-2 (RealWebPhoto v4)** for razor-sharp fabric weaves and logos without hallucinations.
- **Software UI, Desktop Screenshots & Typography**: Identifies UI window borders, system fonts, and code. Recommends **4x-UltraSharp** for crisp, anti-aliased vector edges and text.
- **Technical Schematics, Diagrams & Charts**: Identifies circuit diagrams, engineering drawings, and infographics. Recommends **4x-UltraSharp**.
- **Real-World Photography & Landscapes**: Detects natural continuous gradations and organic textures. Recommends **DAT-2 (RealWebPhoto v4)**.
- **Anime & 2D Manga**: Detects cel-shaded fills and ink contours. Recommends **4x-AnimeSharp** for clean strokes without ringing artifacts.
- **Zero-Latency Daemon**: Runs as a lightweight persistent background service (~260 ms inference time).
- **Auto-Apply Toggle**: Automatically switches to the best model when an image is loaded, or allows one-click application from the recommendation badge.

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

# (Optional) Download standard models if you don't have local models in C:\models or D:\models
npm run download-models

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

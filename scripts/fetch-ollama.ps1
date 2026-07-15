# Ollama 런타임을 내려받아 src-tauri\ollama-runtime\ 에 배치, NVIDIA CUDA 제외 (Windows)
$ErrorActionPreference = "Stop"
$OllamaVersion = "v0.32.0"
$Root = Split-Path -Parent $PSScriptRoot
$Dest = Join-Path $Root "src-tauri\ollama-runtime"
$Tmp  = Join-Path $env:TEMP "ollama-fetch"
$Zip  = Join-Path $Tmp "ollama.zip"

if (Test-Path $Dest) { Remove-Item -Recurse -Force $Dest }
if (Test-Path $Tmp)  { Remove-Item -Recurse -Force $Tmp }
New-Item -ItemType Directory -Force -Path $Dest | Out-Null
New-Item -ItemType Directory -Force -Path $Tmp  | Out-Null

Write-Host "Windows Ollama 런타임($OllamaVersion) 다운로드 중..."
Invoke-WebRequest -Uri "https://github.com/ollama/ollama/releases/download/$OllamaVersion/ollama-windows-amd64.zip" -OutFile $Zip
Expand-Archive -Path $Zip -DestinationPath $Dest -Force

# 용량 절감: NVIDIA CUDA 라이브러리 제외(약 1.75GB). Vulkan/CPU 가속만 유지.
Remove-Item -Recurse -Force (Join-Path $Dest "lib\ollama\cuda_v12") -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force (Join-Path $Dest "lib\ollama\cuda_v13") -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force $Tmp

if (-not (Test-Path (Join-Path $Dest "ollama.exe"))) { throw "ollama.exe 가 없습니다." }
Write-Host "완료: $Dest"

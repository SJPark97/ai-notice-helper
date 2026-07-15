#!/usr/bin/env bash
# Ollama 런타임을 내려받아 src-tauri/ollama-runtime/ 에 배치 (macOS)
set -euo pipefail
OLLAMA_VERSION="v0.32.0"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$ROOT/src-tauri/ollama-runtime"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

if [ "$(uname -s)" != "Darwin" ]; then
  echo "이 스크립트는 macOS 전용입니다. Windows는 fetch-ollama.ps1 을 사용하세요." >&2
  exit 1
fi

echo "macOS Ollama 런타임(${OLLAMA_VERSION}) 다운로드 중..."
curl -fsSL -o "$TMP/ollama.tgz" \
  "https://github.com/ollama/ollama/releases/download/${OLLAMA_VERSION}/ollama-darwin.tgz"

rm -rf "$DEST"
mkdir -p "$DEST"
tar -xzf "$TMP/ollama.tgz" -C "$DEST"

echo "완료: $DEST"
ls "$DEST/ollama" >/dev/null || { echo "ollama 바이너리가 없습니다." >&2; exit 1; }

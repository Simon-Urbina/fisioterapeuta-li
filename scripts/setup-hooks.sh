#!/usr/bin/env bash
# Activa los hooks de git versionados en .githooks/ para este clon.
# Cada integrante lo corre una vez después de clonar.
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

git config core.hooksPath .githooks
chmod +x .githooks/* 2>/dev/null || true

echo "✓ core.hooksPath = .githooks"
echo "  El hook pre-commit escanea secretos (gitleaks) y corre lint+typecheck"
echo "  de los paquetes que toques."

if ! command -v gitleaks >/dev/null 2>&1; then
  echo
  echo "⚠ Falta gitleaks. Instálalo para el escaneo local de secretos:"
  echo "    macOS:   brew install gitleaks"
  echo "    Linux:   https://github.com/gitleaks/gitleaks/releases"
  echo "    Windows: scoop install gitleaks   (o descarga el .exe)"
fi

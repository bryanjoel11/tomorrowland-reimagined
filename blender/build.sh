#!/usr/bin/env bash
# Rebuilds the Blender models and compresses them for the web.
# Needs Blender 4.2+ on PATH (or the `bpy` Python module) and Node.
set -euo pipefail
cd "$(dirname "$0")/.."
if command -v blender >/dev/null; then blender -b -P blender/build_models.py; else python blender/build_models.py; fi
for f in public/models/*.glb; do
  npx -y @gltf-transform/cli weld "$f" "$f"
  npx -y @gltf-transform/cli meshopt "$f" "$f"
done
ls -la public/models

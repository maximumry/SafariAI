#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
BUILD_DIR="${KOMOREBI_BUILD_DIR:-$(mktemp -d "${TMPDIR:-/tmp}/komorebi-build.XXXXXX")}"
# A temporary local directory avoids Finder metadata from synced Documents folders.
xcodebuild -project "$ROOT/Komorebi/Komorebi.xcodeproj" -scheme Komorebi \
  -configuration Release -derivedDataPath "$BUILD_DIR" \
  CODE_SIGN_IDENTITY=- CODE_SIGNING_ALLOWED=YES build
printf '\nBuilt app: %s\n' "$BUILD_DIR/Build/Products/Release/Komorebi.app"
if [[ "${1:-}" == "--open" ]]; then open "$BUILD_DIR/Build/Products/Release/Komorebi.app"; fi

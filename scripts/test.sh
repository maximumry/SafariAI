#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
TEST_DIR="$(mktemp -d "${TMPDIR:-/tmp}/komorebi-tests.XXXXXX")"
trap 'rm -rf "$TEST_DIR"' EXIT
node --test "$ROOT/tests/shared.test.cjs"
xcrun swiftc "$ROOT/Komorebi/Komorebi Extension/Native/Models.swift" \
  "$ROOT/Komorebi/Komorebi Extension/Native/CloudClient.swift" \
  "$ROOT/tests/NativeTests.swift" -o "$TEST_DIR/native-tests"
"$TEST_DIR/native-tests"

#!/usr/bin/env bash
# Cloud Agent install: idempotent dependency refresh for dev-tools-nav.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# rsync is used by the 1Panel deploy script (and its test suite) and by the
# GitHub Pages site-assembly step. It is missing from the default base image.
if ! command -v rsync >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq rsync
fi

# Project dependencies from the committed lockfile.
npm ci

# Chromium is required by the Playwright browser tests exercised via `npm test`.
npx playwright install --with-deps chromium

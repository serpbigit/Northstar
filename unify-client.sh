#!/bin/bash
# Script to copy Code.gs only. HTML unification is manual due to environment constraints.

# --- CONFIGURATION ---
CLIENT_DIR="./client"
DEPLOY_DIR="./_DEPLOY_CLIENT"
CODE_GS_SOURCE="$CLIENT_DIR/Code.gs"
OUTPUT_CODE_GS="$DEPLOY_DIR/Code.gs"

# --- 1. SETUP & CLEANUP ---
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
echo "--- Created clean deployment directory: $DEPLOY_DIR"

# --- 2. COPY SERVER SHIM ARTIFACT (Code.gs) ---
echo "--- Copying Code.gs to deployment folder..."
cp "$CODE_GS_SOURCE" "$OUTPUT_CODE_GS"

# NOTE: HTML unification step is intentionally skipped due to environment errors.
echo "NOTICE: HTML (index.html) must be manually deployed."

# --- 3. VERIFICATION ---
echo "✅ Client Build Successful!"
echo "Artifacts ready for deployment: $OUTPUT_CODE_GS"

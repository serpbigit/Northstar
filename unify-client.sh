#!/bin/bash
# Script to unify client-side HTML, CSS, and JS into final GAS artifacts.

# --- CONFIGURATION ---
CLIENT_DIR="./client"
DEPLOY_DIR="./_DEPLOY_CLIENT"

CODE_GS_SOURCE="$CLIENT_DIR/Code.gs"
INDEX_HTML_SOURCE="$CLIENT_DIR/index.html"
STYLES_HTML_SOURCE="$CLIENT_DIR/styles.html"
SCRIPTS_HTML_SOURCE="$CLIENT_DIR/scripts.html"

# --- 1. SETUP & CLEANUP ---
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"
echo "--- Created clean deployment directory: $DEPLOY_DIR"

# --- 2. CONCATENATE HTML ARTIFACT (index.html) ---

OUTPUT_HTML="$DEPLOY_DIR/index.html"
echo "--- Starting HTML unification..."

# Use a temporary file for intermediate processing
TEMP_HTML="$DEPLOY_DIR/temp.html"

# 2.1 Copy the base template
cp "$INDEX_HTML_SOURCE" "$TEMP_HTML"

# 2.2 Define the AWK command to perform inclusion
# AWK is generally more reliable for multi-line file processing than sed.

awk '
  // {
    # Replace placeholder with content of styles.html
    while ((getline line < "'"$STYLES_HTML_SOURCE"'") > 0) print line;
    close("'"$STYLES_HTML_SOURCE"'");
    next;
  }
  // {
    # Replace placeholder with content of scripts.html
    while ((getline line < "'"$SCRIPTS_HTML_SOURCE"'") > 0) print line;
    close("'"$SCRIPTS_HTML_SOURCE"'");
    next;
  }
  { print }
' "$TEMP_HTML" > "$OUTPUT_HTML"

# Clean up temporary file
rm "$TEMP_HTML"

# --- 3. COPY SERVER SHIM ARTIFACT (Code.gs) ---

OUTPUT_CODE_GS="$DEPLOY_DIR/Code.gs"
cp "$CODE_GS_SOURCE" "$OUTPUT_CODE_GS"

# --- 4. VERIFICATION ---

echo "✅ Client Build Successful!"
echo "Artifacts ready for copy-paste deployment:"
echo " - Server Shim: $OUTPUT_CODE_GS"
echo " - Web App UI: $OUTPUT_HTML"

#!/bin/bash

# This script bundles all relevant TypeScript source files into a single
# file for easy sharing and context provision.

# Set the output file path
OUTPUT_DIR="docs"
OUTPUT_FILE="$OUTPUT_DIR/bundled.dm"

# Create the output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

# Clear the output file if it exists
> "$OUTPUT_FILE"

# Find and concatenate all .ts files in the correct order
find . -name "*.ts" -not -path "./node_modules/*" -not -path "./docs/*" | sort | while read -r file; do
  echo "// FILE: $file" >> "$OUTPUT_FILE"
  cat "$file" >> "$OUTPUT_FILE"
  echo "" >> "$OUTPUT_FILE"
done

echo "✅ Project bundled into $OUTPUT_FILE"
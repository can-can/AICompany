#!/usr/bin/env bash
set -euo pipefail

SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DEST_DIR="$HOME/bin"

echo "Building ai-company from $SRC_DIR ..."

# Run tests
echo "Running tests..."
node --test "$SRC_DIR/test"/**/*.test.js

# Install dependencies
echo "Installing production dependencies..."
cd "$SRC_DIR"
npm ci --omit=dev

# Ensure ~/bin exists
mkdir -p "$DEST_DIR"

# Create wrapper script
cat > "$DEST_DIR/ai-company" <<WRAPPER
#!/usr/bin/env bash
exec node "$SRC_DIR/bin/ai-company.js" "\$@"
WRAPPER

chmod +x "$DEST_DIR/ai-company"

echo "Installed ai-company to $DEST_DIR/ai-company"
echo ""
echo "Make sure $DEST_DIR is in your PATH:"
echo "  export PATH=\"\$HOME/bin:\$PATH\""

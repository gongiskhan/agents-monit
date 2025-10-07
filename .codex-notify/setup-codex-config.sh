#!/bin/bash
# Setup Codex CLI to use our notify handler for session monitoring

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HANDLER_PATH="$SCRIPT_DIR/handler.js"
CODEX_CONFIG="$HOME/.codex/config.toml"

echo "==================================================================="
echo "Codex Monitor - Setup Configuration"
echo "==================================================================="
echo ""

# Ensure handler exists and is executable
if [ ! -f "$HANDLER_PATH" ]; then
    echo "❌ Error: handler.js not found at $HANDLER_PATH"
    exit 1
fi

chmod +x "$HANDLER_PATH"
echo "✓ Handler script: $HANDLER_PATH"

# Create .codex directory if it doesn't exist
mkdir -p "$HOME/.codex"

# Check if config.toml exists
if [ ! -f "$CODEX_CONFIG" ]; then
    echo "Creating new config.toml..."
    touch "$CODEX_CONFIG"
fi

# Check if notify is already configured
if grep -q "^notify = " "$CODEX_CONFIG" 2>/dev/null; then
    echo ""
    echo "⚠️  Warning: 'notify' is already configured in $CODEX_CONFIG"
    echo ""
    echo "Current configuration:"
    grep "^notify = " "$CODEX_CONFIG"
    echo ""
    read -p "Do you want to replace it with our handler? (y/n) " -n 1 -r
    echo ""

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 0
    fi

    # Remove existing notify line
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' '/^notify = /d' "$CODEX_CONFIG"
    else
        # Linux
        sed -i '/^notify = /d' "$CODEX_CONFIG"
    fi
fi

# Add notify configuration
echo "" >> "$CODEX_CONFIG"
echo "# Agent Monitor - Notification handler" >> "$CODEX_CONFIG"
echo "notify = [\"node\", \"$HANDLER_PATH\"]" >> "$CODEX_CONFIG"

echo ""
echo "✅ Configuration updated!"
echo ""
echo "Added to $CODEX_CONFIG:"
echo "  notify = [\"node\", \"$HANDLER_PATH\"]"
echo ""
echo "==================================================================="
echo "Next Steps:"
echo "==================================================================="
echo ""
echo "1. Start your Agent Monitor app (it should already be running)"
echo "2. Run Codex in any project: cd /path/to/project && codex"
echo "3. The monitor will track all Codex sessions automatically!"
echo ""
echo "Events will be logged to: ~/.codex-monitor/events.jsonl"
echo ""
echo "To test, try:"
echo "  cd /tmp && codex 'create a hello world script'"
echo ""

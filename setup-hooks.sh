#!/bin/bash

# Setup script to install Claude Code session tracking hooks
# This script copies hooks to ~/.claude/hooks and updates settings.json

set -e

CLAUDE_DIR="$HOME/.claude"
HOOKS_DIR="$CLAUDE_DIR/hooks"
UTILS_DIR="$HOOKS_DIR/utils"
PROJECT_HOOKS_DIR="$(cd "$(dirname "$0")/hooks" && pwd)"

echo "=========================================="
echo "  Claude Code Session Tracking Setup"
echo "=========================================="
echo

# Create directories if they don't exist
echo "Creating directories..."
mkdir -p "$HOOKS_DIR"
mkdir -p "$UTILS_DIR"
mkdir -p "$CLAUDE_DIR/active_sessions"
echo "✓ Directories created"
echo

# Function to copy or append a hook file
install_hook() {
    local hook_name="$1"
    local source_file="$PROJECT_HOOKS_DIR/$hook_name"
    local dest_file="$HOOKS_DIR/$hook_name"

    if [ ! -f "$source_file" ]; then
        echo "✗ Source file not found: $source_file"
        return 1
    fi

    if [ -f "$dest_file" ]; then
        # File exists - check if it's the same content
        if cmp -s "$source_file" "$dest_file"; then
            echo "  $hook_name already up to date"
        else
            echo "  $hook_name exists, backing up and updating..."
            cp "$dest_file" "$dest_file.backup.$(date +%Y%m%d_%H%M%S)"
            cp "$source_file" "$dest_file"
            chmod +x "$dest_file"
            echo "✓ Updated $hook_name (backup created)"
        fi
    else
        cp "$source_file" "$dest_file"
        chmod +x "$dest_file"
        echo "✓ Installed $hook_name"
    fi
}

# Install hook files
echo "Installing hook scripts..."
install_hook "user_prompt_submit.py"
install_hook "pre_tool_use.py"
install_hook "post_tool_use.py"
install_hook "session_start.py"
echo

# Install utils
echo "Installing utilities..."
if [ -f "$PROJECT_HOOKS_DIR/utils/session_tracker.py" ]; then
    cp "$PROJECT_HOOKS_DIR/utils/session_tracker.py" "$UTILS_DIR/"
    echo "✓ Installed session_tracker.py"
else
    echo "✗ session_tracker.py not found"
fi
echo

# Update settings.json
echo "Updating settings.json..."
if [ -f "$PROJECT_HOOKS_DIR/update_settings.py" ]; then
    python3 "$PROJECT_HOOKS_DIR/update_settings.py"
    echo
else
    echo "✗ update_settings.py not found"
    echo "  You will need to manually add hooks to ~/.claude/settings.json"
    echo
fi

echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo
echo "Session tracking hooks have been installed to:"
echo "  $HOOKS_DIR"
echo
echo "Session data will be stored in:"
echo "  $CLAUDE_DIR/active_sessions"
echo
echo "The Agents Bro app will now be able to monitor"
echo "your Claude Code sessions in real-time!"
echo

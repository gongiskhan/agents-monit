#!/bin/bash

echo "🦀 Installing Rust for Claude Code Session Monitor"
echo "=================================================="
echo ""

# Download and install rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

# Source the cargo environment
source "$HOME/.cargo/env"

# Verify installation
echo ""
echo "✅ Rust installation complete!"
echo "Rust version: $(rustc --version)"
echo "Cargo version: $(cargo --version)"
echo ""
echo "Now you can run:"
echo "  npm run tauri:dev"
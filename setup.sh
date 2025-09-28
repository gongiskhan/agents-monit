#!/bin/bash

echo "🚀 Claude Code Session Monitor - Setup Script"
echo "============================================="
echo ""

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo "❌ Rust is not installed."
    echo ""
    echo "To install Rust, please run:"
    echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    echo ""
    echo "After installation, run:"
    echo "  source $HOME/.cargo/env"
    echo ""
    echo "Then run this setup script again."
    exit 1
else
    echo "✅ Rust is installed: $(rustc --version)"
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed."
    echo "Please install Node.js 18+ from https://nodejs.org/"
    exit 1
else
    echo "✅ Node.js is installed: $(node --version)"
fi

# Check if npm dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing npm dependencies..."
    npm install
else
    echo "✅ npm dependencies installed"
fi

# Check if Tauri CLI is installed
if ! npm list @tauri-apps/cli &> /dev/null; then
    echo "📦 Installing Tauri CLI..."
    npm install --save-dev @tauri-apps/cli
else
    echo "✅ Tauri CLI installed"
fi

echo ""
echo "🎉 Setup complete! You can now run:"
echo "  npm run tauri:dev    # For development"
echo "  npm run tauri:build  # For production build"
echo ""
echo "Alternative: Run frontend only (without backend):"
echo "  npm run dev          # Frontend development server"
# Claude Code Session Monitor

A Tauri-based desktop application that monitors Claude Code sessions running on your machine, providing real-time status updates and notifications.

## Features

- **Real-time Monitoring**: Tracks all Claude Code sessions (CLI, IDE extensions, desktop apps)
- **Session Status**: Shows Active (< 30s) or Stopped (≥ 30s) status
- **Auto-refresh**: Updates every 2 seconds
- **Notifications**: Alerts when sessions transition from active to stopped
- **System Tray**: Optional minimize to tray functionality
- **Session Management**: Supports up to 25 concurrent sessions
- **History Tracking**: Maintains full session history with user-controlled cleanup

## Architecture

- **Backend**: Rust with Tauri 2.0
- **Frontend**: React with TypeScript
- **File Watching**: Uses notify-rs to monitor JSONL files
- **Async Runtime**: Tokio for concurrent operations

## Prerequisites

1. **Rust**: Install from [rustup.rs](https://rustup.rs/)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Node.js**: Version 18+ required
   ```bash
   # Install via nvm (recommended)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   nvm use 18
   ```

3. **Tauri CLI**:
   ```bash
   npm install -g @tauri-apps/cli
   ```

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd agents-monit
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the Rust backend:
   ```bash
   cd src-tauri
   cargo build
   cd ..
   ```

## Development

Run the application in development mode:
```bash
npm run tauri:dev
```

This will:
- Start the Vite dev server for the frontend
- Build and run the Tauri backend
- Enable hot reload for both frontend and backend changes

## Building

Build the application for production:
```bash
npm run tauri:build
```

This creates platform-specific installers in `src-tauri/target/release/bundle/`.

## Testing

### Frontend Tests
```bash
npm test
```

### Backend Tests
```bash
cd src-tauri
cargo test
cd ..
```

## Project Structure

```
agents-monit/
├── src/                    # React frontend
│   ├── components/         # React components
│   ├── types/              # TypeScript type definitions
│   ├── App.tsx             # Main app component
│   └── main.tsx            # Entry point
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands.rs     # Tauri commands
│   │   ├── monitor.rs      # Session monitoring logic
│   │   ├── parser.rs       # JSONL parsing
│   │   ├── session.rs      # Session data structures
│   │   ├── state.rs        # Application state management
│   │   └── main.rs         # Tauri app entry point
│   └── tests/              # Rust tests
└── tests/                  # Frontend test files
```

## How It Works

1. **File Monitoring**: Watches `~/.claude/projects/` for JSONL session files
2. **Session Detection**: Identifies sessions by parsing `session-{id}.jsonl` files
3. **Status Updates**: Tracks last activity timestamp to determine active/stopped status
4. **Real-time Updates**: Refreshes every 2 seconds and responds to file changes
5. **Notifications**: Sends desktop notifications when sessions stop

## Configuration

Settings are stored in localStorage and include:
- Enable/disable notifications
- Sound alerts
- Minimize to tray preference

## Troubleshooting

### Application won't start
- Ensure Rust and Node.js are properly installed
- Check that all dependencies are installed: `npm install`
- Verify Tauri prerequisites: `npm run tauri info`

### Sessions not detected
- Verify Claude Code is installed and running
- Check that `~/.claude/projects/` directory exists
- Ensure proper file permissions

### Build failures
- Clear build cache: `rm -rf src-tauri/target dist node_modules`
- Reinstall dependencies: `npm install`
- Update Rust toolchain: `rustup update`

## License

MIT

## Contributing

Contributions are welcome! Please read the development guidelines and submit pull requests to the main repository.
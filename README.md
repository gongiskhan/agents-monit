# Claude Code Session Monitor

A desktop application built with Electron and React to monitor active Claude Code sessions in real-time.

## Features

- ✅ **Real-time Session Monitoring**: Tracks all active Claude Code sessions across your system
- ✅ **Multiple Detection Methods**:
  - Process monitoring (detects running Claude instances)
  - History monitoring (reads from Claude's history file)
  - Hook monitoring (integrates with your Claude hooks)
- ✅ **Active Status Indicators**: Green pulsing indicators show active sessions
- ✅ **Session Details**: Shows project name, path, and last activity
- ✅ **Settings Panel**: Collapsible settings accessed via gear button
- ✅ **Auto-refresh**: Updates every 5 seconds

## Architecture

- **Backend**: Electron with Node.js
- **Frontend**: React with TypeScript
- **Build Tool**: Vite
- **File Watching**: Chokidar for monitoring session files
- **Process Monitoring**: Native process detection via ps/lsof commands

## Prerequisites

- Node.js 16+
- npm or yarn
- macOS (currently optimized for macOS)

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd agents-monit

# Install dependencies
npm install
```

## Development

To run the app in development mode:

```bash
npm run dev
```

This will:
1. Start the Vite dev server on http://localhost:5173
2. Build the Electron main and preload scripts
3. Launch the Electron desktop app

**Important**: The app only works in the Electron window, not in a regular browser. If you see "Electron API not available" errors in your browser, that's normal - look for the Electron app window that opens automatically.

## Building for Production

```bash
npm run build
```

This creates a distributable application in the `dist/` folder.

## How It Works

The app monitors Claude Code sessions through three complementary methods:

1. **Process Monitoring**: Scans for running Claude processes every 5 seconds
2. **History Monitoring**: Watches `~/.claude/history.jsonl` for activity
3. **Hook Monitoring**: Reads session files from `~/.claude/active_sessions/`

Sessions are marked as "active" if they've had activity within the last 5 minutes.

## Project Structure

```
agents-monit/
├── electron/                 # Electron backend
│   ├── main/                # Main process code
│   │   ├── index.ts         # Electron main entry point
│   │   ├── sessionMonitor.ts    # Core monitoring logic
│   │   ├── claudeProcessMonitor.ts  # Process & history monitoring
│   │   └── types.ts         # TypeScript types
│   └── preload.ts           # Preload script for IPC
├── src/                     # React frontend
│   ├── components/          # UI components
│   │   ├── Header.tsx       # App header
│   │   ├── SessionList.tsx # Session display
│   │   ├── SessionCard.tsx # Individual session cards
│   │   ├── StatusBar.tsx   # Status bar
│   │   └── NotificationSettings.tsx # Settings panel
│   ├── utils/               # Utilities
│   │   └── electronAPI.ts  # Electron IPC wrapper
│   ├── App.tsx             # Main app component
│   └── main.tsx            # Entry point
├── dist-electron/          # Built Electron files
├── dist/                   # Built app for distribution
└── package.json            # Project configuration
```

## Available Scripts

- `npm run dev` - Start development server with Electron
- `npm run build` - Build for production
- `npm run dev:vite` - Start only Vite dev server
- `npm run dev:electron` - Start only Electron (requires Vite running)
- `npm run electron` - Launch Electron with built files

## Troubleshooting

### App doesn't show sessions
- Ensure Claude Code is running
- Check that `~/.claude/` directory exists
- Verify process monitoring permissions
- Look in the Electron app window's console for any errors

### "Electron API not available" error in browser
- This is expected behavior when viewing http://localhost:5173 in a browser
- The app only works in the Electron desktop window
- Look for the separate Electron app window that opens automatically

### Port 5173 already in use
```bash
# Kill any existing Vite processes
pkill -f vite

# Or kill all Electron processes
pkill -f electron
```

### Electron window not opening
- Check the terminal output for errors
- Ensure the preload script is built: `ls -la dist-electron/`
- Try rebuilding: `rm -rf dist-electron && npm run dev`

### Sessions show as inactive when they're running
- The app uses a 5-minute threshold for active status
- Check that process monitoring is working in the console logs
- Verify your Claude hooks are properly configured

## Technologies Used

- **Electron**: Desktop app framework
- **React + TypeScript**: Frontend UI
- **Vite**: Build tool and dev server
- **Chokidar**: File watching
- **IPC (Inter-Process Communication)**: Communication between main and renderer processes

## Contributing

Contributions are welcome! Please feel free to submit pull requests or open issues for bugs and feature requests.

## License

MIT
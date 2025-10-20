# Agent Bro - Claude Code Web Monitor

A web-based monitoring and execution interface for Claude Code with full observability across all sessions.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Browser (React)                       │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────┐  │
│  │   Activity   │  │   Command       │  │   Session    │  │
│  │   Timeline   │  │   Input         │  │   Manager    │  │
│  └──────────────┘  └─────────────────┘  └──────────────┘  │
└───────────────────────────┬─────────────────────────────────┘
                            │ WebSocket
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              Node.js Server (Local Machine)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ WebSocket Server  │  HTTP API  │  File System Watch │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Claude Code Executor (spawn subprocess with -p)      │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Hook Event Processor (reads hook outputs)            │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **Real-time Monitoring**: Watch Claude Code sessions execute in real-time
- **Activity Timeline**: See all events (tool calls, prompts, responses) in chronological order
- **Session Management**: List, view, and manage multiple Claude Code sessions
- **Command Execution**: Execute new commands or continue existing sessions from the web interface
- **Hook Integration**: Captures all hook events (PreToolUse, PostToolUse, etc.)
- **WebSocket Communication**: Live updates without polling
- **Persistent Storage**: All sessions and events stored in `~/.agent-bro/`

## Prerequisites

- Node.js 18+ and npm
- Python 3.x (for hook scripts)
- Claude Code CLI installed and configured

## Installation

1. **Install all dependencies:**

```bash
npm run install:all
```

This will install dependencies for:
- Root workspace
- Server (Node.js/Express)
- Client (React/Vite)

## Configuration

The server creates a configuration file at `~/.agent-bro/config.json` on first run. Default settings:

```json
{
  "server": {
    "httpPort": 3001,
    "wsPort": 3002,
    "hookPort": 3003,
    "host": "0.0.0.0"
  },
  "storage": {
    "dataDir": "~/.agent-bro",
    "retentionDays": 30
  }
}
```

## Hook Setup

The hooks are already configured in `.claude/settings.json`. They will automatically send events to the Agent Bro server when Claude Code is running.

Hooks capture:
- PreToolUse: Before tool execution
- PostToolUse: After tool execution
- UserPromptSubmit: User input
- SessionStart/SessionEnd: Session lifecycle
- Notifications: System notifications

## Usage

### Development Mode

Run both server and client in development mode with hot reloading:

```bash
npm run dev
```

This starts:
- **HTTP API** on `http://localhost:3001`
- **WebSocket** on `ws://localhost:3002`
- **Hook Receiver** on `http://localhost:3003`
- **Web Client** on `http://localhost:5173`

Then open your browser to: **http://localhost:5173**

### Production Build

Build both server and client:

```bash
npm run build
```

Start the production server:

```bash
npm start
```

The server will serve the built client files.

### Running Individual Components

**Server only:**
```bash
npm run dev:server
```

**Client only:**
```bash
npm run dev:client
```

## Using the Web Interface

1. **Start the server**: `npm run dev`

2. **Open the web interface**: http://localhost:5173

3. **Execute a command**:
   - Type your prompt in the command textarea
   - Press Ctrl+Enter or click "Send"
   - Watch real-time execution in the Activity Timeline

4. **View sessions**:
   - All sessions appear in the left sidebar
   - Click a session to view its events
   - Running sessions are highlighted

5. **Continue a session**:
   - Select a running session
   - Type a follow-up prompt
   - Click "Continue"

6. **Interrupt a session**:
   - Select a running session
   - Click "Interrupt"

## API Endpoints

### HTTP API (Port 3001)

- `GET /api/health` - Health check
- `GET /api/sessions` - List all sessions
- `GET /api/sessions/:id` - Get session details
- `POST /api/sessions/execute` - Execute new command
- `POST /api/sessions/:id/continue` - Continue session
- `POST /api/sessions/:id/interrupt` - Interrupt session
- `GET /api/events/hooks` - Get hook events
- `GET /api/events/stream` - Get stream events

### WebSocket (Port 3002)

Client → Server:
- `execute-command` - Execute new command
- `continue-session` - Continue existing session
- `interrupt-session` - Stop running session
- `subscribe-session` - Subscribe to session events

Server → Client:
- `stream-event` - Claude Code stream event
- `hook-event` - Hook captured event
- `session-status` - Session status change
- `connection-status` - Connection status

### Hook Receiver (Port 3003)

- `POST /hook-event` - Receive events from Claude Code hooks

## Data Storage

All data is stored in `~/.agent-bro/`:

```
~/.agent-bro/
├── sessions/
│   ├── {session-id}/
│   │   ├── stream-output.jsonl
│   │   └── metadata.json
│   └── index.json
├── hook-logs/
│   └── {date}/
│       └── events.jsonl
├── metadata/
│   └── active-sessions.json
└── config.json
```

## Troubleshooting

### WebSocket Connection Failed

- Check that the server is running on port 3002
- Verify no firewall is blocking the connection
- Check browser console for errors

### Hooks Not Sending Events

- Verify `.claude/settings.json` is configured correctly
- Check that `send_to_server.py` is executable
- Ensure the hook receiver is running on port 3003
- Check server logs for hook event reception

### Claude Code Execution Fails

- Verify `claude` CLI is in PATH
- Check server logs for subprocess errors
- Ensure you have the latest Claude Code version

### Port Already in Use

Change ports in `~/.agent-bro/config.json` or use environment variables:

```bash
PORT=4001 WS_PORT=4002 HOOK_PORT=4003 npm run dev
```

## Development

### Project Structure

```
agent-bro/
├── server/          # Node.js backend
│   └── src/
│       ├── index.ts
│       ├── api.ts
│       ├── websocket.ts
│       ├── claude-executor.ts
│       ├── hook-processor.ts
│       └── storage.ts
├── client/          # React frontend
│   └── src/
│       ├── App.tsx
│       ├── components/
│       ├── hooks/
│       └── services/
└── .claude/
    ├── hooks/
    │   └── send_to_server.py
    └── settings.json
```

### Adding New Features

1. **Server-side**: Add routes in `server/src/api.ts`
2. **Client-side**: Create components in `client/src/components/`
3. **WebSocket events**: Update `server/src/websocket.ts` and `client/src/hooks/useWebSocket.ts`

## License

MIT

## Credits

Built for Claude Code monitoring and observability.

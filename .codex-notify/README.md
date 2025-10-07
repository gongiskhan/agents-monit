# Codex Session Monitoring

This directory contains the integration between Codex CLI and the Agent Monitor app.

## How It Works

Codex CLI has a `notify` configuration option that calls an external program whenever events occur. We use this to track Codex sessions.

### Architecture

```
Codex CLI
    ↓ (notify config)
handler.js
    ↓ (writes events)
~/.codex-monitor/events.jsonl
    ↓ (file watch)
codexMonitor.ts (Electron app)
    ↓ (emits events)
UI updates
```

### Files

- **`handler.js`** - Node.js script that receives events from Codex CLI
- **`setup-codex-config.sh`** - Configures `~/.codex/config.toml` to use the handler
- **`README.md`** - This file

## Setup

Run the setup script to configure Codex CLI:

```bash
cd .codex-notify
./setup-codex-config.sh
```

This adds the following to `~/.codex/config.toml`:

```toml
notify = ["node", "/path/to/agents-monit/.codex-notify/handler.js"]
```

## Events

Currently, Codex CLI only emits one event type:

### `agent-turn-complete`

Fired when Codex completes a turn (after processing your prompt).

```json
{
  "type": "agent-turn-complete",
  "turn-id": "12345",
  "input-messages": ["Rename foo to bar"],
  "last-assistant-message": "Rename complete and verified...",
  "timestamp": "2025-10-05T12:34:56.789Z",
  "pid": 98765
}
```

## Event Log

All events are appended to:

```
~/.codex-monitor/events.jsonl
```

The Electron app watches this file and processes new events in real-time.

## Troubleshooting

### Events not appearing?

1. Check that Codex is configured:
   ```bash
   cat ~/.codex/config.toml | grep notify
   ```

2. Test the handler directly:
   ```bash
   node .codex-notify/handler.js '{"type":"test","timestamp":"2025-01-01T00:00:00Z"}'
   ```

3. Check the event log:
   ```bash
   tail -f ~/.codex-monitor/events.jsonl
   ```

### Handler not being called?

Make sure the handler is executable:
```bash
chmod +x .codex-notify/handler.js
```

And verify the path in config.toml is absolute, not relative.

## Limitations

- Codex CLI currently only emits `agent-turn-complete` events
- No hooks for session start/end (we use process monitoring as a fallback)
- No hooks for tool calls or approvals
- PID tracking relies on `ppid` which may not be accurate in all cases

## Future Improvements

If Codex adds more event types (like Claude Code's hooks), we can easily extend the handler to support them.

Potential event types we'd like to see:
- `session-start` - When Codex starts in a project
- `session-end` - When Codex exits
- `tool-call` - When a tool is invoked
- `approval-requested` - When user approval is needed
- `error` - When an error occurs

## See Also

- [Codex CLI config docs](https://github.com/openai/codex/blob/main/docs/config.md#notify)
- [Codex CLI advanced features](https://github.com/openai/codex/blob/main/docs/advanced.md)

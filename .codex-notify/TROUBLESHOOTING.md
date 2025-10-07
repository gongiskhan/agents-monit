# Codex Monitoring Troubleshooting

## Current Status

✅ Codex notify handler is installed and configured
✅ TypeScript types are synchronized
✅ New codexMonitor.ts code is compiled
⚠️ **Electron app needs restart to load new code**

## Why Sessions Aren't Showing

### Key Issue: `notify` events only fire when turns complete

The `notify` handler receives `agent-turn-complete` events, which means:

- ❌ **Does NOT fire** when Codex starts
- ❌ **Does NOT fire** while Codex is running/waiting
- ✅ **ONLY fires** after Codex completes processing your prompt

### Example Timeline:

```
10:00 AM - You run: codex "fix the bug"
          [No event fired yet - session started]

10:02 AM - Codex finishes and responds
          [✅ Event fired: agent-turn-complete]
          [Session now appears in monitor]
```

## How to See It Working

### Step 1: Restart the Monitor App

The new code has been compiled but you need to restart Electron:

```bash
# Kill current app (Ctrl+C in the terminal where you ran npm run dev)
# Then restart:
cd /Users/ggomes/dev/agents-monit
npm run dev
```

### Step 2: Test with a Real Codex Interaction

Open a new terminal and run a quick Codex task:

```bash
cd /tmp
codex "create a hello world nodejs script that prints hello world"
```

**Wait for Codex to finish** - you should see:

1. The event logged: `tail -f ~/.codex-monitor/events.jsonl`
2. Session appears in the Monitor app
3. Console log in Electron: `[CodexMonitor] Event received: agent-turn-complete`

### Step 3: Check the Event Log

```bash
# Watch events in real-time
tail -f ~/.codex-monitor/events.jsonl

# Count total events
cat ~/.codex-monitor/events.jsonl | wc -l
```

## What You Should See

After Codex completes a turn:

```json
{
  "type": "agent-turn-complete",
  "turn-id": "abc-123",
  "input-messages": ["create a hello world script"],
  "last-assistant-message": "Created hello.js successfully",
  "timestamp": "2025-10-05T14:30:00.000Z",
  "pid": 12345
}
```

## Current Limitations

### What We CAN Track:
- ✅ When Codex completes a turn
- ✅ What the user asked for
- ✅ What Codex responded
- ✅ Process PID
- ✅ Project path (via lsof lookup)

### What We CANNOT Track (Yet):
- ❌ Session start events
- ❌ Session end events
- ❌ Tool calls during execution
- ❌ Approval requests
- ❌ Real-time progress updates

These would require additional event types that Codex CLI doesn't emit yet.

## Hybrid Approach

The updated `codexMonitor.ts` uses **both** methods:

1. **Event-based** (primary): Monitors `~/.codex-monitor/events.jsonl`
2. **Process-based** (fallback): Scans for running Codex processes

This means:
- Sessions appear when they start (via process scanning)
- Session details update when turns complete (via events)
- Sessions marked stopped when process exits

## Debug Commands

```bash
# Check Codex config
cat ~/.codex/config.toml | grep notify

# Test handler directly
node .codex-notify/handler.js '{"type":"test","timestamp":"2025-01-01T00:00:00Z"}'

# View Codex logs
tail -f ~/.codex/log/codex-tui.log

# Check running Codex processes
ps aux | grep codex | grep -v grep

# Monitor event log
tail -f ~/.codex-monitor/events.jsonl
```

## Next Steps for Better Monitoring

If OpenAI adds more event types to Codex CLI (similar to Claude Code's hooks), we can enhance this to track:

- Session lifecycle (start/end)
- Tool execution
- Approval requests
- Errors and warnings

Watch the GitHub issues:
- https://github.com/openai/codex/issues/2772 (SDK proposal)
- https://github.com/openai/codex/issues/2582 (Enhanced hooks RFC)

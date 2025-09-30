# Claude Code Session Tracking Hooks

This directory contains hooks that enable real-time session tracking for Claude Code.

## What are these hooks?

These Python scripts are executed by Claude Code at specific points during a session:

- **user_prompt_submit.py** - Runs when you submit a prompt to Claude Code
- **pre_tool_use.py** - Runs before Claude Code executes a tool
- **post_tool_use.py** - Runs after Claude Code executes a tool
- **session_start.py** - Runs when a new Claude Code session starts

## How do they work?

Each hook:
1. Receives session data from Claude Code via stdin (JSON format)
2. Extracts relevant information (session ID, project path, activity)
3. Updates session files in `~/.claude/active_sessions/`
4. Returns control to Claude Code (non-blocking)

The session files are then read by the Agents Bro Electron app to display real-time session information.

## Installation

Run the setup script from the project root:

```bash
./setup-hooks.sh
```

This will:
1. Copy hooks to `~/.claude/hooks/`
2. Copy utilities to `~/.claude/hooks/utils/`
3. Update `~/.claude/settings.json` to register the hooks
4. Create `~/.claude/active_sessions/` directory

## Session Data Structure

Each session is stored as a JSON file: `~/.claude/active_sessions/{session_id}.json`

Example session data:
```json
{
  "id": "session_abc123",
  "project_path": "/Users/you/projects/myapp",
  "project_name": "myapp",
  "user_prompt": "Add authentication to the app",
  "start_time": "2025-09-30T10:30:00",
  "last_activity": "2025-09-30T10:35:00",
  "status": "active",
  "tool_calls": [
    {
      "tool": "Edit",
      "timestamp": "2025-09-30T10:31:00",
      "description": "File: src/auth.ts"
    }
  ]
}
```

## Uninstalling

To remove the hooks:

1. Delete hooks from `~/.claude/hooks/`:
   ```bash
   rm ~/.claude/hooks/user_prompt_submit.py
   rm ~/.claude/hooks/pre_tool_use.py
   rm ~/.claude/hooks/post_tool_use.py
   rm ~/.claude/hooks/session_start.py
   rm ~/.claude/hooks/utils/session_tracker.py
   ```

2. Remove hook configuration from `~/.claude/settings.json` (remove the hooks section or specific hook entries)

3. Optionally delete session data:
   ```bash
   rm -rf ~/.claude/active_sessions
   ```

## Troubleshooting

If hooks aren't working:

1. Check that hooks are executable:
   ```bash
   ls -l ~/.claude/hooks/*.py
   ```

2. Check settings.json has the hooks configured:
   ```bash
   cat ~/.claude/settings.json | grep -A 5 '"hooks"'
   ```

3. Check hook logs:
   ```bash
   tail -f /tmp/claude-hooks.log
   ```

4. Verify `uv` is installed (used to run hooks):
   ```bash
   which uv
   ```

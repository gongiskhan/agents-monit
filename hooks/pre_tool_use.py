#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///

import json
import sys
from pathlib import Path
from datetime import datetime

# Add utils to path
sys.path.insert(0, str(Path(__file__).parent / "utils"))
import session_tracker

# Log file path
LOG_FILE = Path("/tmp/claude-hooks.log")


def log_message(message: str):
    """Write log message with timestamp."""
    try:
        timestamp = datetime.now().isoformat()
        with open(LOG_FILE, "a") as f:
            f.write(f"[{timestamp}] [PRE_TOOL_USE] {message}\n")
    except Exception as e:
        print(f"Failed to write log: {e}", file=sys.stderr)


def main():
    """Track tool usage before execution."""
    log_message("Hook called - starting execution")

    try:
        # Read JSON input from stdin
        log_message("Reading input from stdin...")
        input_data = json.load(sys.stdin)
        log_message(f"Received input data: {json.dumps(input_data, indent=2)}")

        # Extract key information (Claude Code uses snake_case)
        session_id = input_data.get('session_id', 'unknown')
        tool_name = input_data.get('tool_name', 'Unknown')
        tool_params = input_data.get('tool_input', {})

        log_message(f"Session ID: {session_id}")
        log_message(f"Tool name: {tool_name}")
        log_message(f"Tool params: {json.dumps(tool_params, indent=2)}")

        # Get tool description - different tools have different param structures
        description = ''
        if 'description' in tool_params:
            description = tool_params['description']
        elif 'command' in tool_params:
            description = tool_params['command']
        elif 'file_path' in tool_params:
            description = f"File: {tool_params['file_path']}"
        elif 'pattern' in tool_params:
            description = f"Search: {tool_params['pattern']}"

        log_message(f"Extracted description: {description}")

        # Update session activity
        log_message("Calling session_tracker.update_activity...")
        session_tracker.update_activity(
            session_id=session_id,
            activity_type='tool_call',
            data={
                'tool': tool_name,
                'description': description,
                'project_path': input_data.get('cwd', 'Unknown')
            }
        )
        log_message("Successfully updated session activity")

        # Don't block execution
        log_message("Hook completed successfully\n")
        return 0

    except Exception as e:
        error_msg = f"Error in pre_tool_use hook: {e}"
        log_message(error_msg)
        print(error_msg, file=sys.stderr)
        return 0  # Don't block on errors


if __name__ == '__main__':
    sys.exit(main())
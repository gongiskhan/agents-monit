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
            f.write(f"[{timestamp}] [USER_PROMPT_SUBMIT] {message}\n")
    except Exception as e:
        print(f"Failed to write log: {e}", file=sys.stderr)


def main():
    """Handle user prompt submission - start of a task."""
    log_message("Hook called - starting execution")

    try:
        # Read input from stdin
        log_message("Reading input from stdin...")
        input_data = json.loads(sys.stdin.read())
        log_message(f"Received input data keys: {list(input_data.keys())}")

        # Extract key information (Claude Code uses snake_case)
        session_id = input_data.get('session_id', 'unknown')
        user_prompt = input_data.get('prompt', '')  # Direct 'prompt' field in Claude Code
        cwd = input_data.get('cwd', '')
        project_path = cwd  # Use cwd as project path

        log_message(f"Session ID: {session_id}")
        log_message(f"Project path: {project_path}")

        # Don't track empty prompts or commands
        if not user_prompt or user_prompt.startswith('/'):
            log_message("Skipping: empty prompt or command")
            return 0

        log_message(f"User prompt: {user_prompt[:100]}")

        # Start tracking this session
        log_message("Calling session_tracker.start_session...")
        session_data = session_tracker.start_session(
            session_id=session_id,
            user_prompt=user_prompt,
            project_path=project_path
        )

        log_message(f"Successfully started session: {session_data['project_name']}")
        print(f"📝 Started tracking session: {session_id}", file=sys.stderr)
        print(f"   Project: {session_data['project_name']}", file=sys.stderr)
        print(f"   Prompt: {user_prompt[:50]}{'...' if len(user_prompt) > 50 else ''}", file=sys.stderr)

        log_message("Hook completed successfully\n")
        return 0

    except Exception as e:
        error_msg = f"Error in user_prompt_submit hook: {e}"
        log_message(error_msg)
        print(error_msg, file=sys.stderr)
        return 0  # Don't block on errors


if __name__ == "__main__":
    sys.exit(main())
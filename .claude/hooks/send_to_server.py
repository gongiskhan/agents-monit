#!/usr/bin/env python3
"""
Send hook events to Agent Bro server

Usage in other hooks:
    import subprocess
    subprocess.run([
        'python3', '.claude/hooks/send_to_server.py',
        '--event-type', 'PreToolUse',
        '--payload', json.dumps(payload)
    ])
"""

import sys
import json
import argparse
import urllib.request
import urllib.error
from datetime import datetime

def send_event(event_type: str, payload: dict):
    """Send event to local Agent Bro server"""

    # Read full stdin data (hook payload)
    try:
        stdin_data = json.load(sys.stdin)
    except:
        stdin_data = {}

    event = {
        'hook_event_type': event_type,
        'timestamp': datetime.utcnow().isoformat() + 'Z',
        'payload': {**stdin_data, **payload},
        'session_id': stdin_data.get('session_id', 'unknown'),
        'source_app': 'claude-code'
    }

    try:
        data = json.dumps(event).encode('utf-8')
        req = urllib.request.Request(
            'http://localhost:3003/hook-event',
            data=data,
            headers={'Content-Type': 'application/json'},
            method='POST'
        )

        with urllib.request.urlopen(req, timeout=1) as response:
            if response.status != 200:
                print(f"Warning: Server returned status {response.status}",
                      file=sys.stderr)
    except urllib.error.URLError as e:
        # Fail silently - don't break Claude Code
        print(f"Warning: Could not send event to Agent Bro: {e}",
              file=sys.stderr)
    except Exception as e:
        print(f"Warning: Unexpected error sending event: {e}",
              file=sys.stderr)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--event-type', required=True)
    parser.add_argument('--payload', default='{}')
    args = parser.parse_args()

    payload = json.loads(args.payload)
    send_event(args.event_type, payload)

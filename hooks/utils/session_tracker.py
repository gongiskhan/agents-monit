#!/usr/bin/env python3
"""
Session tracker for Claude Code monitoring
Manages session data across hooks
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any

# Session storage location
SESSIONS_DIR = Path.home() / ".claude" / "active_sessions"
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)


def get_session_file(session_id: str) -> Path:
    """Get the path to a session's data file."""
    return SESSIONS_DIR / f"{session_id}.json"


def load_session(session_id: str) -> Optional[Dict[str, Any]]:
    """Load session data from disk."""
    session_file = get_session_file(session_id)
    if session_file.exists():
        try:
            with open(session_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading session {session_id}: {e}", file=sys.stderr)
    return None


def save_session(session_id: str, data: Dict[str, Any]) -> bool:
    """Save session data to disk."""
    try:
        session_file = get_session_file(session_id)
        with open(session_file, 'w') as f:
            json.dump(data, f, indent=2, default=str)
        return True
    except Exception as e:
        print(f"Error saving session {session_id}: {e}", file=sys.stderr)
        return False


def start_session(session_id: str, user_prompt: str, project_path: str) -> Dict[str, Any]:
    """Initialize a new session."""
    session_data = {
        'id': session_id,
        'project_path': project_path,
        'project_name': Path(project_path).name if project_path else 'Unknown',
        'user_prompt': user_prompt[:500],  # Limit prompt length for display
        'start_time': datetime.now().isoformat(),
        'last_activity': datetime.now().isoformat(),
        'status': 'active',
        'tool_calls': [],
        'messages': [],
        'final_response': None,
        'end_time': None
    }
    save_session(session_id, session_data)
    return session_data


def update_activity(session_id: str, activity_type: str, data: Dict[str, Any]) -> bool:
    """Update session with new activity."""
    session = load_session(session_id)
    if not session:
        # Session doesn't exist yet - create it with minimal info
        session = {
            'id': session_id,
            'project_path': data.get('project_path', 'Unknown'),
            'project_name': Path(data.get('project_path', 'Unknown')).name,
            'user_prompt': 'Session started mid-conversation',
            'start_time': datetime.now().isoformat(),
            'last_activity': datetime.now().isoformat(),
            'status': 'active',
            'tool_calls': [],
            'messages': [],
            'final_response': None,
            'end_time': None
        }

    session['last_activity'] = datetime.now().isoformat()

    if activity_type == 'tool_call':
        session['tool_calls'].append({
            'tool': data.get('tool'),
            'timestamp': datetime.now().isoformat(),
            'description': data.get('description', '')[:200]
        })
    elif activity_type == 'message':
        session['messages'].append({
            'role': data.get('role', 'system'),
            'content': data.get('content', '')[:500],
            'timestamp': datetime.now().isoformat()
        })

    # Check if session should be considered active or idle
    if session.get('tool_calls'):
        last_tool_time = datetime.fromisoformat(session['tool_calls'][-1]['timestamp'])
        time_since_last = (datetime.now() - last_tool_time).total_seconds()
        if time_since_last > 30:
            session['status'] = 'idle'
        else:
            session['status'] = 'active'

    return save_session(session_id, session)


def end_session(session_id: str, final_response: str = None) -> bool:
    """Mark a session as completed."""
    session = load_session(session_id)
    if not session:
        return False

    session['status'] = 'completed'
    session['end_time'] = datetime.now().isoformat()
    if final_response:
        session['final_response'] = final_response[:1000]  # Limit response length

    return save_session(session_id, session)


def get_active_sessions() -> list:
    """Get all active sessions."""
    sessions = []
    for session_file in SESSIONS_DIR.glob("*.json"):
        try:
            with open(session_file, 'r') as f:
                session = json.load(f)
                if session.get('status') in ['active', 'idle']:
                    sessions.append(session)
        except Exception:
            continue
    return sessions


def cleanup_old_sessions(days: int = 7) -> int:
    """Remove sessions older than specified days."""
    count = 0
    cutoff_time = datetime.now().timestamp() - (days * 86400)

    for session_file in SESSIONS_DIR.glob("*.json"):
        try:
            if session_file.stat().st_mtime < cutoff_time:
                session_file.unlink()
                count += 1
        except Exception:
            continue

    return count


def mark_idle_sessions() -> int:
    """Mark sessions as idle if no activity for 30 seconds."""
    count = 0
    for session_file in SESSIONS_DIR.glob("*.json"):
        try:
            with open(session_file, 'r') as f:
                session = json.load(f)

            if session.get('status') == 'active':
                last_activity = datetime.fromisoformat(session['last_activity'])
                if (datetime.now() - last_activity).total_seconds() > 30:
                    session['status'] = 'idle'
                    save_session(session['id'], session)
                    count += 1
        except Exception:
            continue

    return count


if __name__ == "__main__":
    # Test function
    print(f"Sessions directory: {SESSIONS_DIR}")
    print(f"Active sessions: {len(get_active_sessions())}")
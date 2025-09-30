#!/usr/bin/env python3
"""
Update Claude Code settings.json to include session tracking hooks.
This script safely adds hooks to the settings file without overwriting existing configuration.
"""

import json
import sys
from pathlib import Path
from typing import Dict, Any


def load_settings(settings_path: Path) -> Dict[str, Any]:
    """Load existing settings or return empty dict."""
    if settings_path.exists():
        try:
            with open(settings_path, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: Could not load settings: {e}", file=sys.stderr)
            return {}
    return {}


def save_settings(settings_path: Path, settings: Dict[str, Any]) -> bool:
    """Save settings to file with proper formatting."""
    try:
        settings_path.parent.mkdir(parents=True, exist_ok=True)
        with open(settings_path, 'w') as f:
            json.dump(settings, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving settings: {e}", file=sys.stderr)
        return False


def ensure_hooks_config(settings: Dict[str, Any]) -> bool:
    """Add session tracking hooks to settings if not present."""
    if 'hooks' not in settings:
        settings['hooks'] = {}

    hooks_config = settings['hooks']
    hooks_to_add = {
        'UserPromptSubmit': {
            'matcher': '',
            'hooks': [{
                'type': 'command',
                'command': 'uv run ~/.claude/hooks/user_prompt_submit.py'
            }]
        },
        'PreToolUse': {
            'matcher': '',
            'hooks': [{
                'type': 'command',
                'command': 'uv run ~/.claude/hooks/pre_tool_use.py'
            }]
        },
        'PostToolUse': {
            'matcher': '',
            'hooks': [{
                'type': 'command',
                'command': 'uv run ~/.claude/hooks/post_tool_use.py'
            }]
        },
        'SessionStart': {
            'matcher': '',
            'hooks': [{
                'type': 'command',
                'command': 'uv run ~/.claude/hooks/session_start.py'
            }]
        }
    }

    modified = False
    for hook_name, hook_config in hooks_to_add.items():
        if hook_name not in hooks_config:
            # Hook doesn't exist - add it
            hooks_config[hook_name] = [hook_config]
            print(f"✓ Added {hook_name} hook")
            modified = True
        else:
            # Hook exists - check if our command is already there
            existing_hooks = hooks_config[hook_name]
            if not isinstance(existing_hooks, list):
                existing_hooks = [existing_hooks]

            # Check if our command is already configured
            target_cmd = 'uv run ~/.claude/hooks/' + hook_name.lower().replace('tooluse', '_tool_use').replace('promptsubmit', '_prompt_submit') + '.py'
            if hook_name == 'UserPromptSubmit':
                target_cmd = 'uv run ~/.claude/hooks/user_prompt_submit.py'
            elif hook_name == 'PreToolUse':
                target_cmd = 'uv run ~/.claude/hooks/pre_tool_use.py'
            elif hook_name == 'PostToolUse':
                target_cmd = 'uv run ~/.claude/hooks/post_tool_use.py'
            elif hook_name == 'SessionStart':
                target_cmd = 'uv run ~/.claude/hooks/session_start.py'

            already_configured = False
            for matcher_config in existing_hooks:
                if isinstance(matcher_config, dict):
                    for hook in matcher_config.get('hooks', []):
                        if hook.get('command') == target_cmd:
                            already_configured = True
                            break

            if not already_configured:
                # Append our hook config
                existing_hooks.append(hook_config)
                hooks_config[hook_name] = existing_hooks
                print(f"✓ Appended to existing {hook_name} hook")
                modified = True
            else:
                print(f"  {hook_name} hook already configured")

    return modified


def main():
    """Main setup function."""
    settings_path = Path.home() / ".claude" / "settings.json"

    print(f"Updating Claude Code settings at: {settings_path}")
    print()

    # Load existing settings
    settings = load_settings(settings_path)

    # Add hooks configuration
    modified = ensure_hooks_config(settings)

    if modified:
        # Save updated settings
        if save_settings(settings_path, settings):
            print()
            print("✓ Settings updated successfully!")
            return 0
        else:
            print()
            print("✗ Failed to save settings")
            return 1
    else:
        print()
        print("✓ All hooks already configured, no changes needed")
        return 0


if __name__ == "__main__":
    sys.exit(main())

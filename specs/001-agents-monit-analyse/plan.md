# Implementation Plan: Claude Code Session Monitor

**Feature Branch**: `001-agents-monit-analyse`
**Created**: 2025-01-27
**Spec**: `/specs/001-agents-monit-analyse/spec.md`

## Executive Summary

Build a Rust-based desktop application using Tauri to monitor all Claude Code sessions running on the machine. The app will track session activity across CLI, IDE extensions, and desktop apps by monitoring JSONL files in `~/.claude/projects/`, display real-time status updates, send notifications when tasks complete, and provide window focus switching capabilities.

## Technical Architecture

### Core Technologies
- **Backend**: Rust 1.75+
- **UI Framework**: Tauri 2.0
- **Frontend**: React with TypeScript
- **File Watching**: notify-rs crate
- **JSON Parsing**: serde_json
- **Async Runtime**: tokio
- **Notifications**: tauri-plugin-notification

### Project Structure
```
agents-monit/
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── main.rs         # Tauri app entry
│   │   ├── monitor.rs      # File monitoring logic
│   │   ├── parser.rs       # JSONL parser
│   │   ├── session.rs      # Session management
│   │   ├── window.rs       # Window focus handling
│   │   └── config.rs       # Configuration
│   └── Cargo.toml
├── src/                    # React frontend
│   ├── components/
│   │   ├── SessionList.tsx
│   │   ├── SessionCard.tsx
│   │   ├── NotificationSettings.tsx
│   │   └── StatusIndicator.tsx
│   ├── hooks/
│   │   └── useSessionData.ts
│   ├── types/
│   │   └── session.ts
│   ├── App.tsx
│   └── main.tsx
├── package.json
└── tauri.conf.json
```

## Implementation Phases

### Phase 1: Project Setup & Core Infrastructure

#### 1.1 Initialize Tauri Project
```bash
# Create new Tauri app
npm create tauri-app@latest agents-monit -- \
  --template react-ts \
  --manager npm

cd agents-monit

# Add Rust dependencies
cd src-tauri
cargo add tokio --features full
cargo add notify
cargo add serde_json
cargo add serde --features derive
cargo add chrono
cargo add anyhow
cargo add dirs
```

#### 1.2 Set Up Core Data Structures
```rust
// src-tauri/src/session.rs
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub id: String,
    pub project_name: String,
    pub project_path: String,
    pub status: SessionStatus,
    pub last_activity: DateTime<Utc>,
    pub latest_message: Option<Message>,
    pub file_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SessionStatus {
    Active,
    Idle,
    Stopped,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub content: String,
    pub timestamp: DateTime<Utc>,
    pub msg_type: MessageType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MessageType {
    User,
    Assistant,
    System,
}
```

### Phase 2: File System Monitoring

#### 2.1 Implement File Watcher
```rust
// src-tauri/src/monitor.rs
use notify::{Watcher, RecursiveMode, Result};
use std::path::Path;
use std::sync::mpsc::channel;
use std::time::Duration;

pub struct SessionMonitor {
    watcher: Box<dyn Watcher>,
    sessions: HashMap<String, Session>,
}

impl SessionMonitor {
    pub fn new() -> Result<Self> {
        let (tx, rx) = channel();
        let mut watcher = notify::recommended_watcher(tx)?;

        // Watch Claude projects directory
        let claude_dir = dirs::home_dir()
            .unwrap()
            .join(".claude")
            .join("projects");

        watcher.watch(&claude_dir, RecursiveMode::Recursive)?;

        Ok(Self {
            watcher: Box::new(watcher),
            sessions: HashMap::new(),
        })
    }

    pub fn start_monitoring(&mut self) {
        // Process file change events
        // Update session statuses
        // Check for inactive sessions (30+ seconds)
    }
}
```

#### 2.2 JSONL Parser Implementation
```rust
// src-tauri/src/parser.rs
use serde_json::Value;
use std::fs::File;
use std::io::{BufRead, BufReader};

pub fn parse_jsonl_line(line: &str) -> Result<SessionEntry> {
    let value: Value = serde_json::from_str(line)?;

    Ok(SessionEntry {
        timestamp: value["timestamp"].as_str()
            .and_then(|s| DateTime::parse_from_rfc3339(s).ok()),
        message_type: value["type"].as_str()
            .unwrap_or("unknown")
            .to_string(),
        content: extract_message_content(&value),
        session_id: value["sessionId"].as_str()
            .unwrap_or("")
            .to_string(),
    })
}

pub fn get_latest_entries(file_path: &Path, count: usize) -> Result<Vec<SessionEntry>> {
    let file = File::open(file_path)?;
    let reader = BufReader::new(file);
    let lines: Vec<String> = reader.lines()
        .filter_map(|l| l.ok())
        .collect();

    // Get last N lines
    let recent = lines.iter()
        .rev()
        .take(count)
        .map(|line| parse_jsonl_line(line))
        .collect();

    recent
}
```

### Phase 3: Session Management

#### 3.1 Activity Detection Logic
```rust
// src-tauri/src/session.rs
impl Session {
    pub fn update_status(&mut self) {
        let now = Utc::now();
        let duration = now - self.last_activity;

        self.status = if duration.num_seconds() < 30 {
            SessionStatus::Active
        } else if duration.num_seconds() < 300 {
            SessionStatus::Idle
        } else {
            SessionStatus::Stopped
        };
    }

    pub fn extract_project_name(path: &str) -> String {
        // Extract from path like "-Users-ggomes-dev-project-name"
        path.replace("-", "/")
            .split('/')
            .last()
            .unwrap_or("Unknown")
            .to_string()
    }
}
```

### Phase 4: Tauri Integration & API

#### 4.1 Tauri Commands
```rust
// src-tauri/src/main.rs
use tauri::{Manager, State};

#[tauri::command]
async fn get_sessions(monitor: State<'_, Arc<Mutex<SessionMonitor>>>) -> Result<Vec<Session>> {
    let monitor = monitor.lock().unwrap();
    Ok(monitor.get_all_sessions())
}

#[tauri::command]
async fn focus_window(session_id: String) -> Result<()> {
    // Platform-specific window focus implementation
    #[cfg(target_os = "macos")]
    {
        use std::process::Command;
        // Use AppleScript or open command
        Command::new("open")
            .arg("-a")
            .arg("Terminal") // or detected app
            .spawn()?;
    }
    Ok(())
}

#[tauri::command]
async fn refresh_sessions(monitor: State<'_, Arc<Mutex<SessionMonitor>>>) -> Result<()> {
    let mut monitor = monitor.lock().unwrap();
    monitor.refresh_all_sessions()?;
    Ok(())
}
```

### Phase 5: Frontend UI Implementation

#### 5.1 React Components
```tsx
// src/components/SessionList.tsx
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import SessionCard from './SessionCard';

export default function SessionList() {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const data = await invoke<Session[]>('get_sessions');
      setSessions(data);
    }, 1000); // Refresh every second

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="session-list">
      {sessions.map(session => (
        <SessionCard key={session.id} session={session} />
      ))}
    </div>
  );
}
```

```tsx
// src/components/SessionCard.tsx
interface SessionCardProps {
  session: Session;
}

export default function SessionCard({ session }: SessionCardProps) {
  const handleFocus = async () => {
    await invoke('focus_window', { sessionId: session.id });
  };

  return (
    <div className={`session-card ${session.status.toLowerCase()}`}>
      <h3>{session.project_name}</h3>
      <StatusIndicator status={session.status} />
      <p className="latest-message">{session.latest_message?.content}</p>
      <button onClick={handleFocus}>Focus Window</button>
    </div>
  );
}
```

### Phase 6: Notifications

#### 6.1 Notification System
```rust
// src-tauri/src/notifications.rs
use tauri::api::notification::Notification;

pub fn send_task_complete_notification(session: &Session) {
    Notification::new("com.agents.monit")
        .title("Task Completed")
        .body(&format!("Session in {} has completed", session.project_name))
        .show()
        .unwrap();
}
```

## Testing Strategy

### Unit Tests
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_jsonl_parsing() {
        let line = r#"{"timestamp":"2025-01-27T10:00:00Z","type":"user","content":"test"}"#;
        let result = parse_jsonl_line(line);
        assert!(result.is_ok());
    }

    #[test]
    fn test_session_status_detection() {
        let mut session = Session::new();
        session.last_activity = Utc::now() - Duration::seconds(45);
        session.update_status();
        assert_eq!(session.status, SessionStatus::Idle);
    }
}
```

### Integration Tests
- Test file watching with mock JSONL files
- Test notification delivery
- Test UI updates with mock data

## Build & Deployment

### Development
```bash
# Install dependencies
npm install
cd src-tauri && cargo build

# Run in development mode
npm run tauri dev
```

### Production Build
```bash
# Build for current platform
npm run tauri build

# Output will be in src-tauri/target/release/bundle/
```

## Configuration

### Default Settings
```json
{
  "monitoring": {
    "refresh_interval": 1000,
    "inactivity_timeout": 30000,
    "notification_enabled": true,
    "system_tray": true
  },
  "ui": {
    "theme": "auto",
    "compact_mode": false
  }
}
```

## Estimated Timeline

- **Phase 1 (Setup)**: 2-3 hours
- **Phase 2 (File Monitoring)**: 4-6 hours
- **Phase 3 (Session Management)**: 3-4 hours
- **Phase 4 (Tauri Integration)**: 3-4 hours
- **Phase 5 (UI)**: 6-8 hours
- **Phase 6 (Notifications)**: 2-3 hours
- **Testing & Polish**: 4-6 hours

**Total**: 24-34 hours (3-4 days)

## Success Criteria

1. ✅ All Claude Code sessions detected and displayed
2. ✅ Real-time status updates (Active/Idle/Stopped)
3. ✅ Latest message from each session visible
4. ✅ Notifications when tasks complete
5. ✅ Window focus functionality (with platform limitations)
6. ✅ Resource-efficient monitoring
7. ✅ Clean, intuitive UI
8. ✅ Configurable settings

## Next Steps

1. Review and approve this implementation plan
2. Set up the development environment
3. Begin Phase 1 implementation
4. Iterate based on testing and feedback
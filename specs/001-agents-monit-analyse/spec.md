# Feature Specification: Claude Code Session Monitor

**Feature Branch**: `001-agents-monit-analyse`  
**Created**: 2025-01-27  
**Status**: Draft  
**Input**: User description: "Monitor all Claude Code sessions running on machine across CLI, IDE extensions, and desktop apps"

---

## Clarifications

### Session 2025-01-27
- Q: When should a Claude Code session be marked as "inactive" versus "stopped"? → A: Only two states: Active (< 30 seconds) and Stopped (≥ 30 seconds)
- Q: How frequently should the monitor check for session updates? → A: Every 2 seconds (moderate)
- Q: What's the maximum number of concurrent Claude Code sessions the monitor should handle? → A: 25 sessions (moderate usage)
- Q: Should the monitor retain historical data about past sessions after application restart? → A: Keep full history with user-controlled cleanup
- Q: Should the application support system tray mode for background monitoring? → A: System tray optional - can minimize to tray

## User Scenarios & Testing

### Primary User Story
As a developer using multiple Claude Code interfaces simultaneously, I need a centralized dashboard to monitor all active Claude Code sessions across different tools (CLI, IDE extensions, desktop apps) so that I can track which tasks are running, see their current status, receive notifications when tasks complete, and quickly switch focus to any active session window.

### Acceptance Scenarios
1. **Given** multiple Claude Code sessions are running, **When** the user opens the monitor, **Then** all active sessions are displayed with project names and current status
2. **Given** a Claude Code session has been inactive for 30 seconds, **When** the monitor checks status, **Then** the session is marked as "stopped"
3. **Given** a task completes in any Claude Code session, **When** the completion is detected, **Then** the user receives a notification
4. **Given** the monitor displays an active session, **When** the user clicks the focus button, **Then** the corresponding window/application gains focus
5. **Given** a Claude Code session is active, **When** new messages are added, **Then** the latest message content is displayed in the monitor

### Edge Cases
- What happens when Claude Code configuration folder is missing or inaccessible?
- How does system handle corrupted or malformed JSONL files?
- What occurs when multiple sessions share the same project directory?
- How does the monitor behave when a session file is deleted while monitoring?
- What happens if window focus cannot be achieved due to permissions?

## Requirements

### Functional Requirements
- **FR-001**: System MUST monitor all Claude Code session files in the configuration directory
- **FR-002**: System MUST display all detected sessions with their associated project names prominently
- **FR-003**: System MUST determine session activity status based on file modification timestamps
- **FR-004**: System MUST mark sessions as stopped after 30 seconds of inactivity (two-state model: active/stopped)
- **FR-005**: System MUST parse JSONL files to extract and display the latest message from each session
- **FR-006**: System MUST send notifications when a session transitions from active to stopped state
- **FR-007**: System MUST provide an action to focus/switch to the window running a specific session
- **FR-008**: System MUST update session status in real-time or near real-time
- **FR-009**: System MUST handle multiple session types (CLI, IDE extensions, desktop apps) uniformly
- **FR-010**: System MUST persist full session history across application restarts with user-controlled cleanup options
- **FR-011**: System MUST support minimize-to-system-tray functionality with background monitoring continuing while minimized

### Non-Functional Requirements
- **NFR-001**: System MUST update session status every 2 seconds
- **NFR-002**: System MUST handle monitoring of up to 25 concurrent sessions
- **NFR-003**: Notifications MUST appear within [NEEDS CLARIFICATION: notification delay tolerance - immediate, within 5 seconds?]
- **NFR-004**: System MUST consume minimal system resources while monitoring

### Key Entities
- **Session**: Represents a single Claude Code instance with attributes like session ID, project path, status (active/stopped), last activity timestamp, latest message content, and historical state transitions
- **Project**: Represents the working directory associated with a session, including project name and full path
- **Message**: Represents the latest interaction in a session, containing message content, timestamp, and type (user/assistant/system)
- **Notification**: Represents an alert to the user about session state changes, including session identifier and transition type
- **History**: Persistent storage of session data including timestamps, state transitions, and message counts, with user-controlled retention and cleanup options

---

## Additional Considerations

### Data Sources
- Primary data source is the `.claude/projects/` directory containing JSONL session files
- Session files follow pattern: `[project-path]/[session-uuid].jsonl`
- Each JSONL line contains timestamped message data

### User Interface Requirements
- Dashboard view showing all monitored sessions
- Visual distinction between active and stopped sessions
- Project names displayed prominently for each session
- Latest message preview for each session
- Quick action buttons for window focus
- [NEEDS CLARIFICATION: Should there be filtering/sorting capabilities?]
- System tray icon with minimize-to-tray option for background monitoring

### Integration Points
- File system monitoring for detecting new sessions and changes
- Operating system window management for focus switching
- System notification service for alerts
- [NEEDS CLARIFICATION: Should it integrate with Claude Code SDK if available?]

---

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain (7 items need clarification)
- [x] Requirements are testable and unambiguous (where specified)
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

### Resolved Clarifications
1. **Inactivity timeout**: ✅ 30-second threshold with two states (active/stopped)
2. **Session history**: ✅ Full history with user-controlled cleanup
3. **Refresh interval**: ✅ Update every 2 seconds
4. **Scale limits**: ✅ Support up to 25 concurrent sessions
5. **System tray**: ✅ Optional minimize-to-tray functionality

### Remaining Clarifications
6. **Notification timing**: Acceptable delay for notifications?
7. **UI features**: Need for filtering and sorting capabilities?
8. **SDK integration**: Should the tool leverage Claude Code SDK if available?

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [ ] Review checklist passed (pending clarifications)
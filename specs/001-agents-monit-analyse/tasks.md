# Tasks: Claude Code Session Monitor

**Input**: Design documents from `/specs/001-agents-monit-analyse/`
**Prerequisites**: plan.md (required)

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Rust Backend**: `src-tauri/src/`
- **React Frontend**: `src/`
- **Tests**: `src-tauri/tests/`, `src/__tests__/`

## Phase 3.1: Setup
- [ ] T001 Initialize Tauri project with React TypeScript template using `npm create tauri-app@latest`
- [ ] T002 Configure Rust dependencies in src-tauri/Cargo.toml (tokio, notify, serde_json, serde, chrono, anyhow, dirs)
- [ ] T003 [P] Configure frontend dependencies in package.json (@tauri-apps/api, React hooks)
- [ ] T004 [P] Set up project structure creating directories: src-tauri/src/, src/components/, src/hooks/, src/types/
- [ ] T005 [P] Configure Tauri app settings in tauri.conf.json

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**
- [ ] T006 [P] Unit test for JSONL parsing in src-tauri/tests/parser_test.rs
- [ ] T007 [P] Unit test for session status detection in src-tauri/tests/session_test.rs
- [ ] T008 [P] Unit test for file watcher initialization in src-tauri/tests/monitor_test.rs
- [ ] T009 [P] Integration test for session discovery in src-tauri/tests/integration_test.rs
- [ ] T010 [P] Frontend test for SessionList component in src/__tests__/SessionList.test.tsx
- [ ] T011 [P] Frontend test for SessionCard component in src/__tests__/SessionCard.test.tsx

## Phase 3.3: Core Implementation - Rust Backend (ONLY after tests are failing)
- [ ] T012 [P] Implement Session data structures in src-tauri/src/session.rs
- [ ] T013 [P] Implement JSONL parser module in src-tauri/src/parser.rs
- [ ] T014 [P] Implement file system monitor in src-tauri/src/monitor.rs
- [ ] T015 [P] Implement window focus handler in src-tauri/src/window.rs
- [ ] T016 [P] Implement configuration module in src-tauri/src/config.rs
- [ ] T017 [P] Implement notification module in src-tauri/src/notifications.rs
- [ ] T018 Implement Tauri commands and state management in src-tauri/src/main.rs

## Phase 3.4: Core Implementation - React Frontend
- [ ] T019 [P] Create TypeScript types for Session data in src/types/session.ts
- [ ] T020 [P] Create useSessionData custom hook in src/hooks/useSessionData.ts
- [ ] T021 [P] Implement SessionList component in src/components/SessionList.tsx
- [ ] T022 [P] Implement SessionCard component in src/components/SessionCard.tsx
- [ ] T023 [P] Implement StatusIndicator component in src/components/StatusIndicator.tsx
- [ ] T024 [P] Implement NotificationSettings component in src/components/NotificationSettings.tsx
- [ ] T025 Implement main App component with routing in src/App.tsx
- [ ] T026 Configure main entry point in src/main.tsx

## Phase 3.5: Integration
- [ ] T027 Wire Tauri backend commands to frontend hooks
- [ ] T028 Implement real-time session monitoring with 1-second refresh
- [ ] T029 Connect notification system to session state changes
- [ ] T030 Implement window focus functionality with platform-specific handlers
- [ ] T031 Add error handling and recovery for file system errors
- [ ] T032 Implement configuration persistence and loading

## Phase 3.6: Polish
- [ ] T033 [P] Add CSS styling for session cards and status indicators
- [ ] T034 [P] Implement dark/light theme support
- [ ] T035 [P] Add system tray icon and menu
- [ ] T036 [P] Write user documentation in README.md
- [ ] T037 [P] Add performance monitoring and optimization
- [ ] T038 Run full integration test suite
- [ ] T039 Build production bundles for macOS, Windows, Linux

## Dependencies
- Setup (T001-T005) must complete first
- Tests (T006-T011) before implementation (T012-T026)
- T012 (Session structures) blocks T013, T014
- T018 (main.rs) depends on T012-T017
- T025 (App.tsx) depends on T019-T024
- Integration (T027-T032) requires both backend and frontend complete
- Polish (T033-T039) comes last

## Parallel Execution Examples

### Setup Phase (T003-T005):
```bash
# Can run these simultaneously:
Task: "Configure frontend dependencies in package.json"
Task: "Set up project structure creating directories"
Task: "Configure Tauri app settings in tauri.conf.json"
```

### Test Phase (T006-T011):
```bash
# All tests can run in parallel:
Task: "Unit test for JSONL parsing in src-tauri/tests/parser_test.rs"
Task: "Unit test for session status detection in src-tauri/tests/session_test.rs"
Task: "Unit test for file watcher initialization in src-tauri/tests/monitor_test.rs"
Task: "Integration test for session discovery in src-tauri/tests/integration_test.rs"
Task: "Frontend test for SessionList component in src/__tests__/SessionList.test.tsx"
Task: "Frontend test for SessionCard component in src/__tests__/SessionCard.test.tsx"
```

### Backend Implementation (T012-T017):
```bash
# All backend modules can be developed in parallel:
Task: "Implement Session data structures in src-tauri/src/session.rs"
Task: "Implement JSONL parser module in src-tauri/src/parser.rs"
Task: "Implement file system monitor in src-tauri/src/monitor.rs"
Task: "Implement window focus handler in src-tauri/src/window.rs"
Task: "Implement configuration module in src-tauri/src/config.rs"
Task: "Implement notification module in src-tauri/src/notifications.rs"
```

### Frontend Implementation (T019-T024):
```bash
# All frontend components can be developed in parallel:
Task: "Create TypeScript types for Session data in src/types/session.ts"
Task: "Create useSessionData custom hook in src/hooks/useSessionData.ts"
Task: "Implement SessionList component in src/components/SessionList.tsx"
Task: "Implement SessionCard component in src/components/SessionCard.tsx"
Task: "Implement StatusIndicator component in src/components/StatusIndicator.tsx"
Task: "Implement NotificationSettings component in src/components/NotificationSettings.tsx"
```

## Notes
- [P] tasks = different files, no shared dependencies
- Verify all tests fail before implementing
- Commit after each task completion
- Use Rust 1.75+ and Tauri 2.0
- Follow TDD strictly - tests must fail first

## Key Implementation Details

### File Monitoring
- Watch `~/.claude/projects/` directory recursively
- Parse JSONL files for session data
- Track modification timestamps for activity detection

### Session Management
- 30-second timeout for marking sessions as inactive
- Extract project names from directory paths
- Parse latest messages from JSONL entries

### Window Focus
- Platform-specific implementation required
- macOS: Use AppleScript or `open` command
- Windows: Use Windows API
- Linux: Use xdotool or wmctrl

### Notifications
- Use tauri-plugin-notification
- Trigger on session state transitions
- Configurable notification preferences

## Validation Checklist
- [x] All modules have corresponding test tasks
- [x] All tests come before implementation
- [x] Parallel tasks work on independent files
- [x] Each task specifies exact file paths
- [x] No parallel tasks modify the same file
- [x] Dependencies are clearly defined
- [x] TDD approach is enforced
#!/usr/bin/env node
/**
 * Codex Notify Handler
 *
 * Receives events from Codex CLI via the `notify` config option.
 * Writes events to a JSONL file that the Electron app monitors.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Event log file location
const EVENT_LOG = path.join(os.homedir(), '.codex-monitor', 'events.jsonl');

function main() {
  if (process.argv.length !== 3) {
    console.error('Usage: handler.js <NOTIFICATION_JSON>');
    process.exit(1);
  }

  let notification;
  try {
    notification = JSON.parse(process.argv[2]);
  } catch (error) {
    console.error('Failed to parse notification JSON:', error.message);
    process.exit(1);
  }

  // Add timestamp to event
  const event = {
    ...notification,
    timestamp: new Date().toISOString(),
    pid: process.ppid // Parent process ID (the Codex process)
  };

  // Ensure log directory exists
  const logDir = path.dirname(EVENT_LOG);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Append event to JSONL file
  try {
    fs.appendFileSync(EVENT_LOG, JSON.stringify(event) + '\n', 'utf8');

    // Also log to stderr for debugging (won't interfere with Codex)
    console.error(`[Codex Monitor] Event recorded: ${event.type} (turn: ${event['turn-id'] || 'N/A'})`);
  } catch (error) {
    console.error('Failed to write event:', error.message);
    process.exit(1);
  }

  process.exit(0);
}

if (require.main === module) {
  main();
}

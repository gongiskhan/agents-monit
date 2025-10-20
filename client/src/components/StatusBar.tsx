/**
 * Status Bar Component
 * Displays connection status and basic info
 */

import React from 'react';

interface StatusBarProps {
  connected: boolean;
  eventCount: number;
  sessionCount: number;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  connected,
  eventCount,
  sessionCount,
}) => {
  return (
    <div className="status-bar">
      <div className="status-bar-section">
        <span className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
          {connected ? '🟢' : '🔴'}
        </span>
        <span className="status-text">
          {connected ? 'Connected' : 'Disconnected'}
        </span>
      </div>

      <div className="status-bar-section">
        <span className="status-label">Sessions:</span>
        <span className="status-value">{sessionCount}</span>
      </div>

      <div className="status-bar-section">
        <span className="status-label">Events:</span>
        <span className="status-value">{eventCount}</span>
      </div>

      <div className="status-bar-section status-bar-version">
        <span className="status-text">Agent Bro v1.0.0</span>
      </div>
    </div>
  );
};

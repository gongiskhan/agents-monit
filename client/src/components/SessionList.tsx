/**
 * Session List Component
 * Displays list of Claude Code sessions
 */

import React, { useEffect, useState } from 'react';
import { SessionMetadata } from '../types/events';
import { apiClient } from '../services/api';

interface SessionListProps {
  onSessionSelect?: (sessionId: string) => void;
  selectedSessionId?: string;
}

export const SessionList: React.FC<SessionListProps> = ({
  onSessionSelect,
  selectedSessionId,
}) => {
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'running' | 'completed'>('all');

  const fetchSessions = async () => {
    try {
      const { sessions: fetchedSessions } = await apiClient.listSessions();
      setSessions(fetchedSessions);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();

    // Poll for updates every 5 seconds
    const interval = setInterval(fetchSessions, 5000);

    return () => clearInterval(interval);
  }, []);

  const filteredSessions = sessions.filter((session) => {
    if (filter === 'all') return true;
    if (filter === 'running') return session.status === 'running';
    if (filter === 'completed') return session.status === 'completed';
    return true;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return '🟢';
      case 'completed':
        return '✅';
      case 'error':
        return '❌';
      case 'interrupted':
        return '⏸️';
      default:
        return '⚪';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="session-list">
        <div className="session-list-loading">Loading sessions...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="session-list">
        <div className="session-list-error">
          <p>Error: {error}</p>
          <button onClick={fetchSessions} className="btn btn-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="session-list">
      <div className="session-list-header">
        <h2>Sessions</h2>
        <button onClick={fetchSessions} className="btn btn-sm btn-refresh">
          ↻
        </button>
      </div>

      <div className="session-list-filters">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({sessions.length})
        </button>
        <button
          className={`filter-btn ${filter === 'running' ? 'active' : ''}`}
          onClick={() => setFilter('running')}
        >
          Running ({sessions.filter((s) => s.status === 'running').length})
        </button>
        <button
          className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
          onClick={() => setFilter('completed')}
        >
          Completed ({sessions.filter((s) => s.status === 'completed').length})
        </button>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="session-list-empty">
          <p>No sessions found</p>
          <small>Execute a command to create a session</small>
        </div>
      ) : (
        <div className="session-list-items">
          {filteredSessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${selectedSessionId === session.id ? 'selected' : ''}`}
              onClick={() => onSessionSelect?.(session.id)}
            >
              <div className="session-item-header">
                <span className="session-status-icon">{getStatusIcon(session.status)}</span>
                <span className="session-status-text">{session.status}</span>
                <span className="session-timestamp">{formatTimestamp(session.startTime)}</span>
              </div>

              <div className="session-item-prompt">
                {session.firstPrompt ? (
                  <p>{session.firstPrompt.substring(0, 100)}{session.firstPrompt.length > 100 ? '...' : ''}</p>
                ) : (
                  <p className="session-no-prompt">No prompt</p>
                )}
              </div>

              <div className="session-item-footer">
                <span className="session-project">
                  {session.projectPath ? session.projectPath.split('/').pop() : 'Unknown'}
                </span>
                <span className="session-events">
                  {session.eventCount + session.hookEventCount} events
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

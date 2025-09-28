import React, { useEffect, useState } from 'react';
import { invoke, listen } from '../api/electronAPI';
import { Session } from '../types/session';
import { SessionCard } from './SessionCard';

export const SessionList: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async () => {
    try {
      const data = await invoke<Session[]>('get_sessions');
      setSessions(data);
      setError(null);
    } catch (err) {
      setError('Error loading sessions');
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchSessions();

    // Set up event listener for updates from backend
    const unlisten = listen<Session[]>('sessions_updated', (event) => {
      setSessions(event.payload);
    });

    // Set up polling interval (fallback for events)
    const interval = setInterval(fetchSessions, 2000);

    // Cleanup
    return () => {
      unlisten.then(fn => fn());
      clearInterval(interval);
    };
  }, []);

  // Sort sessions by last activity (most recent first)
  const sortedSessions = [...sessions].sort((a, b) => {
    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
  });

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner" />
        <p>Loading sessions...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="error-message">{error}</p>
        <button onClick={fetchSessions} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📋</div>
        <h2>No active sessions</h2>
        <p>Claude Code sessions will appear here when they're running</p>
      </div>
    );
  }

  return (
    <div className="session-list">
      <div className="session-list-header">
        <h2>Claude Code Sessions</h2>
        <span className="session-count">
          {sessions.length} session{sessions.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="session-grid">
        {sortedSessions.map(session => (
          <SessionCard key={session.id} session={session} />
        ))}
      </div>
    </div>
  );
};
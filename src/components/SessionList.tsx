import React, { useEffect, useState } from 'react';
import { invoke, listen } from '../api/electronAPI';
import { Session } from '../types/session';
import { SessionCard } from './SessionCard';

export const SessionList: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async (isInitialLoad = false) => {
    try {
      const data = await invoke<Session[]>('get-sessions');
      // Ensure data is an array before setting it
      if (Array.isArray(data)) {
        setSessions(data);
      } else {
        console.warn('Received non-array data from get_sessions:', data);
        setSessions([]);
      }
      setError(null);
    } catch (err) {
      setError('Error loading sessions');
      console.error('Failed to fetch sessions:', err);
    } finally {
      if (isInitialLoad) {
        setLoading(false);
        setHasLoaded(true);
      }
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchSessions(true);

    // Set up event listener for updates from backend
    const unlisten = listen<Session[]>('sessions-updated', (event) => {
      // Ensure payload is an array before setting it
      if (Array.isArray(event.payload)) {
        setSessions(event.payload);
        setHasLoaded(true);
      } else {
        console.warn('Received non-array data from sessions_updated:', event.payload);
        setSessions([]);
      }
    });

    // Set up polling interval (fallback for events)
    const interval = setInterval(() => fetchSessions(false), 2000);

    // Cleanup
    return () => {
      unlisten.then(fn => fn());
      clearInterval(interval);
    };
  }, []);

  // Sort sessions by last activity (most recent first)
  const sortedSessions = Array.isArray(sessions)
    ? [...sessions].sort((a, b) => {
        return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
      })
    : [];

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
        <button onClick={() => fetchSessions(true)} className="retry-button">
          Retry
        </button>
      </div>
    );
  }

  if (hasLoaded && sessions.length === 0) {
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
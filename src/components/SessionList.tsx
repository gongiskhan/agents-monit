import React, { useEffect, useState } from 'react';
import { invoke, listen } from '../api/electronAPI';
import { Session } from '../types/session';
import { SessionCard } from './SessionCard';

export const SessionList: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = async (isInitialLoad = false) => {
    try {
      const data = await invoke<Session[]>('get-sessions');
      // Ensure data is an array before setting it
      if (Array.isArray(data)) {
        // Only update sessions if we got valid data
        if (data.length > 0 || isInitialLoad) {
          setSessions(data);
          console.log('Fetched sessions:', data.length, 'Active:', data.filter(s => s.status === 'active').length);
        }
      } else {
        console.warn('Received non-array data from get_sessions:', data);
        if (isInitialLoad) {
          setSessions([]);
        }
      }
      setError(null);
    } catch (err) {
      setError('Error loading sessions');
      console.error('Failed to fetch sessions:', err);
    } finally {
      if (isInitialLoad) {
        setLoading(false);
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
        console.log('Event updated sessions:', event.payload.length, 'Active:', event.payload.filter(s => s.status === 'active').length);
      } else {
        console.warn('Received non-array data from sessions_updated:', event.payload);
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

  // Stable sort: Active sessions first (by first seen), then inactive (by first seen)
  // This prevents tiles from jumping around as activity updates
  const sortedSessions = Array.isArray(sessions)
    ? [...sessions].sort((a, b) => {
        // First, group by status (active first)
        if (a.status !== b.status) {
          return a.status === 'active' ? -1 : 1;
        }

        // Within same status, sort by start time (oldest first for stability)
        // This keeps tiles in a fixed position unless status changes
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
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

  if (!loading && sessions.length === 0) {
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
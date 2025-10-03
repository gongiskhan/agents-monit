import React, { useEffect, useState } from 'react';
import { invoke, listen } from '../api/electronAPI';
import { Session } from '../types/session';
import { SessionCard } from './SessionCard';

export const SessionList: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hiddenSessionIds, setHiddenSessionIds] = useState<Set<string>>(() => {
    // Load hidden sessions from localStorage
    const stored = localStorage.getItem('hiddenSessions');
    return stored ? new Set(JSON.parse(stored)) : new Set();
  });

  // Save hidden sessions to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('hiddenSessions', JSON.stringify(Array.from(hiddenSessionIds)));
  }, [hiddenSessionIds]);

  // Auto-unhide sessions when they become active
  useEffect(() => {
    if (!Array.isArray(sessions)) return;

    const activeSessions = sessions.filter(s => s.status === 'active');
    const shouldUpdate = activeSessions.some(s => hiddenSessionIds.has(s.id));

    if (shouldUpdate) {
      setHiddenSessionIds(prev => {
        const newSet = new Set(prev);
        activeSessions.forEach(s => newSet.delete(s.id));
        return newSet;
      });
    }
  }, [sessions, hiddenSessionIds]);

  const handleHideSession = (sessionId: string) => {
    setHiddenSessionIds(prev => new Set(prev).add(sessionId));
  };

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

  // Filter out hidden inactive sessions, then stable sort
  const visibleSessions = Array.isArray(sessions)
    ? sessions.filter(session => {
        // Hide sessions that are both stopped AND in the hidden set
        return !(session.status === 'stopped' && hiddenSessionIds.has(session.id));
      })
    : [];

  // Stable sort: Active sessions first (by first seen), then inactive (by first seen)
  // This prevents tiles from jumping around as activity updates
  const sortedSessions = [...visibleSessions].sort((a, b) => {
    // First, group by status (active first)
    if (a.status !== b.status) {
      return a.status === 'active' ? -1 : 1;
    }

    // Within same status, sort by start time (oldest first for stability)
    // This keeps tiles in a fixed position unless status changes
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
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
          <SessionCard
            key={session.id}
            session={session}
            onHide={handleHideSession}
          />
        ))}
      </div>
    </div>
  );
};
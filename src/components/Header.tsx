import React, { useState, useEffect } from 'react';
import { invoke } from '../api/electronAPI';
import { Session, SessionStatus } from '../types/session';

export const Header: React.FC = () => {
  const [activeSessions, setActiveSessions] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);

  const updateSessionCounts = async () => {
    try {
      const sessions = await invoke<Session[]>('get_sessions');
      const active = sessions.filter(s => s.status === SessionStatus.Active).length;
      setActiveSessions(active);
      setTotalSessions(sessions.length);
    } catch (error) {
      console.error('Failed to update session counts:', error);
    }
  };

  useEffect(() => {
    updateSessionCounts();
    const interval = setInterval(updateSessionCounts, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    try {
      await invoke('refresh_sessions');
      await updateSessionCounts();
    } catch (error) {
      console.error('Failed to refresh sessions:', error);
    }
  };

  return (
    <header className="app-header draggable">
      <div className="header-content">
        <div className="header-title">
          <h1>Claude Code Monitor</h1>
          <div className="status-badges non-draggable">
            <span className="badge badge-active">
              {activeSessions} Active
            </span>
            <span className="badge badge-total">
              {totalSessions} Total
            </span>
          </div>
        </div>
        <div className="header-actions non-draggable">
          <button
            className="refresh-button"
            onClick={handleRefresh}
            aria-label="Refresh sessions"
          >
            🔄 Refresh
          </button>
        </div>
      </div>
    </header>
  );
};
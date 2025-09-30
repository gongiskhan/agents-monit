import React, { useState, useEffect } from 'react';
import { invoke } from '../api/electronAPI';
import { Session, SessionStatus } from '../types/session';

export const Header: React.FC = () => {
  const [activeSessions, setActiveSessions] = useState(0);
  const [totalSessions, setTotalSessions] = useState(0);

  const updateSessionCounts = async () => {
    try {
      const sessions = await invoke<Session[]>('get-sessions');
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
      await invoke('refresh-sessions');
      await updateSessionCounts();
    } catch (error) {
      console.error('Failed to refresh sessions:', error);
    }
  };

  return (
    <header className="app-header draggable">
      <div className="header-content">
        <div className="header-title">
          <img
            src="/icon.png"
            alt="Agents Bro"
            style={{
              width: '2rem',
              height: '2rem',
              marginRight: '0.5rem',
              borderRadius: '8px'
            }}
          />
          <h1>Agents Bro</h1>
          <div className="status-badges non-draggable">
            <span className="badge badge-active" title={`${activeSessions} active sessions`}>
              {activeSessions}
            </span>
            <span className="badge badge-total" title={`${totalSessions} total sessions`}>
              {totalSessions}
            </span>
          </div>
        </div>
        <div className="header-actions non-draggable">
          <button
            className="refresh-button"
            onClick={handleRefresh}
            aria-label="Refresh sessions"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
};
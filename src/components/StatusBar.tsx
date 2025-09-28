import React, { useState, useEffect } from 'react';

export const StatusBar: React.FC = () => {
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [connectionStatus] = useState<'connected' | 'disconnected'>('connected');

  useEffect(() => {
    const updateTimer = setInterval(() => {
      setLastUpdate(new Date());
    }, 2000);

    return () => clearInterval(updateTimer);
  }, []);

  const formatTime = (date: Date): string => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <footer className="status-bar">
      <div className="status-bar-content">
        <div className="status-item">
          <span className={`connection-indicator ${connectionStatus}`} />
          <span className="status-text">
            {connectionStatus === 'connected' ? 'Monitoring' : 'Disconnected'}
          </span>
        </div>
        <div className="status-item">
          <span className="status-text">
            Last update: {formatTime(lastUpdate)}
          </span>
        </div>
        <div className="status-item">
          <span className="status-text">
            Auto-refresh: 2s
          </span>
        </div>
      </div>
    </footer>
  );
};
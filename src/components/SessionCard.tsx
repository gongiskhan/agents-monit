import React from 'react';
import { invoke } from '../api/electronAPI';
import { Session, SessionStatus, MessageType } from '../types/session';

interface SessionCardProps {
  session: Session;
}

export const SessionCard: React.FC<SessionCardProps> = ({ session }) => {
  const handleClick = async () => {
    try {
      await invoke('focus_window', { sessionId: session.id });
    } catch (error) {
      console.error('Failed to focus window:', error);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const formatTimeAgo = (timestamp: string): string => {
    const now = new Date();
    const then = new Date(timestamp);
    const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

    if (seconds < 30) return 'Just now';
    if (seconds < 60) return `${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  const truncateMessage = (content: string, maxLength = 150): string => {
    if (content.length <= maxLength) return content;
    return `${content.slice(0, maxLength)}...`;
  };

  const getStatusClass = (): string => {
    return session.status === SessionStatus.Active ? 'status-active' : 'status-stopped';
  };

  const getMessageTypeLabel = (type?: MessageType): string => {
    if (!type) return '';
    switch (type) {
      case MessageType.User:
        return 'User';
      case MessageType.Assistant:
        return 'Assistant';
      case MessageType.System:
        return 'System';
      default:
        return '';
    }
  };

  return (
    <button
      className="session-card"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={(e) => e.currentTarget.classList.add('session-card-hover')}
      onMouseLeave={(e) => e.currentTarget.classList.remove('session-card-hover')}
      aria-label={`Focus on ${session.projectName}`}
      data-testid={`session-${session.id}`}
    >
      <div className="session-card-header">
        <div className="session-info">
          <h3 className="project-name" title={session.projectPath}>
            {session.projectName}
          </h3>
          <span className="session-id">{session.id}</span>
        </div>
        <div
          className={`status-indicator ${getStatusClass()}`}
          data-testid={`${session.id}-status`}
          aria-label={`${session.status} session`}
        />
      </div>

      <div className="session-card-body">
        {session.latestMessage ? (
          <>
            <div className="message-meta">
              <span className="message-type">
                {getMessageTypeLabel(session.latestMessage.type)}
              </span>
              <span className="time-ago">
                {formatTimeAgo(session.lastActivity)}
              </span>
            </div>
            <p className="message-content" data-testid="message-content">
              {truncateMessage(session.latestMessage.content)}
            </p>
          </>
        ) : (
          <p className="no-activity">No recent activity</p>
        )}
      </div>
    </button>
  );
};
import React from 'react';
import { invoke } from '../api/electronAPI';
import { Session, SessionStatus, MessageType } from '../types/session';

interface SessionCardProps {
  session: Session;
}

export const SessionCard: React.FC<SessionCardProps> = ({ session }) => {
  // Debug log to see what status we're receiving
  React.useEffect(() => {
    if (session.status === 'active') {
      console.log(`Active session card: ${session.projectName} - status: ${session.status}`);
    }
  }, [session.status, session.projectName]);

  const handleClick = async () => {
    try {
      await invoke('focus-window', { sessionId: session.id });
    } catch (error) {
      console.error('Failed to focus window:', error);
    }
  };

  const handleOpenProject = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click
    console.log('handleOpenProject called');
    try {
      const savedSettings = localStorage.getItem('notificationSettings');
      console.log('savedSettings:', savedSettings);

      const settings = savedSettings ? JSON.parse(savedSettings) : {
        openCommand: 'cursor',
        projectsHomeFolder: ''
      };

      console.log('settings:', settings);
      console.log('projectPath:', `${settings.projectsHomeFolder}/${session.projectName}`);

      if (!settings.projectsHomeFolder) {
        alert('Please configure "Projects home folder" in settings first!');
        return;
      }

      console.log('Calling invoke open-project');
      await invoke('open-project', {
        command: settings.openCommand,
        projectPath: `${settings.projectsHomeFolder}/${session.projectName}`
      });
      console.log('invoke completed');
    } catch (error) {
      console.error('Failed to open project:', error);
      alert(`Failed to open project: ${error}`);
    }
  };

  const handleCreateWorktree = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click
    console.log('handleCreateWorktree called');
    try {
      const savedSettings = localStorage.getItem('notificationSettings');
      console.log('savedSettings:', savedSettings);

      const settings = savedSettings ? JSON.parse(savedSettings) : {
        openCommand: 'cursor',
        projectsHomeFolder: ''
      };

      console.log('settings:', settings);

      if (!settings.projectsHomeFolder) {
        alert('Please configure "Projects home folder" in settings first!');
        return;
      }

      console.log('Calling invoke create-worktree');
      const result = await invoke<{ success: boolean; worktreePath?: string; error?: string }>('create-worktree', {
        projectPath: `${settings.projectsHomeFolder}/${session.projectName}`,
        projectName: session.projectName,
        projectsHomeFolder: settings.projectsHomeFolder,
        command: settings.openCommand
      });

      console.log('create-worktree result:', result);

      if (result.success && result.worktreePath) {
        alert(`Worktree created and opened: ${result.worktreePath}`);
        console.log(`Worktree created and opened: ${result.worktreePath}`);
      } else {
        alert(`Failed to create worktree: ${result.error}`);
        console.error('Failed to create worktree:', result.error);
      }
    } catch (error) {
      console.error('Failed to create worktree:', error);
      alert(`Failed to create worktree: ${error}`);
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
    <div
      className="session-card"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={(e) => e.currentTarget.classList.add('session-card-hover')}
      onMouseLeave={(e) => e.currentTarget.classList.remove('session-card-hover')}
      aria-label={`Focus on ${session.projectName}`}
      data-testid={`session-${session.id}`}
      role="button"
      tabIndex={0}
    >
      <div className="session-card-header">
        <div className="session-info">
          <h3 className="project-name" title={session.projectPath}>
            {session.projectName}
          </h3>
          <span className="session-id">{session.id}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
          <button
            className="worktree-button"
            onClick={(e) => {
              console.log('WORKTREE BUTTON CLICKED!');
              handleCreateWorktree(e);
            }}
            onMouseDown={(e) => {
              console.log('WORKTREE BUTTON MOUSE DOWN!');
              e.stopPropagation();
            }}
            aria-label="Create new version (worktree)"
            title="Create new version (worktree)"
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="18" r="3"></circle>
              <circle cx="6" cy="6" r="3"></circle>
              <path d="M13 6h3a2 2 0 0 1 2 2v7"></path>
              <line x1="6" y1="9" x2="6" y2="21"></line>
            </svg>
          </button>
          <button
            className="open-project-button"
            onClick={(e) => {
              console.log('OPEN PROJECT BUTTON CLICKED!');
              handleOpenProject(e);
            }}
            onMouseDown={(e) => {
              console.log('OPEN PROJECT BUTTON MOUSE DOWN!');
              e.stopPropagation();
            }}
            aria-label="Open project in editor"
            title="Open project in editor"
            type="button"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </button>
          <div
            className={`status-indicator ${getStatusClass()}`}
            data-testid={`${session.id}-status`}
            aria-label={`${session.status} session`}
          />
        </div>
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
    </div>
  );
};
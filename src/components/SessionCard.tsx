import React, { useState, useRef, useEffect } from 'react';
import { invoke } from '../api/electronAPI';
import { Session, SessionStatus, MessageType, TabCategory } from '../types/session';

interface SessionCardProps {
  session: Session;
  onMoveSession: (sessionId: string, newCategory: TabCategory) => void;
  onUpdateName: (sessionId: string, newName: string) => void;
  onToggleActive: (sessionId: string) => void;
  isSelected?: boolean;
  onSelect?: (sessionId: string, selected: boolean) => void;
}

export const SessionCard: React.FC<SessionCardProps> = ({
  session,
  onMoveSession,
  onUpdateName,
  onToggleActive,
  isSelected = false,
  onSelect,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(session.customName || session.projectName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  const handleClick = async () => {
    if (isEditingName) return; // Don't trigger card click when editing

    try {
      await invoke('focus-window', { sessionId: session.id });
    } catch (error) {
      console.error('Failed to focus window:', error);
    }
  };

  const handleOpenProject = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const savedSettings = localStorage.getItem('notificationSettings');
      const settings = savedSettings ? JSON.parse(savedSettings) : {
        openCommand: 'cursor',
        projectsHomeFolder: ''
      };

      if (!settings.projectsHomeFolder) {
        alert('Please configure "Projects home folder" in settings first!');
        return;
      }

      await invoke('open-project', {
        command: settings.openCommand,
        projectPath: `${settings.projectsHomeFolder}/${session.projectName}`
      });
    } catch (error) {
      console.error('Failed to open project:', error);
      alert(`Failed to open project: ${error}`);
    }
  };

  const handleCreateWorktree = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const savedSettings = localStorage.getItem('notificationSettings');
      const settings = savedSettings ? JSON.parse(savedSettings) : {
        openCommand: 'cursor',
        projectsHomeFolder: ''
      };

      if (!settings.projectsHomeFolder) {
        alert('Please configure "Projects home folder" in settings first!');
        return;
      }

      const result = await invoke<{ success: boolean; worktreePath?: string; error?: string }>('create-worktree', {
        projectPath: `${settings.projectsHomeFolder}/${session.projectName}`,
        projectName: session.projectName,
        projectsHomeFolder: settings.projectsHomeFolder,
        command: settings.openCommand
      });

      if (result.success && result.worktreePath) {
        alert(`Worktree created and opened: ${result.worktreePath}`);
      } else {
        alert(`Failed to create worktree: ${result.error}`);
      }
    } catch (error) {
      console.error('Failed to create worktree:', error);
      alert(`Failed to create worktree: ${error}`);
    }
  };

  const handleNameClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsEditingName(true);
  };

  const handleNameBlur = () => {
    setIsEditingName(false);
    if (editedName.trim() && editedName !== (session.customName || session.projectName)) {
      onUpdateName(session.id, editedName.trim());
    } else {
      setEditedName(session.customName || session.projectName);
    }
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameBlur();
    } else if (e.key === 'Escape') {
      setEditedName(session.customName || session.projectName);
      setIsEditingName(false);
    }
  };

  const handleActiveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleActive(session.id);
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (onSelect) {
      onSelect(session.id, e.target.checked);
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

  // Calculate if session is inactive for more than 3 minutes
  const getInactiveTime = (): number => {
    if (session.status === SessionStatus.Active) return 0;
    const now = new Date();
    const lastActivity = new Date(session.lastActivity);
    return Math.floor((now.getTime() - lastActivity.getTime()) / 1000 / 60); // minutes
  };

  const inactiveMinutes = getInactiveTime();
  const showRedBorder = session.tabCategory === 'current' && inactiveMinutes >= 3;
  const showGreenBorder = session.status === SessionStatus.Active;

  // Determine border class
  let borderClass = '';
  if (showGreenBorder) borderClass = 'session-card-active-border';
  else if (showRedBorder) borderClass = 'session-card-inactive-border';

  // Render action buttons based on current tab
  const renderActions = () => {
    if (session.tabCategory === 'current') {
      return (
        <button
          className="move-button move-to-hold"
          onClick={(e) => {
            e.stopPropagation();
            onMoveSession(session.id, 'on-hold');
          }}
          title="Move to On Hold"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
          </svg>
        </button>
      );
    } else if (session.tabCategory === 'on-hold') {
      return (
        <>
          <button
            className="move-button move-to-current"
            onClick={(e) => {
              e.stopPropagation();
              onMoveSession(session.id, 'current');
            }}
            title="Move to Current"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
          </button>
          <button
            className="move-button move-to-archive"
            onClick={(e) => {
              e.stopPropagation();
              onMoveSession(session.id, 'archive');
            }}
            title="Move to Archive"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="21 8 21 21 3 21 3 8"></polyline>
              <rect x="1" y="3" width="22" height="5"></rect>
              <line x1="10" y1="12" x2="14" y2="12"></line>
            </svg>
          </button>
        </>
      );
    } else if (session.tabCategory === 'archive') {
      return (
        <>
          {onSelect && (
            <label className="checkbox-wrapper" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={handleSelectChange}
                title="Select for deletion"
              />
            </label>
          )}
          <button
            className="move-button move-to-hold"
            onClick={(e) => {
              e.stopPropagation();
              onMoveSession(session.id, 'on-hold');
            }}
            title="Move to On Hold"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
          </button>
        </>
      );
    }
  };

  return (
    <div
      className={`session-card ${borderClass}`}
      onClick={handleClick}
      aria-label={`Focus on ${session.customName || session.projectName}`}
      data-testid={`session-${session.id}`}
      role="button"
      tabIndex={0}
    >
      <div className="session-card-header">
        <div className="session-info">
          {isEditingName ? (
            <input
              ref={inputRef}
              type="text"
              className="project-name-edit"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="project-name-wrapper" onClick={handleNameClick} title="Click to edit name">
              <h3 className="project-name">
                {session.customName || session.projectName}
              </h3>
              <svg className="edit-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </div>
          )}
          <span className="session-id">{session.id}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={(e) => e.stopPropagation()}>
          {!session.isManual && (
            <>
              <button
                className="worktree-button"
                onClick={handleCreateWorktree}
                onMouseDown={(e) => e.stopPropagation()}
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
                onClick={handleOpenProject}
                onMouseDown={(e) => e.stopPropagation()}
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
            </>
          )}
          {renderActions()}
          <div
            className={`status-indicator ${getStatusClass()}`}
            data-testid={`${session.id}-status`}
            aria-label={`${session.status} session`}
            onClick={handleActiveClick}
            title="Click to toggle active/inactive"
            style={{ cursor: 'pointer' }}
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

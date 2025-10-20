import React, { useEffect, useState } from 'react';
import { invoke, listen } from '../api/electronAPI';
import { Session, SessionStatus, TabCategory } from '../types/session';
import { SessionCard } from './SessionCard';

export const SessionList: React.FC = () => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabCategory>('current');
  const [selectedForDeletion, setSelectedForDeletion] = useState<Set<string>>(new Set());

  // Load persisted sessions from localStorage and merge with incoming sessions
  const loadPersistedSessions = (): Map<string, Partial<Session>> => {
    const stored = localStorage.getItem('persistedSessions');
    if (!stored) return new Map();

    try {
      const data = JSON.parse(stored);
      return new Map(Object.entries(data));
    } catch {
      return new Map();
    }
  };

  const savePersistedSessions = (sessionsMap: Map<string, Partial<Session>>) => {
    const obj = Object.fromEntries(sessionsMap);
    localStorage.setItem('persistedSessions', JSON.stringify(obj));
  };

  // Merge backend sessions with persisted user data
  const mergeSessions = (backendSessions: Session[]): Session[] => {
    const persisted = loadPersistedSessions();

    return backendSessions.map(session => {
      const persistedData = persisted.get(session.id);

      // Default to 'current' tab for new sessions
      const tabCategory = persistedData?.tabCategory ?? session.tabCategory ?? 'current';
      const customName = persistedData?.customName ?? session.customName;
      const isManual = persistedData?.isManual ?? session.isManual ?? false;

      return {
        ...session,
        tabCategory,
        customName,
        isManual,
        lastManualActiveTime: persistedData?.lastManualActiveTime ?? session.lastManualActiveTime,
      };
    });
  };

  // Check and auto-deactivate manual sessions after 2 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setSessions(prevSessions => {
        let updated = false;
        const newSessions = prevSessions.map(session => {
          if (session.isManual && session.status === SessionStatus.Active && session.lastManualActiveTime) {
            const timeSinceActive = Date.now() - new Date(session.lastManualActiveTime).getTime();
            if (timeSinceActive > 2 * 60 * 1000) { // 2 minutes
              updated = true;
              return { ...session, status: SessionStatus.Stopped };
            }
          }
          return session;
        });

        if (updated) {
          // Update persisted sessions
          const persisted = loadPersistedSessions();
          newSessions.forEach(s => {
            if (s.isManual) {
              persisted.set(s.id, {
                tabCategory: s.tabCategory,
                customName: s.customName,
                isManual: s.isManual,
                lastManualActiveTime: s.lastManualActiveTime,
              });
            }
          });
          savePersistedSessions(persisted);
        }

        return updated ? newSessions : prevSessions;
      });
    }, 10000); // Check every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Handler to move session between tabs
  const handleMoveSession = (sessionId: string, newCategory: TabCategory) => {
    setSessions(prevSessions => {
      const updated = prevSessions.map(s =>
        s.id === sessionId ? { ...s, tabCategory: newCategory } : s
      );

      // Persist the change
      const persisted = loadPersistedSessions();
      const session = updated.find(s => s.id === sessionId);
      if (session) {
        persisted.set(sessionId, {
          tabCategory: newCategory,
          customName: session.customName,
          isManual: session.isManual,
          lastManualActiveTime: session.lastManualActiveTime,
        });
        savePersistedSessions(persisted);
      }

      return updated;
    });
  };

  // Handler to delete archived sessions
  const handleDeleteSessions = (sessionIds: string[]) => {
    setSessions(prevSessions => prevSessions.filter(s => !sessionIds.includes(s.id)));

    // Remove from persistence
    const persisted = loadPersistedSessions();
    sessionIds.forEach(id => persisted.delete(id));
    savePersistedSessions(persisted);

    setSelectedForDeletion(new Set());
  };

  // Handler to update session name
  const handleUpdateName = (sessionId: string, newName: string) => {
    setSessions(prevSessions => {
      const updated = prevSessions.map(s =>
        s.id === sessionId ? { ...s, customName: newName } : s
      );

      // Persist the change
      const persisted = loadPersistedSessions();
      const session = updated.find(s => s.id === sessionId);
      if (session) {
        persisted.set(sessionId, {
          tabCategory: session.tabCategory,
          customName: newName,
          isManual: session.isManual,
          lastManualActiveTime: session.lastManualActiveTime,
        });
        savePersistedSessions(persisted);
      }

      return updated;
    });
  };

  // Handler to toggle active status
  const handleToggleActive = (sessionId: string) => {
    setSessions(prevSessions => {
      const updated = prevSessions.map(s => {
        if (s.id === sessionId) {
          const newStatus = s.status === SessionStatus.Active ? SessionStatus.Stopped : SessionStatus.Active;
          const lastManualActiveTime = newStatus === SessionStatus.Active ? new Date().toISOString() : s.lastManualActiveTime;
          return { ...s, status: newStatus, lastManualActiveTime };
        }
        return s;
      });

      // Persist for manual sessions
      const persisted = loadPersistedSessions();
      const session = updated.find(s => s.id === sessionId);
      if (session?.isManual) {
        persisted.set(sessionId, {
          tabCategory: session.tabCategory,
          customName: session.customName,
          isManual: session.isManual,
          lastManualActiveTime: session.lastManualActiveTime,
        });
        savePersistedSessions(persisted);
      }

      return updated;
    });
  };

  // Handler to add manual session
  const handleAddManualSession = () => {
    const newSession: Session = {
      id: `manual-${Date.now()}`,
      projectPath: '',
      projectName: 'New Session',
      customName: 'New Session',
      lastActivity: new Date().toISOString(),
      status: SessionStatus.Stopped,
      messageCount: 0,
      startTime: new Date().toISOString(),
      source: 'manual',
      tabCategory: 'current',
      isManual: true,
    };

    setSessions(prev => [newSession, ...prev]);

    // Persist the new session
    const persisted = loadPersistedSessions();
    persisted.set(newSession.id, {
      tabCategory: 'current',
      customName: 'New Session',
      isManual: true,
    });
    savePersistedSessions(persisted);
  };

  const fetchSessions = async (isInitialLoad = false) => {
    try {
      const data = await invoke<Session[]>('get-sessions');
      // Ensure data is an array before setting it
      if (Array.isArray(data)) {
        // Merge with persisted session data
        const merged = mergeSessions(data);

        // Get manual sessions from persisted storage
        const persisted = loadPersistedSessions();
        const manualSessions: Session[] = [];
        persisted.forEach((persistedData, id) => {
          if (persistedData.isManual && !merged.find(s => s.id === id)) {
            // This is a manual session that doesn't exist in backend data
            manualSessions.push({
              id,
              projectPath: '',
              projectName: persistedData.customName || 'Manual Session',
              customName: persistedData.customName,
              lastActivity: new Date().toISOString(),
              status: SessionStatus.Stopped,
              messageCount: 0,
              startTime: new Date().toISOString(),
              source: 'manual',
              tabCategory: persistedData.tabCategory || 'current',
              isManual: true,
              lastManualActiveTime: persistedData.lastManualActiveTime,
            });
          }
        });

        // Combine backend and manual sessions
        const allSessions = [...merged, ...manualSessions];

        // Only update sessions if we got valid data
        if (allSessions.length > 0 || isInitialLoad) {
          setSessions(allSessions);
          console.log('Fetched sessions:', allSessions.length, 'Active:', allSessions.filter(s => s.status === 'active').length);
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
        const merged = mergeSessions(event.payload);

        // Add manual sessions back
        const persisted = loadPersistedSessions();
        const manualSessions: Session[] = [];
        persisted.forEach((persistedData, id) => {
          if (persistedData.isManual && !merged.find(s => s.id === id)) {
            manualSessions.push({
              id,
              projectPath: '',
              projectName: persistedData.customName || 'Manual Session',
              customName: persistedData.customName,
              lastActivity: new Date().toISOString(),
              status: SessionStatus.Stopped,
              messageCount: 0,
              startTime: new Date().toISOString(),
              source: 'manual',
              tabCategory: persistedData.tabCategory || 'current',
              isManual: true,
              lastManualActiveTime: persistedData.lastManualActiveTime,
            });
          }
        });

        setSessions([...merged, ...manualSessions]);
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

  // Filter sessions by active tab
  const tabSessions = Array.isArray(sessions)
    ? sessions.filter(session => session.tabCategory === activeTab)
    : [];

  // Stable sort: Active sessions first (by first seen), then inactive (by first seen)
  // This prevents tiles from jumping around as activity updates
  const sortedSessions = [...tabSessions].sort((a, b) => {
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

  const currentCount = sessions.filter(s => s.tabCategory === 'current').length;
  const onHoldCount = sessions.filter(s => s.tabCategory === 'on-hold').length;
  const archiveCount = sessions.filter(s => s.tabCategory === 'archive').length;

  return (
    <div className="session-list">
      {/* Tab Navigation */}
      <div className="tabs-container">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'current' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('current')}
          >
            Current <span className="tab-count">{currentCount}</span>
          </button>
          <button
            className={`tab ${activeTab === 'on-hold' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('on-hold')}
          >
            On Hold <span className="tab-count">{onHoldCount}</span>
          </button>
          <button
            className={`tab ${activeTab === 'archive' ? 'tab-active' : ''}`}
            onClick={() => setActiveTab('archive')}
          >
            Archive <span className="tab-count">{archiveCount}</span>
          </button>
        </div>
        <button className="add-session-button" onClick={handleAddManualSession} title="Add new session">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </div>

      {/* Delete Selected Button (Archive tab only) */}
      {activeTab === 'archive' && selectedForDeletion.size > 0 && (
        <div className="bulk-actions">
          <button
            className="delete-selected-button"
            onClick={() => handleDeleteSessions(Array.from(selectedForDeletion))}
          >
            Delete {selectedForDeletion.size} session{selectedForDeletion.size !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Empty State */}
      {sortedSessions.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h2>No sessions in {activeTab === 'current' ? 'Current' : activeTab === 'on-hold' ? 'On Hold' : 'Archive'}</h2>
          <p>
            {activeTab === 'current'
              ? 'Add a new session or wait for Claude Code/Codex sessions to appear here'
              : activeTab === 'on-hold'
              ? 'Move sessions here to keep them organized but paused'
              : 'Archived sessions will appear here'}
          </p>
        </div>
      )}

      {/* Session Grid */}
      {sortedSessions.length > 0 && (
        <div className="session-grid">
          {sortedSessions.map(session => (
            <SessionCard
              key={session.id}
              session={session}
              onMoveSession={handleMoveSession}
              onUpdateName={handleUpdateName}
              onToggleActive={handleToggleActive}
              isSelected={selectedForDeletion.has(session.id)}
              onSelect={(id, selected) => {
                setSelectedForDeletion(prev => {
                  const newSet = new Set(prev);
                  if (selected) {
                    newSet.add(id);
                  } else {
                    newSet.delete(id);
                  }
                  return newSet;
                });
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

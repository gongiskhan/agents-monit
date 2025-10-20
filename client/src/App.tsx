/**
 * Main Application Component
 * Agent Bro - Claude Code Web Monitor
 */

import { useState, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { apiClient } from './services/api';
import { ActivityTimeline } from './components/ActivityTimeline';
import { CommandInput } from './components/CommandInput';
import { SessionList } from './components/SessionList';
import { StatusBar } from './components/StatusBar';
import { SessionMetadata } from './types/events';
import './App.css';

function App() {
  const {
    connected,
    streamEvents,
    hookEvents,
    sendCommand,
    continueSession,
    interruptSession,
    subscribeToSession,
    clearEvents,
  } = useWebSocket();

  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionMetadata[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);

  // Fetch sessions periodically
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const { sessions: fetchedSessions } = await apiClient.listSessions();
        setSessions(fetchedSessions);

        // Check if any session is running
        const hasRunning = fetchedSessions.some((s) => s.status === 'running');
        setIsExecuting(hasRunning);
      } catch (error) {
        console.error('Error fetching sessions:', error);
      }
    };

    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);

    return () => clearInterval(interval);
  }, []);

  // Subscribe to selected session
  useEffect(() => {
    if (selectedSessionId) {
      subscribeToSession(selectedSessionId);
    }
  }, [selectedSessionId, subscribeToSession]);

  const handleExecute = async (prompt: string) => {
    try {
      setIsExecuting(true);
      await sendCommand(prompt);
    } catch (error) {
      console.error('Error executing command:', error);
      setIsExecuting(false);
    }
  };

  const handleContinue = async (sessionId: string, prompt: string) => {
    try {
      setIsExecuting(true);
      await continueSession(sessionId, prompt);
    } catch (error) {
      console.error('Error continuing session:', error);
      setIsExecuting(false);
    }
  };

  const handleInterrupt = async (sessionId: string) => {
    try {
      await interruptSession(sessionId);
      setIsExecuting(false);
    } catch (error) {
      console.error('Error interrupting session:', error);
    }
  };

  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    clearEvents();

    // Load session events
    apiClient.getSession(sessionId).then((sessionData) => {
      console.log('Session data:', sessionData);
    });
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Agent Bro</h1>
        <p className="app-subtitle">Claude Code Web Monitor</p>
      </header>

      <main className="app-main">
        <aside className="app-sidebar">
          <SessionList
            onSessionSelect={handleSessionSelect}
            selectedSessionId={selectedSessionId || undefined}
          />
        </aside>

        <div className="app-content">
          <div className="app-timeline">
            <ActivityTimeline
              streamEvents={streamEvents}
              hookEvents={hookEvents}
              autoScroll={true}
            />
          </div>

          <div className="app-command">
            <CommandInput
              onExecute={handleExecute}
              onContinue={handleContinue}
              onInterrupt={handleInterrupt}
              isExecuting={isExecuting}
              currentSessionId={selectedSessionId || undefined}
            />
          </div>
        </div>
      </main>

      <StatusBar
        connected={connected}
        eventCount={streamEvents.length + hookEvents.length}
        sessionCount={sessions.length}
      />
    </div>
  );
}

export default App;

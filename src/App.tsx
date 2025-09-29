import { useState } from 'react';
import { Header } from './components/Header';
import { SessionList } from './components/SessionList';
import { StatusBar } from './components/StatusBar';
import { NotificationSettings } from './components/NotificationSettings';
import './App.css';

function App() {
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="app">
      <Header />
      <main className="app-main">
        <div className="main-content">
          <SessionList />
        </div>
        {showSettings && (
          <aside className="sidebar">
            <NotificationSettings />
          </aside>
        )}
      </main>

      {/* Settings toggle button */}
      <button
        className="settings-toggle"
        onClick={() => setShowSettings(!showSettings)}
        aria-label={showSettings ? "Hide settings" : "Show settings"}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24" />
        </svg>
      </button>

      <StatusBar />
    </div>
  );
}

export default App;
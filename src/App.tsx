import { Header } from './components/Header';
import { SessionList } from './components/SessionList';
import { StatusBar } from './components/StatusBar';
import { NotificationSettings } from './components/NotificationSettings';
import './App.css';

function App() {
  return (
    <div className="app">
      <Header />
      <main className="app-main">
        <div className="main-content">
          <SessionList />
        </div>
        <aside className="sidebar">
          <NotificationSettings />
        </aside>
      </main>
      <StatusBar />
    </div>
  );
}

export default App;
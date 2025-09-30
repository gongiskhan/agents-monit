import React, { useState, useEffect } from 'react';
import { invoke } from '../api/electronAPI';

interface NotificationSettingsState {
  enabled: boolean;
  soundEnabled: boolean;
  minimizeToTray: boolean;
  openCommand: string;
  projectsHomeFolder: string;
}

export const NotificationSettings: React.FC = () => {
  const [settings, setSettings] = useState<NotificationSettingsState>({
    enabled: true,
    soundEnabled: false,
    minimizeToTray: false,
    openCommand: 'cursor',
    projectsHomeFolder: '',
  });

  useEffect(() => {
    // Load settings from localStorage
    console.log('NotificationSettings mounted, loading from localStorage');
    const savedSettings = localStorage.getItem('notificationSettings');
    console.log('Loaded from localStorage:', savedSettings);
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      console.log('Parsed settings:', parsed);
      setSettings(parsed);
    } else {
      console.log('No saved settings found, using defaults');
    }
  }, []);

  const handleSettingChange = (key: keyof NotificationSettingsState) => {
    const newSettings = {
      ...settings,
      [key]: !settings[key],
    };
    setSettings(newSettings);
    localStorage.setItem('notificationSettings', JSON.stringify(newSettings));
  };

  const handleTextChange = (key: keyof NotificationSettingsState, value: string) => {
    console.log(`handleTextChange called: ${key} = ${value}`);
    const newSettings = {
      ...settings,
      [key]: value,
    };
    setSettings(newSettings);
    console.log('New settings:', newSettings);
    localStorage.setItem('notificationSettings', JSON.stringify(newSettings));
    console.log('Saved to localStorage');

    // Verify it was saved
    const saved = localStorage.getItem('notificationSettings');
    console.log('Verified saved settings:', saved);
  };

  const handleShowLogFile = async () => {
    console.log('handleShowLogFile called!');
    try {
      console.log('Calling invoke get-log-file-path');
      const logPath = await invoke<string>('get-log-file-path');
      console.log('Log path received:', logPath);
      // Copy to clipboard
      await navigator.clipboard.writeText(logPath);
      console.log('Copied to clipboard');
      alert(`Log file path copied to clipboard:\n${logPath}`);
    } catch (error) {
      console.error('Failed to get log file path:', error);
      alert(`Error: ${error}`);
    }
  };

  return (
    <div className="notification-settings">
      <h3>Settings</h3>
      <div className="settings-list">
        <label className="setting-item">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={() => handleSettingChange('enabled')}
          />
          <span>Enable notifications</span>
        </label>
        <label className="setting-item">
          <input
            type="checkbox"
            checked={settings.soundEnabled}
            onChange={() => handleSettingChange('soundEnabled')}
            disabled={!settings.enabled}
          />
          <span>Play sound with notifications</span>
        </label>
        <label className="setting-item">
          <input
            type="checkbox"
            checked={settings.minimizeToTray}
            onChange={() => handleSettingChange('minimizeToTray')}
          />
          <span>Minimize to system tray</span>
        </label>
        <div className="setting-item-text">
          <label>
            <span>Open command</span>
            <input
              type="text"
              value={settings.openCommand}
              onChange={(e) => handleTextChange('openCommand', e.target.value)}
              placeholder="cursor"
            />
          </label>
        </div>
        <div className="setting-item-text">
          <label>
            <span>Projects home folder</span>
            <input
              type="text"
              value={settings.projectsHomeFolder}
              onChange={(e) => handleTextChange('projectsHomeFolder', e.target.value)}
              placeholder="/Users/username/dev"
            />
          </label>
        </div>
        <button
          className="log-file-button"
          onClick={(e) => {
            console.log('Log file button clicked!');
            e.preventDefault();
            e.stopPropagation();
            handleShowLogFile();
          }}
          onMouseDown={() => console.log('Log file button mouse down!')}
          type="button"
        >
          📋 Show Log File Path
        </button>
      </div>
    </div>
  );
};
import React, { useState, useEffect } from 'react';

interface NotificationSettingsState {
  enabled: boolean;
  soundEnabled: boolean;
  minimizeToTray: boolean;
}

export const NotificationSettings: React.FC = () => {
  const [settings, setSettings] = useState<NotificationSettingsState>({
    enabled: true,
    soundEnabled: false,
    minimizeToTray: false,
  });

  useEffect(() => {
    // Load settings from localStorage
    const savedSettings = localStorage.getItem('notificationSettings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
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
      </div>
    </div>
  );
};
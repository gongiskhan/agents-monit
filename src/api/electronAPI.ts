// Electron API wrapper to replace Tauri's invoke
// This provides a consistent API interface for the React components

export interface HooksCheckResult {
  installed: boolean;
  missingHooks: string[];
}

export interface SetupResult {
  success: boolean;
  output: string;
  error?: string;
}

export const invoke = async <T = any>(command: string, args?: any): Promise<T> => {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }

  switch (command) {
    case 'get-sessions':
      return window.electronAPI.invoke('get-sessions') as Promise<T>;

    case 'get-active-sessions':
      return window.electronAPI.invoke('get-active-sessions') as Promise<T>;

    case 'refresh-sessions':
      return window.electronAPI.invoke('refresh-sessions') as Promise<T>;

    case 'focus-window':
      return window.electronAPI.invoke('focus-window', args?.sessionId) as Promise<T>;

    case 'get-session-details':
      return window.electronAPI.invoke('get-session-details', args?.sessionId) as Promise<T>;

    case 'open-project':
      return window.electronAPI.invoke('open-project', args) as Promise<T>;

    case 'create-worktree':
      return window.electronAPI.invoke('create-worktree', args) as Promise<T>;

    case 'get-log-file-path':
      return window.electronAPI.invoke('get-log-file-path') as Promise<T>;

    case 'check-hooks-installed':
      return window.electronAPI.invoke('check-hooks-installed') as Promise<T>;

    case 'run-setup-hooks':
      return window.electronAPI.invoke('run-setup-hooks') as Promise<T>;

    default:
      throw new Error(`Unknown command: ${command}`);
  }
};

export const listen = <T = any>(
  event: string,
  callback: (payload: { payload: T }) => void
): Promise<() => void> => {
  if (!window.electronAPI) {
    throw new Error('Electron API not available');
  }

  if (event === 'sessions-updated') {
    const unsubscribe = window.electronAPI.on('sessions-updated', (_, data) => {
      callback({ payload: data });
    });

    return Promise.resolve(unsubscribe);
  }

  throw new Error(`Unknown event: ${event}`);
};

// Type declarations for window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      on: (channel: string, callback: (event: any, ...args: any[]) => void) => () => void;
    };
  }
}
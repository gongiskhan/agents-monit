import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { SessionMonitor } from './sessionMonitor';

let mainWindow: BrowserWindow | null = null;
let sessionMonitor: SessionMonitor | null = null;

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// Set up logging
const logFile = path.join(app.getPath('userData'), 'agents-bro.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function log(message: string) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  logStream.write(logMessage);
  console.log(message);
}

log(`=== Agents Bro started ===`);
log(`Log file: ${logFile}`);

// Check if hooks are installed
function checkHooksInstalled(): { installed: boolean; missingHooks: string[] } {
  const homeDir = require('os').homedir();
  const hooksDir = path.join(homeDir, '.claude', 'hooks');
  const requiredHooks = [
    'user_prompt_submit.py',
    'pre_tool_use.py',
    'post_tool_use.py',
    'session_start.py'
  ];

  const missingHooks: string[] = [];
  for (const hook of requiredHooks) {
    const hookPath = path.join(hooksDir, hook);
    if (!fs.existsSync(hookPath)) {
      missingHooks.push(hook);
    }
  }

  const utilPath = path.join(hooksDir, 'utils', 'session_tracker.py');
  if (!fs.existsSync(utilPath)) {
    missingHooks.push('utils/session_tracker.py');
  }

  return {
    installed: missingHooks.length === 0,
    missingHooks
  };
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../../public/icon.png'),
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();

    // Prevent navigation to other URLs - allow port 5173 from any host
    mainWindow.webContents.on('will-navigate', (event, url) => {
      try {
        const urlObj = new URL(url);
        if (urlObj.port !== '5173' && urlObj.port !== '') {
          event.preventDefault();
        }
      } catch {
        event.preventDefault();
      }
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Initialize session monitor FIRST
  sessionMonitor = new SessionMonitor();

  // Set up IPC handlers BEFORE creating window
  ipcMain.handle('get-sessions', () => {
    const sessions = sessionMonitor?.getSessions() || [];
    log(`get-sessions called, returning ${sessions.length} sessions`);
    return sessions;
  });

  ipcMain.handle('get-active-sessions', () => {
    const activeSessions = sessionMonitor?.getActiveSessions() || [];
    log(`get-active-sessions called, returning ${activeSessions.length} sessions`);
    return activeSessions;
  });

  ipcMain.handle('refresh-sessions', async () => {
    log('refresh-sessions called');
    await sessionMonitor?.scanDirectory();
    return sessionMonitor?.getSessions() || [];
  });

  ipcMain.handle('focus-window', async (_, sessionId: string) => {
    // In Electron, we can't directly focus other application windows
    // This would require platform-specific code or AppleScript on macOS
    log(`Focus requested for session: ${sessionId}`);
    return true;
  });

  ipcMain.handle('get-session-details', async (_, sessionId: string) => {
    log(`get-session-details called for: ${sessionId}`);
    return sessionMonitor?.getSessionById(sessionId);
  });

  ipcMain.handle('get-log-file-path', () => {
    return logFile;
  });

  ipcMain.handle('check-hooks-installed', () => {
    const result = checkHooksInstalled();
    log(`Hooks check: installed=${result.installed}, missing=${result.missingHooks.join(', ')}`);
    return result;
  });

  ipcMain.handle('run-setup-hooks', async () => {
    const { spawn } = await import('child_process');
    const setupScript = path.join(__dirname, '../../setup-hooks.sh');

    log(`Running setup script: ${setupScript}`);

    return new Promise((resolve) => {
      const setupProcess = spawn(setupScript, [], {
        shell: true,
        stdio: 'pipe'
      });

      let output = '';
      let errorOutput = '';

      setupProcess.stdout?.on('data', (data) => {
        const text = data.toString();
        output += text;
        log(`Setup stdout: ${text}`);
      });

      setupProcess.stderr?.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;
        log(`Setup stderr: ${text}`);
      });

      setupProcess.on('close', (code) => {
        log(`Setup script exited with code: ${code}`);
        resolve({
          success: code === 0,
          output,
          error: errorOutput
        });
      });

      setupProcess.on('error', (error) => {
        log(`Setup script error: ${error.message}`);
        resolve({
          success: false,
          output,
          error: error.message
        });
      });
    });
  });

  ipcMain.handle('open-project', async (_, { command, projectPath }: { command: string; projectPath: string }) => {
    const { spawn } = await import('child_process');
    try {
      log(`open-project called: command="${command}" projectPath="${projectPath}"`);

      // Check if project path exists
      if (!fs.existsSync(projectPath)) {
        log(`ERROR: Project path does not exist: ${projectPath}`);
        return false;
      }

      log(`Spawning: ${command} ${projectPath}`);
      const child = spawn(command, [projectPath], {
        detached: true,
        stdio: 'pipe'
      });

      child.stderr?.on('data', (data) => {
        log(`open-project stderr: ${data.toString()}`);
      });

      child.on('error', (error) => {
        log(`open-project spawn error: ${error.message}`);
      });

      child.on('spawn', () => {
        log(`open-project spawned successfully`);
      });

      child.unref();
      return true;
    } catch (error) {
      log(`open-project exception: ${error}`);
      return false;
    }
  });

  ipcMain.handle('create-worktree', async (_, { projectPath, projectName, projectsHomeFolder, command }: {
    projectPath: string;
    projectName: string;
    projectsHomeFolder: string;
    command: string;
  }) => {
    const { spawn } = await import('child_process');
    const pathModule = await import('path');

    try {
      log(`create-worktree called: projectPath="${projectPath}" projectName="${projectName}" projectsHomeFolder="${projectsHomeFolder}" command="${command}"`);

      // Check if project path exists
      if (!fs.existsSync(projectPath)) {
        log(`ERROR: Project path does not exist: ${projectPath}`);
        return { success: false, error: `Project path does not exist: ${projectPath}` };
      }

      // Create worktrees directory if it doesn't exist
      const worktreesDir = pathModule.join(projectsHomeFolder, 'worktrees');
      log(`Worktrees directory: ${worktreesDir}`);

      if (!fs.existsSync(worktreesDir)) {
        log(`Creating worktrees directory: ${worktreesDir}`);
        fs.mkdirSync(worktreesDir, { recursive: true });
      }

      // Scan existing worktrees to find next version number
      let nextVersion = 1;
      if (fs.existsSync(worktreesDir)) {
        const entries = fs.readdirSync(worktreesDir);
        log(`Found ${entries.length} entries in worktrees directory`);
        const projectWorktrees = entries.filter(name => name.startsWith(`${projectName}-v`));
        log(`Found ${projectWorktrees.length} worktrees for project "${projectName}"`);

        if (projectWorktrees.length > 0) {
          const versions = projectWorktrees
            .map(name => {
              const match = name.match(/-v(\d+)$/);
              return match ? parseInt(match[1], 10) : 0;
            })
            .filter(v => !isNaN(v));

          if (versions.length > 0) {
            nextVersion = Math.max(...versions) + 1;
            log(`Next version will be: v${nextVersion}`);
          }
        }
      }

      const worktreeName = `${projectName}-v${nextVersion}`;
      const worktreePath = pathModule.join(worktreesDir, worktreeName);

      log(`Creating worktree: ${worktreePath}`);

      // Create the git worktree
      return new Promise((resolve) => {
        log(`Spawning git: git worktree add ${worktreePath} (cwd: ${projectPath})`);
        const gitProcess = spawn('git', ['worktree', 'add', worktreePath], {
          cwd: projectPath,
          stdio: 'pipe'
        });

        let errorOutput = '';
        let stdoutOutput = '';

        gitProcess.stdout?.on('data', (data) => {
          const output = data.toString();
          stdoutOutput += output;
          log(`git stdout: ${output}`);
        });

        gitProcess.stderr?.on('data', (data) => {
          const output = data.toString();
          errorOutput += output;
          log(`git stderr: ${output}`);
        });

        gitProcess.on('error', (error) => {
          log(`git spawn error: ${error.message}`);
          resolve({ success: false, error: error.message });
        });

        gitProcess.on('close', (code) => {
          log(`git process exited with code: ${code}`);

          if (code === 0) {
            log(`Worktree created successfully: ${worktreePath}`);

            // Copy .env files from source project to worktree
            try {
              const files = fs.readdirSync(projectPath);
              const envFiles = files.filter(file => file.startsWith('.env'));

              if (envFiles.length > 0) {
                log(`Found ${envFiles.length} .env files to copy: ${envFiles.join(', ')}`);

                for (const envFile of envFiles) {
                  const sourcePath = pathModule.join(projectPath, envFile);
                  const destPath = pathModule.join(worktreePath, envFile);

                  try {
                    fs.copyFileSync(sourcePath, destPath);
                    log(`Copied ${envFile} to worktree`);
                  } catch (copyError) {
                    log(`Warning: Failed to copy ${envFile}: ${copyError}`);
                  }
                }
              } else {
                log('No .env files found to copy');
              }
            } catch (scanError) {
              log(`Warning: Failed to scan for .env files: ${scanError}`);
            }

            // Open the worktree in the editor
            log(`Opening worktree: ${command} ${worktreePath}`);
            const openProcess = spawn(command, [worktreePath], {
              detached: true,
              stdio: 'pipe'
            });

            openProcess.on('error', (error) => {
              log(`open worktree spawn error: ${error.message}`);
            });

            openProcess.on('spawn', () => {
              log(`Worktree opened successfully`);
            });

            openProcess.unref();

            resolve({ success: true, worktreePath });
          } else {
            log(`Failed to create worktree. Error: ${errorOutput}`);
            resolve({ success: false, error: errorOutput || `Git exited with code ${code}` });
          }
        });
      });
    } catch (error) {
      log(`create-worktree exception: ${error}`);
      return { success: false, error: String(error) };
    }
  });

  // Set up session update broadcasts
  sessionMonitor.on('sessions-updated', (sessions) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('sessions-updated', sessions);
    }
  });

  // Start watching BEFORE creating window
  await sessionMonitor.startWatching();

  // NOW create the window
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
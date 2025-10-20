/**
 * Agent Bro Server - Main Entry Point
 * Web-based Claude Code monitoring and execution interface
 */

import { StorageManager } from './storage';
import { ClaudeExecutor } from './claude-executor';
import { HookProcessor } from './hook-processor';
import { WebSocketServer } from './websocket';
import { createAPIServer } from './api';

const HTTP_PORT = parseInt(process.env.PORT || '3001');
const WS_PORT = parseInt(process.env.WS_PORT || '3002');
const HOOK_PORT = parseInt(process.env.HOOK_PORT || '3003');

async function main() {
  console.log('🚀 Starting Agent Bro Server...');
  console.log('================================');

  // Initialize storage
  const storage = new StorageManager();
  await storage.initializeStorage();

  // Initialize Claude executor
  const executor = new ClaudeExecutor(storage);

  // Initialize hook processor
  const hookProcessor = new HookProcessor(storage);

  // Initialize WebSocket server
  const wsServer = new WebSocketServer(WS_PORT);

  // Initialize HTTP API server
  const apiApp = createAPIServer(storage, executor, hookProcessor);

  // Connect executor events to WebSocket
  executor.on('stream-event', (event) => {
    wsServer.broadcastStreamEvent(event);
  });

  executor.on('session-status', (status) => {
    wsServer.broadcastSessionStatus(status.sessionId, status);
  });

  // Connect hook processor events to WebSocket
  hookProcessor.on('hook-event', (event) => {
    wsServer.broadcastHookEvent(event);
  });

  // Connect WebSocket events to executor
  wsServer.on('execute-command', async (data) => {
    try {
      const execution = await executor.executeCommand(data.prompt, data.options);
      wsServer.sendResponse(data.clientId, {
        type: 'execution-started',
        sessionId: execution.sessionId,
      });
    } catch (error) {
      wsServer.sendResponse(data.clientId, {
        type: 'error',
        message: (error as Error).message,
      });
    }
  });

  wsServer.on('continue-session', async (data) => {
    try {
      await executor.continueSession(data.sessionId, data.prompt);
      wsServer.sendResponse(data.clientId, {
        type: 'session-continued',
        sessionId: data.sessionId,
      });
    } catch (error) {
      wsServer.sendResponse(data.clientId, {
        type: 'error',
        message: (error as Error).message,
      });
    }
  });

  wsServer.on('interrupt-session', async (data) => {
    try {
      await executor.interruptSession(data.sessionId);
      wsServer.sendResponse(data.clientId, {
        type: 'session-interrupted',
        sessionId: data.sessionId,
      });
    } catch (error) {
      wsServer.sendResponse(data.clientId, {
        type: 'error',
        message: (error as Error).message,
      });
    }
  });

  // Start HTTP API server
  apiApp.listen(HTTP_PORT, '0.0.0.0', () => {
    console.log(`✓ HTTP API server running on http://0.0.0.0:${HTTP_PORT}`);
  });

  // Start hook event receiver
  hookProcessor.startHookListener(HOOK_PORT);
  console.log(`✓ Hook event receiver running on http://localhost:${HOOK_PORT}`);

  console.log(`✓ WebSocket server running on ws://0.0.0.0:${WS_PORT}`);
  console.log('================================');
  console.log('🎉 Agent Bro Server is ready!');
  console.log('');
  console.log(`📊 Access web interface at: http://localhost:${HTTP_PORT}`);
  console.log(`🔌 WebSocket endpoint: ws://localhost:${WS_PORT}`);
  console.log(`🪝 Hook endpoint: http://localhost:${HOOK_PORT}/hook-event`);
  console.log('');

  // Set up periodic cleanup (every hour)
  setInterval(async () => {
    console.log('Running periodic cleanup...');
    await storage.cleanupOldSessions(30);
  }, 60 * 60 * 1000);

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n⏹️  Shutting down Agent Bro Server...');
    wsServer.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n\n⏹️  Shutting down Agent Bro Server...');
    wsServer.close();
    process.exit(0);
  });
}

// Start server
main().catch((error) => {
  console.error('❌ Fatal error starting server:', error);
  process.exit(1);
});

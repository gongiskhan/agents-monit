/**
 * HTTP API Routes
 * RESTful API for session management and data retrieval
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { StorageManager } from './storage';
import { ClaudeExecutor } from './claude-executor';
import { HookProcessor } from './hook-processor';
import { ExecuteOptions, EventFilters } from './types';

export function createAPIServer(
  storage: StorageManager,
  executor: ClaudeExecutor,
  hookProcessor: HookProcessor
): express.Application {
  const app = express();

  app.use(cors());
  app.use(express.json());

  /**
   * GET /api/health
   * Server health check
   */
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      activeSessions: executor.getActiveSessions().length,
    });
  });

  /**
   * GET /api/sessions
   * List all sessions with metadata
   */
  app.get('/api/sessions', async (req: Request, res: Response) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

      let sessions = await storage.listSessions();

      // Apply offset and limit
      if (offset) {
        sessions = sessions.slice(offset);
      }
      if (limit) {
        sessions = sessions.slice(0, limit);
      }

      res.json({
        sessions,
        total: sessions.length,
      });
    } catch (error) {
      console.error('Error listing sessions:', error);
      res.status(500).json({ error: 'Failed to list sessions' });
    }
  });

  /**
   * GET /api/sessions/:sessionId
   * Get session details including all events
   */
  app.get('/api/sessions/:sessionId', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const metadata = await storage.getSessionMetadata(sessionId);
      if (!metadata) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const streamEvents = await storage.readSessionOutput(sessionId);
      const hookEvents = await storage.readHookEvents({ sessionId });

      res.json({
        metadata,
        streamEvents,
        hookEvents,
        totalEvents: streamEvents.length + hookEvents.length,
      });
    } catch (error) {
      console.error('Error getting session:', error);
      res.status(500).json({ error: 'Failed to get session' });
    }
  });

  /**
   * POST /api/sessions/execute
   * Execute new Claude Code command
   */
  app.post('/api/sessions/execute', async (req: Request, res: Response) => {
    try {
      const { prompt, options } = req.body as {
        prompt: string;
        options?: ExecuteOptions;
      };

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const execution = await executor.executeCommand(prompt, options);

      res.json({
        sessionId: execution.sessionId,
        status: execution.status,
        startTime: execution.startTime,
      });
    } catch (error) {
      console.error('Error executing command:', error);
      res.status(500).json({ error: 'Failed to execute command' });
    }
  });

  /**
   * POST /api/sessions/:sessionId/continue
   * Continue existing session
   */
  app.post('/api/sessions/:sessionId/continue', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      const { prompt } = req.body as { prompt: string };

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const execution = await executor.continueSession(sessionId, prompt);

      res.json({
        sessionId: execution.sessionId,
        status: execution.status,
      });
    } catch (error) {
      console.error('Error continuing session:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * POST /api/sessions/:sessionId/interrupt
   * Stop running session
   */
  app.post('/api/sessions/:sessionId/interrupt', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      await executor.interruptSession(sessionId);

      res.json({
        sessionId,
        status: 'interrupted',
      });
    } catch (error) {
      console.error('Error interrupting session:', error);
      res.status(500).json({ error: (error as Error).message });
    }
  });

  /**
   * GET /api/sessions/:sessionId/status
   * Get current status of a session
   */
  app.get('/api/sessions/:sessionId/status', async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;

      const status = executor.getSessionStatus(sessionId);

      if (!status) {
        const metadata = await storage.getSessionMetadata(sessionId);
        if (!metadata) {
          return res.status(404).json({ error: 'Session not found' });
        }

        return res.json({
          sessionId,
          status: metadata.status,
          startTime: metadata.startTime,
          endTime: metadata.endTime,
        });
      }

      res.json(status);
    } catch (error) {
      console.error('Error getting session status:', error);
      res.status(500).json({ error: 'Failed to get session status' });
    }
  });

  /**
   * GET /api/events/hooks
   * Get hook events with filters
   */
  app.get('/api/events/hooks', async (req: Request, res: Response) => {
    try {
      const filters: EventFilters = {
        sessionId: req.query.sessionId as string,
        eventType: req.query.eventType as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      };

      const events = await hookProcessor.getHookEvents(filters);

      res.json({
        events,
        total: events.length,
      });
    } catch (error) {
      console.error('Error getting hook events:', error);
      res.status(500).json({ error: 'Failed to get hook events' });
    }
  });

  /**
   * GET /api/events/stream
   * Get stream events for session
   */
  app.get('/api/events/stream', async (req: Request, res: Response) => {
    try {
      const sessionId = req.query.sessionId as string;

      if (!sessionId) {
        return res.status(400).json({ error: 'sessionId is required' });
      }

      const events = await storage.readSessionOutput(sessionId);

      res.json({
        sessionId,
        events,
        total: events.length,
      });
    } catch (error) {
      console.error('Error getting stream events:', error);
      res.status(500).json({ error: 'Failed to get stream events' });
    }
  });

  /**
   * GET /api/projects
   * List all Claude Code projects (placeholder)
   */
  app.get('/api/projects', async (req: Request, res: Response) => {
    try {
      // TODO: Implement project discovery from ~/.claude/projects
      res.json({
        projects: [],
        message: 'Project discovery not yet implemented',
      });
    } catch (error) {
      console.error('Error listing projects:', error);
      res.status(500).json({ error: 'Failed to list projects' });
    }
  });

  return app;
}

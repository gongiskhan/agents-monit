/**
 * Hook Event Processor
 * Receives and processes hook events from Claude Code hooks
 */

import express from 'express';
import { EventEmitter } from 'events';
import { HookEvent, EventFilters } from './types';
import { StorageManager } from './storage';

export class HookProcessor extends EventEmitter {
  private storage: StorageManager;
  private app: express.Application;
  private seenEvents: Set<string> = new Set();

  constructor(storage: StorageManager) {
    super();
    this.storage = storage;
    this.app = express();
    this.setupRoutes();
  }

  /**
   * Set up Express routes for hook events
   */
  private setupRoutes(): void {
    this.app.use(express.json());

    // POST /hook-event - Receive hook events from Python hooks
    this.app.post('/hook-event', async (req, res) => {
      try {
        const event = req.body as HookEvent;

        // Validate event
        if (!event.session_id || !event.hook_event_type || !event.timestamp) {
          return res.status(400).json({ error: 'Invalid hook event format' });
        }

        await this.processHookEvent(event);

        res.status(200).json({ status: 'ok' });
      } catch (error) {
        console.error('Error processing hook event:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    // GET /health - Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });
  }

  /**
   * Process a hook event
   */
  async processHookEvent(event: HookEvent): Promise<void> {
    // Generate event hash for deduplication
    const eventHash = this.generateEventHash(event);

    if (this.seenEvents.has(eventHash)) {
      console.log(`Duplicate hook event ignored: ${event.hook_event_type}`);
      return;
    }

    this.seenEvents.add(eventHash);

    // Clean up old hashes (keep last 1000)
    if (this.seenEvents.size > 1000) {
      const toDelete = Array.from(this.seenEvents).slice(0, 100);
      toDelete.forEach(hash => this.seenEvents.delete(hash));
    }

    console.log(`[Hook] ${event.hook_event_type} from session ${event.session_id}`);

    // Store event
    await this.storeHookEvent(event);

    // Update session metadata
    const metadata = await this.storage.getSessionMetadata(event.session_id);
    if (metadata) {
      await this.storage.updateSessionMetadata(event.session_id, {
        hookEventCount: (metadata.hookEventCount || 0) + 1,
      });
    }

    // Broadcast to WebSocket clients
    this.emit('hook-event', event);
  }

  /**
   * Store hook event to file system
   */
  async storeHookEvent(event: HookEvent): Promise<void> {
    await this.storage.writeHookEvent(event);
  }

  /**
   * Get hook events with filters
   */
  async getHookEvents(filters: EventFilters = {}): Promise<HookEvent[]> {
    return await this.storage.readHookEvents(filters);
  }

  /**
   * Generate hash for event deduplication
   */
  private generateEventHash(event: HookEvent): string {
    return `${event.session_id}-${event.hook_event_type}-${event.timestamp}`;
  }

  /**
   * Start hook listener HTTP server
   */
  startHookListener(port: number): void {
    this.app.listen(port, '127.0.0.1', () => {
      console.log(`Hook event receiver listening on http://localhost:${port}`);
    });
  }

  /**
   * Get Express app (for testing or integration)
   */
  getApp(): express.Application {
    return this.app;
  }
}

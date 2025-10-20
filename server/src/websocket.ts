/**
 * WebSocket Server
 * Handles real-time bidirectional communication with web clients
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { WebSocketMessage, ClientMessage, StreamEvent, HookEvent } from './types';

interface Client {
  id: string;
  ws: WebSocket;
  subscribedSessions: Set<string>;
  connectedAt: string;
}

export class WebSocketServer extends EventEmitter {
  private wss: WebSocket.Server;
  private clients: Map<string, Client> = new Map();
  private clientIdCounter = 0;

  constructor(port: number) {
    super();

    this.wss = new WebSocket.Server({ port });

    this.wss.on('connection', (ws) => {
      this.handleConnection(ws);
    });

    console.log(`WebSocket server listening on port ${port}`);
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket): void {
    const clientId = `client-${++this.clientIdCounter}`;

    const client: Client = {
      id: clientId,
      ws,
      subscribedSessions: new Set(),
      connectedAt: new Date().toISOString(),
    };

    this.clients.set(clientId, client);

    console.log(`[WS] Client connected: ${clientId} (Total: ${this.clients.size})`);

    // Send connection confirmation
    this.sendToClient(client, {
      type: 'connection-status',
      data: {
        clientId,
        status: 'connected',
        message: 'Connected to Agent Bro server',
      },
      timestamp: new Date().toISOString(),
    });

    // Handle messages from client
    ws.on('message', (data: WebSocket.Data) => {
      this.handleClientMessage(client, data);
    });

    // Handle client disconnect
    ws.on('close', () => {
      console.log(`[WS] Client disconnected: ${clientId}`);
      this.clients.delete(clientId);
    });

    // Handle errors
    ws.on('error', (error) => {
      console.error(`[WS] Client error (${clientId}):`, error);
    });

    // Set up ping/pong for keepalive
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000); // Ping every 30 seconds

    ws.on('pong', () => {
      // Client is alive
    });
  }

  /**
   * Handle message from client
   */
  private handleClientMessage(client: Client, data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString()) as ClientMessage;

      console.log(`[WS] Message from ${client.id}: ${message.type}`);

      switch (message.type) {
        case 'execute-command':
          this.emit('execute-command', {
            clientId: client.id,
            prompt: message.data.prompt,
            options: message.data.options,
          });
          break;

        case 'continue-session':
          this.emit('continue-session', {
            clientId: client.id,
            sessionId: message.data.sessionId,
            prompt: message.data.prompt,
          });
          break;

        case 'interrupt-session':
          this.emit('interrupt-session', {
            clientId: client.id,
            sessionId: message.data.sessionId,
          });
          break;

        case 'subscribe-session':
          client.subscribedSessions.add(message.data.sessionId);
          console.log(`[WS] ${client.id} subscribed to session ${message.data.sessionId}`);
          break;

        case 'unsubscribe-session':
          client.subscribedSessions.delete(message.data.sessionId);
          console.log(`[WS] ${client.id} unsubscribed from session ${message.data.sessionId}`);
          break;

        default:
          console.warn(`[WS] Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('[WS] Error handling client message:', error);
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(client: Client, message: WebSocketMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error(`[WS] Error sending to client ${client.id}:`, error);
      }
    }
  }

  /**
   * Broadcast message to all clients
   */
  broadcastToAll(message: WebSocketMessage): void {
    for (const client of this.clients.values()) {
      this.sendToClient(client, message);
    }
  }

  /**
   * Broadcast to clients subscribed to a specific session
   */
  broadcastToSession(sessionId: string, message: WebSocketMessage): void {
    for (const client of this.clients.values()) {
      if (client.subscribedSessions.has(sessionId)) {
        this.sendToClient(client, message);
      }
    }
  }

  /**
   * Broadcast stream event
   */
  broadcastStreamEvent(event: StreamEvent): void {
    const message: WebSocketMessage = {
      type: 'stream-event',
      data: event,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to all clients and clients subscribed to this session
    this.broadcastToAll(message);
  }

  /**
   * Broadcast hook event
   */
  broadcastHookEvent(event: HookEvent): void {
    const message: WebSocketMessage = {
      type: 'hook-event',
      data: event,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to all clients
    this.broadcastToAll(message);
  }

  /**
   * Broadcast session status change
   */
  broadcastSessionStatus(sessionId: string, status: any): void {
    const message: WebSocketMessage = {
      type: 'session-status',
      data: {
        sessionId,
        status,
      },
      timestamp: new Date().toISOString(),
    };

    this.broadcastToSession(sessionId, message);
  }

  /**
   * Send response to specific client
   */
  sendResponse(clientId: string, data: any): void {
    const client = this.clients.get(clientId);

    if (client) {
      const message: WebSocketMessage = {
        type: 'connection-status',
        data,
        timestamp: new Date().toISOString(),
      };

      this.sendToClient(client, message);
    }
  }

  /**
   * Get connected clients count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Close server
   */
  close(): void {
    this.wss.close();
  }
}

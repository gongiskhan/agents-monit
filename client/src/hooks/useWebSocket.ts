/**
 * WebSocket Connection Hook
 * Manages WebSocket connection and real-time events
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { WebSocketMessage, StreamEvent, HookEvent, ExecuteOptions } from '../types/events';

const WS_URL = (import.meta as any).env?.VITE_WS_URL || 'ws://localhost:3002';

interface UseWebSocketReturn {
  connected: boolean;
  streamEvents: StreamEvent[];
  hookEvents: HookEvent[];
  sendCommand: (prompt: string, options?: ExecuteOptions) => Promise<void>;
  continueSession: (sessionId: string, prompt: string) => Promise<void>;
  interruptSession: (sessionId: string) => Promise<void>;
  subscribeToSession: (sessionId: string) => void;
  unsubscribeFromSession: (sessionId: string) => void;
  clearEvents: () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const [hookEvents, setHookEvents] = useState<HookEvent[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    console.log('Connecting to WebSocket:', WS_URL);

    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);

        console.log('WebSocket message:', message.type);

        switch (message.type) {
          case 'stream-event':
            setStreamEvents((prev) => [...prev, message.data as StreamEvent]);
            break;

          case 'hook-event':
            setHookEvents((prev) => [...prev, message.data as HookEvent]);
            break;

          case 'session-status':
            console.log('Session status update:', message.data);
            break;

          case 'connection-status':
            console.log('Connection status:', message.data);
            break;

          default:
            console.warn('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      wsRef.current = null;

      // Exponential backoff reconnection
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
      reconnectAttempts.current++;

      console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    wsRef.current = ws;
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.error('WebSocket not connected');
      throw new Error('WebSocket not connected');
    }
  }, []);

  const sendCommand = useCallback(async (prompt: string, options?: ExecuteOptions) => {
    sendMessage({
      type: 'execute-command',
      data: { prompt, options },
    });
  }, [sendMessage]);

  const continueSession = useCallback(async (sessionId: string, prompt: string) => {
    sendMessage({
      type: 'continue-session',
      data: { sessionId, prompt },
    });
  }, [sendMessage]);

  const interruptSession = useCallback(async (sessionId: string) => {
    sendMessage({
      type: 'interrupt-session',
      data: { sessionId },
    });
  }, [sendMessage]);

  const subscribeToSession = useCallback((sessionId: string) => {
    sendMessage({
      type: 'subscribe-session',
      data: { sessionId },
    });
  }, [sendMessage]);

  const unsubscribeFromSession = useCallback((sessionId: string) => {
    sendMessage({
      type: 'unsubscribe-session',
      data: { sessionId },
    });
  }, [sendMessage]);

  const clearEvents = useCallback(() => {
    setStreamEvents([]);
    setHookEvents([]);
  }, []);

  return {
    connected,
    streamEvents,
    hookEvents,
    sendCommand,
    continueSession,
    interruptSession,
    subscribeToSession,
    unsubscribeFromSession,
    clearEvents,
  };
}

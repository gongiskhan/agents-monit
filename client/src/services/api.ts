/**
 * API Client Service
 * Handles HTTP requests to the Agent Bro server
 */

import { SessionMetadata, ExecuteOptions, StreamEvent, HookEvent } from '../types/events';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:3001';

class APIClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * List all sessions
   */
  async listSessions(limit?: number, offset?: number): Promise<{ sessions: SessionMetadata[]; total: number }> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (offset) params.append('offset', offset.toString());

    const response = await fetch(`${this.baseUrl}/api/sessions?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to list sessions: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get session details
   */
  async getSession(sessionId: string): Promise<{
    metadata: SessionMetadata;
    streamEvents: StreamEvent[];
    hookEvents: HookEvent[];
    totalEvents: number;
  }> {
    const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`);
    if (!response.ok) {
      throw new Error(`Failed to get session: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Execute new command
   */
  async executeCommand(prompt: string, options?: ExecuteOptions): Promise<{
    sessionId: string;
    status: string;
    startTime: string;
  }> {
    const response = await fetch(`${this.baseUrl}/api/sessions/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, options }),
    });

    if (!response.ok) {
      throw new Error(`Failed to execute command: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Continue existing session
   */
  async continueSession(sessionId: string, prompt: string): Promise<{
    sessionId: string;
    status: string;
  }> {
    const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/continue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      throw new Error(`Failed to continue session: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Interrupt running session
   */
  async interruptSession(sessionId: string): Promise<{
    sessionId: string;
    status: string;
  }> {
    const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/interrupt`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to interrupt session: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get session status
   */
  async getSessionStatus(sessionId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/status`);
    if (!response.ok) {
      throw new Error(`Failed to get session status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get hook events
   */
  async getHookEvents(filters?: {
    sessionId?: string;
    eventType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<{ events: HookEvent[]; total: number }> {
    const params = new URLSearchParams();
    if (filters?.sessionId) params.append('sessionId', filters.sessionId);
    if (filters?.eventType) params.append('eventType', filters.eventType);
    if (filters?.startDate) params.append('startDate', filters.startDate);
    if (filters?.endDate) params.append('endDate', filters.endDate);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const response = await fetch(`${this.baseUrl}/api/events/hooks?${params}`);
    if (!response.ok) {
      throw new Error(`Failed to get hook events: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get stream events
   */
  async getStreamEvents(sessionId: string): Promise<{
    sessionId: string;
    events: StreamEvent[];
    total: number;
  }> {
    const response = await fetch(`${this.baseUrl}/api/events/stream?sessionId=${sessionId}`);
    if (!response.ok) {
      throw new Error(`Failed to get stream events: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Health check
   */
  async health(): Promise<{
    status: string;
    timestamp: string;
    version: string;
    activeSessions: number;
  }> {
    const response = await fetch(`${this.baseUrl}/api/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }

    return response.json();
  }
}

export const apiClient = new APIClient();

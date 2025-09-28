import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SessionCard } from '../components/SessionCard';
import { invoke } from '@tauri-apps/api/core';
import { Session, SessionStatus } from '../types/session';

// Mock Tauri API
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

describe('SessionCard', () => {
  const mockSession: Session = {
    id: 'session-001',
    projectName: 'test-project',
    projectPath: '/Users/test/projects/test-project',
    status: SessionStatus.Active,
    lastActivity: new Date().toISOString(),
    latestMessage: {
      content: 'Working on implementing new feature',
      timestamp: new Date().toISOString(),
      type: 'user',
    },
    filePath: '/Users/test/.claude/projects/test-project/session-001.jsonl',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders session information', () => {
    render(<SessionCard session={mockSession} />);

    expect(screen.getByText('test-project')).toBeInTheDocument();
    expect(screen.getByText(/Working on implementing new feature/i)).toBeInTheDocument();
  });

  test('displays active status indicator', () => {
    render(<SessionCard session={mockSession} />);

    const statusIndicator = screen.getByTestId('status-indicator');
    expect(statusIndicator).toHaveClass('status-active');
    expect(statusIndicator).toHaveAttribute('aria-label', 'Active session');
  });

  test('displays stopped status indicator', () => {
    const stoppedSession = {
      ...mockSession,
      status: SessionStatus.Stopped,
      lastActivity: new Date(Date.now() - 60000).toISOString(),
    };

    render(<SessionCard session={stoppedSession} />);

    const statusIndicator = screen.getByTestId('status-indicator');
    expect(statusIndicator).toHaveClass('status-stopped');
    expect(statusIndicator).toHaveAttribute('aria-label', 'Stopped session');
  });

  test('handles click to focus window', async () => {
    render(<SessionCard session={mockSession} />);

    const card = screen.getByRole('button', { name: /Focus on test-project/i });
    fireEvent.click(card);

    expect(invoke).toHaveBeenCalledWith('focus_window', {
      sessionId: 'session-001',
    });
  });

  test('displays time since last activity', () => {
    const pastSession = {
      ...mockSession,
      lastActivity: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
    };

    render(<SessionCard session={pastSession} />);

    expect(screen.getByText(/5 minutes ago/i)).toBeInTheDocument();
  });

  test('truncates long message content', () => {
    const longMessageSession = {
      ...mockSession,
      latestMessage: {
        ...mockSession.latestMessage!,
        content: 'A'.repeat(200), // Very long message
      },
    };

    render(<SessionCard session={longMessageSession} />);

    const messageElement = screen.getByTestId('message-content');
    expect(messageElement.textContent!.length).toBeLessThanOrEqual(150);
    expect(messageElement.textContent).toContain('...');
  });

  test('displays message type indicator', () => {
    render(<SessionCard session={mockSession} />);

    expect(screen.getByText('User')).toBeInTheDocument();
  });

  test('displays assistant message type', () => {
    const assistantSession = {
      ...mockSession,
      latestMessage: {
        ...mockSession.latestMessage!,
        type: 'assistant',
      },
    };

    render(<SessionCard session={assistantSession} />);

    expect(screen.getByText('Assistant')).toBeInTheDocument();
  });

  test('handles session without latest message', () => {
    const noMessageSession = {
      ...mockSession,
      latestMessage: undefined,
    };

    render(<SessionCard session={noMessageSession} />);

    expect(screen.getByText(/No recent activity/i)).toBeInTheDocument();
  });

  test('displays session ID', () => {
    render(<SessionCard session={mockSession} />);

    expect(screen.getByText('session-001')).toBeInTheDocument();
  });

  test('applies hover styles', () => {
    render(<SessionCard session={mockSession} />);

    const card = screen.getByRole('button');
    fireEvent.mouseEnter(card);

    expect(card).toHaveClass('session-card-hover');
  });

  test('keyboard navigation support', () => {
    render(<SessionCard session={mockSession} />);

    const card = screen.getByRole('button');
    fireEvent.keyDown(card, { key: 'Enter' });

    expect(invoke).toHaveBeenCalledWith('focus_window', {
      sessionId: 'session-001',
    });
  });

  test('displays project path on hover', () => {
    render(<SessionCard session={mockSession} />);

    const projectName = screen.getByText('test-project');
    expect(projectName).toHaveAttribute('title', '/Users/test/projects/test-project');
  });
});
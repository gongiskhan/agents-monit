import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SessionList } from '../components/SessionList';
import { invoke } from '@tauri-apps/api/core';
import { Session, SessionStatus } from '../types/session';

// Mock Tauri API
jest.mock('@tauri-apps/api/core', () => ({
  invoke: jest.fn(),
}));

describe('SessionList', () => {
  const mockSessions: Session[] = [
    {
      id: 'session-001',
      projectName: 'project-one',
      projectPath: '/path/to/project-one',
      status: SessionStatus.Active,
      lastActivity: new Date().toISOString(),
      latestMessage: {
        content: 'Working on feature X',
        timestamp: new Date().toISOString(),
        type: 'user',
      },
      filePath: '/path/to/session-001.jsonl',
    },
    {
      id: 'session-002',
      projectName: 'project-two',
      projectPath: '/path/to/project-two',
      status: SessionStatus.Stopped,
      lastActivity: new Date(Date.now() - 60000).toISOString(),
      latestMessage: {
        content: 'Task completed',
        timestamp: new Date(Date.now() - 60000).toISOString(),
        type: 'assistant',
      },
      filePath: '/path/to/session-002.jsonl',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders loading state initially', () => {
    (invoke as jest.Mock).mockImplementation(() => new Promise(() => {}));
    render(<SessionList />);
    expect(screen.getByText(/Loading sessions/i)).toBeInTheDocument();
  });

  test('renders sessions after loading', async () => {
    (invoke as jest.Mock).mockResolvedValue(mockSessions);
    render(<SessionList />);

    await waitFor(() => {
      expect(screen.getByText('project-one')).toBeInTheDocument();
      expect(screen.getByText('project-two')).toBeInTheDocument();
    });
  });

  test('displays active session indicator', async () => {
    (invoke as jest.Mock).mockResolvedValue(mockSessions);
    render(<SessionList />);

    await waitFor(() => {
      const activeIndicator = screen.getByTestId('session-001-status');
      expect(activeIndicator).toHaveClass('status-active');
    });
  });

  test('displays stopped session indicator', async () => {
    (invoke as jest.Mock).mockResolvedValue(mockSessions);
    render(<SessionList />);

    await waitFor(() => {
      const stoppedIndicator = screen.getByTestId('session-002-status');
      expect(stoppedIndicator).toHaveClass('status-stopped');
    });
  });

  test('refreshes sessions every 2 seconds', async () => {
    (invoke as jest.Mock).mockResolvedValue(mockSessions);
    render(<SessionList />);

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledWith('get_sessions');
    });

    // Wait for 2 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));

    await waitFor(() => {
      expect(invoke).toHaveBeenCalledTimes(2);
    });
  });

  test('handles error state', async () => {
    (invoke as jest.Mock).mockRejectedValue(new Error('Failed to fetch sessions'));
    render(<SessionList />);

    await waitFor(() => {
      expect(screen.getByText(/Error loading sessions/i)).toBeInTheDocument();
    });
  });

  test('displays empty state when no sessions', async () => {
    (invoke as jest.Mock).mockResolvedValue([]);
    render(<SessionList />);

    await waitFor(() => {
      expect(screen.getByText(/No active sessions/i)).toBeInTheDocument();
      expect(screen.getByText(/Claude Code and Codex sessions will appear here/i)).toBeInTheDocument();
    });
  });

  test('sorts sessions by last activity', async () => {
    const unsortedSessions = [
      { ...mockSessions[1], lastActivity: new Date(Date.now() - 60000).toISOString() },
      { ...mockSessions[0], lastActivity: new Date().toISOString() },
    ];

    (invoke as jest.Mock).mockResolvedValue(unsortedSessions);
    render(<SessionList />);

    await waitFor(() => {
      const sessionElements = screen.getAllByTestId(/session-\d+/);
      expect(sessionElements[0]).toHaveTextContent('project-one');
      expect(sessionElements[1]).toHaveTextContent('project-two');
    });
  });
});

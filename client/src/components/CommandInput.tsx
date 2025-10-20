/**
 * Command Input Component
 * Multi-line textarea with send/interrupt/continue actions
 */

import React, { useState, useRef, KeyboardEvent } from 'react';
import { ExecuteOptions } from '../types/events';

interface CommandInputProps {
  onExecute: (prompt: string, options?: ExecuteOptions) => void;
  onContinue?: (sessionId: string, prompt: string) => void;
  onInterrupt?: (sessionId: string) => void;
  isExecuting?: boolean;
  currentSessionId?: string;
}

export const CommandInput: React.FC<CommandInputProps> = ({
  onExecute,
  onContinue,
  onInterrupt,
  isExecuting = false,
  currentSessionId,
}) => {
  const [commandText, setCommandText] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+Enter or Cmd+Enter to send
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
      return;
    }

    // Up arrow for history
    if (e.key === 'ArrowUp' && !commandText && commandHistory.length > 0) {
      e.preventDefault();
      const newIndex = historyIndex + 1;
      if (newIndex < commandHistory.length) {
        setHistoryIndex(newIndex);
        setCommandText(commandHistory[newIndex]);
      }
      return;
    }

    // Down arrow for history
    if (e.key === 'ArrowDown' && historyIndex >= 0) {
      e.preventDefault();
      const newIndex = historyIndex - 1;
      if (newIndex >= 0) {
        setHistoryIndex(newIndex);
        setCommandText(commandHistory[newIndex]);
      } else {
        setHistoryIndex(-1);
        setCommandText('');
      }
      return;
    }
  };

  const handleSend = () => {
    if (!commandText.trim()) return;

    // Add to history
    setCommandHistory([commandText, ...commandHistory]);
    setHistoryIndex(-1);

    // Execute command
    onExecute(commandText);

    // Clear input
    setCommandText('');
  };

  const handleContinue = () => {
    if (!commandText.trim() || !currentSessionId) return;

    // Add to history
    setCommandHistory([commandText, ...commandHistory]);
    setHistoryIndex(-1);

    // Continue session
    onContinue?.(currentSessionId, commandText);

    // Clear input
    setCommandText('');
  };

  const handleInterrupt = () => {
    if (!currentSessionId) return;
    onInterrupt?.(currentSessionId);
  };

  return (
    <div className="command-input">
      <div className="command-input-header">
        <h3>Command</h3>
        <div className="command-input-hints">
          <span>Ctrl+Enter to send</span>
          <span>↑↓ for history</span>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        className="command-textarea"
        value={commandText}
        onChange={(e) => setCommandText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Enter command for Claude Code... (Ctrl+Enter to send)"
        rows={6}
        disabled={isExecuting}
      />

      <div className="command-input-actions">
        <button
          className="btn btn-primary"
          onClick={handleSend}
          disabled={!commandText.trim() || isExecuting}
        >
          {isExecuting ? 'Executing...' : 'Send'}
        </button>

        {currentSessionId && (
          <>
            <button
              className="btn btn-secondary"
              onClick={handleContinue}
              disabled={!commandText.trim() || isExecuting}
            >
              Continue
            </button>

            {isExecuting && (
              <button
                className="btn btn-danger"
                onClick={handleInterrupt}
              >
                Interrupt
              </button>
            )}
          </>
        )}
      </div>

      {commandHistory.length > 0 && (
        <div className="command-history-info">
          {commandHistory.length} command{commandHistory.length !== 1 ? 's' : ''} in history
        </div>
      )}
    </div>
  );
};

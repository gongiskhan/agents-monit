import React, { useState, useEffect } from 'react';
import { invoke } from '../api/electronAPI';
import type { HooksCheckResult, SetupResult } from '../api/electronAPI';

export const SetupBanner: React.FC = () => {
  const [hooksCheck, setHooksCheck] = useState<HooksCheckResult | null>(null);
  const [isRunningSetup, setIsRunningSetup] = useState(false);
  const [setupResult, setSetupResult] = useState<SetupResult | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkHooks();
  }, []);

  const checkHooks = async () => {
    try {
      const result = await invoke<HooksCheckResult>('check-hooks-installed');
      setHooksCheck(result);
    } catch (error) {
      console.error('Failed to check hooks:', error);
    }
  };

  const runSetup = async () => {
    setIsRunningSetup(true);
    setSetupResult(null);

    try {
      const result = await invoke<SetupResult>('run-setup-hooks');
      setSetupResult(result);

      if (result.success) {
        // Recheck hooks after successful setup
        await checkHooks();
      }
    } catch (error) {
      setSetupResult({
        success: false,
        output: '',
        error: String(error)
      });
    } finally {
      setIsRunningSetup(false);
    }
  };

  // Don't show if dismissed or hooks are installed
  if (dismissed || !hooksCheck || hooksCheck.installed) {
    return null;
  }

  return (
    <div className="setup-banner">
      <div className="setup-banner-content">
        <div className="setup-banner-icon">⚠️</div>
        <div className="setup-banner-text">
          <h3>Session Tracking Setup Required</h3>
          <p>
            Agents Bro needs to install hooks in <code>~/.claude/hooks</code> to track your Claude Code sessions.
          </p>
          {setupResult && (
            <div className={`setup-result ${setupResult.success ? 'success' : 'error'}`}>
              {setupResult.success ? (
                <span>✓ Hooks installed successfully! Restart Claude Code sessions to begin tracking.</span>
              ) : (
                <span>✗ Setup failed: {setupResult.error || 'Unknown error'}</span>
              )}
            </div>
          )}
        </div>
        <div className="setup-banner-actions">
          {!setupResult?.success && (
            <>
              <button
                className="setup-button primary"
                onClick={runSetup}
                disabled={isRunningSetup}
              >
                {isRunningSetup ? 'Installing...' : 'Install Hooks'}
              </button>
              <button
                className="setup-button secondary"
                onClick={() => setDismissed(true)}
              >
                Dismiss
              </button>
            </>
          )}
          {setupResult?.success && (
            <button
              className="setup-button secondary"
              onClick={() => setDismissed(true)}
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

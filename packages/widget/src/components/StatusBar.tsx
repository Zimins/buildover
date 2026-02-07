import { h } from 'preact';
import type { AIStatus } from '../types';

interface StatusBarProps {
  status: AIStatus;
  message?: string;
}

export function StatusBar({ status, message }: StatusBarProps) {
  if (status === 'idle') {
    return null;
  }

  const statusText = message || getDefaultStatusText(status);
  const icon = getStatusIcon(status);

  return (
    <div className={`buildover-status ${status}`}>
      <div className="buildover-status-icon">{icon}</div>
      <div>{statusText}</div>
    </div>
  );
}

function getDefaultStatusText(status: AIStatus): string {
  switch (status) {
    case 'analyzing':
      return 'AI is analyzing...';
    case 'editing':
      return 'AI is editing files...';
    case 'done':
      return 'Done!';
    default:
      return '';
  }
}

function getStatusIcon(status: AIStatus): string {
  switch (status) {
    case 'analyzing':
      return '🔍';
    case 'editing':
      return '✏️';
    case 'done':
      return '✓';
    default:
      return '';
  }
}

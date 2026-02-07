import { h } from 'preact';

interface FABProps {
  onClick: () => void;
  isOpen: boolean;
}

export function FAB({ onClick, isOpen }: FABProps) {
  if (isOpen) {
    return null; // Hide FAB when panel is open
  }

  return (
    <button className="buildover-fab" onClick={onClick} title="Open BuildOver AI">
      💬
    </button>
  );
}

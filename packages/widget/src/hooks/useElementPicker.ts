import { useState, useRef, useCallback } from 'preact/hooks';
import { generateSelector, type SelectorResult } from '../utils/generateSelector';

interface UseElementPickerOptions {
  onSelect: (result: SelectorResult) => void;
}

export function useElementPicker({ onSelect }: UseElementPickerOptions) {
  const [isActive, setIsActive] = useState(false);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const highlightRef = useRef<HTMLDivElement | null>(null);
  const lastTargetRef = useRef<Element | null>(null);
  // Store refs to listeners so we can remove them
  const listenersRef = useRef<{
    move: (e: MouseEvent) => void;
    click: (e: MouseEvent) => void;
    key: (e: KeyboardEvent) => void;
  } | null>(null);

  const cleanup = useCallback(() => {
    if (listenersRef.current) {
      const overlay = overlayRef.current;
      if (overlay) {
        overlay.removeEventListener('mousemove', listenersRef.current.move);
        overlay.removeEventListener('click', listenersRef.current.click);
      }
      document.removeEventListener('keydown', listenersRef.current.key, { capture: true });
      listenersRef.current = null;
    }
    overlayRef.current?.remove();
    highlightRef.current?.remove();
    overlayRef.current = null;
    highlightRef.current = null;
    lastTargetRef.current = null;
    setIsActive(false);
  }, []);

  const activate = useCallback(() => {
    if (overlayRef.current) return;

    // Full-screen transparent overlay to capture mouse events
    const overlay = document.createElement('div');
    overlay.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:2147483646',
      'cursor:crosshair',
      'background:transparent',
    ].join(';');

    // Highlight box shown over hovered element
    const highlight = document.createElement('div');
    highlight.style.cssText = [
      'position:fixed',
      'z-index:2147483645',
      'pointer-events:none',
      'border:2px solid #3b82f6',
      'background:rgba(59,130,246,0.12)',
      'border-radius:3px',
      'box-sizing:border-box',
      'transition:top 0.05s,left 0.05s,width 0.05s,height 0.05s',
      'display:none',
    ].join(';');

    const handleMouseMove = (e: MouseEvent) => {
      overlay.style.pointerEvents = 'none';
      const target = document.elementFromPoint(e.clientX, e.clientY);
      overlay.style.pointerEvents = 'auto';

      if (!target || target === document.body || target === document.documentElement) {
        highlight.style.display = 'none';
        lastTargetRef.current = null;
        return;
      }

      lastTargetRef.current = target;
      const rect = target.getBoundingClientRect();
      highlight.style.display = 'block';
      highlight.style.left = `${rect.left}px`;
      highlight.style.top = `${rect.top}px`;
      highlight.style.width = `${rect.width}px`;
      highlight.style.height = `${rect.height}px`;
    };

    const handleClick = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const target = lastTargetRef.current;
      cleanup();
      if (target) {
        onSelect(generateSelector(target));
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup();
      }
    };

    overlay.addEventListener('mousemove', handleMouseMove);
    overlay.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown, { capture: true });

    listenersRef.current = {
      move: handleMouseMove,
      click: handleClick,
      key: handleKeyDown,
    };

    document.body.appendChild(highlight);
    document.body.appendChild(overlay);

    overlayRef.current = overlay;
    highlightRef.current = highlight;
    setIsActive(true);
  }, [cleanup, onSelect]);

  const deactivate = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return { isActive, activate, deactivate };
}

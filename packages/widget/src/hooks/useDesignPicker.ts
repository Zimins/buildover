import { useState, useRef, useCallback } from 'preact/hooks';
import { generateSelector } from '../utils/generateSelector';
import { rgbToHex } from '../utils/colorUtils';
import type { DesignElementInfo } from '../types';

const TEXT_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'span', 'a', 'li', 'td', 'th',
  'label', 'button', 'blockquote', 'caption',
  'dt', 'dd', 'figcaption', 'legend', 'summary',
]);

const EDITABLE_PROPS = [
  'fontSize', 'color', 'letterSpacing', 'lineHeight', 'fontWeight', 'fontFamily',
] as const;

function isTextElement(el: Element): boolean {
  if (TEXT_TAGS.has(el.tagName.toLowerCase())) return true;
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim()) return true;
  }
  return false;
}

/** Walk up from el to find the nearest text element ancestor, or search immediate text children */
function findTextElement(el: Element): Element | null {
  if (isTextElement(el)) return el;

  let parent = el.parentElement;
  for (let i = 0; i < 3 && parent; i++) {
    if (isTextElement(parent) && parent !== document.body && parent !== document.documentElement) {
      return parent;
    }
    parent = parent.parentElement;
  }

  const queue: Element[] = [el];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const child of Array.from(curr.children)) {
      if (child.closest('#buildover-widget-host')) continue;
      if (isTextElement(child)) return child;
      queue.push(child);
    }
  }

  return null;
}

function readComputedStyles(el: Element): Record<string, string> {
  const cs = getComputedStyle(el);
  const styles: Record<string, string> = {};
  for (const prop of EDITABLE_PROPS) {
    let val = cs[prop] as string;
    if (prop === 'color') val = rgbToHex(val);
    if (prop === 'letterSpacing' && val === 'normal') val = '0px';
    styles[prop] = val;
  }
  return styles;
}

function makeHighlightDiv(color: string, bg: string): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'z-index:99990', 'pointer-events:none',
    `border:2px solid ${color}`, `background:${bg}`,
    'border-radius:3px', 'box-sizing:border-box',
    'transition:top 0.08s,left 0.08s,width 0.08s,height 0.08s',
    'display:none',
  ].join(';');
  return el;
}

function positionHighlight(el: HTMLDivElement, target: Element) {
  const rect = target.getBoundingClientRect();
  el.style.display = 'block';
  el.style.left = `${rect.left}px`;
  el.style.top = `${rect.top}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
}

interface UseDesignPickerOptions {
  onSelect: (info: DesignElementInfo) => void;
}

export function useDesignPicker({ onSelect }: UseDesignPickerOptions) {
  const [isActive, setIsActive] = useState(false);
  const hoverHighlightRef = useRef<HTMLDivElement | null>(null);
  const selectHighlightRef = useRef<HTMLDivElement | null>(null);
  const lastTargetRef = useRef<Element | null>(null);
  const selectedElementRef = useRef<Element | null>(null);
  const listenersRef = useRef<{
    move: (e: MouseEvent) => void;
    click: (e: MouseEvent) => void;
    key: (e: KeyboardEvent) => void;
  } | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const cleanup = useCallback(() => {
    if (listenersRef.current) {
      document.removeEventListener('mousemove', listenersRef.current.move, true);
      document.removeEventListener('click', listenersRef.current.click, true);
      document.removeEventListener('keydown', listenersRef.current.key, true);
      listenersRef.current = null;
    }
    hoverHighlightRef.current?.remove();
    selectHighlightRef.current?.remove();
    hoverHighlightRef.current = null;
    selectHighlightRef.current = null;
    lastTargetRef.current = null;
    selectedElementRef.current = null;
    document.body.style.cursor = '';
    setIsActive(false);
  }, []);

  const activate = useCallback(() => {
    if (listenersRef.current) return;

    // Hover highlight: light green dashed
    const hoverHL = makeHighlightDiv('#10b981', 'rgba(16,185,129,0.08)');
    hoverHL.style.borderStyle = 'dashed';

    // Selection highlight: solid green
    const selectHL = makeHighlightDiv('#10b981', 'rgba(16,185,129,0.12)');

    document.body.appendChild(selectHL);
    document.body.appendChild(hoverHL);
    hoverHighlightRef.current = hoverHL;
    selectHighlightRef.current = selectHL;

    document.body.style.cursor = 'crosshair';

    const handleMouseMove = (e: MouseEvent) => {
      const raw = e.target as Element;

      // When mouse is over the widget (sidebar), just hide hover highlight but keep selection
      if (!raw || raw === document.body || raw === document.documentElement || raw.closest('#buildover-widget-host')) {
        hoverHL.style.display = 'none';
        lastTargetRef.current = null;
        return;
      }

      const target = findTextElement(raw);
      if (!target) {
        hoverHL.style.display = 'none';
        lastTargetRef.current = null;
        return;
      }

      lastTargetRef.current = target;

      // Don't show hover highlight if it's the same as the selected element
      if (target === selectedElementRef.current) {
        hoverHL.style.display = 'none';
        return;
      }

      positionHighlight(hoverHL, target);
    };

    const handleClick = (e: MouseEvent) => {
      const clickTarget = e.target as Element;
      if (clickTarget?.closest('#buildover-widget-host')) return;

      e.preventDefault();
      e.stopPropagation();

      const target = lastTargetRef.current;
      if (!target) return;

      // Update selection highlight
      selectedElementRef.current = target;
      positionHighlight(selectHL, target);
      hoverHL.style.display = 'none';

      const { selector, tagName } = generateSelector(target);
      const info: DesignElementInfo = {
        selector,
        tagName,
        textContent: (target.textContent || '').trim().substring(0, 100),
        classes: Array.from(target.classList),
        id: target.id || '',
        computedStyles: readComputedStyles(target),
      };

      onSelectRef.current(info);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cleanup();
      }
    };

    document.addEventListener('mousemove', handleMouseMove, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown, true);

    listenersRef.current = {
      move: handleMouseMove,
      click: handleClick,
      key: handleKeyDown,
    };

    setIsActive(true);
  }, [cleanup]);

  const deactivate = useCallback(() => {
    cleanup();
  }, [cleanup]);

  return { isActive, activate, deactivate };
}

export interface SelectorResult {
  selector: string;
  tagName: string;
}

export function generateSelector(el: Element): SelectorResult {
  const tagName = el.tagName.toLowerCase();

  // Use id if available
  if (el.id && !el.id.startsWith('buildover')) {
    return { selector: `#${CSS.escape(el.id)}`, tagName };
  }

  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body && current !== document.documentElement) {
    let segment = current.tagName.toLowerCase();

    // Add classes, filtering out buildover-* classes
    const classes = Array.from(current.classList)
      .filter(c => !c.startsWith('buildover'))
      .map(c => `.${CSS.escape(c)}`);

    if (classes.length > 0) {
      segment += classes.join('');
    }

    // Add nth-child if sibling disambiguation needed
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        s => s.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const idx = siblings.indexOf(current) + 1;
        segment += `:nth-of-type(${idx})`;
      }
    }

    parts.unshift(segment);
    current = current.parentElement;

    // Verify uniqueness at each step — stop early if already unique
    const candidate = parts.join(' > ');
    if (document.querySelectorAll(candidate).length === 1) {
      break;
    }
  }

  let selector = parts.join(' > ');

  // Truncate if too long
  if (selector.length > 100) {
    selector = selector.slice(-100);
    // Trim to valid start (avoid starting mid-segment)
    const firstArrow = selector.indexOf(' > ');
    if (firstArrow !== -1) {
      selector = selector.slice(firstArrow + 3);
    }
  }

  return { selector, tagName };
}

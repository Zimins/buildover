import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import type { DesignElementInfo } from '../types';

interface DesignSidebarProps {
  isOpen: boolean;
  element: DesignElementInfo | null;
  onPropertyChange: (property: string, value: string) => void;
  onClose: () => void;
}

const FONT_WEIGHTS = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];

function parseNumeric(val: string): string {
  const num = parseFloat(val);
  return isNaN(num) ? '0' : String(num);
}

function camelToKebab(s: string): string {
  return s.replace(/[A-Z]/g, m => '-' + m.toLowerCase());
}

export function DesignSidebar({ isOpen, element, onPropertyChange, onClose }: DesignSidebarProps) {
  const [fontSize, setFontSize] = useState('');
  const [color, setColor] = useState('');
  const [letterSpacing, setLetterSpacing] = useState('');
  const [lineHeight, setLineHeight] = useState('');
  const [fontWeight, setFontWeight] = useState('');
  const [fontFamily, setFontFamily] = useState('');

  // Sync from element
  useEffect(() => {
    if (!element) return;
    const s = element.computedStyles;
    setFontSize(parseNumeric(s.fontSize || ''));
    setColor(s.color || '#000000');
    setLetterSpacing(parseNumeric(s.letterSpacing || ''));
    setLineHeight(parseNumeric(s.lineHeight || ''));
    setFontWeight(String(parseInt(s.fontWeight || '400', 10)));
    setFontFamily(s.fontFamily || '');
  }, [element]);

  if (!isOpen) return null;

  const label = element
    ? `<${element.tagName}> ${element.id ? '#' + element.id : ''}${element.classes.length ? '.' + element.classes.join('.') : ''}`
    : '';

  const textPreview = element?.textContent
    ? `"${element.textContent.length > 40 ? element.textContent.substring(0, 40) + '...' : element.textContent}"`
    : '';

  const handleChange = (cssProp: string, value: string) => {
    onPropertyChange(cssProp, value);
  };

  return (
    <div className="buildover-design-sidebar">
      <div className="buildover-design-header">
        <span className="buildover-design-title">Design</span>
        <button className="buildover-design-close" onClick={onClose} title="Close">✕</button>
      </div>

      {!element ? (
        <div className="buildover-design-empty">
          Click a text element on the page to select it
        </div>
      ) : (
        <div className="buildover-design-body">
          <div className="buildover-design-element-info">
            <span className="buildover-design-element-tag">{label}</span>
            {textPreview && <span className="buildover-design-element-text">{textPreview}</span>}
          </div>

          <div className="buildover-design-section-title">Text Properties</div>

          <div className="buildover-design-field">
            <label>Font Size</label>
            <div className="buildover-design-input-group">
              <input
                type="number"
                value={fontSize}
                onInput={(e) => {
                  const v = (e.target as HTMLInputElement).value;
                  setFontSize(v);
                  handleChange('font-size', v + 'px');
                }}
                min="1"
                step="1"
              />
              <span className="buildover-design-unit">px</span>
            </div>
          </div>

          <div className="buildover-design-field">
            <label>Color</label>
            <div className="buildover-design-color-group">
              <input
                type="color"
                value={color}
                onInput={(e) => {
                  const v = (e.target as HTMLInputElement).value;
                  setColor(v);
                  handleChange('color', v);
                }}
              />
              <input
                type="text"
                value={color}
                className="buildover-design-color-text"
                onInput={(e) => {
                  const v = (e.target as HTMLInputElement).value;
                  setColor(v);
                  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
                    handleChange('color', v);
                  }
                }}
              />
            </div>
          </div>

          <div className="buildover-design-field">
            <label>Letter Spacing</label>
            <div className="buildover-design-input-group">
              <input
                type="number"
                value={letterSpacing}
                onInput={(e) => {
                  const v = (e.target as HTMLInputElement).value;
                  setLetterSpacing(v);
                  handleChange('letter-spacing', v + 'px');
                }}
                step="0.5"
              />
              <span className="buildover-design-unit">px</span>
            </div>
          </div>

          <div className="buildover-design-field">
            <label>Line Height</label>
            <div className="buildover-design-input-group">
              <input
                type="number"
                value={lineHeight}
                onInput={(e) => {
                  const v = (e.target as HTMLInputElement).value;
                  setLineHeight(v);
                  handleChange('line-height', v + 'px');
                }}
                min="1"
                step="1"
              />
              <span className="buildover-design-unit">px</span>
            </div>
          </div>

          <div className="buildover-design-field">
            <label>Font Weight</label>
            <select
              value={fontWeight}
              onChange={(e) => {
                const v = (e.target as HTMLSelectElement).value;
                setFontWeight(v);
                handleChange('font-weight', v);
              }}
            >
              {FONT_WEIGHTS.map(w => (
                <option key={w} value={w}>{w}</option>
              ))}
            </select>
          </div>

          <div className="buildover-design-field">
            <label>Font Family</label>
            <input
              type="text"
              value={fontFamily}
              readOnly
              className="buildover-design-readonly"
              title="Read-only in v1"
            />
          </div>
        </div>
      )}
    </div>
  );
}

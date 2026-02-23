import { h } from 'preact';

interface ElementChipProps {
  tagName: string;
  selector: string;
  onRemove: () => void;
}

export function ElementChip({ tagName, selector, onRemove }: ElementChipProps) {
  return (
    <div className="buildover-element-chip" title={selector}>
      <span className="buildover-element-chip-tag">&lt;{tagName}&gt;</span>
      <span className="buildover-element-chip-selector">{selector}</span>
      <button
        className="buildover-element-chip-remove"
        onClick={onRemove}
        title="선택 해제"
        type="button"
      >
        ×
      </button>
    </div>
  );
}

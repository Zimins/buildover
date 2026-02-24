'use client';

import React, { useRef, useEffect, CSSProperties } from 'react';

interface MagnetLinesProps {
  rows?: number;
  columns?: number;
  containerSize?: string;
  lineColor?: string;
  lineWidth?: string;
  lineHeight?: string;
  baseAngle?: number;
  style?: CSSProperties;
  className?: string;
}

export default function MagnetLines({
  rows = 9,
  columns = 9,
  containerSize = '100%',
  lineColor = 'rgba(251,146,60,0.55)',
  lineWidth = '1px',
  lineHeight = '40px',
  baseAngle = -10,
  style = {},
  className = '',
}: MagnetLinesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const linesRef = useRef<HTMLSpanElement[]>([]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      linesRef.current.forEach((line) => {
        if (!line) return;
        const lineRect = line.getBoundingClientRect();
        const lineCenterX = lineRect.left + lineRect.width / 2 - rect.left;
        const lineCenterY = lineRect.top + lineRect.height / 2 - rect.top;

        const dx = mouseX - lineCenterX;
        const dy = mouseY - lineCenterY;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        line.style.transform = `rotate(${angle}deg)`;
      });
    };

    const handleMouseLeave = () => {
      linesRef.current.forEach((line) => {
        if (!line) return;
        line.style.transform = `rotate(${baseAngle}deg)`;
      });
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [baseAngle]);

  const totalLines = rows * columns;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        width: containerSize,
        height: containerSize === '100%' ? '100%' : containerSize,
        ...style,
      }}
    >
      {Array.from({ length: totalLines }).map((_, i) => (
        <span
          key={i}
          ref={(el) => {
            if (el) linesRef.current[i] = el;
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
          }}
        >
          <span
            style={{
              display: 'block',
              width: lineWidth,
              height: lineHeight,
              backgroundColor: lineColor,
              borderRadius: '9999px',
              transform: `rotate(${baseAngle}deg)`,
              transition: 'transform 0.12s ease-out',
              willChange: 'transform',
            }}
          />
        </span>
      ))}
    </div>
  );
}

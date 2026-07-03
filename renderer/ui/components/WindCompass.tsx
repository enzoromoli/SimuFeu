import { useCallback, useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import './WindCompass.css';

const DIRECTIONS = [
  'Nord', 'Nord-Nord-Est', 'Nord-Est', 'Est-Nord-Est',
  'Est', 'Est-Sud-Est', 'Sud-Est', 'Sud-Sud-Est',
  'Sud', 'Sud-Sud-Ouest', 'Sud-Ouest', 'Ouest-Sud-Ouest',
  'Ouest', 'Ouest-Nord-Ouest', 'Nord-Ouest', 'Nord-Nord-Ouest',
];

const TICKS = Array.from({ length: 16 }, (_, i) => i * 22.5);

function directionLabel(deg: number): string {
  const index = Math.round(deg / 22.5) % 16;
  return DIRECTIONS[index] ?? 'Nord';
}

interface WindCompassProps {
  value: number;
  onChange: (deg: number) => void;
  disabled?: boolean;
}

export default function WindCompass({ value, onChange, disabled = false }: WindCompassProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);

  const angleFromPointer = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const angle = Math.atan2(dx, -dy) * (180 / Math.PI);
    return Math.round((angle + 360) % 360);
  }, []);

  const handlePointerMove = useCallback((event: PointerEvent) => {
    if (!draggingRef.current) return;
    onChange(angleFromPointer(event.clientX, event.clientY));
  }, [angleFromPointer, onChange]);

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false;
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  }, [handlePointerMove]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    draggingRef.current = true;
    onChange(angleFromPointer(event.clientX, event.clientY));
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [disabled, angleFromPointer, handlePointerMove, handlePointerUp, onChange]);

  const handleKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      onChange((value + 1) % 360);
      event.preventDefault();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      onChange((value + 359) % 360);
      event.preventDefault();
    }
  }, [disabled, value, onChange]);

  useEffect(() => () => {
    window.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
  }, [handlePointerMove, handlePointerUp]);

  return (
    <div
      className={`compass${disabled ? ' compass--disabled' : ''}`}
      title={disabled ? 'Désactivez AUTO pour ajuster manuellement' : undefined}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Direction du vent"
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={value}
      aria-valuetext={`${value}° (${directionLabel(value)})`}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    >
      <svg ref={svgRef} className="compass-dial" viewBox="0 0 200 200" aria-hidden="true">
        <circle className="compass-ring" cx="100" cy="100" r="96" />
        <circle className="compass-ring-inner" cx="100" cy="100" r="72" />
        <g className="compass-ticks">
          {TICKS.map((deg) => (
            <line
              key={deg}
              className={`compass-tick${deg % 90 === 0 ? ' compass-tick--major' : ''}`}
              x1="100"
              y1="6"
              x2="100"
              y2={deg % 90 === 0 ? 20 : 14}
              transform={`rotate(${deg} 100 100)`}
            />
          ))}
        </g>
        <text className="compass-label" x="100" y="22" textAnchor="middle">N</text>
        <text className="compass-label" x="178" y="105" textAnchor="middle">E</text>
        <text className="compass-label" x="100" y="186" textAnchor="middle">S</text>
        <text className="compass-label" x="22" y="105" textAnchor="middle">O</text>
        <g className="compass-needle" transform={`rotate(${value} 100 100)`}>
          <line x1="100" y1="100" x2="100" y2="30" className="compass-needle__line" />
          <polygon points="100,18 89,38 111,38" className="compass-needle__head" />
          <circle cx="100" cy="100" r="7" className="compass-needle__hub" />
        </g>
      </svg>
      <div className="compass-readout">
        <strong>{value}°</strong>
        <span>{directionLabel(value)}</span>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

interface Props {
  value: string;
  max: string;
  onChange: (value: string) => void;
}

function parseYM(ym: string): [number, number] {
  const parts = ym.split('-');
  const y = parseInt(parts[0]) || new Date().getFullYear();
  const m = (parseInt(parts[1]) || 1) - 1;
  return [y, m];
}

export default function MonthPicker({ value, max, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [selectedYear, selectedMonth] = parseYM(value);
  const [maxYear, maxMonth] = parseYM(max);
  const [viewYear, setViewYear] = useState(selectedYear);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function isDisabled(monthIdx: number): boolean {
    if (viewYear > maxYear) return true;
    if (viewYear === maxYear && monthIdx > maxMonth) return true;
    return false;
  }

  function select(monthIdx: number) {
    if (isDisabled(monthIdx)) return;
    onChange(`${viewYear}-${String(monthIdx + 1).padStart(2, '0')}`);
    setOpen(false);
  }

  const displayLabel = `${MONTHS[selectedMonth]} ${selectedYear}`;

  return (
    <div className="mp" ref={ref}>
      <button
        type="button"
        className="mp-trigger"
        onClick={() => { setOpen(!open); setViewYear(selectedYear); }}
      >
        <span>{displayLabel}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div className="mp-dropdown">
          <div className="mp-header">
            <button type="button" className="mp-arrow" onClick={() => setViewYear(y => y - 1)}>‹</button>
            <span className="mp-year">{viewYear}</span>
            <button
              type="button"
              className="mp-arrow"
              onClick={() => setViewYear(y => y + 1)}
              disabled={viewYear >= maxYear}
            >›</button>
          </div>
          <div className="mp-grid">
            {MONTHS.map((m, i) => {
              const off = isDisabled(i);
              const active = viewYear === selectedYear && i === selectedMonth;
              return (
                <button
                  key={m}
                  type="button"
                  className={`mp-cell ${active ? 'active' : ''} ${off ? 'disabled' : ''}`}
                  disabled={off}
                  onClick={() => select(i)}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

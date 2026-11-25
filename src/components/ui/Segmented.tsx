import React from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  // Text colour of the chosen option; the pill itself is always white
  activeClassName?: string;
  className?: string;
  // The track behind the options; darker where the page itself is light grey
  trackClassName?: string;
  size?: 'md' | 'sm';
}

// Track padding and the gap between options, in px - the pill's maths depends on both
const PAD = 4;
const GAP = 4;

/**
 * A row of mutually exclusive choices whose white pill glides to the one picked.
 *
 * There is one pill, moved with a CSS transform, so it travels between positions
 * rather than vanishing from one and appearing at the next - the eye follows the
 * selection instead of having to find it again. (It deliberately is not a Motion
 * shared-layout element: inside a drawer that is closing, one of those keeps the
 * drawer from ever being removed.)
 */
function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  activeClassName = 'text-blue-700',
  className = '',
  trackClassName = 'bg-gray-100',
  size = 'md'
}: SegmentedProps<T>) {
  const count = options.length;
  const index = Math.max(0, options.findIndex(option => option.value === value));

  return (
    <div
      role="group"
      aria-label={label}
      className={`relative grid rounded-[14px] ${trackClassName} ${className}`}
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`, gap: GAP, padding: PAD }}
    >
      <span
        aria-hidden="true"
        className="absolute rounded-[10px] bg-white shadow-sm"
        style={{
          top: PAD,
          bottom: PAD,
          left: PAD,
          width: `calc((100% - ${PAD * 2 + GAP * (count - 1)}px) / ${count})`,
          transform: `translateX(calc(${index} * (100% + ${GAP}px)))`,
          transition: 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)'
        }}
      />
      {options.map(option => {
        const on = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(option.value)}
            className={`relative z-10 ${size === 'sm' ? 'h-10 text-sm' : 'h-11 text-[15px]'} rounded-[10px] font-semibold transition-colors duration-200 ${
              on ? activeClassName : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            <span className="flex items-center justify-center gap-2">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default Segmented;

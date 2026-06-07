type BaseOccupancyProps = {
  first?: boolean;
  second?: boolean;
  third?: boolean;
  size?: number;
  className?: string;
};

export default function BaseOccupancy({
  first = false,
  second = false,
  third = false,
  size = 72,
  className = "",
}: BaseOccupancyProps) {
  const activeBase = "fill-yellow-400 stroke-yellow-200";
  const inactiveBase = "fill-zinc-800/90 stroke-zinc-500";

  return (
    <div
      className={`inline-flex items-center justify-center rounded-xl bg-zinc-950/90 ring-1 ring-white/10 shadow-lg px-2 py-1 ${className}`}
      aria-label={`Bases occupied: ${[
        first ? "first" : null,
        second ? "second" : null,
        third ? "third" : null,
      ]
        .filter(Boolean)
        .join(", ") || "none"}`}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        role="img"
        aria-hidden="true"
      >
        <defs>
          <filter id="baseGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* subtle connecting infield lines */}
        <path
          d="M50 20 L80 50 L50 80 L20 50 Z"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1.5"
        />

        {/* second */}
        <g transform="translate(50 20) rotate(45)">
          <rect
            x="-8"
            y="-8"
            width="16"
            height="16"
            rx="1.5"
            className={second ? activeBase : inactiveBase}
            strokeWidth="2"
            filter={second ? "url(#baseGlow)" : undefined}
          />
        </g>

        {/* third */}
        <g transform="translate(20 50) rotate(45)">
          <rect
            x="-8"
            y="-8"
            width="16"
            height="16"
            rx="1.5"
            className={third ? activeBase : inactiveBase}
            strokeWidth="2"
            filter={third ? "url(#baseGlow)" : undefined}
          />
        </g>

        {/* first */}
        <g transform="translate(80 50) rotate(45)">
          <rect
            x="-8"
            y="-8"
            width="16"
            height="16"
            rx="1.5"
            className={first ? activeBase : inactiveBase}
            strokeWidth="2"
            filter={first ? "url(#baseGlow)" : undefined}
          />
        </g>
      </svg>
    </div>
  );
}
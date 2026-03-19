/**
 * Transparent wordmark — no raster “white box”. Uses app fonts (Geist) + brand colors.
 * The “C” in Chore includes a teal checkmark (completed chore motif).
 */
function ChoreWithCheckmark() {
  return (
    <span className="inline-flex items-baseline text-slate-800">
      {/* Only the “C” is the positioning context so the check scales with the letter */}
      <span className="relative inline-block align-baseline">
        <span className="font-extrabold leading-none select-none">C</span>
        <svg
          className="pointer-events-none absolute text-ease-teal
            left-[0.05em] top-[24%] w-[0.48em] h-[0.48em]
            [filter:drop-shadow(0_0.5px_0_rgba(255,255,255,0.85))]"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <path
            d="M6 12.5 L10.8 17.2 L18.5 7.5"
            stroke="currentColor"
            strokeWidth="3.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="font-extrabold leading-none">hore</span>
    </span>
  )
}

export function ScoreChoreLogo({
  variant = 'header',
  className = '',
}: {
  /** hero: landing page · header: kid board · nav: parent bar */
  variant?: 'hero' | 'header' | 'nav'
  className?: string
}) {
  const sizes = {
    hero:
      'text-[2.85rem] leading-[0.95] sm:text-6xl sm:leading-none md:text-7xl md:leading-none lg:text-8xl',
    header:
      'text-[2.35rem] leading-none sm:text-[2.65rem] sm:leading-none min-[480px]:text-[3rem]',
    nav: 'text-[2.15rem] leading-none sm:text-[2.5rem] sm:leading-none md:text-[3rem] md:leading-none',
  }

  return (
    <span
      className={`inline-flex items-baseline font-extrabold tracking-tight ${sizes[variant]} ${className}`}
    >
      <span className="text-ease-teal">Score</span>
      <ChoreWithCheckmark />
    </span>
  )
}

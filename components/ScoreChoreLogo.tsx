/**
 * Transparent wordmark — no raster “white box”. Uses app fonts (Geist) + brand colors.
 */
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
      'text-[2.1rem] leading-none sm:text-5xl sm:leading-none min-[480px]:text-[2.75rem]',
    nav: 'text-[2rem] leading-none sm:text-[2.35rem] sm:leading-none md:text-[2.85rem] md:leading-none',
  }

  return (
    <span
      className={`inline-flex items-baseline font-extrabold tracking-tight ${sizes[variant]} ${className}`}
    >
      <span className="text-ease-teal">Score</span>
      <span className="text-slate-800">Chore</span>
    </span>
  )
}

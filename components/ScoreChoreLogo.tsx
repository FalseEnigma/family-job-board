import Image from 'next/image'

const VARIANT_CLASSES = {
  /** Landing — large */
  hero: 'h-16 sm:h-24 md:h-28 lg:h-32 w-auto max-w-full',
  /** Kid board header */
  header: 'h-11 sm:h-14 min-[480px]:h-16 w-auto max-w-[min(100%,360px)]',
  /** Parent toolbar — aligns with tab row */
  nav: 'h-9 sm:h-10 md:h-11 w-auto',
} as const

/**
 * Brand mark from `/public/scorechore-logo.svg` (transparent, includes check-in-C).
 */
export function ScoreChoreLogo({
  variant = 'header',
  className = '',
  priority = false,
}: {
  variant?: keyof typeof VARIANT_CLASSES
  className?: string
  /** Set true for LCP (e.g. home hero) */
  priority?: boolean
}) {
  return (
    <Image
      src="/scorechore-logo.svg"
      alt="ScoreChore"
      width={480}
      height={90}
      priority={priority}
      className={`${VARIANT_CLASSES[variant]} ${className}`.trim()}
    />
  )
}

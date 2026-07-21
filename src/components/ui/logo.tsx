import Link from 'next/link'

interface LogoProps {
  className?: string
  width?: number
  height?: number
  linkTo?: string
  showLink?: boolean
  center?: boolean
}

export function Logo({
  className = '',
  width = 140,
  height = 21,
  linkTo = '/',
  showLink = true,
  center = false,
}: LogoProps) {
  // Inline SVG so the wordmark uses `currentColor` for "Serika" — this makes it
  // legible in both light and dark themes (the old /logo.svg was hardcoded white
  // and disappeared on the light background).
  const logoImage = (
    <svg
      width={width}
      height={height}
      viewBox="0 0 400 60"
      className={`text-foreground ${className}`}
      role="img"
      aria-label="SerikaGifs"
      style={{ display: 'block' }}
    >
      <text
        x={center ? "200" : "0"}
        y="45"
        textAnchor={center ? "middle" : "start"}
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="48"
        fontWeight="800"
        letterSpacing="-0.5"
      >
        <tspan fill="currentColor">Serika</tspan>
        <tspan fill="#8b5cf6">Gifs</tspan>
      </text>
    </svg>
  )

  if (showLink) {
    return (
      <Link href={linkTo} className="flex items-center">
        {logoImage}
      </Link>
    )
  }

  return logoImage
}

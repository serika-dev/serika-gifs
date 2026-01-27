import Image from 'next/image'
import Link from 'next/link'

interface LogoProps {
  className?: string
  width?: number
  height?: number
  linkTo?: string
  showLink?: boolean
}

export function Logo({
  className = '',
  width = 140,
  height = 21,
  linkTo = '/',
  showLink = true,
}: LogoProps) {
  const logoImage = (
    <Image
      src="/logo.svg"
      alt="SerikaGifs"
      width={width}
      height={height}
      className={className}
      priority
    />
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

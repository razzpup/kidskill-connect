import Image from 'next/image'

/** The KidsConnect wordmark. Fixed aspect ratio (433x126) — size by height only. */
export function Logo({ height = 32, className = '' }: { height?: number; className?: string }) {
  const width = Math.round((height * 433) / 126)
  return (
    <Image
      src="/logo.png"
      alt="KidsConnect"
      width={width}
      height={height}
      priority
      className={`shrink-0 ${className}`}
      style={{ height, width: 'auto' }}
    />
  )
}

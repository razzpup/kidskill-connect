import type { Metadata, Viewport } from 'next'
import { Baloo_2, Inter, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'

const display = Baloo_2({ subsets: ['latin'], weight: ['500', '600', '700', '800'], variable: '--font-display-raw' })
const body = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-sans-raw' })
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['500', '600'], variable: '--font-mono-raw' })

export const metadata: Metadata = {
  title: 'KidsConnect',
  description:
    'Vetted local coaches for kids, paid per verified class — and a documented skill history the child keeps.',
}

export const viewport: Viewport = {
  themeColor: '#2B2E86',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}

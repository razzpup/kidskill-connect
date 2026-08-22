import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'KidSkill Connect',
  description:
    'Vetted local trainers for kids, paid per verified class — and a documented skill history the child keeps.',
}

export const viewport: Viewport = {
  themeColor: '#F2F4F1',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>{children}</body>
    </html>
  )
}

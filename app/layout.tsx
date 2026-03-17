import type { Metadata } from 'next'
import 'react-notion-x/src/styles.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'hyeonlog',
  description: 'hyeonlog',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}

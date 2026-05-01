import type { Metadata } from 'next'
import 'react-notion-x/src/styles.css'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'hyeonlog',
    template: '%s | hyeonlog',
  },
  description: '베를린에서 살며 배운 것들을 기록합니다. 여행, 일상, 그리고 생각.',
  metadataBase: new URL('https://hyeonlog-com.vercel.app'),
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://hyeonlog-com.vercel.app',
    siteName: 'hyeonlog',
    title: 'hyeonlog',
    description: '베를린에서 살며 배운 것들을 기록합니다. 여행, 일상, 그리고 생각.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'hyeonlog',
    description: '베를린에서 살며 배운 것들을 기록합니다.',
  },
  verification: {
    google: 'nE7uKdl_qS5xt0EM1lgkhESspA10lIdY7oWbmsDiTTE',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}

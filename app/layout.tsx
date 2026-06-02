import type { Metadata, Viewport } from 'next'
import { Noto_Sans_KR } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const notoSansKR = Noto_Sans_KR({ 
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-kr"
});

export const metadata: Metadata = {
  title: 'QNow - 실시간 대기시간 알림 서비스',
  description: '지정한 장소의 실시간 대기시간, 대기 인원, 혼잡도를 확인하고 공유하세요',
  generator: 'v0.app',
  icons: {
    icon: '/QNow_icon-removebg-preview.png',
    apple: '/QNow_icon-removebg-preview.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#4B6BFB',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko">
      <body className={`${notoSansKR.variable} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}

import type { Metadata, Viewport } from 'next'
import { Noto_Sans_KR } from 'next/font/google'
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
      <head>
        {/* 구글 애드센스 — Next.js <Script>는 data-nscript를 추가해 AdSense 경고를 유발하므로 plain <script> 사용 */}
        <script
          async
          crossOrigin="anonymous"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9580039077255456"
        />
      </head>
      <body className={`${notoSansKR.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  )
}

"use client"

import { useEffect, useRef } from "react"

declare global {
  interface Window {
    adsbygoogle?: unknown[]
  }
}

const AD_CLIENT = "ca-pub-9580039077255456"

interface AdBannerProps {
  /** 애드센스 광고 단위 슬롯 ID */
  slot: string
  className?: string
  /** 광고 형식 (기본 auto) */
  format?: string
  /** 전체 너비 반응형 (기본 true) */
  responsive?: boolean
}

export function AdBanner({ slot, className, format = "auto", responsive = true }: AdBannerProps) {
  // 마운트당 1회만 push (StrictMode 중복 렌더 / 재마운트 시 중복 광고 요청 방지)
  const pushed = useRef(false)

  useEffect(() => {
    if (pushed.current) return
    try {
      ;(window.adsbygoogle = window.adsbygoogle || []).push({})
      pushed.current = true
    } catch (e) {
      // 로더 스크립트 미로드(광고 차단기 등) 시 조용히 무시
      console.error("[AdBanner] adsbygoogle push error:", e)
    }
  }, [])

  return (
    <ins
      className={`adsbygoogle ${className ?? ""}`}
      style={{ display: "block" }}
      data-ad-client={AD_CLIENT}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive ? "true" : "false"}
    />
  )
}

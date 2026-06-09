"use client"

import { useEffect, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

export interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  signInWithKakao: () => Promise<void>
  switchKakaoAccount: () => Promise<void>
  signOut: () => Promise<void>
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // 만료·무효 리프레시 토큰 → localStorage 정리 후 비로그인 처리
        // Supabase가 내부적으로 console.error를 찍지만 동작에는 영향 없음
        supabase.auth.signOut().catch(() => {})
        setSession(null)
        setUser(null)
        setIsLoading(false)
        return
      }
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESHED: 세션 갱신 성공 / SIGNED_OUT: 리프레시 실패 후 자동 로그아웃
      if (event === "SIGNED_OUT") {
        setSession(null)
        setUser(null)
      } else {
        setSession(session)
        setUser(session?.user ?? null)
      }
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  // prompt 지정 시 카카오 계정 선택 화면 강제 (저장된 간편로그인 무시)
  const kakaoSignIn = async (prompt?: string) => {
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        ...(prompt ? { queryParams: { prompt } } : {}),
      },
    })
  }

  // 일반 로그인 — 카카오 간편로그인(기억하기) 그대로 활용 → 빠른 재로그인
  const signInWithKakao = () => kakaoSignIn()

  // 계정 전환 — 계정 선택 화면 강제 노출
  const switchKakaoAccount = () => kakaoSignIn("select_account")

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return { user, session, isLoading, signInWithKakao, switchKakaoAccount, signOut }
}

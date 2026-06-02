"use client"

import { useEffect, useState } from "react"
import type { Session, User } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

export interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  signInWithKakao: () => Promise<void>
  signOut: () => Promise<void>
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithKakao = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return { user, session, isLoading, signInWithKakao, signOut }
}

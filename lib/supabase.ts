import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// 브라우저용 클라이언트 — 세션 자동 유지, localStorage 사용
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// 서버용 클라이언트 — API 라우트에서 사용, 세션 비활성화
export function createServerClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

// 유저 토큰 기반 클라이언트 — RLS 정책이 auth.uid()를 올바르게 인식
export function createUserClient(accessToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

// 서비스 롤 클라이언트 — 서버 전용, RLS 우회 (API 라우트에서만 사용)
export function createServiceClient() {
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

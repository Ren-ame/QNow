/* 2026-05-26: 신규 생성
 * fetchMultiplePlaces에서 Supabase를 여러 번 호출하던 문제를 해결하기 위해
 * place ID 목록을 받아 Supabase를 단 한 번만 조회하는 전용 엔드포인트
 * 서버 전용 client: persistSession/autoRefreshToken false로 브라우저 auth 충돌 방지 */

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ids = searchParams.get("ids")

  if (!ids) return NextResponse.json([])

  const placeIds = ids.split(",").filter(Boolean)

  const { data: waitTimes } = await supabase
    .from("wait_times")
    .select("*")
    .in("place_id", placeIds)
    .order("created_at", { ascending: false })

  return NextResponse.json(waitTimes ?? [])
}

/* 2026-05-26: POST 핸들러 추가
 * 기존: handleWaitTimeSubmit이 React 상태만 업데이트 → 새로고침 시 데이터 소실
 * 변경: Supabase wait_times 테이블에 저장하여 영구 보존 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { place_id, wait_time, waiting_people, crowd_level } = body

  if (!place_id) {
    return NextResponse.json({ error: "place_id는 필수입니다" }, { status: 400 })
  }

  const { error } = await supabase
    .from("wait_times")
    .insert({ place_id, wait_time, waiting_people, crowd_level })

  if (error) {
    console.error("[wait-times POST] Supabase error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

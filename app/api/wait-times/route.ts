/* 2026-05-26: 신규 생성
 * fetchMultiplePlaces에서 Supabase를 여러 번 호출하던 문제를 해결하기 위해
 * place ID 목록을 받아 Supabase를 단 한 번만 조회하는 전용 엔드포인트
 * 서버 전용 client: persistSession/autoRefreshToken false로 브라우저 auth 충돌 방지
 *
 * 2026-05-27: IQR 기반 이상치 제거 평균값 계산 추가
 * - 최근 10건 기준으로 wait_time, waiting_people IQR 평균 계산
 * - crowd_level은 최빈값 사용
 * - sample_count 필드 추가 */

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { iqrMean, mode } from "@/lib/stats"

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

  // 최신순으로 가져온 뒤 place_id별 최근 10건씩 IQR 집계
  const { data: allRecords } = await supabase
    .from("wait_times")
    .select("*")
    .in("place_id", placeIds)
    .order("created_at", { ascending: false })
    .limit(500)

  if (!allRecords || allRecords.length === 0) return NextResponse.json([])

  // place_id별 그룹핑 (최신순 정렬 유지, 최근 10건만 사용)
  const grouped = new Map<string, any[]>()
  for (const r of allRecords) {
    const arr = grouped.get(r.place_id) ?? []
    if (arr.length < 10) arr.push(r)
    grouped.set(r.place_id, arr)
  }

  const result: any[] = []
  for (const [placeId, records] of grouped) {
    result.push({
      place_id: placeId,
      wait_time: iqrMean(records.map((r) => r.wait_time)),
      waiting_people: iqrMean(records.map((r) => r.waiting_people)),
      crowd_level: mode(records.map((r) => r.crowd_level)),
      created_at: records[0].created_at, // 가장 최근 등록 시각
      sample_count: records.length,
    })
  }

  return NextResponse.json(result)
}

/* 2026-05-26: POST 핸들러 추가
 * 기존: handleWaitTimeSubmit이 React 상태만 업데이트 → 새로고침 시 데이터 소실
 * 변경: Supabase wait_times 테이블에 저장하여 영구 보존 */
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { place_id, place_name, wait_time, waiting_people, crowd_level } = body

  if (!place_id) {
    return NextResponse.json({ error: "place_id는 필수입니다" }, { status: 400 })
  }

  const { error } = await supabase
    .from("wait_times")
    .insert({ place_id, place_name, wait_time, waiting_people, crowd_level })

  if (error) {
    console.error("[wait-times POST] Supabase error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

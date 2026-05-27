/* 2026-05-27: 신규 생성
 * 특정 장소의 시간대별 대기 정보 히스토리를 반환하는 엔드포인트
 * - range=today: 최근 24시간, range=week: 최근 7일
 * - 시간대별로 그룹핑 후 IQR 평균 계산 */

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
  const placeId = searchParams.get("place_id")
  const range = searchParams.get("range") ?? "today"

  if (!placeId) {
    return NextResponse.json({ error: "place_id is required" }, { status: 400 })
  }

  const now = new Date()
  const since =
    range === "week"
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() - 24 * 60 * 60 * 1000)

  const { data: records } = await supabase
    .from("wait_times")
    .select("*")
    .eq("place_id", placeId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true })

  if (!records || records.length === 0) return NextResponse.json([])

  // 시간대별 그룹핑
  const hourlyMap = new Map<number, any[]>()
  for (const r of records) {
    const hour = new Date(r.created_at).getHours()
    const arr = hourlyMap.get(hour) ?? []
    arr.push(r)
    hourlyMap.set(hour, arr)
  }

  const history = Array.from(hourlyMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, recs]) => ({
      hour,
      label: `${String(hour).padStart(2, "0")}시`,
      avg_wait_time: iqrMean(recs.map((r) => r.wait_time)),
      avg_waiting_people: iqrMean(recs.map((r) => r.waiting_people)),
      dominant_crowd: mode(recs.map((r) => r.crowd_level)),
      count: recs.length,
    }))

  return NextResponse.json(history)
}

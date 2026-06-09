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
import { iqrMean, mode } from "@/lib/stats"
import { createServerClient, createServiceClient } from "@/lib/supabase"

const supabase = createServerClient()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ids = searchParams.get("ids")

  if (!ids) return NextResponse.json([])

  const placeIds = ids.split(",").filter(Boolean)

  // 2시간 이내 데이터만 사용 (만료된 정보 자동 초기화)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()

  const { data: allRecords } = await supabase
    .from("wait_times")
    .select("*")
    .in("place_id", placeIds)
    .gte("created_at", twoHoursAgo)
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
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const ALLOWED_CROWD_LEVELS = ["low", "medium", "high", "critical"]
const MAX_WAIT_TIME = 600       // 분 (10시간)
const MAX_WAITING_PEOPLE = 9999
const MAX_PLACE_NAME = 200

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { place_id, place_name, wait_time, waiting_people, crowd_level,
          place_lat, place_lng, user_lat, user_lng } = body

  if (!place_id || typeof place_id !== "string") {
    return NextResponse.json({ error: "place_id는 필수입니다" }, { status: 400 })
  }

  // 입력 검증 (음수·비정상값·임의 crowd_level 차단)
  if (!Number.isFinite(wait_time) || wait_time < 0 || wait_time > MAX_WAIT_TIME) {
    return NextResponse.json({ error: "wait_time이 유효하지 않습니다" }, { status: 400 })
  }
  if (!Number.isFinite(waiting_people) || waiting_people < 0 || waiting_people > MAX_WAITING_PEOPLE) {
    return NextResponse.json({ error: "waiting_people이 유효하지 않습니다" }, { status: 400 })
  }
  if (!ALLOWED_CROWD_LEVELS.includes(crowd_level)) {
    return NextResponse.json({ error: "crowd_level이 유효하지 않습니다" }, { status: 400 })
  }
  if (typeof place_name === "string" && place_name.length > MAX_PLACE_NAME) {
    return NextResponse.json({ error: "place_name이 너무 깁니다" }, { status: 400 })
  }

  // 로그인 유저면 user_id 추출
  let user_id: string | null = null
  const authHeader = req.headers.get("authorization")
  if (authHeader) {
    const { data: { user } } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    )
    user_id = user?.id ?? null
  }

  const { error } = await supabase
    .from("wait_times")
    .insert({ place_id, place_name, wait_time, waiting_people, crowd_level, user_id })

  if (error) {
    console.error("[wait-times POST] Supabase error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 로그인 유저 + 100m 이내일 때만 포인트 적립 (+10P)
  const POINT_RADIUS_M = 100
  const withinRange =
    user_lat != null && user_lng != null &&
    place_lat != null && place_lng != null &&
    haversineMeters(user_lat, user_lng, place_lat, place_lng) <= POINT_RADIUS_M

  if (authHeader && user_id) {
    if (withinRange) {
      const serviceClient = createServiceClient()
      const { error: pointError } = await serviceClient.from("point_transactions").insert({
        user_id,
        type: "earn",
        amount: 10,
        description: `대기 정보 등록 - ${place_name ?? place_id}`,
        reference_id: place_id,
      })
      if (pointError) console.error("[wait-times POST] 포인트 적립 실패:", pointError)
    }
  }

  return NextResponse.json({ success: true, point_earned: withinRange && !!user_id })
}

import { type NextRequest, NextResponse } from "next/server"
import { createServerClient, createServiceClient } from "@/lib/supabase"

// 조회용 anon 클라이언트 (RLS SELECT 정책 적용)
const supabase = createServerClient()

/** GET /api/custom-places?lat=&lng=&radius=
 *  현재 위치 기준 반경 내 사용자 등록 장소 조회 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = parseFloat(searchParams.get("lat") ?? "")
  const lng = parseFloat(searchParams.get("lng") ?? "")
  const radius = Math.min(Math.max(parseInt(searchParams.get("radius") ?? "5000"), 500), 20000)

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json({ error: "lat, lng 파라미터가 필요합니다" }, { status: 400 })
  }

  // Haversine 근사: 위경도 1도 ≈ 111km → radius(m)를 도(degree)로 변환
  const degRadius = radius / 111000
  const { data, error } = await supabase
    .from("custom_places")
    .select("*")
    .gte("lat", lat - degRadius)
    .lte("lat", lat + degRadius)
    .gte("lng", lng - degRadius)
    .lte("lng", lng + degRadius)
    .eq("is_active", true)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 실제 직선거리 계산 후 필터링
  const toRad = (d: number) => (d * Math.PI) / 180
  const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371000
    const dLat = toRad(lat2 - lat1)
    const dLng = toRad(lng2 - lng1)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const filtered = (data ?? [])
    .map((p) => ({ ...p, distance: Math.round(haversine(lat, lng, p.lat, p.lng)) }))
    .filter((p) => p.distance <= radius)
    .sort((a, b) => a.distance - b.distance)

  return NextResponse.json(filtered)
}

/** POST /api/custom-places
 *  신규 장소 등록 (로그인 필수) */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (!authHeader) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  )
  if (authError || !user) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 })
  }

  const body = await req.json()
  const { name, category, address, lat, lng, description } = body

  if (!name || !lat || !lng) {
    return NextResponse.json({ error: "name, lat, lng는 필수입니다" }, { status: 400 })
  }

  // 인증은 위에서 완료 → service role로 insert (RLS auth.uid() 컨텍스트 없어도 동작)
  const serviceClient = createServiceClient()
  const { data, error } = await serviceClient
    .from("custom_places")
    .insert({
      user_id: user.id,
      name: name.trim(),
      category: category?.trim() || "기타",
      address: address?.trim() || null,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      description: description?.trim() || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}

/** DELETE /api/custom-places?id=
 *  장소 삭제 (어드민 전용 — 일반 유저는 신고만 가능) */
export async function DELETE(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (!authHeader) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  )
  if (authError || !user) {
    return NextResponse.json({ error: "인증 실패" }, { status: 401 })
  }

  // 어드민 또는 dev 환경에서만 삭제 가능
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim())
  const isAdmin = adminEmails.includes(user.email ?? "")
  const isDev = process.env.NODE_ENV !== "production"

  if (!isAdmin && !isDev) {
    return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 })
  }

  const id = new URL(req.url).searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "id 파라미터가 필요합니다" }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from("custom_places")
    .delete()
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

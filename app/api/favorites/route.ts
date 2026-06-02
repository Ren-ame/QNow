import { type NextRequest, NextResponse } from "next/server"
import { createUserClient } from "@/lib/supabase"

function getToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization")
  return header ? header.replace("Bearer ", "") : null
}

// GET — 내 즐겨찾기 목록
export async function GET(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: "인증 필요" }, { status: 401 })

  const supabase = createUserClient(token)
  const { data, error } = await supabase
    .from("favorites")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — 즐겨찾기 추가
export async function POST(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: "인증 필요" }, { status: 401 })

  const supabase = createUserClient(token)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "인증 실패" }, { status: 401 })

  const body = await req.json()
  const { place_id, place_name, place_address, place_category, place_lat, place_lng } = body

  if (!place_id) return NextResponse.json({ error: "place_id 필수" }, { status: 400 })

  const { error } = await supabase.from("favorites").upsert({
    user_id: user.id,
    place_id,
    place_name,
    place_address,
    place_category,
    place_lat,
    place_lng,
  }, { onConflict: "user_id,place_id" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE — 즐겨찾기 제거
export async function DELETE(req: NextRequest) {
  const token = getToken(req)
  if (!token) return NextResponse.json({ error: "인증 필요" }, { status: 401 })

  const supabase = createUserClient(token)
  const { searchParams } = new URL(req.url)
  const place_id = searchParams.get("place_id")

  if (!place_id) return NextResponse.json({ error: "place_id 필수" }, { status: 400 })

  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("place_id", place_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

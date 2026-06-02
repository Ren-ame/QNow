import { type NextRequest, NextResponse } from "next/server"
import { createUserClient, createServiceClient } from "@/lib/supabase"

export async function DELETE(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "프로덕션에서 사용 불가" }, { status: 403 })
  }

  const authHeader = req.headers.get("authorization")
  if (!authHeader) return NextResponse.json({ error: "인증 필요" }, { status: 401 })

  const userClient = createUserClient(authHeader.replace("Bearer ", ""))
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: "인증 실패" }, { status: 401 })

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from("point_transactions")
    .delete()
    .eq("user_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (!authHeader) return NextResponse.json({ error: "인증 필요" }, { status: 401 })

  const token = authHeader.replace("Bearer ", "")
  const userClient = createUserClient(token)
  const serviceClient = createServiceClient()

  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return NextResponse.json({ error: "인증 실패" }, { status: 401 })

  // 포인트 트랜잭션 (서비스 롤로 조회, user_id 필터)
  const { data: transactions } = await serviceClient
    .from("point_transactions")
    .select("type, amount, description, reference_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  const totalPoints = (transactions ?? []).reduce((sum, t) =>
    t.type === "earn" ? sum + t.amount : sum - t.amount, 0
  )

  // 이번 달 적립 포인트
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const monthPoints = (transactions ?? [])
    .filter((t) => t.type === "earn" && new Date(t.created_at) >= startOfMonth)
    .reduce((sum, t) => sum + t.amount, 0)

  // 총 제보 수
  const { count: registrationCount } = await serviceClient
    .from("wait_times")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)

  // 즐겨찾기 수
  const { count: favoritesCount } = await userClient
    .from("favorites")
    .select("id", { count: "exact", head: true })

  return NextResponse.json({
    total_points: totalPoints,
    month_points: monthPoints,
    registration_count: registrationCount ?? 0,
    favorites_count: favoritesCount ?? 0,
    recent_activity: (transactions ?? []).slice(0, 5),
  })
}

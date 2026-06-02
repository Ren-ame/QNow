import { type NextRequest, NextResponse } from "next/server"
import { createUserClient } from "@/lib/supabase"

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (!authHeader) return NextResponse.json({ error: "인증 필요" }, { status: 401 })

  const supabase = createUserClient(authHeader.replace("Bearer ", ""))
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "인증 실패" }, { status: 401 })

  const { data, error } = await supabase
    .from("wait_times")
    .select("id, place_id, place_name, wait_time, waiting_people, crowd_level, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

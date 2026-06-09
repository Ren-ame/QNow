import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { isAdminEmail } from "@/lib/admin"

const supabase = createServerClient()

/** GET /api/me — 로그인 유저의 권한 정보 (어드민 여부)
 *  어드민 이메일을 클라이언트 번들에 노출하지 않기 위해 서버에서 판정 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (!authHeader) return NextResponse.json({ isAdmin: false })

  const { data: { user } } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  )
  return NextResponse.json({ isAdmin: isAdminEmail(user?.email) })
}

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createServiceClient } from "@/lib/supabase"
import { Resend } from "resend"

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false, autoRefreshToken: false } }
)

const RESEND_TO_EMAIL = process.env.RESEND_TO_EMAIL ?? ""

/** POST /api/place-reports — 장소 신고 접수 */
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

  const { place_id, place_name, reason, detail } = await req.json()
  if (!place_id || !place_name || !reason) {
    return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 })
  }

  // DB 저장
  const serviceClient = createServiceClient()
  const { error: dbError } = await serviceClient.from("place_reports").insert({
    place_id,
    place_name,
    reason,
    detail: detail?.trim() || null,
    user_id: user.id,
  })
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  // 어드민 이메일 발송
  if (RESEND_TO_EMAIL && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: "QNow <onboarding@resend.dev>",
        to: RESEND_TO_EMAIL,
        subject: `[QNow] 장소 신고 접수 — ${place_name}`,
        html: `
          <h2>🚨 신규 장소 신고가 접수되었습니다</h2>
          <table style="border-collapse:collapse; width:100%; max-width:480px;">
            <tr><td style="padding:8px; font-weight:bold;">장소명</td><td style="padding:8px;">${place_name}</td></tr>
            <tr><td style="padding:8px; font-weight:bold;">신고 사유</td><td style="padding:8px;">${reason}</td></tr>
            ${detail ? `<tr><td style="padding:8px; font-weight:bold;">상세 내용</td><td style="padding:8px;">${detail}</td></tr>` : ""}
            <tr><td style="padding:8px; font-weight:bold;">신고자 ID</td><td style="padding:8px;">${user.id}</td></tr>
            <tr><td style="padding:8px; font-weight:bold;">접수 시각</td><td style="padding:8px;">${new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })}</td></tr>
          </table>
          <p style="color:#6b7280; font-size:12px;">Supabase place_reports 테이블에서 전체 내역을 확인할 수 있습니다.</p>
        `,
      })
    } catch (e) {
      // 이메일 실패해도 신고 접수는 성공으로 처리
      console.error("[place-reports] email error:", e)
    }
  }

  return NextResponse.json({ success: true }, { status: 201 })
}

/** GET /api/place-reports/count — 어드민용 미처리 신고 수 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (!authHeader) return NextResponse.json({ count: 0 })

  const { data: { user } } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  )
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "").split(",").map(e => e.trim())
  if (!user?.email || !adminEmails.includes(user.email)) {
    return NextResponse.json({ count: 0 })
  }

  const serviceClient = createServiceClient()
  const { count } = await serviceClient
    .from("place_reports")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")

  return NextResponse.json({ count: count ?? 0 })
}

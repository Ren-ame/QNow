import { type NextRequest, NextResponse } from "next/server"
import { createServerClient, createServiceClient } from "@/lib/supabase"
import { Resend } from "resend"

const supabase = createServerClient()

const RESEND_TO_EMAIL = process.env.RESEND_TO_EMAIL ?? ""

// 허용된 신고 사유 (클라이언트 REPORT_REASONS와 동기화)
const ALLOWED_REASONS = [
  "잘못된 위치",
  "존재하지 않는 장소",
  "스팸 / 홍보성 내용",
  "부적절한 장소명 또는 설명",
  "중복 등록",
  "기타",
]

// 입력 길이 제한
const MAX_PLACE_ID = 200
const MAX_PLACE_NAME = 200
const MAX_DETAIL = 1000

/** HTML 특수문자 이스케이프 — 이메일 본문 인젝션 방지 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

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

  const body = await req.json()
  const place_id = typeof body.place_id === "string" ? body.place_id.trim() : ""
  const place_name = typeof body.place_name === "string" ? body.place_name.trim() : ""
  const reason = typeof body.reason === "string" ? body.reason.trim() : ""
  const detail = typeof body.detail === "string" ? body.detail.trim() : ""

  if (!place_id || !place_name || !reason) {
    return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 })
  }
  // 신고 사유는 허용된 값만 (클라이언트 우회 방지)
  if (!ALLOWED_REASONS.includes(reason)) {
    return NextResponse.json({ error: "유효하지 않은 신고 사유입니다" }, { status: 400 })
  }
  // 길이 제한 (저장 어뷰징·DoS 방지)
  if (place_id.length > MAX_PLACE_ID || place_name.length > MAX_PLACE_NAME || detail.length > MAX_DETAIL) {
    return NextResponse.json({ error: "입력이 너무 깁니다" }, { status: 400 })
  }

  // DB 저장
  const serviceClient = createServiceClient()
  const { error: dbError } = await serviceClient.from("place_reports").insert({
    place_id,
    place_name,
    reason,
    detail: detail || null,
    user_id: user.id,
  })
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  // 어드민 이메일 발송
  if (RESEND_TO_EMAIL && process.env.RESEND_API_KEY) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      // 사용자 입력값은 모두 이스케이프 (HTML 인젝션 방지)
      const safeName = escapeHtml(place_name)
      const safeReason = escapeHtml(reason)
      const safeDetail = escapeHtml(detail)
      await resend.emails.send({
        from: "QNow <onboarding@resend.dev>",
        to: RESEND_TO_EMAIL,
        subject: `[QNow] 장소 신고 접수 — ${place_name.replace(/[\r\n]+/g, " ")}`,
        html: `
          <h2>🚨 신규 장소 신고가 접수되었습니다</h2>
          <table style="border-collapse:collapse; width:100%; max-width:480px;">
            <tr><td style="padding:8px; font-weight:bold;">장소명</td><td style="padding:8px;">${safeName}</td></tr>
            <tr><td style="padding:8px; font-weight:bold;">신고 사유</td><td style="padding:8px;">${safeReason}</td></tr>
            ${safeDetail ? `<tr><td style="padding:8px; font-weight:bold;">상세 내용</td><td style="padding:8px;">${safeDetail}</td></tr>` : ""}
            <tr><td style="padding:8px; font-weight:bold;">신고자 ID</td><td style="padding:8px;">${escapeHtml(user.id)}</td></tr>
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

/** GET /api/place-reports — 어드민용 신고 조회
 *  ?list=true  → 미처리 신고 목록
 *  (기본)      → 미처리 신고 수만 */
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
  const isList = new URL(req.url).searchParams.get("list") === "true"

  if (isList) {
    const { data } = await serviceClient
      .from("place_reports")
      .select("id, created_at, place_id, place_name, reason, detail, status")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
    return NextResponse.json({ reports: data ?? [] })
  }

  const { count } = await serviceClient
    .from("place_reports")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")

  return NextResponse.json({ count: count ?? 0 })
}

/** PATCH /api/place-reports?id= — 어드민용 신고 상태 변경 */
export async function PATCH(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (!authHeader) return NextResponse.json({ error: "인증 필요" }, { status: 401 })

  const { data: { user } } = await supabase.auth.getUser(
    authHeader.replace("Bearer ", "")
  )
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? "").split(",").map(e => e.trim())
  if (!user?.email || !adminEmails.includes(user.email)) {
    return NextResponse.json({ error: "권한 없음" }, { status: 403 })
  }

  const id = new URL(req.url).searchParams.get("id")
  const { status } = await req.json()
  if (!id || !["resolved", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 })
  }

  const serviceClient = createServiceClient()
  const { error } = await serviceClient
    .from("place_reports")
    .update({ status })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

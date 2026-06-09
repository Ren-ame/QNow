// 어드민 이메일 판정 (서버 전용)
// 비공개 ADMIN_EMAILS만 사용 (클라이언트 노출 방지). 미설정 시 어드민 없음(fail-closed)

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? ""
  return raw.split(",").map((e) => e.trim()).filter(Boolean)
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && getAdminEmails().includes(email)
}

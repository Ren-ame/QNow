// 어드민 이메일 판정 (서버 전용)
// 비공개 ADMIN_EMAILS 우선, 미설정 시 기존 NEXT_PUBLIC_ADMIN_EMAILS로 폴백(이전 호환)
// → 운영에서 ADMIN_EMAILS 설정 후 NEXT_PUBLIC_ADMIN_EMAILS 제거하면 이메일 노출 제거됨

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? ""
  return raw.split(",").map((e) => e.trim()).filter(Boolean)
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && getAdminEmails().includes(email)
}

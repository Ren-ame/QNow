"use client"

import { useEffect, useState } from "react"
import { User, Star, ClipboardList, Clock, ChevronRight } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import type { User as SupabaseUser, Session } from "@supabase/supabase-js"

interface MyPageData {
  total_points: number
  month_points: number
  registration_count: number
  favorites_count: number
  recent_activity: {
    type: string
    amount: number
    description: string
    created_at: string
  }[]
}

interface MyPageModalProps {
  isOpen: boolean
  onClose: () => void
  user: SupabaseUser | null
  session: Session | null
  onOpenRegistrations: () => void
}

function getGrade(points: number) {
  if (points >= 1000) return { label: "골드", emoji: "👑", bg: "bg-yellow-100", text: "text-yellow-700" }
  if (points >= 500)  return { label: "활동", emoji: "🔥", bg: "bg-orange-100", text: "text-orange-700" }
  if (points >= 100)  return { label: "일반", emoji: "⭐", bg: "bg-blue-100",   text: "text-blue-700" }
  return                     { label: "새싹", emoji: "🌱", bg: "bg-green-100",  text: "text-green-700" }
}

function formatDate(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000 / 60)
  if (diff < 1) return "방금 전"
  if (diff < 60) return `${diff}분 전`
  const h = Math.floor(diff / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

export function MyPageModal({ isOpen, onClose, user, session, onOpenRegistrations }: MyPageModalProps) {
  const [data, setData] = useState<MyPageData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !session) return

    setIsLoading(true)
    fetch("/api/my-page", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => res.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setIsLoading(false))
  }, [isOpen, session])

  if (!user) return null

  const nickname = user.user_metadata?.full_name ?? user.user_metadata?.name ?? "사용자"
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined
  const grade = getGrade(data?.total_points ?? 0)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="bg-primary px-5 pt-8 pb-6 shrink-0">
          <div className="mb-4">
            <DialogTitle className="text-lg font-bold text-primary-foreground">마이페이지</DialogTitle>
            <DialogDescription className="sr-only">프로필 및 포인트 정보</DialogDescription>
          </div>
          {/* 프로필 */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white/20 overflow-hidden shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="프로필" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-7 h-7 text-primary-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-primary-foreground truncate">{nickname}</p>
              <p className="text-xs text-primary-foreground/70 mt-0.5">QNow 멤버</p>
              <div className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${grade.bg} ${grade.text}`}>
                {grade.emoji} {grade.label} 등급
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* 포인트 카드 */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">보유 포인트</p>
                <p className="text-2xl font-bold text-primary">
                  {(data?.total_points ?? 0).toLocaleString()} P
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  이번 달 +{data?.month_points ?? 0}P 적립
                </p>
              </div>

              {/* 통계 */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { icon: ClipboardList, label: "총 제보", value: data?.registration_count ?? 0 },
                  { icon: Star, label: "즐겨찾기", value: data?.favorites_count ?? 0 },
                  { icon: null, label: "포인트", value: data?.total_points ?? 0 },
                ].map((stat) => (
                  <div key={stat.label} className="bg-muted rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-foreground">{stat.value.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* 최근 활동 */}
              {(data?.recent_activity?.length ?? 0) > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-2">최근 활동 내역</h3>
                  <div className="space-y-2">
                    {data!.recent_activity.map((act, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-b-0">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <Clock className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">{act.description}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(act.created_at)}</p>
                        </div>
                        <span className={`text-sm font-semibold shrink-0 ${act.type === "earn" ? "text-primary" : "text-destructive"}`}>
                          {act.type === "earn" ? "+" : "-"}{act.amount}P
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 전체 제보 내역 보기 */}
              <button
                onClick={() => { onClose(); onOpenRegistrations() }}
                className="w-full flex items-center justify-center gap-2 py-3 border border-border rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <ClipboardList className="w-4 h-4" />
                전체 제보 내역 보기
                <ChevronRight className="w-4 h-4" />
              </button>

              {/* DEV 전용 포인트 초기화 */}
              {process.env.NODE_ENV !== "production" && (
                <button
                  onClick={async () => {
                    if (!session) return
                    await fetch("/api/my-page", {
                      method: "DELETE",
                      headers: { Authorization: `Bearer ${session.access_token}` },
                    })
                    setData((prev) => prev ? { ...prev, total_points: 0, month_points: 0, recent_activity: [] } : prev)
                  }}
                  className="w-full py-2 rounded-xl text-xs font-medium text-destructive border border-destructive/30 hover:bg-destructive/10 transition-colors"
                >
                  [DEV] 포인트 초기화
                </button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

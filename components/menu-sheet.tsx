"use client"

import { useState, useEffect } from "react"
import { Star, ClipboardList, User, Megaphone, Info, ChevronRight, ChevronLeft, Lock, MapPin, LogOut, Clock, Users, Zap, Siren, CheckCircle, XCircle } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { Place } from "./place-card"
import type { User as SupabaseUser, Session } from "@supabase/supabase-js"

interface MenuSheetProps {
  isOpen: boolean
  onClose: () => void
  favoritePlaces: Place[]
  onFavoriteSelect: (place: Place) => void
  user: SupabaseUser | null
  session: Session | null
  isAuthLoading: boolean
  onSignIn: () => void
  onSignOut: () => void
  onOpenMyPage: () => void
  initialView?: View
  isAdmin?: boolean
  pendingReportCount?: number
}

interface PlaceReport {
  id: string
  created_at: string
  place_id: string
  place_name: string
  reason: string
  detail: string | null
  status: "pending" | "resolved" | "dismissed"
}

interface MyRegistration {
  id: number
  place_id: string
  place_name: string
  wait_time: number
  waiting_people: number
  crowd_level: string
  created_at: string
}

type View = "main" | "favorites" | "my-registrations" | "reports"

const crowdLabelMap: Record<string, string> = {
  low: "여유", medium: "보통", high: "혼잡", critical: "매우혼잡",
}

const crowdColorMap: Record<string, string> = {
  low: "#10b981", medium: "#f59e0b", high: "#f97316", critical: "#ef4444",
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const diff = Math.floor((Date.now() - d.getTime()) / 1000 / 60)
  if (diff < 1) return "방금 전"
  if (diff < 60) return `${diff}분 전`
  const hours = Math.floor(diff / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

export function MenuSheet({
  isOpen, onClose, favoritePlaces, onFavoriteSelect,
  user, session, isAuthLoading, onSignIn, onSignOut, onOpenMyPage,
  initialView = "main", isAdmin = false, pendingReportCount = 0,
}: MenuSheetProps) {
  const [view, setView] = useState<View>(initialView)

  useEffect(() => {
    if (isOpen) setView(initialView)
  }, [isOpen, initialView])
  const [registrations, setRegistrations] = useState<MyRegistration[]>([])
  const [isLoadingReg, setIsLoadingReg] = useState(false)
  const [points, setPoints] = useState<{ total: number; month: number } | null>(null)
  const [reports, setReports] = useState<PlaceReport[]>([])
  const [isLoadingReports, setIsLoadingReports] = useState(false)

  useEffect(() => {
    if (!user || !session) { setPoints(null); return }
    fetch("/api/my-page", { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((r) => r.json())
      .then((d) => setPoints({ total: d.total_points ?? 0, month: d.month_points ?? 0 }))
      .catch(() => {})
  }, [user?.id])

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose()
      setTimeout(() => setView("main"), 300)
    }
  }

  // 신고 내역 뷰 진입 시 데이터 로딩
  useEffect(() => {
    if (view !== "reports" || !session || !isAdmin) return
    setIsLoadingReports(true)
    fetch("/api/place-reports?list=true", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((d) => setReports(Array.isArray(d.reports) ? d.reports : []))
      .catch(() => setReports([]))
      .finally(() => setIsLoadingReports(false))
  }, [view, session, isAdmin])

  const handleReportAction = async (reportId: string, status: "resolved" | "dismissed") => {
    if (!session) return
    await fetch(`/api/place-reports?id=${reportId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ status }),
    })
    setReports((prev) => prev.filter((r) => r.id !== reportId))
  }

  // 내가 등록한 정보 뷰 진입 시 데이터 로딩
  useEffect(() => {
    if (view !== "my-registrations" || !session) return

    setIsLoadingReg(true)
    fetch("/api/my-registrations", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((res) => res.json())
      .then((data) => setRegistrations(Array.isArray(data) ? data : []))
      .catch(() => setRegistrations([]))
      .finally(() => setIsLoadingReg(false))
  }, [view, session])

  const nickname = user?.user_metadata?.full_name
    ?? user?.user_metadata?.name
    ?? user?.email
    ?? "사용자"
  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-72 p-0 flex flex-col overflow-hidden">

        {/* ── 메인 뷰 ── */}
        <div className={cn(
          "absolute inset-0 flex flex-col transition-transform duration-300",
          view === "main" ? "translate-x-0" : "-translate-x-full"
        )}>
          <SheetHeader className="px-5 pt-8 pb-4 border-b border-border shrink-0">
            <SheetTitle className="text-xl font-bold text-foreground">QNow</SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">실시간 대기 정보</SheetDescription>
          </SheetHeader>

          {/* 로그인 / 유저 프로필 */}
          <div className="px-5 py-4 border-b border-border shrink-0">
            {isAuthLoading ? (
              <div className="h-10 bg-muted rounded-lg animate-pulse" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-muted overflow-hidden shrink-0">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="프로필" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary/10">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{nickname}</p>
                  <p className="text-xs text-muted-foreground">카카오 로그인</p>
                </div>
                <button onClick={onSignOut} className="p-1.5 hover:bg-muted rounded-full transition-colors" title="로그아웃">
                  <LogOut className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <button
                onClick={onSignIn}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#FEE500] hover:bg-[#F5DC00] transition-colors text-[#191919] font-semibold text-sm"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path fillRule="evenodd" clipRule="evenodd"
                    d="M9 1C4.582 1 1 3.896 1 7.455c0 2.282 1.518 4.285 3.81 5.432L3.9 16.2a.3.3 0 0 0 .447.322L8.1 14.07c.297.027.597.04.9.04 4.418 0 8-2.896 8-6.455C17 3.896 13.418 1 9 1z"
                    fill="#191919"/>
                </svg>
                카카오 로그인
              </button>
            )}
          </div>

          {/* 메뉴 목록 */}
          <nav className="flex-1 overflow-y-auto py-2">
            {/* 마이페이지 + 나의 포인트 */}
            {[
              {
                icon: User, label: "마이페이지", description: "프로필 및 설정",
                onClick: () => { onClose(); onOpenMyPage() },
              },
            ].map((item) => {
              const Icon = item.icon
              const isEnabled = !!user
              return (
                <div key={item.label}>
                  <button disabled={!isEnabled}
                    onClick={isEnabled ? item.onClick : undefined}
                    className={cn(
                      "w-full flex items-center gap-4 px-5 py-4 text-left transition-colors",
                      isEnabled ? "hover:bg-muted" : "opacity-40 cursor-not-allowed"
                    )}>
                    <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                      isEnabled ? "bg-primary/10" : "bg-muted")}>
                      <Icon className={cn("w-4 h-4", isEnabled ? "text-primary" : "text-muted-foreground")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{item.label}</span>
                        {!isEnabled && (
                          <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                            <Lock className="w-2.5 h-2.5" />로그인 필요
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                    </div>
                    {isEnabled && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                  </button>
                  {/* 나의 포인트 (마이페이지 바로 아래) */}
                  {isEnabled && points !== null && (
                    <div className="px-5 pb-2">
                      <button
                        onClick={() => { onClose(); onOpenMyPage() }}
                        className="w-full flex items-center justify-between bg-primary/5 hover:bg-primary/10 transition-colors rounded-xl px-4 py-3"
                      >
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-foreground">나의 포인트</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-bold text-primary">{points.total.toLocaleString()}P</span>
                          {points.month > 0 && (
                            <span className="text-xs text-emerald-500 font-medium">+{points.month}P</span>
                          )}
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              )
            })}

            <div className="h-px bg-border mx-5 my-2" />

            {/* 즐겨찾기 / 내가 등록한 정보 */}
            {[
              {
                icon: Star, label: "즐겨찾기",
                description: favoritePlaces.length > 0 ? `${favoritePlaces.length}개 저장됨` : "저장된 장소 없음",
                onClick: () => setView("favorites"), requireLogin: false,
              },
              {
                icon: ClipboardList, label: "등록한 정보", description: "내가 올린 대기 정보 모아보기",
                onClick: () => setView("my-registrations"), requireLogin: true,
              },
            ].map((item) => {
              const Icon = item.icon
              const isEnabled = !item.requireLogin || !!user
              return (
                <button key={item.label} disabled={!isEnabled}
                  onClick={isEnabled ? item.onClick : undefined}
                  className={cn(
                    "w-full flex items-center gap-4 px-5 py-4 text-left transition-colors",
                    isEnabled ? "hover:bg-muted" : "opacity-40 cursor-not-allowed"
                  )}>
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                    isEnabled ? "bg-primary/10" : "bg-muted")}>
                    <Icon className={cn("w-4 h-4", isEnabled ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                      {!isEnabled && (
                        <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                          <Lock className="w-2.5 h-2.5" />로그인 필요
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                  </div>
                  {isEnabled && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>
              )
            })}

            {/* 어드민 전용 신고 내역 */}
            {isAdmin && (
              <>
                <div className="h-px bg-border mx-5 my-2" />
                <button
                  onClick={() => setView("reports")}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-red-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0 relative">
                    <Siren className="w-4 h-4 text-red-500" />
                    {pendingReportCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {pendingReportCount > 9 ? "9+" : pendingReportCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-red-600">신고 내역</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {pendingReportCount > 0 ? `미처리 ${pendingReportCount}건` : "미처리 없음"}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              </>
            )}

            <div className="h-px bg-border mx-5 my-2" />

            {[
              { icon: Megaphone, label: "공지사항", description: "업데이트 소식" },
              { icon: Info, label: "앱 정보", description: "버전 및 개발 정보" },
            ].map((item) => {
              const Icon = item.icon
              return (
                <button key={item.label}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-muted transition-colors">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              )
            })}
          </nav>

          {/* 배너 광고 영역 */}
          <div className="px-4 py-3 border-t border-border shrink-0">
            <div className="w-full h-[60px] bg-muted rounded-lg flex items-center justify-center overflow-hidden">
              {/* TODO: 애드센스 코드로 교체
              <ins className="adsbygoogle"
                style={{ display: "block", width: "100%", height: "60px" }}
                data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
                data-ad-slot="XXXXXXXXXX"
                data-ad-format="horizontal" /> */}
              <p className="text-xs text-muted-foreground/50 select-none">광고</p>
            </div>
          </div>

          <div className="px-5 py-3 border-t border-border shrink-0">
            <p className="text-xs text-muted-foreground">ver 0.1.0 · QNow</p>
          </div>
        </div>

        {/* ── 즐겨찾기 뷰 ── */}
        <div className={cn(
          "absolute inset-0 flex flex-col transition-transform duration-300",
          view === "favorites" ? "translate-x-0" : "translate-x-full"
        )}>
          <div className="flex items-center gap-3 px-4 pt-8 pb-4 border-b border-border shrink-0">
            <button onClick={() => setView("main")} className="p-1.5 hover:bg-muted rounded-full transition-colors">
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-foreground">즐겨찾기</h2>
              <p className="text-xs text-muted-foreground">{favoritePlaces.length}개 저장됨</p>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {favoritePlaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 pb-12">
                <Star className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-foreground">저장된 장소가 없습니다</p>
                <p className="text-xs text-muted-foreground mt-1">장소 카드의 ★ 버튼으로 추가하세요</p>
              </div>
            ) : (
              <div className="py-2">
                {favoritePlaces.map((place) => (
                  <button key={place.id}
                    onClick={() => { onFavoriteSelect(place); onClose() }}
                    className="w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-muted transition-colors">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{place.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        <MapPin className="w-3 h-3 inline mr-0.5" />{place.address}
                      </p>
                      {place.waitTime > 0 && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: crowdColorMap[place.crowdLevel] }} />
                          <span className="text-xs" style={{ color: crowdColorMap[place.crowdLevel] }}>
                            {crowdLabelMap[place.crowdLevel]}
                          </span>
                          <span className="text-xs text-muted-foreground">· {place.waitTime}분 대기</span>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 내가 등록한 정보 뷰 ── */}
        <div className={cn(
          "absolute inset-0 flex flex-col transition-transform duration-300",
          view === "my-registrations" ? "translate-x-0" : "translate-x-full"
        )}>
          <div className="flex items-center gap-3 px-4 pt-8 pb-4 border-b border-border shrink-0">
            <button onClick={() => setView("main")} className="p-1.5 hover:bg-muted rounded-full transition-colors">
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-foreground">내가 등록한 정보</h2>
              <p className="text-xs text-muted-foreground">최근 50건</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingReg ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : registrations.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 pb-12">
                <ClipboardList className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-foreground">등록한 정보가 없습니다</p>
                <p className="text-xs text-muted-foreground mt-1">장소 카드를 눌러 대기 정보를 등록해보세요</p>
              </div>
            ) : (
              <div className="py-2">
                {registrations.map((reg) => (
                  <div key={reg.id} className="px-5 py-3.5 border-b border-border last:border-b-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-foreground truncate flex-1">
                        {reg.place_name ?? "알 수 없는 장소"}
                      </p>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatDate(reg.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: crowdColorMap[reg.crowd_level] ?? "#94a3b8" }} />
                        <span className="text-xs" style={{ color: crowdColorMap[reg.crowd_level] ?? "#94a3b8" }}>
                          {crowdLabelMap[reg.crowd_level] ?? reg.crowd_level}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />{reg.wait_time}분
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users className="w-3 h-3" />{reg.waiting_people}명
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 신고 내역 뷰 (어드민) ── */}
        <div className={cn(
          "absolute inset-0 flex flex-col transition-transform duration-300",
          view === "reports" ? "translate-x-0" : "translate-x-full"
        )}>
          <div className="flex items-center gap-3 px-4 pt-8 pb-4 border-b border-border shrink-0">
            <button onClick={() => setView("main")} className="p-1.5 hover:bg-muted rounded-full transition-colors">
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-foreground">신고 내역</h2>
              <p className="text-xs text-muted-foreground">
                {reports.length > 0 ? `미처리 ${reports.length}건` : "미처리 없음"}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingReports ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : reports.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 pb-12">
                <Siren className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-foreground">미처리 신고가 없습니다</p>
              </div>
            ) : (
              <div className="py-2">
                {reports.map((report) => (
                  <div key={report.id} className="px-5 py-4 border-b border-border last:border-b-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground truncate flex-1">{report.place_name}</p>
                      <span className="text-xs text-muted-foreground shrink-0">{formatDate(report.created_at)}</span>
                    </div>
                    <p className="text-xs font-medium text-red-500 mb-1">{report.reason}</p>
                    {report.detail && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{report.detail}</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleReportAction(report.id, "resolved")}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 text-xs font-medium hover:bg-emerald-100 transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> 처리 완료
                      </button>
                      <button
                        onClick={() => handleReportAction(report.id, "dismissed")}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium hover:bg-muted/70 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" /> 무시
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </SheetContent>
    </Sheet>
  )
}

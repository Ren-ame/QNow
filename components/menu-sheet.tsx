"use client"

import { useState } from "react"
import { Star, ClipboardList, User, Megaphone, Info, ChevronRight, ChevronLeft, Lock, MapPin } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import type { Place } from "./place-card"

interface MenuSheetProps {
  isOpen: boolean
  onClose: () => void
  favoritePlaces: Place[]
  onFavoriteSelect: (place: Place) => void
}

type View = "main" | "favorites"

const crowdLabelMap: Record<string, string> = {
  low: "여유",
  medium: "보통",
  high: "혼잡",
  critical: "매우혼잡",
}

const crowdColorMap: Record<string, string> = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
}

export function MenuSheet({ isOpen, onClose, favoritePlaces, onFavoriteSelect }: MenuSheetProps) {
  const [view, setView] = useState<View>("main")

  // Sheet 닫힐 때 뷰 초기화
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose()
      setTimeout(() => setView("main"), 300) // 닫히는 애니메이션 후 초기화
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-72 p-0 flex flex-col overflow-hidden">

        {/* 메인 뷰 */}
        <div className={cn(
          "absolute inset-0 flex flex-col transition-transform duration-300",
          view === "main" ? "translate-x-0" : "-translate-x-full"
        )}>
          {/* 헤더 */}
          <SheetHeader className="px-5 pt-8 pb-4 border-b border-border shrink-0">
            <SheetTitle className="text-xl font-bold text-foreground">QNow</SheetTitle>
            <p className="text-sm text-muted-foreground">실시간 대기 정보</p>
          </SheetHeader>

          {/* 메뉴 목록 */}
          <nav className="flex-1 overflow-y-auto py-2">

            {/* 즐겨찾기 */}
            <button
              onClick={() => setView("favorites")}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-muted transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Star className="w-4 h-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-foreground">즐겨찾기</span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {favoritePlaces.length > 0 ? `${favoritePlaces.length}개 저장됨` : "저장된 장소 없음"}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            </button>

            {/* 로그인 필요 항목들 */}
            {[
              { icon: User, label: "마이페이지", description: "프로필 및 설정" },
              { icon: ClipboardList, label: "내가 등록한 정보", description: "내가 올린 대기 정보 모아보기" },
            ].map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  disabled
                  className="w-full flex items-center gap-4 px-5 py-4 text-left opacity-40 cursor-not-allowed"
                >
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                      <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        <Lock className="w-2.5 h-2.5" />
                        로그인 필요
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                  </div>
                </button>
              )
            })}

            <div className="h-px bg-border mx-5 my-2" />

            {/* 로그인 불필요 항목들 */}
            {[
              { icon: Megaphone, label: "공지사항", description: "업데이트 소식" },
              { icon: Info, label: "앱 정보", description: "버전 및 개발 정보" },
            ].map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.label}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-muted transition-colors"
                >
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

          {/* 버전 */}
          <div className="px-5 py-4 border-t border-border shrink-0">
            <p className="text-xs text-muted-foreground">ver 0.1.0 · QNow</p>
          </div>
        </div>

        {/* 즐겨찾기 뷰 */}
        <div className={cn(
          "absolute inset-0 flex flex-col transition-transform duration-300",
          view === "favorites" ? "translate-x-0" : "translate-x-full"
        )}>
          {/* 헤더 */}
          <div className="flex items-center gap-3 px-4 pt-8 pb-4 border-b border-border shrink-0">
            <button
              onClick={() => setView("main")}
              className="p-1.5 hover:bg-muted rounded-full transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-foreground" />
            </button>
            <div>
              <h2 className="text-lg font-bold text-foreground">즐겨찾기</h2>
              <p className="text-xs text-muted-foreground">{favoritePlaces.length}개 저장됨</p>
            </div>
          </div>

          {/* 즐겨찾기 목록 */}
          <div className="flex-1 overflow-y-auto">
            {favoritePlaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-6 pb-12">
                <Star className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-foreground">저장된 장소가 없습니다</p>
                <p className="text-xs text-muted-foreground mt-1">
                  장소 카드의 ★ 버튼으로 추가하세요
                </p>
              </div>
            ) : (
              <div className="py-2">
                {favoritePlaces.map((place) => (
                  <button
                    key={place.id}
                    onClick={() => {
                      onFavoriteSelect(place)
                      onClose()
                    }}
                    className="w-full flex items-start gap-3 px-5 py-3.5 text-left hover:bg-muted transition-colors"
                  >
                    <div className="mt-0.5 shrink-0">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{place.name}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        <MapPin className="w-3 h-3 inline mr-0.5" />
                        {place.address}
                      </p>
                      {place.waitTime > 0 && (
                        <div className="flex items-center gap-2 mt-1.5">
                          <div
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: crowdColorMap[place.crowdLevel] }}
                          />
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

      </SheetContent>
    </Sheet>
  )
}

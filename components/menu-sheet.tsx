"use client"

import { Star, ClipboardList, User, SlidersHorizontal, Megaphone, Info, ChevronRight, Lock } from "lucide-react"
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

interface MenuItem {
  icon: React.ElementType
  label: string
  description?: string
  requiresLogin: boolean
  onClick?: () => void
}

export function MenuSheet({ isOpen, onClose, favoritePlaces, onFavoriteSelect }: MenuSheetProps) {
  const menuItems: MenuItem[] = [
    {
      icon: Star,
      label: "즐겨찾기",
      description: favoritePlaces.length > 0 ? `${favoritePlaces.length}개 저장됨` : "저장된 장소 없음",
      requiresLogin: false,
    },
    {
      icon: User,
      label: "마이페이지",
      description: "프로필 및 설정",
      requiresLogin: true,
    },
    {
      icon: ClipboardList,
      label: "내가 등록한 정보",
      description: "내가 올린 대기 정보 모아보기",
      requiresLogin: true,
    },
    {
      icon: Megaphone,
      label: "공지사항",
      description: "업데이트 소식",
      requiresLogin: false,
    },
    {
      icon: Info,
      label: "앱 정보",
      description: "버전 및 개발 정보",
      requiresLogin: false,
    },
  ]

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-72 p-0 flex flex-col">
        {/* 헤더 */}
        <SheetHeader className="px-5 pt-8 pb-4 border-b border-border">
          <SheetTitle className="text-xl font-bold text-foreground">QNow</SheetTitle>
          <p className="text-sm text-muted-foreground">실시간 대기 정보</p>
        </SheetHeader>

        {/* 메뉴 항목 */}
        <nav className="flex-1 overflow-y-auto py-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const isFavoriteItem = item.label === "즐겨찾기"

            return (
              <div key={item.label}>
                <button
                  disabled={item.requiresLogin}
                  onClick={() => {
                    if (!item.requiresLogin) item.onClick?.()
                  }}
                  className={cn(
                    "w-full flex items-center gap-4 px-5 py-4 text-left transition-colors",
                    item.requiresLogin
                      ? "opacity-40 cursor-not-allowed"
                      : "hover:bg-muted cursor-pointer"
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                    item.requiresLogin ? "bg-muted" : "bg-primary/10"
                  )}>
                    <Icon className={cn(
                      "w-4 h-4",
                      item.requiresLogin ? "text-muted-foreground" : "text-primary"
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{item.label}</span>
                      {item.requiresLogin && (
                        <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                          <Lock className="w-2.5 h-2.5" />
                          로그인 필요
                        </div>
                      )}
                    </div>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                    )}
                  </div>
                  {!item.requiresLogin && (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                </button>

                {/* 즐겨찾기 장소 목록 */}
                {isFavoriteItem && favoritePlaces.length > 0 && (
                  <div className="mx-4 mb-2 rounded-lg border border-border overflow-hidden">
                    {favoritePlaces.map((place) => (
                      <button
                        key={place.id}
                        onClick={() => {
                          onFavoriteSelect(place)
                          onClose()
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors border-b border-border last:border-b-0"
                      >
                        <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{place.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        {/* 하단 버전 정보 */}
        <div className="px-5 py-4 border-t border-border">
          <p className="text-xs text-muted-foreground">ver 0.1.0 · QNow</p>
        </div>
      </SheetContent>
    </Sheet>
  )
}

"use client"

import { useState } from "react"
import { MapPin, Tag, FileText, Navigation } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const CATEGORIES = [
  "음식점", "카페", "팝업스토어", "행사/이벤트",
  "뷰티/미용", "의류/패션", "병원/의원", "기타",
]

export interface NewPlaceData {
  name: string
  category: string
  address: string
  lat: number
  lng: number
  description: string
}

interface NewPlaceModalProps {
  isOpen: boolean
  onClose: () => void
  /** 지도 현재 중심 좌표 (위치 기본값으로 사용) */
  defaultLat?: number
  defaultLng?: number
  /** 내 현재 위치 */
  userLat?: number
  userLng?: number
  onSubmit: (data: NewPlaceData) => Promise<void>
}

export function NewPlaceModal({
  isOpen,
  onClose,
  defaultLat,
  defaultLng,
  userLat,
  userLng,
  onSubmit,
}: NewPlaceModalProps) {
  const [name, setName] = useState("")
  const [category, setCategory] = useState("기타")
  const [address, setAddress] = useState("")
  const [description, setDescription] = useState("")
  const [useMyLocation, setUseMyLocation] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const lat = useMyLocation && userLat != null ? userLat : (defaultLat ?? 0)
  const lng = useMyLocation && userLng != null ? userLng : (defaultLng ?? 0)

  const handleClose = () => {
    setName("")
    setCategory("기타")
    setAddress("")
    setDescription("")
    setUseMyLocation(false)
    onClose()
  }

  const handleSubmit = async () => {
    if (!name.trim()) return
    setIsSubmitting(true)
    try {
      await onSubmit({ name, category, address, lat, lng, description })
      handleClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            신규 장소 등록
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            카카오맵에 없는 팝업스토어·임시 매장 등을 등록해주세요
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* 장소명 */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Tag className="w-4 h-4 text-primary" />
              장소명 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 무신사 팝업 강남"
              maxLength={50}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* 카테고리 */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">카테고리</label>
            <div className="grid grid-cols-4 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    "rounded-lg border py-1.5 text-xs font-medium transition-all",
                    category === cat
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 위치 */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <MapPin className="w-4 h-4 text-primary" />
              위치
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setUseMyLocation(false)}
                className={cn(
                  "flex-1 rounded-lg border py-2 text-xs font-medium transition-all",
                  !useMyLocation
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                )}
              >
                📍 지도 중심 위치
              </button>
              <button
                onClick={() => setUseMyLocation(true)}
                disabled={userLat == null}
                className={cn(
                  "flex-1 rounded-lg border py-2 text-xs font-medium transition-all",
                  useMyLocation
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50",
                  userLat == null && "opacity-40 cursor-not-allowed"
                )}
              >
                <Navigation className="w-3 h-3 inline mr-1" />
                내 현재 위치
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              위도 {lat.toFixed(5)} / 경도 {lng.toFixed(5)}
            </p>
          </div>

          {/* 주소 (선택) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">
              주소 <span className="text-muted-foreground font-normal">(선택)</span>
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="예: 서울 강남구 강남대로 123"
              maxLength={100}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* 설명 (선택) */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FileText className="w-4 h-4 text-primary" />
              설명 <span className="text-muted-foreground font-normal">(선택)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="예: 6월 한 달간 운영하는 팝업스토어입니다"
              maxLength={200}
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground text-right">{description.length}/200</p>
          </div>

          {/* 포인트 안내 */}
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              💡 신규 장소 등록 포인트는 검토 후 지급됩니다
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={handleClose} className="flex-1" disabled={isSubmitting}>
            취소
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1"
            disabled={!name.trim() || isSubmitting}
          >
            {isSubmitting ? "등록 중..." : "장소 등록하기"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

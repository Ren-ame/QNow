"use client"

import { useState } from "react"
import { X, Clock, Users, AlertCircle } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import type { Place } from "./place-card"

interface WaitTimeInputModalProps {
  place: Place | null
  isOpen: boolean
  onClose: () => void
  onSubmit?: (data: { waitTime: number; waitingPeople: number; crowdLevel: string }) => void
}

const crowdLevels = [
  { id: "low", label: "여유", color: "bg-emerald-500", description: "자리가 충분합니다" },
  { id: "medium", label: "보통", color: "bg-amber-400", description: "약간의 대기가 있습니다" },
  { id: "high", label: "혼잡", color: "bg-orange-500", description: "대기시간이 깁니다" },
  { id: "critical", label: "매우혼잡", color: "bg-red-500", description: "오래 기다려야 합니다" },
]

export function WaitTimeInputModal({ place, isOpen, onClose, onSubmit }: WaitTimeInputModalProps) {
  const [waitTime, setWaitTime] = useState(15)
  const [waitingPeople, setWaitingPeople] = useState(5)
  const [selectedCrowdLevel, setSelectedCrowdLevel] = useState("medium")

  const handleSubmit = () => {
    onSubmit?.({
      waitTime,
      waitingPeople,
      crowdLevel: selectedCrowdLevel,
    })
    onClose()
  }

  if (!place) return null

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-foreground">
            대기 정보 입력
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            현재 장소의 대기시간과 혼잡도 정보를 입력해주세요
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 장소 정보 */}
          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm text-muted-foreground">{place.category}</p>
            <p className="font-semibold text-lg text-foreground">{place.name}</p>
            <p className="text-sm text-muted-foreground">{place.address}</p>
          </div>

          {/* 예상 대기시간 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock className="w-4 h-4 text-primary" />
                예상 대기시간
              </label>
              <span className="text-lg font-bold text-primary">{waitTime}분</span>
            </div>
            <Slider
              value={[waitTime]}
              onValueChange={(value) => setWaitTime(value[0])}
              max={120}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0분</span>
              <span>60분</span>
              <span>120분</span>
            </div>
          </div>

          {/* 대기 인원 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Users className="w-4 h-4 text-primary" />
                현재 대기 인원
              </label>
              <span className="text-lg font-bold text-primary">{waitingPeople}명</span>
            </div>
            <Slider
              value={[waitingPeople]}
              onValueChange={(value) => setWaitingPeople(value[0])}
              max={50}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0명</span>
              <span>25명</span>
              <span>50명</span>
            </div>
          </div>

          {/* 혼잡도 선택 */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium text-foreground">
              <AlertCircle className="w-4 h-4 text-primary" />
              현재 혼잡도
            </label>
            <div className="grid grid-cols-2 gap-2">
              {crowdLevels.map((level) => (
                <button
                  key={level.id}
                  onClick={() => setSelectedCrowdLevel(level.id)}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg border-2 transition-all",
                    selectedCrowdLevel === level.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <div className={cn("w-3 h-3 rounded-full", level.color)} />
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">{level.label}</p>
                    <p className="text-xs text-muted-foreground">{level.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button onClick={handleSubmit} className="flex-1">
            정보 등록하기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

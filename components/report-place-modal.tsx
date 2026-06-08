"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

const REPORT_REASONS = [
  "잘못된 위치",
  "존재하지 않는 장소",
  "스팸 / 홍보성 내용",
  "부적절한 장소명 또는 설명",
  "중복 등록",
  "기타",
]

interface ReportPlaceModalProps {
  isOpen: boolean
  onClose: () => void
  placeName: string
  onSubmit: (reason: string, detail: string) => Promise<void>
}

export function ReportPlaceModal({ isOpen, onClose, placeName, onSubmit }: ReportPlaceModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [detail, setDetail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDone, setIsDone] = useState(false)

  const handleClose = () => {
    setSelectedReason(null)
    setDetail("")
    setIsDone(false)
    onClose()
  }

  const handleSubmit = async () => {
    if (!selectedReason) return
    setIsSubmitting(true)
    try {
      await onSubmit(selectedReason, detail)
      setIsDone(true)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose() }}>
      <DialogContent className="max-w-sm mx-4 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" />
            장소 신고
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{placeName}</span>
          </DialogDescription>
        </DialogHeader>

        {isDone ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center text-2xl">✅</div>
            <p className="font-medium">신고가 접수되었습니다</p>
            <p className="text-sm text-muted-foreground">검토 후 조치하겠습니다</p>
            <Button className="mt-2 w-full" onClick={handleClose}>확인</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">신고 사유</p>
              <div className="flex flex-wrap gap-2">
                {REPORT_REASONS.map((reason) => (
                  <button
                    key={reason}
                    onClick={() => setSelectedReason(reason)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm border transition-colors",
                      selectedReason === reason
                        ? "bg-destructive text-white border-destructive"
                        : "border-border text-muted-foreground hover:border-destructive hover:text-destructive"
                    )}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">상세 내용 <span className="text-muted-foreground font-normal">(선택)</span></p>
              <Textarea
                placeholder="추가 설명을 입력해주세요"
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                className="resize-none text-sm"
                rows={3}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={handleClose}>취소</Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={!selectedReason || isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? "접수 중..." : "신고하기"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

interface BottomSheetProps {
  children: React.ReactNode
  className?: string
  onStateChange?: (height: number, isDragging: boolean) => void
}

const SNAP_HIDDEN = 10
const SNAP_MID = 45
const SNAP_FULL = 85

function nearestSnap(h: number): number {
  if (h < 28) return SNAP_HIDDEN
  if (h < 65) return SNAP_MID
  return SNAP_FULL
}

export function BottomSheet({ children, className, onStateChange }: BottomSheetProps) {
  const [sheetHeight, setSheetHeight] = useState(SNAP_MID)
  const [isDragging, setIsDragging] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const startHeight = useRef(0)
  const liveHeight = useRef(SNAP_MID)

  const applyHeight = (h: number, dragging: boolean) => {
    liveHeight.current = h
    setSheetHeight(h)
    onStateChange?.(h, dragging)
  }

  const handleDragStart = (clientY: number) => {
    setIsDragging(true)
    startY.current = clientY
    startHeight.current = liveHeight.current
  }

  const handleDrag = (clientY: number) => {
    const deltaY = startY.current - clientY
    const deltaPercent = (deltaY / window.innerHeight) * 100
    const newHeight = Math.min(SNAP_FULL, Math.max(SNAP_HIDDEN, startHeight.current + deltaPercent))
    applyHeight(newHeight, true)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    applyHeight(nearestSnap(liveHeight.current), false)
  }

  useEffect(() => {
    if (!isDragging) return

    const onMouseMove = (e: MouseEvent) => handleDrag(e.clientY)
    const onTouchMove = (e: TouchEvent) => handleDrag(e.touches[0].clientY)

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", handleDragEnd)
    document.addEventListener("touchmove", onTouchMove, { passive: true })
    document.addEventListener("touchend", handleDragEnd)

    return () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", handleDragEnd)
      document.removeEventListener("touchmove", onTouchMove)
      document.removeEventListener("touchend", handleDragEnd)
    }
  }, [isDragging])

  const isHidden = sheetHeight <= SNAP_HIDDEN + 2

  return (
    <div
      ref={sheetRef}
      className={cn(
        "absolute bottom-0 left-0 right-0 z-30 bg-card rounded-t-3xl shadow-2xl",
        !isDragging && "transition-all duration-300 ease-out",
        className
      )}
      style={{ height: `${sheetHeight}%` }}
    >
      {/* 드래그 핸들 */}
      <div
        className="flex items-center justify-center py-3 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={(e) => handleDragStart(e.clientY)}
        onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
      >
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
      </div>

      {/* 컨텐츠 */}
      <div
        className={cn(
          "h-[calc(100%-28px)] overflow-y-auto px-4 pb-4",
          isHidden && "overflow-hidden"
        )}
      >
        {children}
      </div>
    </div>
  )
}

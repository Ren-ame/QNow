"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

interface BottomSheetProps {
  children: React.ReactNode
  className?: string
}

export function BottomSheet({ children, className }: BottomSheetProps) {
  const [sheetHeight, setSheetHeight] = useState(45) // 퍼센트
  const [isDragging, setIsDragging] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const startY = useRef(0)
  const startHeight = useRef(0)

  const handleDragStart = (clientY: number) => {
    setIsDragging(true)
    startY.current = clientY
    startHeight.current = sheetHeight
  }

  const handleDrag = (clientY: number) => {
    if (!isDragging) return

    const deltaY = startY.current - clientY
    const deltaPercent = (deltaY / window.innerHeight) * 100
    const newHeight = Math.min(85, Math.max(25, startHeight.current + deltaPercent))
    setSheetHeight(newHeight)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    // 스냅 포인트로 이동
    if (sheetHeight > 65) {
      setSheetHeight(85)
    } else if (sheetHeight < 35) {
      setSheetHeight(25)
    } else {
      setSheetHeight(45)
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleDrag(e.clientY)
    const handleMouseUp = () => handleDragEnd()
    const handleTouchMove = (e: TouchEvent) => handleDrag(e.touches[0].clientY)
    const handleTouchEnd = () => handleDragEnd()

    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.addEventListener("touchmove", handleTouchMove)
      document.addEventListener("touchend", handleTouchEnd)
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
    }
  }, [isDragging])

  return (
    <div
      ref={sheetRef}
      className={cn(
        "absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl shadow-2xl transition-all duration-300 ease-out",
        isDragging && "transition-none",
        className
      )}
      style={{ height: `${sheetHeight}%` }}
    >
      {/* 드래그 핸들 */}
      <div
        className="flex items-center justify-center py-3 cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => handleDragStart(e.clientY)}
        onTouchStart={(e) => handleDragStart(e.touches[0].clientY)}
      >
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
      </div>

      {/* 컨텐츠 */}
      <div className="h-[calc(100%-28px)] overflow-y-auto px-4 pb-4">
        {children}
      </div>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { BarChart2, Clock, Users, Info } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import type { Place } from "./place-card"

interface HistoryEntry {
  hour: number
  label: string
  avg_wait_time: number
  avg_waiting_people: number
  dominant_crowd: "low" | "medium" | "high" | "critical"
  count: number
}

interface WaitTimeHistoryModalProps {
  place: Place | null
  isOpen: boolean
  onClose: () => void
}

const crowdColorMap: Record<string, string> = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
}

const crowdLabelMap: Record<string, string> = {
  low: "여유",
  medium: "보통",
  high: "혼잡",
  critical: "매우혼잡",
}

export function WaitTimeHistoryModal({ place, isOpen, onClose }: WaitTimeHistoryModalProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [range, setRange] = useState<"today" | "week">("today")

  useEffect(() => {
    if (!isOpen || !place) return

    const controller = new AbortController()
    setIsLoading(true)
    setHistory([])

    fetch(`/api/wait-times/history?place_id=${place.id}&range=${range}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => setHistory(Array.isArray(data) ? data : []))
      .catch((err) => {
        if (err.name !== "AbortError") setHistory([])
      })
      .finally(() => setIsLoading(false))

    return () => controller.abort()
  }, [isOpen, place?.id, range])

  if (!place) return null

  // 현재 시간 기준 ±2시간 윈도우 (5개 슬롯)
  const currentHour = new Date().getHours()
  const windowHours = [-2, -1, 0, 1, 2].map((offset) => (currentHour + offset + 24) % 24)
  const visibleHistory = windowHours.map(
    (h) => history.find((e) => e.hour === h) ?? {
      hour: h,
      label: `${String(h).padStart(2, "0")}시`,
      avg_wait_time: 0,
      avg_waiting_people: 0,
      dominant_crowd: "low" as const,
      count: 0,
    }
  )

  const totalSamples = visibleHistory.reduce((sum, h) => sum + h.count, 0)

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: HistoryEntry }[] }) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload as HistoryEntry
    return (
      <div className="bg-background border border-border rounded-lg p-3 shadow-lg text-sm min-w-[130px]">
        <p className="font-semibold text-foreground mb-1">{d.label}</p>
        <p className="text-primary">대기시간: {d.avg_wait_time}분</p>
        <p className="text-muted-foreground">대기인원: {d.avg_waiting_people}명</p>
        <p style={{ color: crowdColorMap[d.dominant_crowd] }}>
          혼잡도: {crowdLabelMap[d.dominant_crowd]}
        </p>
        <p className="text-muted-foreground text-xs mt-1">{d.count}건 기반</p>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-semibold">
            <BarChart2 className="w-5 h-5 text-primary" />
            시간대별 대기 현황
          </DialogTitle>
          <DialogDescription className="sr-only">
            장소별 시간대 평균 대기시간 및 혼잡도 통계
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 장소 정보 */}
          <div className="bg-muted rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">{place.category}</p>
            <p className="font-semibold text-foreground">{place.name}</p>
          </div>

          {/* 범위 탭 */}
          <div className="flex gap-2">
            {(["today", "week"] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  range === r
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {r === "today" ? "오늘" : "이번 주"}
              </button>
            ))}
          </div>

          {/* 차트 영역 */}
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground">
              <BarChart2 className="w-10 h-10 mb-2 opacity-30" />
              <p className="text-sm">기록된 데이터가 없습니다</p>
              <p className="text-xs mt-1">정보를 먼저 등록해주세요</p>
            </div>
          ) : (
            <>
              {/* 대기시간 차트 */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  평균 대기시간 (분)
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={visibleHistory} margin={{ top: 4, right: 16, left: -16, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={({ x, y, payload }) => (
                        <text
                          x={x} y={y + 10}
                          textAnchor="middle"
                          fontSize={11}
                          fill={payload.value === `${String(currentHour).padStart(2, "0")}시` ? "hsl(var(--primary))" : "#94a3b8"}
                          fontWeight={payload.value === `${String(currentHour).padStart(2, "0")}시` ? 700 : 400}
                        >
                          {payload.value}
                        </text>
                      )}
                    />
                    <YAxis tick={{ fontSize: 11 }} unit="분" domain={[0, "auto"]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="avg_wait_time" radius={[4, 4, 0, 0]} barSize={48} minPointSize={0}>
                      {visibleHistory.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.count > 0 ? (crowdColorMap[entry.dominant_crowd] ?? "#94a3b8") : "#e2e8f0"}
                          opacity={entry.hour === currentHour ? 1 : 0.6}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 대기인원 차트 */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  평균 대기 인원 (명)
                </p>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={visibleHistory} margin={{ top: 4, right: 16, left: -16, bottom: 0 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="label"
                      tick={({ x, y, payload }) => (
                        <text
                          x={x} y={y + 10}
                          textAnchor="middle"
                          fontSize={11}
                          fill={payload.value === `${String(currentHour).padStart(2, "0")}시` ? "hsl(var(--primary))" : "#94a3b8"}
                          fontWeight={payload.value === `${String(currentHour).padStart(2, "0")}시` ? 700 : 400}
                        >
                          {payload.value}
                        </text>
                      )}
                    />
                    <YAxis tick={{ fontSize: 11 }} unit="명" domain={[0, "auto"]} />
                    <Bar
                      dataKey="avg_waiting_people"
                      radius={[4, 4, 0, 0]}
                      barSize={48}
                      minPointSize={0}
                    >
                      {visibleHistory.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={entry.count > 0 ? "hsl(var(--primary))" : "#e2e8f0"}
                          opacity={entry.hour === currentHour ? 1 : 0.6}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 혼잡도 범례 */}
              <div className="flex flex-wrap gap-3 justify-center">
                {Object.entries(crowdLabelMap).map(([key, label]) => (
                  <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: crowdColorMap[key] }}
                    />
                    {label}
                  </div>
                ))}
              </div>

              {/* 하단 안내 */}
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  총{" "}
                  <strong className="text-foreground">{totalSamples}건</strong>의
                  등록 정보 기반. 이상치는 IQR 방식으로 자동 제거됩니다.
                </span>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

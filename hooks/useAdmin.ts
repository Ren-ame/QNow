"use client"

import { useState, useEffect } from "react"
import type { Session, User } from "@supabase/supabase-js"
import type { Place } from "@/components/place-card"

export function useAdmin(user: User | null, session: Session | null) {
  const [isAdmin, setIsAdmin] = useState(false)
  const [pendingReportCount, setPendingReportCount] = useState(0)
  const [reportingPlace, setReportingPlace] = useState<Place | null>(null)

  useEffect(() => {
    if (!session) { setIsAdmin(false); return }
    let cancelled = false
    fetch("/api/me", { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((res) => res.json())
      .then((d) => { if (!cancelled) setIsAdmin(!!d.isAdmin) })
      .catch(() => { if (!cancelled) setIsAdmin(false) })
    return () => { cancelled = true }
  }, [user?.id])

  useEffect(() => {
    if (isAdmin && session) fetchPendingReportCount()
  }, [isAdmin, session])

  const fetchPendingReportCount = async () => {
    if (!session || !isAdmin) return
    const res = await fetch("/api/place-reports", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (res.ok) {
      const { count } = await res.json()
      setPendingReportCount(count ?? 0)
    }
  }

  const handleReportPlace = async (reason: string, detail: string) => {
    if (!reportingPlace || !session) return
    const res = await fetch("/api/place-reports", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        place_id: reportingPlace.id,
        place_name: reportingPlace.name,
        reason,
        detail,
      }),
    })
    if (!res.ok) throw new Error("신고 접수 실패")
  }

  return {
    isAdmin,
    pendingReportCount,
    reportingPlace, setReportingPlace,
    handleReportPlace,
  }
}

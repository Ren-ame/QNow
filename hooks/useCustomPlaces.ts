"use client"

import { useState } from "react"
import { formatLastUpdated } from "@/lib/utils"
import type { Session, User } from "@supabase/supabase-js"
import type { Place } from "@/components/place-card"
import type { Tables } from "@/lib/database.types"
import type { NewPlaceData } from "@/components/new-place-modal"

type WaitTimeResult = {
  place_id: string
  wait_time: number
  waiting_people: number
  crowd_level: string
  created_at: string
  sample_count: number
}

export function useCustomPlaces(
  user: User | null,
  session: Session | null,
  mapCenter: { lat: number; lng: number } | null,
  actualMapCenter: { lat: number; lng: number } | null,
) {
  const [customPlaces, setCustomPlaces] = useState<Place[]>([])
  const [showCustomPlaces, setShowCustomPlaces] = useState(true)
  const [isNewPlaceModalOpen, setIsNewPlaceModalOpen] = useState(false)
  const [isLocationPickerMode, setIsLocationPickerMode] = useState(false)
  const [pickedLocation, setPickedLocation] = useState<{ lat: number; lng: number } | null>(null)

  const fetchCustomPlaces = async (lat: number, lng: number, radius: number) => {
    try {
      const res = await fetch(`/api/custom-places?lat=${lat}&lng=${lng}&radius=${radius}`)
      if (!res.ok) return
      const data = await res.json()
      const mapped: Place[] = data.map((p: Tables<"custom_places"> & { distance: number }) => ({
        id: `custom_${p.id}`,
        name: p.name,
        category: p.category,
        address: p.address ?? "",
        lat: p.lat,
        lng: p.lng,
        distance: p.distance != null ? `${p.distance}m` : "",
        waitTime: 0,
        waitingPeople: 0,
        crowdLevel: "low" as const,
        lastUpdated: "정보 없음",
        isFavorite: false,
        registeredAt: p.created_at,
        isCustom: true,
      }))

      try {
        const ids = mapped.map((p) => p.id).join(",")
        const waitRes = await fetch(`/api/wait-times?ids=${ids}`)
        if (waitRes.ok) {
          const waitTimes: WaitTimeResult[] = await waitRes.json()
          const waitTimeMap = new Map<string, WaitTimeResult>()
          for (const w of waitTimes) {
            if (!waitTimeMap.has(w.place_id)) waitTimeMap.set(w.place_id, w)
          }
          const enriched = mapped.map((place) => {
            const latest = waitTimeMap.get(place.id)
            if (!latest) return place
            return {
              ...place,
              waitTime: latest.wait_time,
              waitingPeople: latest.waiting_people,
              crowdLevel: latest.crowd_level as Place["crowdLevel"],
              lastUpdated: formatLastUpdated(latest.created_at),
            }
          })
          setCustomPlaces(enriched)
          return
        }
      } catch (err) {
        console.error("[fetchCustomPlaces] wait-times 병합 실패:", err)
      }

      setCustomPlaces(mapped)
    } catch (err) {
      console.error("[fetchCustomPlaces]", err)
    }
  }

  const handleAddNewPlace = (onNotLoggedIn: () => void) => {
    if (!user) {
      onNotLoggedIn()
      return
    }
    setIsLocationPickerMode(true)
  }

  const handleLocationConfirm = () => {
    setPickedLocation(mapCenter ?? actualMapCenter ?? null)
    setIsLocationPickerMode(false)
    setIsNewPlaceModalOpen(true)
  }

  const handleLocationCancel = () => {
    setIsLocationPickerMode(false)
  }

  const handleNewPlaceSubmit = async (data: NewPlaceData): Promise<{ error?: string } | void> => {
    if (!session) return
    try {
      const res = await fetch("/api/custom-places", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json()
        return { error: err.error ?? "등록에 실패했습니다" }
      }
      const created = await res.json()
      const newPlace: Place = {
        id: `custom_${created.id}`,
        name: created.name,
        category: created.category,
        address: created.address ?? "",
        lat: created.lat,
        lng: created.lng,
        distance: "",
        waitTime: 0,
        waitingPeople: 0,
        crowdLevel: "low",
        lastUpdated: "방금 전",
        isFavorite: false,
        registeredAt: created.created_at ?? new Date().toISOString(),
      }
      setCustomPlaces((prev) => [newPlace, ...prev])
    } catch {
      return { error: "등록 중 오류가 발생했습니다. 다시 시도해주세요." }
    }
  }

  const handleDeleteCustomPlace = async (place: Place, token: string | undefined): Promise<{ error?: string } | void> => {
    if (!token) return { error: "로그인이 필요합니다" }
    const rawId = place.id.replace("custom_", "")
    try {
      const res = await fetch(`/api/custom-places?id=${rawId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = await res.json()
        return { error: err.error }
      }
      setCustomPlaces((prev) => prev.filter((p) => p.id !== place.id))
    } catch {
      return { error: "삭제 중 오류가 발생했습니다" }
    }
  }

  return {
    customPlaces, setCustomPlaces,
    showCustomPlaces, setShowCustomPlaces,
    isNewPlaceModalOpen, setIsNewPlaceModalOpen,
    isLocationPickerMode,
    pickedLocation,
    fetchCustomPlaces,
    handleAddNewPlace,
    handleLocationConfirm,
    handleLocationCancel,
    handleNewPlaceSubmit,
    handleDeleteCustomPlace,
  }
}

"use client"

import { useState, useEffect } from "react"
import type { Session, User } from "@supabase/supabase-js"
import type { Place } from "@/components/place-card"
import type { Tables } from "@/lib/database.types"

const FAVORITES_KEY = "qnow_favorites"

export function loadFavorites(): Record<string, Place> {
  if (typeof window === "undefined") return {}
  try {
    const stored = localStorage.getItem(FAVORITES_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch { return {} }
}

export function saveFavorites(favorites: Record<string, Place>) {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)) } catch {}
}

export function useFavorites(user: User | null, session: Session | null) {
  const [savedFavorites, setSavedFavorites] = useState<Record<string, Place>>({})

  useEffect(() => {
    setSavedFavorites(loadFavorites())
  }, [])

  useEffect(() => {
    if (!user || !session) return
    const token = session.access_token

    const sync = async () => {
      const res = await fetch("/api/favorites", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const dbData = await res.json()
      if (!Array.isArray(dbData)) return

      const dbFavorites: Record<string, Place> = {}
      dbData.forEach((fav: Tables<"favorites">) => {
        dbFavorites[fav.place_id] = {
          id: fav.place_id,
          name: fav.place_name ?? "",
          address: fav.place_address ?? "",
          category: fav.place_category ?? "",
          lat: fav.place_lat ?? undefined,
          lng: fav.place_lng ?? undefined,
          distance: "",
          waitTime: 0,
          waitingPeople: 0,
          crowdLevel: "low",
          lastUpdated: "정보 없음",
        }
      })

      const localFavorites = loadFavorites()
      const localOnly = Object.values(localFavorites).filter((f) => !dbFavorites[f.id])
      for (const fav of localOnly) {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            place_id: fav.id,
            place_name: fav.name,
            place_address: fav.address,
            place_category: fav.category,
            place_lat: fav.lat,
            place_lng: fav.lng,
          }),
        })
        dbFavorites[fav.id] = fav
      }

      setSavedFavorites(dbFavorites)
      saveFavorites(dbFavorites)
    }

    sync().catch((err) => console.error("[syncFavorites]", err))
  }, [user?.id])

  function mergeFavorites(data: Place[]): Place[] {
    const favIds = new Set(Object.keys(loadFavorites()))
    return data.map((p) => ({ ...p, isFavorite: favIds.has(p.id) }))
  }

  async function toggleFavorite(place: Place): Promise<boolean> {
    const isNowFavorite = !place.isFavorite

    if (user && session) {
      const token = session.access_token
      if (isNowFavorite) {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            place_id: place.id,
            place_name: place.name,
            place_address: place.address,
            place_category: place.category,
            place_lat: place.lat,
            place_lng: place.lng,
          }),
        })
      } else {
        await fetch(`/api/favorites?place_id=${place.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        })
      }
    }

    const current = loadFavorites()
    if (isNowFavorite) {
      current[place.id] = place
    } else {
      delete current[place.id]
    }
    saveFavorites(current)
    setSavedFavorites({ ...current })

    return isNowFavorite
  }

  return { savedFavorites, setSavedFavorites, toggleFavorite, mergeFavorites }
}

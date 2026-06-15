"use client"

import { useState, useRef, useEffect } from "react"
import { toast } from "sonner"
import { formatLastUpdated, haversineMeters } from "@/lib/utils"
import type { Place } from "@/components/place-card"
import type { FilterState } from "@/components/filter-buttons"
import type { SearchSuggestion } from "@/components/search-bar"

type WaitTimeResult = {
  place_id: string
  wait_time: number
  waiting_people: number
  crowd_level: string
  created_at: string
  sample_count: number
}

export const DEFAULT_SEARCH_QUERY = "음식점"
const DIVERSE_CATEGORY_QUERIES = ["음식점", "카페", "병원", "은행", "약국", "편의점"]
const DEFAULT_RADIUS = 5000
const RADIUS_KEY = "qnow_search_radius"

const categoryMap: Record<string, string | string[]> = {
  subway: "SW8",
  cafe: "카페",
  restaurant: "음식점",
  fastfood: "패스트푸드",
  beauty: "뷰티/화장품",
  cinema: ["CGV", "롯데시네마", "메가박스"],
  hospital: "병원",
  bank: "은행",
  government: "공공기관",
}

function loadRadius(): number {
  if (typeof window === "undefined") return DEFAULT_RADIUS
  return parseInt(localStorage.getItem(RADIUS_KEY) ?? String(DEFAULT_RADIUS))
}

export function saveRadius(r: number) {
  try { localStorage.setItem(RADIUS_KEY, String(r)) } catch {}
}

interface UsePlacesProps {
  mergeFavorites: (data: Place[]) => Place[]
  mapCenterRef: React.RefObject<{ lat: number; lng: number } | null>
  userLocationRef: React.RefObject<{ lat: number; lng: number } | null>
}

export function usePlaces({ mergeFavorites, mapCenterRef, userLocationRef }: UsePlacesProps) {
  const [places, setPlaces] = useState<Place[]>([])
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const [filters, setFilters] = useState<FilterState>({ category: null, waitTime: null, crowd: null })
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([])
  const [activeSearchQuery, setActiveSearchQuery] = useState(DEFAULT_SEARCH_QUERY)
  const [searchRadius, setSearchRadius] = useState<number>(DEFAULT_RADIUS)
  const searchIdRef = useRef(0)
  const originalOrderRef = useRef<string[]>([])
  const isRadiusMounted = useRef(false)
  const searchRadiusRef = useRef(DEFAULT_RADIUS)

  useEffect(() => {
    const r = loadRadius()
    setSearchRadius(r)
    searchRadiusRef.current = r
  }, [])

  useEffect(() => {
    searchRadiusRef.current = searchRadius
  }, [searchRadius])

  // 반경 변경 시 자동 재검색 (500ms 디바운스)
  useEffect(() => {
    if (!isRadiusMounted.current) {
      isRadiusMounted.current = true
      return
    }
    const timer = setTimeout(() => {
      const location = getActiveLocation()
      if (location) searchAt(location)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchRadius])

  const getActiveLocation = () => mapCenterRef.current ?? userLocationRef.current

  function buildSearchSuggestions(fetchedPlaces: Place[], query: string): SearchSuggestion[] {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return []

    const filtered = fetchedPlaces.filter((place) => {
      const name = place.name.toLowerCase()
      const category = place.category.toLowerCase()
      const address = place.address.toLowerCase()
      return name.includes(normalized) || category.includes(normalized) || address.includes(normalized)
    })

    const source = filtered.length > 0 ? filtered : fetchedPlaces
    const seen = new Set<string>()

    return source
      .filter((place) => {
        if (seen.has(place.id)) return false
        seen.add(place.id)
        return true
      })
      .slice(0, 6)
      .map((place) => ({
        id: place.id,
        title: place.name,
        subtitle: `${place.category} · ${place.address}`,
        lat: place.lat,
        lng: place.lng,
      }))
  }

  const enrichPlacesAsync = async (placesToEnrich: Place[], searchId: number) => {
    if (placesToEnrich.length === 0) return
    const ids = placesToEnrich.map((p) => p.id).join(",")
    const waitRes = await fetch(`/api/wait-times?ids=${ids}`)
    const waitTimes: WaitTimeResult[] = await waitRes.json()

    if (searchIdRef.current !== searchId) return

    const waitTimeMap = new Map<string, WaitTimeResult>()
    for (const w of waitTimes) {
      if (!waitTimeMap.has(w.place_id)) waitTimeMap.set(w.place_id, w)
    }
    setPlaces((prev) =>
      prev.map((place) => {
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
    )
  }

  const fetchPlaces = async (loc: { lat: number; lng: number }, query: string) => {
    const res = await fetch(`/api/places?lat=${loc.lat}&lng=${loc.lng}&query=${query}&radius=${searchRadiusRef.current}`)
    const data: Place[] = await res.json()
    setPlaces(mergeFavorites(data))
    setSearchSuggestions(buildSearchSuggestions(data, query))
    return data
  }

  const fetchPlacesByCategory = async (loc: { lat: number; lng: number }, categoryGroupCode: string, queryForSuggestion = "") => {
    const res = await fetch(
      `/api/places?lat=${loc.lat}&lng=${loc.lng}&categoryGroupCode=${categoryGroupCode}&query=${encodeURIComponent(queryForSuggestion)}&radius=${searchRadiusRef.current}`
    )
    const data: Place[] = await res.json()
    setPlaces(mergeFavorites(data))
    setSearchSuggestions(buildSearchSuggestions(data, queryForSuggestion || "역"))
    return data
  }

  const fetchMultiplePlaces = async (loc: { lat: number; lng: number }, queries: string[], radiusOverride?: number) => {
    const searchId = ++searchIdRef.current
    const queriesParam = encodeURIComponent(queries.join(","))
    const radius = radiusOverride ?? searchRadiusRef.current
    const res = await fetch(`/api/places?lat=${loc.lat}&lng=${loc.lng}&queries=${queriesParam}&skipEnrich=true&radius=${radius}`)
    const data: Place[] = await res.json()

    if (searchIdRef.current !== searchId) return data
    setPlaces(mergeFavorites(data))

    enrichPlacesAsync(data, searchId)
    return data
  }

  const fetchDiversePlaces = async (loc: { lat: number; lng: number }, query: string, radiusOverride?: number) => {
    const mergedQueries = Array.from(new Set([query, ...DIVERSE_CATEGORY_QUERIES]))
    const data = await fetchMultiplePlaces(loc, mergedQueries, radiusOverride)
    setSearchSuggestions(buildSearchSuggestions(data, query))
    return data
  }

  const executeSearch = (loc: { lat: number; lng: number }, rawQuery: string, radiusOverride?: number) => {
    const normalizedQuery = rawQuery.trim() || DEFAULT_SEARCH_QUERY
    setActiveSearchQuery(normalizedQuery)

    if (!rawQuery.trim()) {
      return fetchDiversePlaces(loc, DEFAULT_SEARCH_QUERY)
    }

    return fetchDiversePlaces(loc, normalizedQuery, radiusOverride)
  }

  const keepSelectedPlaceFirst = (list: Place[]) => {
    if (!selectedPlace) return list
    return [...list].sort((a, b) => {
      if (a.id === selectedPlace.id) return -1
      if (b.id === selectedPlace.id) return 1
      return 0
    })
  }

  const resetPinHighlight = () => {
    setSelectedPlace(null)
    originalOrderRef.current = []
  }

  const handleDeselect = () => {
    setSelectedPlace(null)
    if (originalOrderRef.current.length > 0) {
      const savedOrder = originalOrderRef.current
      setPlaces((prev) =>
        [...prev].sort((a, b) => {
          const ai = savedOrder.indexOf(a.id)
          const bi = savedOrder.indexOf(b.id)
          if (ai === -1 && bi === -1) return 0
          if (ai === -1) return 1
          if (bi === -1) return -1
          return ai - bi
        })
      )
      originalOrderRef.current = []
    }
  }

  const searchAt = (location: { lat: number; lng: number }) => {
    resetPinHighlight()
    executeSearch(location, activeSearchQuery)
  }

  const handleMarkerClick = (place: Place) => {
    setSelectedPlace(place)

    if (!filters.category) {
      setPlaces((prev) => {
        if (originalOrderRef.current.length === 0) {
          originalOrderRef.current = prev.map((p) => p.id)
        }
        const savedOrder = originalOrderRef.current
        return [...prev].sort((a, b) => {
          if (a.id === place.id) return -1
          if (b.id === place.id) return 1
          return savedOrder.indexOf(a.id) - savedOrder.indexOf(b.id)
        })
      })
      return
    }

    if (place.lat == null || place.lng == null) return

    setPlaces((prev) => {
      const sorted = [...prev].sort((a, b) => {
        if (a.id === place.id) return -1
        if (b.id === place.id) return 1

        const aHasCoord = a.lat != null && a.lng != null
        const bHasCoord = b.lat != null && b.lng != null

        if (!aHasCoord && !bHasCoord) return 0
        if (!aHasCoord) return 1
        if (!bHasCoord) return -1

        const aDist = haversineMeters(place.lat!, place.lng!, a.lat!, a.lng!)
        const bDist = haversineMeters(place.lat!, place.lng!, b.lat!, b.lng!)
        return aDist - bDist
      })

      return keepSelectedPlaceFirst(sorted)
    })
  }

  const handleFilterChange = (filterType: keyof FilterState, value: string | null) => {
    const newFilters = { ...filters, [filterType]: value }
    setFilters(newFilters)

    if (filterType === "category") resetPinHighlight()

    const location = getActiveLocation()
    if (!location) return

    const isAllCategory = !newFilters.category || newFilters.category === "all"
    const categoryQuery = newFilters.category ? categoryMap[newFilters.category] : DEFAULT_SEARCH_QUERY

    const fetcher: Promise<Place[]> = isAllCategory
      ? fetchDiversePlaces(location, activeSearchQuery || DEFAULT_SEARCH_QUERY)
      : categoryQuery === "SW8"
        ? fetchPlacesByCategory(location, "SW8", activeSearchQuery)
        : Array.isArray(categoryQuery)
          ? fetchMultiplePlaces(location, categoryQuery)
          : fetchPlaces(location, categoryQuery || DEFAULT_SEARCH_QUERY)

    fetcher.then((fetchedPlaces: Place[]) => {
      let result = [...fetchedPlaces]

      if (newFilters.waitTime) {
        switch (newFilters.waitTime) {
          case "asc": result.sort((a, b) => a.waitTime - b.waitTime); break
          case "desc": result.sort((a, b) => b.waitTime - a.waitTime); break
          case "under10": result = result.filter((p) => p.waitTime <= 10); break
          case "under30": result = result.filter((p) => p.waitTime <= 30); break
          case "over30": result = result.filter((p) => p.waitTime > 30); break
        }
      }

      const crowdOrder: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 }
      if (newFilters.crowd) {
        switch (newFilters.crowd) {
          case "low_first": result.sort((a, b) => crowdOrder[a.crowdLevel] - crowdOrder[b.crowdLevel]); break
          case "high_first": result.sort((a, b) => crowdOrder[b.crowdLevel] - crowdOrder[a.crowdLevel]); break
          case "low": result = result.filter((p) => p.crowdLevel === "low"); break
          case "medium": result = result.filter((p) => p.crowdLevel === "medium"); break
          case "high": result = result.filter((p) => p.crowdLevel === "high" || p.crowdLevel === "critical"); break
        }
      }

      setPlaces(keepSelectedPlaceFirst(result))
    }).catch(() => {
      toast.error("장소를 불러오는 중 오류가 발생했습니다.")
    })
  }

  return {
    places, setPlaces,
    selectedPlace, setSelectedPlace,
    filters, setFilters,
    searchSuggestions, setSearchSuggestions,
    activeSearchQuery, setActiveSearchQuery,
    searchRadius, setSearchRadius,
    getActiveLocation,
    fetchDiversePlaces, fetchMultiplePlaces,
    executeSearch, searchAt,
    handleMarkerClick, handleDeselect, handleFilterChange,
    resetPinHighlight, keepSelectedPlaceFirst,
    DEFAULT_SEARCH_QUERY,
  }
}

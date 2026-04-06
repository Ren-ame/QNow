"use client"

import { useState, useEffect } from "react"
import { Plus, Navigation } from "lucide-react"
import { SearchBar, type SearchSuggestion } from "@/components/search-bar"
import { MapView } from "@/components/map-view"
import { FilterButtons, type FilterState } from "@/components/filter-buttons"
import { BottomSheet } from "@/components/bottom-sheet"
import { PlaceCard, type Place } from "@/components/place-card"
import { WaitTimeInputModal } from "@/components/wait-time-input-modal"
import { Button } from "@/components/ui/button"
import { Toaster, toast } from "sonner"

// 샘플 데이터
const samplePlaces: Place[] = [
  {
    id: "1",
    name: "스타벅스 강남역점",
    category: "카페",
    address: "서울 강남구 강남대로 396",
    distance: "350m",
    waitTime: 15,
    waitingPeople: 8,
    crowdLevel: "medium",
    lastUpdated: "5분 전",
    isFavorite: true,
  },
  {
    id: "2",
    name: "이디야커피 역삼점",
    category: "카페",
    address: "서울 강남구 테헤란로 152",
    distance: "500m",
    waitTime: 5,
    waitingPeople: 3,
    crowdLevel: "low",
    lastUpdated: "2분 전",
    isFavorite: false,
  },
  {
    id: "3",
    name: "맥도날드 강남점",
    category: "패스트푸드",
    address: "서울 강남구 강남대로 390",
    distance: "400m",
    waitTime: 25,
    waitingPeople: 15,
    crowdLevel: "high",
    lastUpdated: "10분 전",
    isFavorite: false,
  },
  {
    id: "4",
    name: "고기굽는집",
    category: "음식점",
    address: "서울 강남구 봉은사로 123",
    distance: "650m",
    waitTime: 45,
    waitingPeople: 22,
    crowdLevel: "critical",
    lastUpdated: "3분 전",
    isFavorite: true,
  },
  {
    id: "5",
    name: "올리브영 강남역점",
    category: "뷰티/화장품",
    address: "서울 강남구 강남대로 382",
    distance: "280m",
    waitTime: 10,
    waitingPeople: 6,
    crowdLevel: "medium",
    lastUpdated: "7분 전",
    isFavorite: false,
  },
  {
    id: "6",
    name: "CGV 강남",
    category: "영화관",
    address: "서울 강남구 강남대로 438",
    distance: "800m",
    waitTime: 0,
    waitingPeople: 0,
    crowdLevel: "low",
    lastUpdated: "1분 전",
    isFavorite: false,
  },
]

export default function WaitingNowPage() {
  const DEFAULT_SEARCH_QUERY = "음식점"
  const DIVERSE_CATEGORY_QUERIES = ["음식점", "카페", "병원", "은행", "약국", "편의점"]
  const isDeveloperMode = process.env.NODE_ENV !== "production"
  const [places, setPlaces] = useState<Place[]>(samplePlaces)
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const [filters, setFilters] = useState<FilterState>({
    category: null,
    waitTime: null,
    crowd: null,
  })
  const [isInputModalOpen, setIsInputModalOpen] = useState(false)
  const [editingPlace, setEditingPlace] = useState<Place | null>(null)
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null)
  const [mapViewportCenter, setMapViewportCenter] = useState<{lat: number, lng: number} | null>(null)
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number} | null>(null)
  const [actualMapCenter, setActualMapCenter] = useState<{lat: number, lng: number} | null>(null)
  const [guideFocusTarget, setGuideFocusTarget] = useState<{lat: number, lng: number} | null>(null)
  const [activeSearchQuery, setActiveSearchQuery] = useState(DEFAULT_SEARCH_QUERY)
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([])

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        setMapViewportCenter(loc)
        setMapCenter(loc)
        fetchPlaces(loc, DEFAULT_SEARCH_QUERY)
      },
      () => {
        const loc = { lat: 37.4979, lng: 127.0276 }
        setUserLocation(loc)
        setMapViewportCenter(loc)
        setMapCenter(loc)
        fetchPlaces(loc, DEFAULT_SEARCH_QUERY)
      }
    )
  }, [])

  const buildSearchSuggestions = (fetchedPlaces: Place[], query: string): SearchSuggestion[] => {
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

  const fetchPlaces = async (loc: {lat: number, lng: number}, query: string) => {
    const res = await fetch(`/api/places?lat=${loc.lat}&lng=${loc.lng}&query=${query}`)
    const data: Place[] = await res.json()
    setPlaces(data)
    setSearchSuggestions(buildSearchSuggestions(data, query))
    return data
  }

  const fetchPlacesByCategory = async (loc: {lat: number, lng: number}, categoryGroupCode: string, queryForSuggestion = "") => {
    const res = await fetch(
      `/api/places?lat=${loc.lat}&lng=${loc.lng}&categoryGroupCode=${categoryGroupCode}&query=${encodeURIComponent(queryForSuggestion)}`
    )
    const data: Place[] = await res.json()
    setPlaces(data)
    setSearchSuggestions(buildSearchSuggestions(data, queryForSuggestion || "역"))
    return data
  }

  const fetchMultiplePlaces = async (loc: {lat: number, lng: number}, queries: string[]) => {
    const results = await Promise.all(
      queries.map(q => fetch(`/api/places?lat=${loc.lat}&lng=${loc.lng}&query=${q}`).then(r => r.json()))
    )
    const merged: Place[] = results.flat()
    // 중복 제거
    const unique = merged.filter((place, index, self) =>
      index === self.findIndex((p) => p.id === place.id)
    )
    setPlaces(unique)
    return unique
  }

  const fetchDiversePlaces = async (loc: {lat: number, lng: number}, query: string) => {
    const mergedQueries = Array.from(new Set([query, ...DIVERSE_CATEGORY_QUERIES]))
    const data = await fetchMultiplePlaces(loc, mergedQueries)
    setSearchSuggestions(buildSearchSuggestions(data, query))
    return data
  }

  const executeSearch = (loc: {lat: number, lng: number}, rawQuery: string) => {
    const normalizedQuery = rawQuery.trim() || DEFAULT_SEARCH_QUERY
    setActiveSearchQuery(normalizedQuery)

    if (!rawQuery.trim()) {
      return fetchPlaces(loc, DEFAULT_SEARCH_QUERY)
    }

    return fetchDiversePlaces(loc, normalizedQuery)
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
  }

  const getActiveLocation = () => mapCenter ?? userLocation

  const handleDebugCenter = () => {
    if (!actualMapCenter || !mapCenter) {
      toast.info("현재 중심 좌표를 아직 가져오지 못했습니다.")
      return
    }

    console.log("[WaitingNowPage] Actual map center:", actualMapCenter)
    console.log("[WaitingNowPage] Crosshair center:", mapCenter)

    toast.custom(() => (
      <div className="rounded-lg border border-border bg-background px-4 py-3 shadow-lg">
        <div className="text-sm font-semibold text-foreground">중심 좌표 비교</div>
        <div className="mt-2 grid gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">현재 중심 좌표</div>
            <div className="font-medium text-foreground">
              {actualMapCenter.lat.toFixed(6)}, {actualMapCenter.lng.toFixed(6)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">십자선 좌표</div>
            <div className="font-medium text-foreground">
              {mapCenter.lat.toFixed(6)}, {mapCenter.lng.toFixed(6)}
            </div>
          </div>
        </div>
      </div>
    ))
  }

  const handleReSearch = () => {
    if (!mapCenter) {
      toast.info("십자선 중심 좌표를 아직 가져오지 못했습니다.")
      return
    }

    resetPinHighlight()

    setFilters({
      category: null,
      waitTime: null,
      crowd: null,
    })

    executeSearch(mapCenter, activeSearchQuery)
  }

  const handleSearch = (query: string) => {
    const location = getActiveLocation()

    if (!location) return
    resetPinHighlight()
    executeSearch(location, query)
  }

  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    const normalizedQuery = suggestion.title.trim() || DEFAULT_SEARCH_QUERY
    setActiveSearchQuery(normalizedQuery)

    if (suggestion.lat == null || suggestion.lng == null) {
      handleSearch(normalizedQuery)
      return
    }

    const target = { lat: suggestion.lat, lng: suggestion.lng }
    setGuideFocusTarget(target)
    setMapCenter(target)

    const matchedPlace = places.find((place) => place.id === suggestion.id)
    if (matchedPlace) {
      setSelectedPlace(matchedPlace)
    }
  }

  const handlePlaceSelect = (place: Place) => {
    setSelectedPlace(place)
    setEditingPlace(place)
    setIsInputModalOpen(true)
  }

  const handleMarkerClick = (place: Place) => {
    setSelectedPlace(place)

    // 업종 필터가 선택된 상태에서만, 클릭한 핀 기준으로 주변 목록을 가까운 순 정렬한다.
    if (!filters.category) return
    if (place.lat == null || place.lng == null) return

    const toRad = (deg: number) => (deg * Math.PI) / 180
    const distanceInMeters = (
      lat1: number,
      lng1: number,
      lat2: number,
      lng2: number
    ) => {
      const R = 6371000
      const dLat = toRad(lat2 - lat1)
      const dLng = toRad(lng2 - lng1)
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2)
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      return R * c
    }

    setPlaces((prev) => {
      const sorted = [...prev].sort((a, b) => {
        if (a.id === place.id) return -1
        if (b.id === place.id) return 1

        const aHasCoord = a.lat != null && a.lng != null
        const bHasCoord = b.lat != null && b.lng != null

        if (!aHasCoord && !bHasCoord) return 0
        if (!aHasCoord) return 1
        if (!bHasCoord) return -1

        const aDist = distanceInMeters(place.lat!, place.lng!, a.lat!, a.lng!)
        const bDist = distanceInMeters(place.lat!, place.lng!, b.lat!, b.lng!)
        return aDist - bDist
      })

      return keepSelectedPlaceFirst(sorted)
    })
  }

  const handleFavorite = (place: Place) => {
    setPlaces((prev) =>
      prev.map((p) =>
        p.id === place.id ? { ...p, isFavorite: !p.isFavorite } : p
      )
    )
    toast.success(
      place.isFavorite ? "즐겨찾기에서 제거되었습니다" : "즐겨찾기에 추가되었습니다"
    )
  }

  const handleWaitTimeSubmit = (data: {
    waitTime: number
    waitingPeople: number
    crowdLevel: string
  }) => {
    if (!editingPlace) return

    setPlaces((prev) =>
      prev.map((p) =>
        p.id === editingPlace.id
          ? {
              ...p,
              waitTime: data.waitTime,
              waitingPeople: data.waitingPeople,
              crowdLevel: data.crowdLevel as Place["crowdLevel"],
              lastUpdated: "방금 전",
            }
          : p
      )
    )
    toast.success("대기 정보가 업데이트되었습니다!")
    setEditingPlace(null)
  }

  const handleAddNewPlace = () => {
    // 새로운 장소 추가 로직 (데모용으로 첫 번째 장소 선택)
    setEditingPlace(null)
    setIsInputModalOpen(true)
  }

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

const handleFilterChange = (filterType: keyof FilterState, value: string | null) => {
  const newFilters = { ...filters, [filterType]: value }
  setFilters(newFilters)

  if (filterType === "category") {
    resetPinHighlight()
  }

  const location = getActiveLocation()

  if (location) {
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
    })
  }
}

  return (
    <main className="relative h-screen w-full overflow-hidden bg-background">
      <Toaster position="top-center" richColors />

      {/* 검색바 */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4">
        <SearchBar
          onSearch={handleSearch}
          onDebouncedSearch={handleSearch}
          onSuggestionSelect={handleSuggestionSelect}
          suggestions={searchSuggestions}
        />
      </div>

      {/* 필터 버튼 */}
      <div className="absolute top-20 right-4 z-20">
        <FilterButtons
          filters={filters}
          onFilterChange={handleFilterChange}
        />
      </div>

      {/* 지도 영역 */}
      <div className="absolute inset-0 z-0">
        <MapView
          places={places}
          selectedPlace={selectedPlace}
          onMarkerClick={handleMarkerClick}
          onMapBackgroundClick={() => setSelectedPlace(null)}
          center={mapViewportCenter ?? userLocation ?? undefined}
          focusTargetAtGuide={guideFocusTarget}
          onSearchArea={(lat, lng) => fetchPlaces({ lat, lng }, "음식점")}
          onCenterChange={(lat, lng) => setMapCenter({ lat, lng })}
          onMapCenterChange={(lat, lng) => setActualMapCenter({ lat, lng })}
        />
      </div>

      {/* 현재 위치로 이동 버튼 */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute left-4 bottom-[48%] z-10 rounded-full shadow-lg bg-card hover:bg-muted"
        onClick={() => {
          if (!userLocation) {
            toast.info("현재 위치를 아직 가져오지 못했습니다.")
            return
          }

          const currentLocation = { ...userLocation }

          resetPinHighlight()
          setMapViewportCenter(currentLocation)
          executeSearch(currentLocation, activeSearchQuery)
          toast.info("현재 위치로 이동합니다")
        }}
      >
        <Navigation className="w-5 h-5 text-primary" />
      </Button>

      {/* 중심점 디버그 버튼 */}
      {isDeveloperMode && (
        <Button
          variant="secondary"
          className="absolute right-4 bottom-[58%] z-10 rounded-full shadow-lg bg-card hover:bg-muted"
          onClick={handleDebugCenter}
        >
          중심점 확인
        </Button>
      )}

      {/* 이 지역 재검색 버튼 */}
      {mapCenter && (
      <Button
        onClick={handleReSearch}
        className="absolute bottom-[48%] left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-card rounded-full shadow-md border border-border hover:bg-muted transition-colors text-sm font-medium text-foreground"
      >
        이 지역 재검색
      </Button>
      )}

      {/* 대기 정보 입력 버튼 */}
      <Button
        className="absolute right-4 bottom-[48%] z-10 rounded-full shadow-lg gap-2"
        onClick={handleAddNewPlace}
      >
        <Plus className="w-5 h-5" />
        <span className="hidden sm:inline">정보 등록</span>
      </Button>

      {/* 하단 장소 목록 시트 */}
      <BottomSheet>
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">
              주변 대기 정보
            </h2>
            <span className="text-sm text-muted-foreground">
              {places.length}개 장소
            </span>
          </div>

          {places.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <Navigation className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground">
                검색 결과가 없습니다
              </p>
            </div>
          ) : (
            places.map((place) => (
              <PlaceCard
                key={place.id}
                place={place}
                onSelect={handlePlaceSelect}
                onFavorite={handleFavorite}
              />
            ))
          )}
        </div>
      </BottomSheet>

      {/* 대기 정보 입력 모달 */}
      <WaitTimeInputModal
        place={editingPlace}
        isOpen={isInputModalOpen}
        onClose={() => {
          setIsInputModalOpen(false)
          setEditingPlace(null)
        }}
        onSubmit={handleWaitTimeSubmit}
      />
    </main>
  )
}

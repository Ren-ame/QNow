"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, Navigation, SlidersHorizontal, Layers, MapPin, Check, X } from "lucide-react"
import { SearchBar, type SearchSuggestion } from "@/components/search-bar"
import { MapView } from "@/components/map-view"
import { FilterButtons, type FilterState } from "@/components/filter-buttons"
import { BottomSheet } from "@/components/bottom-sheet"
import { PlaceCard, type Place } from "@/components/place-card"
import { WaitTimeInputModal } from "@/components/wait-time-input-modal"
import { WaitTimeHistoryModal } from "@/components/wait-time-history-modal"
import { NewPlaceModal, type NewPlaceData } from "@/components/new-place-modal"
import { ReportPlaceModal } from "@/components/report-place-modal"
import { MenuSheet } from "@/components/menu-sheet"
import { MyPageModal } from "@/components/my-page-modal"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Toaster, toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"

// ── localStorage 즐겨찾기 헬퍼 ──────────────────────────────────────
const FAVORITES_KEY = "qnow_favorites"
const RADIUS_KEY = "qnow_search_radius"
const DEFAULT_RADIUS = 5000
// min=500, max=9500 → default 5000이 정중앙
const RADIUS_MIN = 500
const RADIUS_MAX = 9500

function loadRadius(): number {
  if (typeof window === "undefined") return DEFAULT_RADIUS
  return parseInt(localStorage.getItem(RADIUS_KEY) ?? String(DEFAULT_RADIUS))
}
function saveRadius(r: number) {
  try { localStorage.setItem(RADIUS_KEY, String(r)) } catch {}
}

function loadFavorites(): Record<string, Place> {
  if (typeof window === "undefined") return {}
  try {
    const stored = localStorage.getItem(FAVORITES_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch { return {} }
}

function saveFavorites(favorites: Record<string, Place>) {
  try { localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)) } catch {}
}

/** 새로 불러온 places에 localStorage 즐겨찾기 여부를 병합 */
function mergeFavorites(data: Place[]): Place[] {
  const favIds = new Set(Object.keys(loadFavorites()))
  return data.map((p) => ({ ...p, isFavorite: favIds.has(p.id) }))
}
// ────────────────────────────────────────────────────────────────────

/* LEGACY CODE - 밑의 코드로 대체됨 (2024-06-20)
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
] */

export default function WaitingNowPage() {
  const DEFAULT_SEARCH_QUERY = "음식점"
  const DIVERSE_CATEGORY_QUERIES = ["음식점", "카페", "병원", "은행", "약국", "편의점"]
  const isDeveloperMode = process.env.NODE_ENV !== "production"
  const [places, setPlaces] = useState<Place[]>([])
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null)
  const [filters, setFilters] = useState<FilterState>({
    category: null,
    waitTime: null,
    crowd: null,
  })
  const [isInputModalOpen, setIsInputModalOpen] = useState(false)
  const [editingPlace, setEditingPlace] = useState<Place | null>(null)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [historyPlace, setHistoryPlace] = useState<Place | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [searchRadius, setSearchRadius] = useState<number>(DEFAULT_RADIUS)
  const [menuInitialView, setMenuInitialView] = useState<"main" | "favorites" | "my-registrations">("main")
  const [isMyPageOpen, setIsMyPageOpen] = useState(false)
  const [savedFavorites, setSavedFavorites] = useState<Record<string, Place>>({})
  const { user, session, isLoading: isAuthLoading, signInWithKakao, switchKakaoAccount, signOut } = useAuth()
  // 어드민 여부는 서버에서 판정(/api/me) — 어드민 이메일을 클라이언트에 노출하지 않음
  const [isAdmin, setIsAdmin] = useState(false)
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null)
  const [mapViewportCenter, setMapViewportCenter] = useState<{lat: number, lng: number} | null>(null)
  const [mapCenter, setMapCenter] = useState<{lat: number, lng: number} | null>(null)
  const [actualMapCenter, setActualMapCenter] = useState<{lat: number, lng: number} | null>(null)
  const [guideFocusTarget, setGuideFocusTarget] = useState<{lat: number, lng: number} | null>(null)
  const [activeSearchQuery, setActiveSearchQuery] = useState(DEFAULT_SEARCH_QUERY)
  const [searchSuggestions, setSearchSuggestions] = useState<SearchSuggestion[]>([])
  const [resetZoomSignal, setResetZoomSignal] = useState(0)
  const [showRadiusPanel, setShowRadiusPanel] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [isNewPlaceModalOpen, setIsNewPlaceModalOpen] = useState(false)
  const [isLocationPickerMode, setIsLocationPickerMode] = useState(false)
  const [pickedLocation, setPickedLocation] = useState<{lat: number, lng: number} | null>(null)
  const [reportingPlace, setReportingPlace] = useState<Place | null>(null)
  const [pendingReportCount, setPendingReportCount] = useState(0)
  const [customPlaces, setCustomPlaces] = useState<Place[]>([])
  const [showCustomPlaces, setShowCustomPlaces] = useState(true)
  // 2026-05-26: 구 검색의 비동기 enrichment가 신 검색 결과를 덮어쓰는 것을 방지
  const searchIdRef = useRef(0)
  const originalOrderRef = useRef<string[]>([])

  // 로그인 시 서버에서 어드민 여부 조회
  useEffect(() => {
    if (!session) { setIsAdmin(false); return }
    fetch("/api/me", { headers: { Authorization: `Bearer ${session.access_token}` } })
      .then((res) => res.json())
      .then((d) => setIsAdmin(!!d.isAdmin))
      .catch(() => setIsAdmin(false))
  }, [session])

  // 어드민이면 미처리 신고 수 조회
  useEffect(() => {
    if (isAdmin && session) fetchPendingReportCount()
  }, [isAdmin, session])

  useEffect(() => {
    if (!user || !session) return

    const token = session.access_token

    const syncFavorites = async () => {
      // DB에서 불러오기
      const res = await fetch("/api/favorites", {
        headers: { Authorization: `Bearer ${token}` },
      })
      const dbData = await res.json()

      if (!Array.isArray(dbData)) return

      const dbFavorites: Record<string, Place> = {}
      dbData.forEach((fav: any) => {
        dbFavorites[fav.place_id] = {
          id: fav.place_id,
          name: fav.place_name ?? "",
          address: fav.place_address ?? "",
          category: fav.place_category ?? "",
          lat: fav.place_lat,
          lng: fav.place_lng,
          distance: "",
          waitTime: 0,
          waitingPeople: 0,
          crowdLevel: "low",
          lastUpdated: "정보 없음",
        }
      })

      // localStorage에만 있는 항목 DB에 마이그레이션
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

      // DB 기준으로 상태 통일
      setSavedFavorites(dbFavorites)
      saveFavorites(dbFavorites)
    }

    syncFavorites()
  }, [user?.id])

  // 클라이언트 마운트 후 localStorage 값 복원
  const isRadiusMounted = useRef(false)
  useEffect(() => {
    setSearchRadius(loadRadius())
    setSavedFavorites(loadFavorites())
  }, [])

  // 반경 변경 시 자동 재검색 (슬라이더 조작 끝나고 500ms 후)
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

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
        /* 2026-05-26: setMapViewportCenter → setGuideFocusTarget으로 변경
         * 기존: 내 위치가 지도 수학적 중심에 배치 (십자선과 불일치)
         * 변경: 현재위치 버튼과 동일하게 내 위치가 십자선에 오도록 통일 */
        setGuideFocusTarget(loc)
        setMapCenter(loc)
        fetchDiversePlaces(loc, DEFAULT_SEARCH_QUERY)
        fetchCustomPlaces(loc.lat, loc.lng, searchRadius)
      },
      () => {
        const loc = { lat: 37.4979, lng: 127.0276 }
        setUserLocation(loc)
        setGuideFocusTarget(loc)
        setMapCenter(loc)
        fetchDiversePlaces(loc, DEFAULT_SEARCH_QUERY)
        fetchCustomPlaces(loc.lat, loc.lng, searchRadius)
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

  /* 2026-05-26: 2단계 로딩을 위한 헬퍼
   * Kakao 결과를 먼저 보여준 뒤 Supabase 대기 정보를 비동기로 병합
   * searchId가 다르면 이미 새 검색이 시작된 것이므로 업데이트 무시 */
  const formatLastUpdated = (createdAt: string) => {
    const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000 / 60)
    if (diff < 1) return "방금 전"
    if (diff < 60) return `${diff}분 전`
    const hours = Math.floor(diff / 60)
    if (hours < 24) return `${hours}시간 전`
    return `${Math.floor(hours / 24)}일 전`
  }

  const enrichPlacesAsync = async (places: Place[], searchId: number) => {
    if (places.length === 0) return
    const ids = places.map((p) => p.id).join(",")
    const waitRes = await fetch(`/api/wait-times?ids=${ids}`)
    const waitTimes: any[] = await waitRes.json()

    if (searchIdRef.current !== searchId) return // 구 검색 결과 무시

    // waitTimes는 created_at DESC(최신순)이므로 먼저 나온 항목(최신)만 유지
    const waitTimeMap = new Map<string, any>()
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

  const fetchPlaces = async (loc: {lat: number, lng: number}, query: string) => {
    const res = await fetch(`/api/places?lat=${loc.lat}&lng=${loc.lng}&query=${query}&radius=${searchRadius}`)
    const data: Place[] = await res.json()
    setPlaces(mergeFavorites(data))
    setSearchSuggestions(buildSearchSuggestions(data, query))
    return data
  }

  const fetchPlacesByCategory = async (loc: {lat: number, lng: number}, categoryGroupCode: string, queryForSuggestion = "") => {
    const res = await fetch(
      `/api/places?lat=${loc.lat}&lng=${loc.lng}&categoryGroupCode=${categoryGroupCode}&query=${encodeURIComponent(queryForSuggestion)}&radius=${searchRadius}`
    )
    const data: Place[] = await res.json()
    setPlaces(mergeFavorites(data))
    setSearchSuggestions(buildSearchSuggestions(data, queryForSuggestion || "역"))
    return data
  }

  /* 2026-05-26: 성능 개선 - 클라이언트-서버 왕복 N→1 + 2단계 로딩 적용
   * Phase 1: skipEnrich=true로 Kakao 결과 즉시 표시 (대기 정보 없음)
   * Phase 2: /api/wait-times로 Supabase 1번 조회 후 대기 정보 비동기 병합 */
  const fetchMultiplePlaces = async (loc: {lat: number, lng: number}, queries: string[]) => {
    const searchId = ++searchIdRef.current
    const queriesParam = encodeURIComponent(queries.join(","))
    const res = await fetch(`/api/places?lat=${loc.lat}&lng=${loc.lng}&queries=${queriesParam}&skipEnrich=true&radius=${searchRadius}`)
    const data: Place[] = await res.json()

    if (searchIdRef.current !== searchId) return data
    setPlaces(mergeFavorites(data)) // Phase 1: 즉시 표시 (즐겨찾기 병합)

    enrichPlacesAsync(data, searchId) // Phase 2: 대기 정보 비동기 병합 (non-blocking)
    return data
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
      return fetchDiversePlaces(loc, DEFAULT_SEARCH_QUERY)
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

  /** 특정 좌표 기준으로 재검색 — 현재위치 버튼, 이 지역 재검색, 즐겨찾기 이동 공통 사용 */
  const searchAt = (location: { lat: number; lng: number }) => {
    resetPinHighlight()
    executeSearch(location, activeSearchQuery)
  }

  const handleReSearch = () => {
    if (!mapCenter) {
      toast.info("십자선 중심 좌표를 아직 가져오지 못했습니다.")
      return
    }
    setFilters({ category: null, waitTime: null, crowd: null })
    searchAt(mapCenter)
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

    if (place.lastUpdated === "정보 없음") {
      toast.info("아직 대기 정보가 없어요. 첫 번째로 등록해보세요! 🙌")
    }
  }

  const handleMarkerClick = (place: Place) => {
    setSelectedPlace(place)

    // 필터 없이 선택만 된 경우: 선택된 장소를 목록 맨 위로
    if (!filters.category) {
      setPlaces((prev) => {
        // 최초 선택이면 원래 순서 저장, 선택 전환이면 기존 저장 순서 유지
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

    // 업종 필터가 선택된 상태: 클릭한 핀 기준으로 주변 목록을 가까운 순 정렬
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

  const handleFavorite = async (place: Place) => {
    const isNowFavorite = !place.isFavorite

    // 로그인 상태면 DB에도 저장
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

    // 항상 localStorage 업데이트 (오프라인 캐시)
    const current = loadFavorites()
    if (isNowFavorite) {
      current[place.id] = place
    } else {
      delete current[place.id]
    }
    saveFavorites(current)
    setSavedFavorites({ ...current })

    setPlaces((prev) =>
      prev.map((p) => p.id === place.id ? { ...p, isFavorite: isNowFavorite } : p)
    )
    toast.success(isNowFavorite ? "즐겨찾기에 추가되었습니다" : "즐겨찾기에서 제거되었습니다")
  }

  /* 2026-05-26: Supabase 저장 추가
   * 기존: React 상태만 업데이트 → 새로고침/재검색 시 데이터 소실
   * 변경: /api/wait-times POST로 Supabase에 저장 후 상태 업데이트 */
  const handleWaitTimeSubmit = async (data: {
    waitTime: number
    waitingPeople: number
    crowdLevel: string
  }) => {
    if (!editingPlace) return

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (session) headers["Authorization"] = `Bearer ${session.access_token}`

      const res = await fetch("/api/wait-times", {
        method: "POST",
        headers,
        body: JSON.stringify({
          place_id: editingPlace.id,
          place_name: editingPlace.name,
          wait_time: data.waitTime,
          waiting_people: data.waitingPeople,
          crowd_level: data.crowdLevel,
          place_lat: editingPlace.lat,
          place_lng: editingPlace.lng,
          user_lat: userLocation?.lat,
          user_lng: userLocation?.lng,
        }),
      })

      if (!res.ok) throw new Error("저장 실패")

      const result = await res.json()

      const updatedFields = {
        waitTime: data.waitTime,
        waitingPeople: data.waitingPeople,
        crowdLevel: data.crowdLevel as Place["crowdLevel"],
        lastUpdated: "방금 전",
      }
      setPlaces((prev) =>
        prev.map((p) => p.id === editingPlace.id ? { ...p, ...updatedFields } : p)
      )
      // 커스텀 장소 대기정보도 즉시 반영
      if (editingPlace.id.startsWith("custom_")) {
        setCustomPlaces((prev) =>
          prev.map((p) => p.id === editingPlace.id ? { ...p, ...updatedFields } : p)
        )
      }

      if (result.point_earned) {
        toast.success("대기 정보가 등록되었습니다! +10P 적립")
      } else if (user) {
        toast.success("대기 정보가 등록되었습니다! (100m 이내 방문 시 포인트 적립)")
      } else {
        toast.success("대기 정보가 등록되었습니다!")
      }
    } catch {
      toast.error("저장 중 오류가 발생했습니다. 다시 시도해주세요.")
    } finally {
      setEditingPlace(null)
    }
  }

  const handleShowHistory = (place: Place) => {
    setHistoryPlace(place)
    setIsHistoryModalOpen(true)
  }

  const handleAddNewPlace = () => {
    if (!user) {
      toast.error("신규 장소 등록은 로그인이 필요합니다")
      return
    }
    // 위치 선택 모드 진입 — 지도를 움직여 위치 확정 후 등록 폼 오픈
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

  const handleNewPlaceSubmit = async (data: NewPlaceData) => {
    if (!session) return
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
      toast.error(err.error ?? "등록에 실패했습니다")
      return
    }
    const created = await res.json()
    // Place 형태로 변환 후 지도에 즉시 반영
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
    toast.success("장소가 등록됐어요! 포인트는 검토 후 지급됩니다 🎉")
  }

  const fetchCustomPlaces = async (lat: number, lng: number, radius: number) => {
    try {
      const res = await fetch(`/api/custom-places?lat=${lat}&lng=${lng}&radius=${radius}`)
      if (!res.ok) return
      const data = await res.json()
      const mapped: Place[] = data.map((p: any) => ({
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

      // 커스텀 장소 대기정보 병합 (wait_times 테이블에서 조회)
      try {
        const ids = mapped.map((p) => p.id).join(",")
        const waitRes = await fetch(`/api/wait-times?ids=${ids}`)
        if (waitRes.ok) {
          const waitTimes: any[] = await waitRes.json()
          const waitTimeMap = new Map<string, any>()
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
      } catch {}

      setCustomPlaces(mapped)
    } catch {}
  }

  /** 신규 등록 장소 삭제 (어드민/dev 전용 — 서버에서 권한 검증) */
  const handleDeleteCustomPlace = async (place: Place) => {
    if (!confirm(`"${place.name}" 장소를 삭제할까요?`)) return
    const rawId = place.id.replace("custom_", "")
    const token = session?.access_token
    if (!token) { alert("로그인이 필요합니다"); return }
    try {
      const res = await fetch(`/api/custom-places?id=${rawId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const err = await res.json()
        alert(`삭제 실패: ${err.error}`)
        return
      }
      setCustomPlaces((prev) => prev.filter((p) => p.id !== place.id))
    } catch {
      alert("삭제 중 오류가 발생했습니다")
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
          onMenuClick={() => setIsMenuOpen(true)}
        />
        {/* 어드민 미처리 신고 뱃지 */}
        {isAdmin && pendingReportCount > 0 && (
          <button
            onClick={() => setIsMenuOpen(true)}
            className="absolute top-3 right-3 z-30 flex items-center gap-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-md animate-pulse"
          >
            🚨 {pendingReportCount}
          </button>
        )}
      </div>

      {/* 검색 반경 토글 버튼 + 슬라이더 패널 */}
      <div className="absolute top-20 left-4 z-20 flex flex-col items-center gap-2">
        <button
          onClick={() => setShowRadiusPanel((v) => !v)}
          className="w-10 h-10 rounded-full bg-card/95 backdrop-blur-sm shadow-md border border-border flex flex-col items-center justify-center gap-0.5"
        >
          <Layers className="w-4 h-4 text-primary" />
          <span className="text-[9px] font-bold text-primary leading-none">
            {searchRadius >= 1000 ? `${searchRadius / 1000}k` : `${searchRadius}m`}
          </span>
        </button>
        {showRadiusPanel && (
          <div className="flex flex-col items-center bg-card/95 backdrop-blur-sm rounded-xl px-3 py-3 shadow-md border border-border gap-1.5">
            <span className="text-[10px] text-muted-foreground">9.5km</span>
            <Slider
              orientation="vertical"
              value={[searchRadius]}
              onValueChange={(v) => { setSearchRadius(v[0]); saveRadius(v[0]) }}
              min={500}
              max={9500}
              step={500}
              className="h-24 w-2"
            />
            <span className="text-[10px] text-muted-foreground">500m</span>
            <div className="h-px w-full bg-border" />
            <span className="text-[11px] font-bold text-primary w-10 text-center">
              {searchRadius >= 1000 ? `${searchRadius / 1000}km` : `${searchRadius}m`}
            </span>
          </div>
        )}
      </div>

      {/* 필터 토글 버튼 + 필터 패널 */}
      <div className="absolute top-20 right-4 z-20 flex flex-col items-end gap-2">
        <button
          onClick={() => setShowFilterPanel((v) => !v)}
          className="w-10 h-10 rounded-full bg-card/95 backdrop-blur-sm shadow-md border border-border flex items-center justify-center relative"
        >
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          {(filters.category || filters.waitTime || filters.crowd) && (
            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-primary" />
          )}
        </button>
        {showFilterPanel && (
          <FilterButtons
            filters={filters}
            onFilterChange={handleFilterChange}
          />
        )}
      </div>

      {/* 지도 영역 */}
      <div className="absolute inset-0 z-0">
        <MapView
          places={[...places, ...customPlaces]}
          selectedPlace={selectedPlace}
          onMarkerClick={handleMarkerClick}
          onMapBackgroundClick={handleDeselect}
          center={mapViewportCenter ?? userLocation ?? undefined}
          focusTargetAtGuide={guideFocusTarget}
          onSearchArea={(lat, lng) => executeSearch({ lat, lng }, activeSearchQuery)}
          onCenterChange={(lat, lng) => setMapCenter({ lat, lng })}
          onMapCenterChange={(lat, lng) => setActualMapCenter({ lat, lng })}
          resetZoomSignal={resetZoomSignal}
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
          /* LEGACY CODE - 밑의 코드로 대체됨 (2024-06-20)
          setMapViewportCenter(currentLocation)
           */
          setGuideFocusTarget(currentLocation)
          setResetZoomSignal(prev => prev + 1)
          searchAt(currentLocation)
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

      {/* 위치 선택 모드 오버레이 */}
      {isLocationPickerMode && (
        <>
          {/* 중앙 핀 마커 (pointer-events-none: 지도 터치/드래그 방해 안 함) */}
          <div className="absolute inset-0 z-20 pointer-events-none">
            {/* 핀 꼬리 끝(그림자 점)을 dev 십자선 중심과 동일한 위치(중앙 -200px)에 맞춤 */}
            <div className="absolute left-1/2 top-1/2 flex flex-col items-center" style={{ transform: "translate(-50%, calc(-100% - 200px))" }}>
              {/* 핀 몸통 */}
              <div className="bg-primary rounded-full p-2.5 shadow-xl border-2 border-white">
                <MapPin className="w-7 h-7 text-primary-foreground fill-primary-foreground" />
              </div>
              {/* 핀 꼬리 */}
              <div className="w-0.5 h-5 bg-primary" />
              {/* 그림자 타원 */}
              <div className="w-4 h-1.5 bg-black/25 rounded-full blur-[2px]" />
            </div>
          </div>

          {/* 상단 안내 배너 */}
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="bg-background/90 backdrop-blur-sm border border-border rounded-full px-4 py-2 shadow-lg">
              <p className="text-sm font-medium text-foreground whitespace-nowrap">
                지도를 움직여 위치를 선택하세요
              </p>
            </div>
          </div>

          {/* 하단 확인 패널 */}
          <div className="absolute bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border shadow-2xl px-4 pt-4 pb-6 space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">선택된 위치</p>
              <p className="text-sm font-mono text-foreground mt-0.5">
                {(actualMapCenter ?? mapCenter) ? (
                  <>
                    {(actualMapCenter?.lat ?? mapCenter?.lat)?.toFixed(5)}°N&nbsp;
                    {(actualMapCenter?.lng ?? mapCenter?.lng)?.toFixed(5)}°E
                  </>
                ) : "위치를 불러오는 중..."}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleLocationCancel}
                className="flex-1 gap-2"
              >
                <X className="w-4 h-4" />
                취소
              </Button>
              <Button
                onClick={handleLocationConfirm}
                className="flex-1 gap-2"
                disabled={!(actualMapCenter ?? mapCenter)}
              >
                <Check className="w-4 h-4" />
                이 위치로 선택
              </Button>
            </div>
          </div>
        </>
      )}

      {/* 신규 장소 등록 버튼 (위치 선택 모드일 때 숨김) */}
      {!isLocationPickerMode && (
      <Button
        className="absolute right-4 bottom-[48%] z-10 rounded-full shadow-lg gap-2"
        onClick={handleAddNewPlace}
        title="신규 장소 등록"
      >
        <Plus className="w-5 h-5" />
        <span className="hidden sm:inline">신규 등록</span>
      </Button>
      )}

      {/* 하단 장소 목록 시트 */}
      <BottomSheet>
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">
              주변 대기 정보
            </h2>
            <div className="flex items-center gap-2">
              {customPlaces.length > 0 && (
                <button
                  onClick={() => setShowCustomPlaces((v) => !v)}
                  className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors ${
                    showCustomPlaces
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  <Plus className="w-3 h-3" />
                  신규
                </button>
              )}
              <span className="text-sm text-muted-foreground">
                {places.length}개 장소
              </span>
            </div>
          </div>

          {/* 24시간 이내 신규 등록 장소: 상단 고정 / 이후: 거리순 일반 목록 편입 */}
          {(() => {
            const HIGHLIGHT_MS = 24 * 60 * 60 * 1000 // 24시간
            const now = Date.now()
            const newCustom = showCustomPlaces
              ? customPlaces.filter(
                  (p) => p.registeredAt && now - new Date(p.registeredAt).getTime() < HIGHLIGHT_MS
                )
              : []
            const oldCustom = customPlaces.filter(
              (p) => !showCustomPlaces || !p.registeredAt || now - new Date(p.registeredAt).getTime() >= HIGHLIGHT_MS
            )
            // 24시간 지난 커스텀 장소(또는 토글 OFF 시 전체)는 일반 목록에 거리순으로 편입
            const distNum = (d: string) => parseInt(d.replace("m", "")) || Number.MAX_SAFE_INTEGER
            const allPlaces = [...places, ...oldCustom].sort(
              (a, b) => distNum(a.distance) - distNum(b.distance)
            )

            return (
              <>
                {newCustom.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-primary flex items-center gap-1">
                      <Plus className="w-3 h-3" /> 신규 등록 장소
                    </p>
                    {newCustom.map((place) => (
                      <PlaceCard
                        key={place.id}
                        place={place}
                        onSelect={handlePlaceSelect}
                        onFavorite={handleFavorite}
                        onHistory={handleShowHistory}
                        onReport={() => user ? setReportingPlace(place) : toast.error("신고하려면 로그인이 필요합니다")}
                        onDelete={isDeveloperMode || isAdmin ? handleDeleteCustomPlace : undefined}
                      />
                    ))}
                    <div className="border-t border-border pt-3" />
                  </div>
                )}

                {allPlaces.length === 0 && newCustom.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                      <Navigation className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">검색 결과가 없습니다</p>
                  </div>
                ) : (
                  allPlaces.map((place) => (
                    <PlaceCard
                      key={place.id}
                      place={place}
                      onSelect={handlePlaceSelect}
                      onFavorite={handleFavorite}
                      onHistory={handleShowHistory}
                      onReport={place.id.startsWith("custom_") ? () => user ? setReportingPlace(place) : toast.error("신고하려면 로그인이 필요합니다") : undefined}
                      onDelete={
                        (isDeveloperMode || isAdmin) && place.id.startsWith("custom_")
                          ? handleDeleteCustomPlace
                          : undefined
                      }
                    />
                  ))
                )}
              </>
            )
          })()}
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

      {/* 신규 장소 등록 모달 */}
      <NewPlaceModal
        isOpen={isNewPlaceModalOpen}
        onClose={() => setIsNewPlaceModalOpen(false)}
        defaultLat={pickedLocation?.lat}
        defaultLng={pickedLocation?.lng}
        userLat={userLocation?.lat}
        userLng={userLocation?.lng}
        onSubmit={handleNewPlaceSubmit}
      />

      {/* 장소 신고 모달 */}
      <ReportPlaceModal
        isOpen={!!reportingPlace}
        onClose={() => setReportingPlace(null)}
        placeName={reportingPlace?.name ?? ""}
        onSubmit={handleReportPlace}
      />

      {/* 햄버거 메뉴 */}
      <MenuSheet
        isOpen={isMenuOpen}
        onClose={() => { setIsMenuOpen(false); setMenuInitialView("main") }}
        user={user}
        session={session}
        isAuthLoading={isAuthLoading}
        onSignIn={signInWithKakao}
        onSwitchAccount={switchKakaoAccount}
        onSignOut={signOut}
        onOpenMyPage={() => setIsMyPageOpen(true)}
        initialView={menuInitialView}
        isAdmin={isAdmin}
        pendingReportCount={pendingReportCount}
        favoritePlaces={Object.values(savedFavorites).map((fav) => {
          const current = places.find((p) => p.id === fav.id)
          return current ?? fav
        })}
        onFavoriteSelect={(place) => {
          setSelectedPlace(place)
          if (place.lat && place.lng) {
            const loc = { lat: place.lat, lng: place.lng }
            setGuideFocusTarget(loc)
            setMapCenter(loc)
            searchAt(loc)
          }
        }}
      />

      {/* 시간대별 히스토리 모달 */}
      <WaitTimeHistoryModal
        place={historyPlace}
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false)
          setHistoryPlace(null)
        }}
      />

      {/* 마이페이지 모달 */}
      <MyPageModal
        isOpen={isMyPageOpen}
        onClose={() => setIsMyPageOpen(false)}
        user={user}
        session={session}
        onOpenRegistrations={() => {
          setMenuInitialView("my-registrations")
          setIsMenuOpen(true)
        }}
      />
    </main>
  )
}

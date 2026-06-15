"use client"

import { useState, useEffect, useRef } from "react"
import { Plus, Navigation, SlidersHorizontal, Layers, MapPin, Check, X } from "lucide-react"
import { SearchBar } from "@/components/search-bar"
import { MapView } from "@/components/map-view"
import { FilterButtons } from "@/components/filter-buttons"
import { BottomSheet } from "@/components/bottom-sheet"
import { PlaceCard, type Place } from "@/components/place-card"
import { WaitTimeInputModal } from "@/components/wait-time-input-modal"
import { WaitTimeHistoryModal } from "@/components/wait-time-history-modal"
import { NewPlaceModal } from "@/components/new-place-modal"
import { ReportPlaceModal } from "@/components/report-place-modal"
import { MenuSheet } from "@/components/menu-sheet"
import { MyPageModal } from "@/components/my-page-modal"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Toaster, toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"
import { useFavorites } from "@/hooks/useFavorites"
import { usePlaces, saveRadius } from "@/hooks/usePlaces"
import { useCustomPlaces } from "@/hooks/useCustomPlaces"
import { useAdmin } from "@/hooks/useAdmin"

export default function WaitingNowPage() {
  const isDeveloperMode = process.env.NODE_ENV !== "production"
  const { user, session, isLoading: isAuthLoading, signInWithKakao, switchKakaoAccount, signOut } = useAuth()

  // ── 위치 상태 ──────────────────────────────────────────────────────
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [actualMapCenter, setActualMapCenter] = useState<{ lat: number; lng: number } | null>(null)
  const [guideFocusTarget, setGuideFocusTarget] = useState<{ lat: number; lng: number } | null>(null)
  const [resetZoomSignal, setResetZoomSignal] = useState(0)

  // 훅 내부 async 함수에서 stale closure 없이 최신값 참조하기 위한 ref
  const mapCenterRef = useRef<{ lat: number; lng: number } | null>(null)
  const userLocationRef = useRef<{ lat: number; lng: number } | null>(null)
  useEffect(() => { mapCenterRef.current = mapCenter }, [mapCenter])
  useEffect(() => { userLocationRef.current = userLocation }, [userLocation])

  // ── UI 상태 ────────────────────────────────────────────────────────
  const [isInputModalOpen, setIsInputModalOpen] = useState(false)
  const [editingPlace, setEditingPlace] = useState<Place | null>(null)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [historyPlace, setHistoryPlace] = useState<Place | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [menuInitialView, setMenuInitialView] = useState<"main" | "favorites" | "my-registrations">("main")
  const [isMyPageOpen, setIsMyPageOpen] = useState(false)
  const [sheetHeight, setSheetHeight] = useState(45)
  const [sheetDragging, setSheetDragging] = useState(false)
  const [showRadiusPanel, setShowRadiusPanel] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)

  // ── 커스텀 훅 ──────────────────────────────────────────────────────
  const { savedFavorites, toggleFavorite, mergeFavorites } = useFavorites(user, session)

  const {
    places, setPlaces,
    selectedPlace, setSelectedPlace,
    filters, setFilters,
    searchSuggestions,
    activeSearchQuery, setActiveSearchQuery,
    searchRadius, setSearchRadius,
    getActiveLocation,
    fetchDiversePlaces,
    executeSearch, searchAt,
    handleMarkerClick, handleDeselect, handleFilterChange,
    resetPinHighlight, keepSelectedPlaceFirst,
    DEFAULT_SEARCH_QUERY,
  } = usePlaces({ mergeFavorites, mapCenterRef, userLocationRef })

  const {
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
  } = useCustomPlaces(user, session, mapCenter, actualMapCenter)

  const {
    isAdmin,
    pendingReportCount,
    reportingPlace, setReportingPlace,
    handleReportPlace,
  } = useAdmin(user, session)

  // ── 초기 위치 획득 ─────────────────────────────────────────────────
  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLocation(loc)
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

  // ── 브리지 핸들러 (두 훅 이상의 상태를 함께 업데이트) ────────────────
  const handleFavorite = async (place: Place) => {
    const isNowFavorite = await toggleFavorite(place)
    setPlaces((prev) =>
      prev.map((p) => p.id === place.id ? { ...p, isFavorite: isNowFavorite } : p)
    )
    toast.success(isNowFavorite ? "즐겨찾기에 추가되었습니다" : "즐겨찾기에서 제거되었습니다")
  }

  const handleWaitTimeSubmit = async (data: { waitTime: number; waitingPeople: number; crowdLevel: string }) => {
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

  const handlePlaceSelect = (place: Place) => {
    setSelectedPlace(place)
    setEditingPlace(place)
    setIsInputModalOpen(true)

    if (place.lastUpdated === "정보 없음") {
      toast.info("아직 대기 정보가 없어요. 첫 번째로 등록해보세요! 🙌")
    }
  }

  const handleSuggestionSelect = (suggestion: { id: string; title: string; lat?: number; lng?: number }) => {
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
    if (matchedPlace) handleMarkerClick(matchedPlace)
  }

  const confirmAndDelete = async (place: Place) => {
    if (!confirm(`"${place.name}" 장소를 삭제할까요?`)) return
    const result = await handleDeleteCustomPlace(place, session?.access_token)
    if (result?.error) alert(`삭제 실패: ${result.error}`)
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
    executeSearch(location, query, query.trim() ? 20000 : undefined)
  }

  const handleDebugCenter = () => {
    if (!actualMapCenter || !mapCenter) {
      toast.info("현재 중심 좌표를 아직 가져오지 못했습니다.")
      return
    }
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

  return (
    <main className="relative h-screen w-full overflow-hidden bg-background">
      <Toaster position="top-center" richColors />

      {/* 검색바 */}
      <div className="absolute top-0 left-0 right-0 z-50 p-4">
        <SearchBar
          onSearch={handleSearch}
          onDebouncedSearch={handleSearch}
          onSuggestionSelect={handleSuggestionSelect}
          suggestions={searchSuggestions}
          onMenuClick={() => setIsMenuOpen(true)}
        />
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
          center={userLocation ?? undefined}
          focusTargetAtGuide={guideFocusTarget}
          onSearchArea={(lat, lng) => executeSearch({ lat, lng }, activeSearchQuery)}
          onCenterChange={(lat, lng) => setMapCenter({ lat, lng })}
          onMapCenterChange={(lat, lng) => setActualMapCenter({ lat, lng })}
          resetZoomSignal={resetZoomSignal}
          sheetHeight={sheetHeight}
          sheetDragging={sheetDragging}
        />
      </div>

      {/* 현재 위치로 이동 버튼 */}
      <Button
        variant="secondary"
        size="icon"
        className="absolute left-4 z-10 rounded-full shadow-lg bg-card hover:bg-muted"
        style={{ bottom: `calc(${sheetHeight}% + 8px)`, transition: sheetDragging ? "none" : "bottom 300ms ease-out" }}
        onClick={() => {
          if (!userLocation) {
            toast.info("현재 위치를 아직 가져오지 못했습니다.")
            return
          }
          const currentLocation = { ...userLocation }
          resetPinHighlight()
          setGuideFocusTarget(currentLocation)
          setResetZoomSignal((prev) => prev + 1)
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
          className="absolute left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-card rounded-full shadow-md border border-border hover:bg-muted transition-colors text-sm font-medium text-foreground"
          style={{ bottom: `calc(${sheetHeight}% + 8px)`, transition: sheetDragging ? "none" : "bottom 300ms ease-out" }}
        >
          이 지역 재검색
        </Button>
      )}

      {/* 위치 선택 모드 오버레이 */}
      {isLocationPickerMode && (
        <>
          <div className="absolute inset-0 z-20 pointer-events-none">
            <div className="absolute left-1/2 top-1/2 flex flex-col items-center" style={{ transform: "translate(-50%, calc(-100% - 200px))" }}>
              <div className="bg-primary rounded-full p-2.5 shadow-xl border-2 border-white">
                <MapPin className="w-7 h-7 text-primary-foreground fill-primary-foreground" />
              </div>
              <div className="w-0.5 h-5 bg-primary" />
              <div className="w-4 h-1.5 bg-black/25 rounded-full blur-[2px]" />
            </div>
          </div>

          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="bg-background/90 backdrop-blur-sm border border-border rounded-full px-4 py-2 shadow-lg">
              <p className="text-sm font-medium text-foreground whitespace-nowrap">
                지도를 움직여 위치를 선택하세요
              </p>
            </div>
          </div>

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
              <Button variant="outline" onClick={handleLocationCancel} className="flex-1 gap-2">
                <X className="w-4 h-4" />
                취소
              </Button>
              <Button onClick={handleLocationConfirm} className="flex-1 gap-2" disabled={!(actualMapCenter ?? mapCenter)}>
                <Check className="w-4 h-4" />
                이 위치로 선택
              </Button>
            </div>
          </div>
        </>
      )}

      {/* 신규 장소 등록 버튼 */}
      {!isLocationPickerMode && (
        <Button
          className="absolute right-4 z-10 rounded-full shadow-lg gap-2"
          style={{ bottom: `calc(${sheetHeight}% + 8px)`, transition: sheetDragging ? "none" : "bottom 300ms ease-out" }}
          onClick={() => handleAddNewPlace(() => toast.error("신규 장소 등록은 로그인이 필요합니다"))}
          title="신규 장소 등록"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">신규 등록</span>
        </Button>
      )}

      {/* 하단 장소 목록 시트 */}
      <BottomSheet onStateChange={(h, dragging) => { setSheetHeight(h); setSheetDragging(dragging) }}>
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">주변 대기 정보</h2>
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
              <span className="text-sm text-muted-foreground">{places.length}개 장소</span>
            </div>
          </div>

          {(() => {
            const HIGHLIGHT_MS = 24 * 60 * 60 * 1000
            const now = Date.now()
            const newCustom = showCustomPlaces
              ? customPlaces.filter((p) => p.registeredAt && now - new Date(p.registeredAt).getTime() < HIGHLIGHT_MS)
              : []
            const oldCustom = customPlaces.filter(
              (p) => !showCustomPlaces || !p.registeredAt || now - new Date(p.registeredAt).getTime() >= HIGHLIGHT_MS
            )
            const distNum = (d: string) => parseInt(d.replace("m", "")) || Number.MAX_SAFE_INTEGER
            const allPlaces = [...places, ...oldCustom].sort((a, b) => distNum(a.distance) - distNum(b.distance))

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
                        onHistory={(p) => { setHistoryPlace(p); setIsHistoryModalOpen(true) }}
                        onReport={() => user ? setReportingPlace(place) : toast.error("신고하려면 로그인이 필요합니다")}
                        onDelete={isDeveloperMode || isAdmin ? (p) => confirmAndDelete(p) : undefined}
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
                      onHistory={(p) => { setHistoryPlace(p); setIsHistoryModalOpen(true) }}
                      onReport={place.id.startsWith("custom_") ? () => user ? setReportingPlace(place) : toast.error("신고하려면 로그인이 필요합니다") : undefined}
                      onDelete={
                        (isDeveloperMode || isAdmin) && place.id.startsWith("custom_")
                          ? (p) => confirmAndDelete(p)
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
        onClose={() => { setIsInputModalOpen(false); setEditingPlace(null) }}
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
        onSubmit={async (data) => {
          if (!session) return
          const result = await handleNewPlaceSubmit(data)
          if (result?.error) {
            toast.error(result.error)
          } else {
            toast.success("장소가 등록됐어요! 포인트는 검토 후 지급됩니다 🎉")
          }
        }}
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
        onClose={() => { setIsHistoryModalOpen(false); setHistoryPlace(null) }}
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

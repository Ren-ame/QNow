"use client"

import { useEffect, useRef, useState } from "react"
import type { Place } from "./place-card"

declare global {
  interface Window {
    kakao: typeof kakao
  }
}

declare namespace kakao.maps {
  class Map {
    constructor(container: HTMLElement, options: MapOptions)
    setCenter(latlng: LatLng): void
    setLevel(level: number): void
    panBy(x: number, y: number): void
    getLevel(): number
    getCenter(): LatLng
    getProjection(): MapProjection
  }

  class Point {
    constructor(x: number, y: number)
    getX(): number
    getY(): number
  }

  interface MapProjection {
    coordsFromContainerPoint(point: Point): LatLng
  }

  class LatLng {
    constructor(lat: number, lng: number)
    getLat(): number
    getLng(): number
  }

  class Marker {
    constructor(options: MarkerOptions)
    setMap(map: Map | null): void
    getPosition(): LatLng
  }

  class CustomOverlay {
    constructor(options: CustomOverlayOptions)
    setMap(map: Map | null): void
    setPosition(position: LatLng): void
  }

  interface MapOptions {
    center: LatLng
    level: number
  }

  interface MarkerOptions {
    position: LatLng
    map?: Map
  }

  interface CustomOverlayOptions {
    position: LatLng
    content: string | HTMLElement
    map?: Map
    yAnchor?: number
    xAnchor?: number
    zIndex?: number
  }

  namespace event {
    function addListener(target: object, type: string, callback: () => void): void
    function removeListener(target: object, type: string, callback: () => void): void
    function preventMap(): void
  }

  function load(callback: () => void): void
}

interface MapViewProps {
  places: Place[]
  selectedPlace?: Place | null
  onMarkerClick?: (place: Place) => void
  onMapBackgroundClick?: () => void
  center?: { lat: number; lng: number }
  focusTargetAtGuide?: { lat: number; lng: number } | null
  onSearchArea?: (lat: number, lng: number) => void
  onCenterChange?: (lat: number, lng: number) => void
  onMapCenterChange?: (lat: number, lng: number) => void
}

const crowdColorMap = {
  low: "#10b981",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
}

const crowdTextMap = {
  low: "여유",
  medium: "보통",
  high: "혼잡",
  critical: "매우혼잡",
}

const centerGuideOffsetY = 200

export function MapView({ places, selectedPlace, onMarkerClick, onMapBackgroundClick, center, focusTargetAtGuide, onSearchArea, onCenterChange, onMapCenterChange  }: MapViewProps) {
  const isDeveloperMode = process.env.NODE_ENV !== "production"
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<kakao.maps.Map | null>(null)
  const overlaysRef = useRef<kakao.maps.CustomOverlay[]>([])
  const centerGuideRef = useRef<HTMLButtonElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [mapError, setMapError] = useState<string | null>(null)
  const [isCenterGuideActive, setIsCenterGuideActive] = useState(false)
  const centerGuideDragRef = useRef<{ x: number; y: number } | null>(null)

  const getGuidedCenter = () => {
    const map = mapInstanceRef.current
    const mapElement = mapRef.current

    if (!map || !mapElement) return null

    const rect = mapElement.getBoundingClientRect()
    const guidePoint = new window.kakao.maps.Point(rect.width / 2, rect.height / 2 - centerGuideOffsetY)

    return map.getProjection().coordsFromContainerPoint(guidePoint)
  }

  const emitGuidedCenter = () => {
    const guidedCenter = getGuidedCenter()

    if (guidedCenter) {
      onCenterChange?.(guidedCenter.getLat(), guidedCenter.getLng())
    }
  }

  const emitActualCenter = () => {
    const map = mapInstanceRef.current

    if (!map) return

    const actualCenter = map.getCenter()
    onMapCenterChange?.(actualCenter.getLat(), actualCenter.getLng())
  }

  const emitCenters = () => {
    emitActualCenter()
    emitGuidedCenter()
  }

  // 카카오맵 SDK 로드
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY

    console.log("[v0] API Key exists:", !!apiKey)
    console.log("[v0] API Key length:", apiKey?.length)
    console.log("[v0] Current domain:", window.location.hostname)

    if (!apiKey) {
      setMapError("카카오맵 API 키가 설정되지 않았습니다.")
      return
    }

    // 이미 로드되어 있는지 확인
    if (window.kakao && window.kakao.maps) {
      console.log("[v0] Kakao SDK already loaded")
      window.kakao.maps.load(() => {
        setIsLoaded(true)
      })
      return
    }

    // 기존 스크립트가 있는지 확인
    const existingScript = document.querySelector('script[src*="dapi.kakao.com"]')
    if (existingScript) {
      console.log("[v0] Kakao script already exists in DOM, waiting...")
      const checkKakao = setInterval(() => {
        if (window.kakao && window.kakao.maps) {
          clearInterval(checkKakao)
          window.kakao.maps.load(() => {
            setIsLoaded(true)
          })
        }
      }, 100)
      return () => clearInterval(checkKakao)
    }

    const script = document.createElement("script")
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false`
    script.async = true

    script.onload = () => {
      console.log("[v0] Kakao SDK script loaded successfully")
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => {
          console.log("[v0] Kakao Maps initialized")
          setIsLoaded(true)
        })
      } else {
        console.log("[v0] Kakao object not found after script load")
        setMapError("카카오맵 초기화에 실패했습니다.")
      }
    }

    script.onerror = () => {
      console.log("[v0] Kakao SDK load error - Check API key and domain registration")
      console.log("[v0] Make sure this domain is registered in Kakao Developers Console:")
      console.log("[v0] Domain:", window.location.origin)
      setMapError(`카카오맵 SDK를 불러오는데 실패했습니다.\n\n도메인 등록을 확인해주세요:\n${window.location.origin}`)
    }

    document.head.appendChild(script)

    return () => {
      // Cleanup if needed
    }
  }, [])
  

  // 지도 초기화
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstanceRef.current) return

    const options: kakao.maps.MapOptions = {
      center: new window.kakao.maps.LatLng(37.4979, 127.0276), // 강역 좌표
      level: 4,
    }

    mapInstanceRef.current = new window.kakao.maps.Map(mapRef.current, options)
    kakao.maps.event.addListener(mapInstanceRef.current, "dragend", () => {
      emitCenters()
    })
    kakao.maps.event.addListener(mapInstanceRef.current, "idle", emitCenters)
    emitCenters()
  }, [isLoaded, onCenterChange, onMapCenterChange, onMapBackgroundClick])

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!isLoaded || !map || !onMapBackgroundClick) return

    const handleMapClick = () => {
      onMapBackgroundClick()
    }

    kakao.maps.event.addListener(map, "click", handleMapClick)

    return () => {
      kakao.maps.event.removeListener(map, "click", handleMapClick)
    }
  }, [isLoaded, onMapBackgroundClick])

  // 마커 및 오버레이 생성
  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current) return

    const map = mapInstanceRef.current

    // 기존 오버레이 제거
    overlaysRef.current.forEach((overlay) => overlay.setMap(null))
    overlaysRef.current = []

    // 각 장소에 대한 커스텀 오버레이 생성
    places.forEach((place, index) => {
      const lat = place.lat ?? 37.4979
      const lng = place.lng ?? 127.0276

      const position = new window.kakao.maps.LatLng(lat, lng)
      const color = crowdColorMap[place.crowdLevel]
      const isSelected = selectedPlace?.id === place.id

      // 마커 콘텐츠 생성
      const content = document.createElement("div")
      content.className = "kakao-marker-wrapper"
      content.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          transform: ${isSelected ? "scale(1.2)" : "scale(1)"};
          transition: transform 0.2s ease;
        ">
          <div style="
            width: ${isSelected ? "48px" : "40px"};
            height: ${isSelected ? "48px" : "40px"};
            background-color: ${color};
            border: 3px solid white;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
            font-size: ${isSelected ? "14px" : "12px"};
            font-weight: 700;
            color: white;
          ">
            ${place.waitingPeople > 99 ? "99+" : place.waitingPeople}
          </div>
          ${isSelected ? `
            <div style="
              margin-top: 8px;
              background: white;
              padding: 8px 12px;
              border-radius: 8px;
              box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
              white-space: nowrap;
            ">
              <div style="font-size: 13px; font-weight: 600; color: #1f2937;">${place.name}</div>
              <div style="font-size: 11px; color: ${color}; margin-top: 2px;">
                대기 ${place.waitTime}분 · ${place.waitingPeople}명 · ${crowdTextMap[place.crowdLevel]}
              </div>
            </div>
          ` : ""}
        </div>
      `

      content.addEventListener("click", (event) => {
        event.stopPropagation()
        window.kakao.maps.event.preventMap()
        onMarkerClick?.(place)
      })

      const overlay = new window.kakao.maps.CustomOverlay({
        position,
        content,
        yAnchor: 1,
        zIndex: isSelected ? 100 : 10,
      })

      overlay.setMap(map)
      overlaysRef.current.push(overlay)
    })
  }, [isLoaded, places, selectedPlace, onMarkerClick])

  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current || !center) return

    mapInstanceRef.current.setCenter(
      new window.kakao.maps.LatLng(center.lat, center.lng)
    )
    emitCenters()
  }, [center, isLoaded])

  useEffect(() => {
    if (!isLoaded || !mapInstanceRef.current || !mapRef.current || !focusTargetAtGuide) return

    const map = mapInstanceRef.current
    const mapElement = mapRef.current
    const rect = mapElement.getBoundingClientRect()

    // 목표 좌표를 먼저 중앙에 둔 뒤, 중앙 아래 offset 좌표를 새 중심으로 잡아
    // 최종적으로 목표 좌표가 십자선(중앙 - offsetY)에 오도록 맞춘다.
    map.setCenter(new window.kakao.maps.LatLng(focusTargetAtGuide.lat, focusTargetAtGuide.lng))

    const adjustedCenter = map
      .getProjection()
      .coordsFromContainerPoint(new window.kakao.maps.Point(rect.width / 2, rect.height / 2 + centerGuideOffsetY))

    map.setCenter(adjustedCenter)
    emitCenters()
  }, [focusTargetAtGuide, isLoaded])

  // 줌 컨트롤
  const handleZoomIn = () => {
    if (mapInstanceRef.current) {
      const level = mapInstanceRef.current.getLevel()
      mapInstanceRef.current.setLevel(level - 1)
    }
  }

  const handleZoomOut = () => {
    if (mapInstanceRef.current) {
      const level = mapInstanceRef.current.getLevel()
      mapInstanceRef.current.setLevel(level + 1)
    }
  }

  const handleCenterGuidePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!mapInstanceRef.current) return

    event.preventDefault()
    centerGuideDragRef.current = { x: event.clientX, y: event.clientY }
    setIsCenterGuideActive(true)
    centerGuideRef.current?.setPointerCapture(event.pointerId)
  }

  const handleCenterGuidePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!mapInstanceRef.current || !centerGuideDragRef.current || !isCenterGuideActive) return

    const deltaX = event.clientX - centerGuideDragRef.current.x
    const deltaY = event.clientY - centerGuideDragRef.current.y

    if (deltaX === 0 && deltaY === 0) return

    mapInstanceRef.current.panBy(-deltaX, -deltaY)
    centerGuideDragRef.current = { x: event.clientX, y: event.clientY }
  }

  const handleCenterGuidePointerUp = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!isCenterGuideActive) return

    centerGuideDragRef.current = null
    setIsCenterGuideActive(false)
    centerGuideRef.current?.releasePointerCapture(event.pointerId)
  }

  // 현재 위치로 이동
  const handleCurrentLocation = () => {
    if (navigator.geolocation && mapInstanceRef.current) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude
          const lng = position.coords.longitude
          const moveLatLng = new window.kakao.maps.LatLng(lat, lng)
          mapInstanceRef.current?.setCenter(moveLatLng)
        },
        () => {
          alert("현재 위치를 가져올 수 없습니다.")
        }
      )
    }
  }

  if (mapError) {
    return (
      <div className="relative w-full h-full bg-muted flex items-center justify-center">
        <div className="text-center p-4">
          <p className="text-destructive font-medium mb-2">{mapError}</p>
          <p className="text-sm text-muted-foreground">
            환경 변수 NEXT_PUBLIC_KAKAO_MAP_API_KEY를 확인해주세요.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      {/* 로딩 상태 */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">지도를 불러오는 중...</p>
          </div>
        </div>
      )}

      {/* 카카오맵 컨테이너 */}
      <div ref={mapRef} className="w-full h-full" />

      {/* 중앙 가이드 점 */}
      {isDeveloperMode && (
        <button
          ref={centerGuideRef}
          type="button"
          aria-label="중심점 가이드"
          title="중심점 가이드"
          onPointerDown={handleCenterGuidePointerDown}
          onPointerMove={handleCenterGuidePointerMove}
          onPointerUp={handleCenterGuidePointerUp}
          onPointerCancel={handleCenterGuidePointerUp}
          className="absolute left-1/2 top-1/2 z-20 h-10 w-10 cursor-grab touch-none select-none transition-transform hover:scale-110 active:cursor-grabbing"
          style={{ transform: `translate(-50%, calc(-50% - ${centerGuideOffsetY}px))` }}
        >
          <span className="absolute left-1/2 top-1/2 h-px w-8 -translate-x-1/2 -translate-y-1/2 bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.95)]" />
          <span className="absolute left-1/2 top-1/2 h-8 w-px -translate-x-1/2 -translate-y-1/2 bg-sky-500 shadow-[0_0_10px_rgba(14,165,233,0.95)]" />
          <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-sky-500 shadow-[0_0_14px_rgba(14,165,233,1)]" />
          <span className="absolute inset-0 rounded-full border border-sky-300/70 bg-sky-500/5 shadow-[0_0_0_10px_rgba(14,165,233,0.08)]" />
        </button>
      )}

      {/* 이 지역 재검색 버튼 */}
      {/* {onSearchArea && (
        <button
          onClick={() => {
            if (mapInstanceRef.current) {
              const center = mapInstanceRef.current.getCenter()
              onSearchArea(center.getLat(), center.getLng())
            }
          }}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-card rounded-full shadow-md border border-border hover:bg-muted transition-colors text-sm font-medium text-foreground"
        >
          이 지역 재검색
        </button>
      )} */}

      {/* 지도 컨트롤 버튼 */}
      <div className="absolute right-4 bottom-4 flex flex-col gap-2">
        
        {/* 확대/축소 버튼 */}
        <div className="flex flex-col bg-card rounded-lg shadow-md border border-border overflow-hidden">
          <button
            onClick={handleZoomIn}
            className="p-2.5 hover:bg-muted transition-colors"
            title="확대"
          >
            <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12M6 12h12" />
            </svg>
          </button>
          <div className="h-px bg-border" />
          <button
            onClick={handleZoomOut}
            className="p-2.5 hover:bg-muted transition-colors"
            title="축소"
          >
            <svg className="w-5 h-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* 범례 */}
      <div className="absolute left-4 bottom-4 bg-card/95 backdrop-blur-sm rounded-lg shadow-md border border-border p-3">
        <p className="text-xs font-medium text-foreground mb-2">혼잡도</p>
        <div className="flex flex-col gap-1.5">
          {Object.entries(crowdColorMap).map(([level, color]) => (
            <div key={level} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-muted-foreground">
                {crowdTextMap[level as keyof typeof crowdTextMap]}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase"
import { formatLastUpdated } from "@/lib/utils"

const supabase = createServerClient()

const KAKAO_LOCAL_BASE_URL = "https://dapi.kakao.com/v2/local"

interface KakaoPlaceDoc {
  id: string
  place_name: string
  category_name: string
  category_group_code: string
  road_address_name: string
  address_name: string
  distance: string
  x: string
  y: string
}

const mapToPlace = (doc: KakaoPlaceDoc) => ({
  id: doc.id,
  name: doc.place_name,
  category: doc.category_name.split(">").pop()?.trim() || doc.category_name,
  address: doc.road_address_name || doc.address_name,
  distance: doc.distance ? `${doc.distance}m` : "",
  lat: parseFloat(doc.y),
  lng: parseFloat(doc.x),
  waitTime: 0,
  waitingPeople: 0,
  crowdLevel: "low" as const,
  lastUpdated: "정보 없음",
  isFavorite: false,
})

const uniqueById = (docs: KakaoPlaceDoc[]) => {
  const seen = new Set<string>()
  return docs.filter((doc) => {
    if (seen.has(doc.id)) return false
    seen.add(doc.id)
    return true
  })
}

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, "")

const isSubwayDoc = (doc: KakaoPlaceDoc) => {
  const categoryGroup = String(doc.category_group_code ?? "")
  const categoryName = String(doc.category_name ?? "")
  const placeName = String(doc.place_name ?? "")
  return categoryGroup === "SW8" || /지하철|전철/.test(categoryName) || /역$/.test(placeName)
}

const rankDocuments = (docs: KakaoPlaceDoc[], query: string) => {
  const normalizedQuery = normalize(query)
  const isStationIntent = /역|지하철|subway/i.test(query)

  return [...docs].sort((a, b) => {
    const aName = normalize(String(a.place_name ?? ""))
    const bName = normalize(String(b.place_name ?? ""))
    const aCategory = normalize(String(a.category_name ?? ""))
    const bCategory = normalize(String(b.category_name ?? ""))

    const score = (name: string, category: string, doc: KakaoPlaceDoc) => {
      let total = 0
      const subway = isSubwayDoc(doc)

      if (name === normalizedQuery) total += 250
      if (name.startsWith(normalizedQuery)) total += 150
      if (name.includes(normalizedQuery)) total += 90
      if (category.includes(normalizedQuery)) total += 40

      // 지하철 검색 의도이거나 역명 일부 검색 시 지하철역을 우선 노출
      if (subway) {
        total += isStationIntent ? 220 : 80
      }

      // "강남" 같은 입력에서도 "강남역"이 앞에 오도록 보정
      if (subway && name.endsWith("역") && name.includes(normalizedQuery)) {
        total += 120
      }

      return total
    }

    const aScore = score(aName, aCategory, a)
    const bScore = score(bName, bCategory, b)

    if (aScore !== bScore) return bScore - aScore

    const aDistance = Number(a.distance || Number.MAX_SAFE_INTEGER)
    const bDistance = Number(b.distance || Number.MAX_SAFE_INTEGER)
    return aDistance - bDistance
  })
}

/* 2026-05-26: Supabase 대기 정보 병합 함수 분리 - 단일 호출로 재사용 */
const enrichWithWaitTimes = async (places: ReturnType<typeof mapToPlace>[]) => {
  if (places.length === 0) return places
  const placeIds = places.map((p) => p.id)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  const { data: waitTimes } = await supabase
    .from("wait_times")
    .select("*")
    .in("place_id", placeIds)
    .gte("created_at", twoHoursAgo)
    .order("created_at", { ascending: false })

  return places.map((place) => {
    const latest = waitTimes?.find((w) => w.place_id === place.id)
    if (!latest) return place
    return {
      ...place,
      waitTime: latest.wait_time,
      waitingPeople: latest.waiting_people,
      crowdLevel: latest.crowd_level,
      lastUpdated: formatLastUpdated(latest.created_at),
    }
  })
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get("lat")
  const lng = searchParams.get("lng")
  const query = searchParams.get("query") || "맛집"
  const categoryGroupCode = searchParams.get("categoryGroupCode")
  const authHeader = {
    Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
  }

  const requestWithAuth = async (url: string): Promise<{ documents: KakaoPlaceDoc[] }> => {
    const res = await fetch(url, { headers: authHeader })
    return res.json()
  }

  /* 2026-05-26: 다중 쿼리 서버 병렬 처리 추가
   * 기존: 클라이언트에서 쿼리 N개 × 개별 fetch → 서버 왕복 N번 + Supabase N번
   * 변경: queries 파라미터로 한 번에 전달 → 서버에서 Kakao N개 병렬 + Supabase 1번
   * skipEnrich=true 시 Kakao 결과만 즉시 반환 (2단계 로딩 Phase 1용) */
  const queriesParam = searchParams.get("queries")
  const skipEnrich = searchParams.get("skipEnrich") === "true"
  const radius = Math.min(Math.max(parseInt(searchParams.get("radius") ?? "5000"), 500), 20000)

  // 카카오 로컬 API 제약사항:
  //   - radius: 최대 20,000m (20km)
  //   - size: keyword/category 모두 최대 15 (초과 시 API 오류로 빈 결과 반환)
  //   → radius는 자유롭게 변경 가능하지만, 쿼리당 결과는 최대 15개로 고정
  const keywordSize = 15
  const categorySize = 15

  if (queriesParam && lat && lng) {
    const queries = queriesParam.split(",").filter(Boolean)

    const allDocsArrays = await Promise.all(
      queries.map((q) => {
        const url = `${KAKAO_LOCAL_BASE_URL}/search/keyword.json?query=${encodeURIComponent(q)}&x=${lng}&y=${lat}&radius=${radius}&size=${keywordSize}`
        return requestWithAuth(url).then((data) => data.documents ?? [])
      })
    )

    // 다중 카테고리 검색은 관련도 랭킹 대신 거리순 정렬
    const merged = uniqueById(allDocsArrays.flat()).sort((a, b) =>
      Number(a.distance || Number.MAX_SAFE_INTEGER) - Number(b.distance || Number.MAX_SAFE_INTEGER)
    )
    const places = merged.map(mapToPlace)
    if (skipEnrich) return NextResponse.json(places)
    const enriched = await enrichWithWaitTimes(places)
    return NextResponse.json(enriched)
  }

  // 카테고리 그룹 코드가 전달되면 키워드가 아닌 카테고리 전용 조회를 수행한다.
  if (categoryGroupCode && lat && lng) {
    const categoryUrl = `${KAKAO_LOCAL_BASE_URL}/search/category.json?category_group_code=${encodeURIComponent(categoryGroupCode)}&x=${lng}&y=${lat}&radius=${radius}&size=${categorySize}`
    const categoryData = await requestWithAuth(categoryUrl)
    const categoryDocs: KakaoPlaceDoc[] = categoryData.documents ?? []

    const rankedCategoryDocs = rankDocuments(uniqueById(categoryDocs), query)
    const places = rankedCategoryDocs.map(mapToPlace)
    const enriched = await enrichWithWaitTimes(places)
    return NextResponse.json(enriched)
  }

  const isSubwayQuery = /역|지하철|subway/i.test(query)

  // 1) 기본: 현재 지도 기준 반경 검색
  const nearbyKeywordUrl = `${KAKAO_LOCAL_BASE_URL}/search/keyword.json?query=${encodeURIComponent(query)}&x=${lng}&y=${lat}&radius=${radius}&size=${keywordSize}`
  const nearbyKeywordData = await requestWithAuth(nearbyKeywordUrl)

  let docs: KakaoPlaceDoc[] = nearbyKeywordData.documents ?? []

  // 2) 결과가 없으면 위치 제약 없이 전체 키워드 검색으로 보강
  if (docs.length === 0) {
    const globalKeywordUrl = `${KAKAO_LOCAL_BASE_URL}/search/keyword.json?query=${encodeURIComponent(query)}&size=15`
    const globalKeywordData = await requestWithAuth(globalKeywordUrl)
    docs = globalKeywordData.documents ?? []
  }

  // 3) 지하철 키워드면 지하철 카테고리(SW8)도 합쳐서 보강
  if (isSubwayQuery && lat && lng) {
    const subwayCategoryUrl = `${KAKAO_LOCAL_BASE_URL}/search/category.json?category_group_code=SW8&x=${lng}&y=${lat}&radius=20000&size=15`
    const subwayCategoryData = await requestWithAuth(subwayCategoryUrl)
    const subwayDocs = (subwayCategoryData.documents ?? []).filter((doc: KakaoPlaceDoc) =>
      doc.place_name?.toLowerCase().includes(query.toLowerCase().replace(/\s+/g, "")) ||
      query.length <= 2
    )
    docs = [...docs, ...subwayDocs]
  }

  const rankedDocs = rankDocuments(uniqueById(docs), query)
  const places = rankedDocs.map(mapToPlace)
  const enriched = await enrichWithWaitTimes(places)
  return NextResponse.json(enriched)
}

import { type NextRequest, NextResponse } from "next/server"

const KAKAO_LOCAL_BASE_URL = "https://dapi.kakao.com/v2/local"

const mapToPlace = (doc: any) => ({
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

const uniqueById = (docs: any[]) => {
  const seen = new Set<string>()
  return docs.filter((doc) => {
    if (seen.has(doc.id)) return false
    seen.add(doc.id)
    return true
  })
}

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, "")

const isSubwayDoc = (doc: any) => {
  const categoryGroup = String(doc.category_group_code ?? "")
  const categoryName = String(doc.category_name ?? "")
  const placeName = String(doc.place_name ?? "")
  return categoryGroup === "SW8" || /지하철|전철/.test(categoryName) || /역$/.test(placeName)
}

const rankDocuments = (docs: any[], query: string) => {
  const normalizedQuery = normalize(query)
  const isStationIntent = /역|지하철|subway/i.test(query)

  return [...docs].sort((a, b) => {
    const aName = normalize(String(a.place_name ?? ""))
    const bName = normalize(String(b.place_name ?? ""))
    const aCategory = normalize(String(a.category_name ?? ""))
    const bCategory = normalize(String(b.category_name ?? ""))

    const score = (name: string, category: string, doc: any) => {
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

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get("lat")
  const lng = searchParams.get("lng")
  const query = searchParams.get("query") || "맛집"
  const categoryGroupCode = searchParams.get("categoryGroupCode")
  const authHeader = {
    Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
  }

  const requestWithAuth = async (url: string) => {
    const res = await fetch(url, { headers: authHeader })
    return res.json()
  }

  // 카테고리 그룹 코드가 전달되면 키워드가 아닌 카테고리 전용 조회를 수행한다.
  if (categoryGroupCode && lat && lng) {
    const categoryUrl = `${KAKAO_LOCAL_BASE_URL}/search/category.json?category_group_code=${encodeURIComponent(categoryGroupCode)}&x=${lng}&y=${lat}&radius=5000&size=15`
    const categoryData = await requestWithAuth(categoryUrl)
    const categoryDocs: any[] = categoryData.documents ?? []

    const rankedCategoryDocs = rankDocuments(uniqueById(categoryDocs), query)
    return NextResponse.json(rankedCategoryDocs.map(mapToPlace))
  }

  const isSubwayQuery = /역|지하철|subway/i.test(query)

  // 1) 기본: 현재 지도 기준 반경 검색
  const nearbyKeywordUrl = `${KAKAO_LOCAL_BASE_URL}/search/keyword.json?query=${encodeURIComponent(query)}&x=${lng}&y=${lat}&radius=5000&size=15`
  const nearbyKeywordData = await requestWithAuth(nearbyKeywordUrl)

  let docs: any[] = nearbyKeywordData.documents ?? []

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
    const subwayDocs = (subwayCategoryData.documents ?? []).filter((doc: any) =>
      doc.place_name?.toLowerCase().includes(query.toLowerCase().replace(/\s+/g, "")) ||
      query.length <= 2
    )
    docs = [...docs, ...subwayDocs]
  }

  const rankedDocs = rankDocuments(uniqueById(docs), query)
  const places = rankedDocs.map(mapToPlace)

  return NextResponse.json(places)
}
import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get("lat")
  const lng = searchParams.get("lng")
  const query = searchParams.get("query") || "맛집"

  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&x=${lng}&y=${lat}&radius=1000&size=15`,
    {
      headers: {
        Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}`,
      },
    }
  )

  const data = await res.json()

  const places = data.documents.map((doc: any) => ({
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
  }))

  return NextResponse.json(places)
}
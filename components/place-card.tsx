"use client"

import { Clock, Users, MapPin, Star, ChevronRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export interface Place {
  id: string
  name: string
  category: string
  address: string
  lat?: number
  lng?: number
  distance: string
  waitTime: number
  waitingPeople: number
  crowdLevel: "low" | "medium" | "high" | "critical"
  lastUpdated: string
  isFavorite?: boolean
}

interface PlaceCardProps {
  place: Place
  onSelect?: (place: Place) => void
  onFavorite?: (place: Place) => void
}

const crowdLevelConfig = {
  low: { label: "여유", color: "bg-emerald-500", textColor: "text-emerald-600" },
  medium: { label: "보통", color: "bg-amber-400", textColor: "text-amber-600" },
  high: { label: "혼잡", color: "bg-orange-500", textColor: "text-orange-600" },
  critical: { label: "매우혼잡", color: "bg-red-500", textColor: "text-red-600" },
}

export function PlaceCard({ place, onSelect, onFavorite }: PlaceCardProps) {
  const crowdConfig = crowdLevelConfig[place.crowdLevel]

  return (
    <Card
      className="p-4 border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer bg-card"
      onClick={() => onSelect?.(place)}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm text-muted-foreground">{place.category}</span>
            <span className="text-xs text-muted-foreground">{place.lastUpdated}</span>
          </div>
          <h3 className="font-semibold text-foreground truncate text-lg">{place.name}</h3>
          <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate">{place.address}</span>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onFavorite?.(place)
          }}
          className="p-1 hover:bg-muted rounded-full transition-colors"
        >
          <Star
            className={cn(
              "w-5 h-5",
              place.isFavorite ? "fill-amber-400 text-amber-400" : "text-muted-foreground"
            )}
          />
        </button>
      </div>

      <div className="flex items-center gap-4 mt-4">
        <div className="flex items-center gap-2">
          <div className={cn("w-2 h-2 rounded-full", crowdConfig.color)} />
          <span className={cn("text-sm font-medium", crowdConfig.textColor)}>
            {crowdConfig.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-foreground">
          <Clock className="w-4 h-4 text-primary" />
          <span className="font-semibold">{place.waitTime}분</span>
        </div>
        <div className="flex items-center gap-1.5 text-foreground">
          <Users className="w-4 h-4 text-primary" />
          <span className="font-semibold">{place.waitingPeople}명</span>
        </div>
        <span className="ml-auto text-sm text-primary font-medium">{place.distance}</span>
      </div>
    </Card>
  )
}

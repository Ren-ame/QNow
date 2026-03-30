"use client"

import { MapPin, Clock, Users, ChevronDown, Check } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export interface FilterOption {
  id: string
  label: string
}

export interface FilterState {
  category: string | null
  waitTime: string | null
  crowd: string | null
}

interface FilterButtonsProps {
  filters: FilterState
  onFilterChange: (filterType: keyof FilterState, value: string | null) => void
}

const categoryOptions: FilterOption[] = [
  { id: "all", label: "전체" },
  { id: "cafe", label: "카페" },
  { id: "restaurant", label: "음식점" },
  { id: "fastfood", label: "패스트푸드" },
  { id: "beauty", label: "뷰티/화장품" },
  { id: "cinema", label: "영화관" },
  { id: "hospital", label: "병원/약국" },
  { id: "bank", label: "은행" },
  { id: "government", label: "공공기관" },
]

const waitTimeOptions: FilterOption[] = [
  { id: "asc", label: "대기시간 짧은 순" },
  { id: "desc", label: "대기시간 긴 순" },
  { id: "under10", label: "10분 이하" },
  { id: "under30", label: "30분 이하" },
  { id: "over30", label: "30분 이상" },
]

const crowdOptions: FilterOption[] = [
  { id: "low_first", label: "여유로운 순" },
  { id: "high_first", label: "혼잡한 순" },
  { id: "low", label: "여유만 보기" },
  { id: "medium", label: "보통만 보기" },
  { id: "high", label: "혼잡만 보기" },
]

const filterConfig = [
  { 
    id: "category" as const, 
    label: "업종", 
    icon: MapPin,
    options: categoryOptions,
    title: "업종 선택"
  },
  { 
    id: "waitTime" as const, 
    label: "대기시간", 
    icon: Clock,
    options: waitTimeOptions,
    title: "대기시간 정렬"
  },
  { 
    id: "crowd" as const, 
    label: "혼잡도", 
    icon: Users,
    options: crowdOptions,
    title: "혼잡도 필터"
  },
]

export function FilterButtons({ filters, onFilterChange }: FilterButtonsProps) {
  const getSelectedLabel = (filterId: keyof FilterState) => {
    const value = filters[filterId]
    if (!value) return null
    const config = filterConfig.find(f => f.id === filterId)
    const option = config?.options.find(o => o.id === value)
    return option?.label
  }

  return (
    <div className="flex flex-col gap-2 bg-card rounded-xl shadow-md border border-border p-2">
      {filterConfig.map((filter) => {
        const Icon = filter.icon
        const isActive = filters[filter.id] !== null
        const selectedLabel = getSelectedLabel(filter.id)

        return (
          <DropdownMenu key={filter.id}>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200 min-w-[60px]",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{filter.label}</span>
                {selectedLabel && (
                  <span className="text-[10px] truncate max-w-[56px] opacity-80">
                    {selectedLabel}
                  </span>
                )}
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align="end" 
              sideOffset={8}
              className="w-48"
            >
              <DropdownMenuLabel>{filter.title}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {filter.options.map((option) => {
                const isSelected = filters[filter.id] === option.id
                return (
                  <DropdownMenuItem
                    key={option.id}
                    onClick={() => {
                      if (option.id === "all" || isSelected) {
                        onFilterChange(filter.id, null)
                      } else {
                        onFilterChange(filter.id, option.id)
                      }
                    }}
                    className={cn(
                      "flex items-center justify-between cursor-pointer",
                      isSelected && "bg-primary/10 text-primary"
                    )}
                  >
                    <span>{option.label}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </DropdownMenuItem>
                )
              })}
              {filters[filter.id] && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onFilterChange(filter.id, null)}
                    className="text-muted-foreground"
                  >
                    필터 초기화
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      })}
    </div>
  )
}

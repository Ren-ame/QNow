"use client"

import { useState } from "react"
import { Search, Menu, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface SearchBarProps {
  onSearch?: (query: string) => void
  onMenuClick?: () => void
  className?: string
}

export function SearchBar({ onSearch, onMenuClick, className }: SearchBarProps) {
  const [query, setQuery] = useState("")
  const [isFocused, setIsFocused] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch?.(query)
  }

  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)}>
      <div
        className={cn(
          "flex items-center gap-2 bg-card rounded-xl px-4 py-2 shadow-md border transition-all duration-200",
          isFocused ? "border-primary ring-2 ring-primary/20" : "border-border"
        )}
      >
        <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        <Input
          type="text"
          placeholder="장소, 지하철역, 지역명 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-foreground placeholder:text-muted-foreground"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            className="p-1 hover:bg-muted rounded-full transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
        <div className="w-px h-6 bg-border" />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="flex-shrink-0"
          onClick={onMenuClick}
        >
          <Menu className="w-5 h-5 text-foreground" />
        </Button>
      </div>
    </form>
  )
}

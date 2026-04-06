"use client"

import { useEffect, useRef, useState } from "react"
import { Search, Menu, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export interface SearchSuggestion {
  id: string
  title: string
  subtitle?: string
  lat?: number
  lng?: number
}

interface SearchBarProps {
  onSearch?: (query: string) => void
  onDebouncedSearch?: (query: string) => void
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void
  suggestions?: SearchSuggestion[]
  debounceMs?: number
  onMenuClick?: () => void
  className?: string
}

export function SearchBar({
  onSearch,
  onDebouncedSearch,
  onSuggestionSelect,
  suggestions = [],
  debounceMs = 350,
  onMenuClick,
  className,
}: SearchBarProps) {
  const [query, setQuery] = useState("")
  const [isFocused, setIsFocused] = useState(false)
  const didMountRef = useRef(false)
  const debouncedSearchRef = useRef(onDebouncedSearch)

  useEffect(() => {
    debouncedSearchRef.current = onDebouncedSearch
  }, [onDebouncedSearch])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch?.(query.trim())
  }

  const handleClear = () => {
    setQuery("")
    onSearch?.("")
  }

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }

    if (!debouncedSearchRef.current) return

    const timer = window.setTimeout(() => {
      debouncedSearchRef.current?.(query.trim())
    }, debounceMs)

    return () => window.clearTimeout(timer)
  }, [query, debounceMs])

  const showSuggestions = isFocused && query.trim().length > 0 && suggestions.length > 0

  return (
    <form onSubmit={handleSubmit} className={cn("relative", className)}>
      <div
        className={cn(
          "flex items-center gap-2 bg-card rounded-xl px-4 py-2 shadow-md border transition-all duration-200",
          isFocused ? "border-primary ring-2 ring-primary/20" : "border-border"
        )}
      >
        <button
          type="submit"
          aria-label="검색"
          className="flex-shrink-0 rounded-full p-1 hover:bg-muted transition-colors"
        >
          <Search className="w-5 h-5 text-muted-foreground" />
        </button>
        <Input
          type="text"
          placeholder="장소, 지하철역, 지역명 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setIsFocused(false), 120)
          }}
          className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-foreground placeholder:text-muted-foreground"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
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

      {showSuggestions && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-30 overflow-hidden rounded-xl border border-border bg-card shadow-xl">
          <ul className="max-h-72 overflow-y-auto py-1">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setQuery(suggestion.title)
                    if (onSuggestionSelect) {
                      onSuggestionSelect(suggestion)
                    } else {
                      onSearch?.(suggestion.title)
                    }
                    setIsFocused(false)
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-muted transition-colors"
                >
                  <div className="text-sm font-medium text-foreground">{suggestion.title}</div>
                  {suggestion.subtitle && (
                    <div className="mt-0.5 text-xs text-muted-foreground">{suggestion.subtitle}</div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  )
}

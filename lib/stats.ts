/**
 * IQR(사분위 범위) 기반 이상치 제거 후 평균 계산
 * - 정렬 후 Q1 - 1.5×IQR ~ Q3 + 1.5×IQR 범위 밖 값 제거
 * - 필터 후 남은 값이 없으면 전체 평균으로 fallback
 */
export function iqrMean(values: number[]): number {
  if (values.length === 0) return 0
  if (values.length <= 2) {
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
  }

  const sorted = [...values].sort((a, b) => a - b)
  const q1 = sorted[Math.floor(sorted.length * 0.25)]
  const q3 = sorted[Math.floor(sorted.length * 0.75)]
  const iqr = q3 - q1
  const lower = q1 - 1.5 * iqr
  const upper = q3 + 1.5 * iqr

  const filtered = sorted.filter((v) => v >= lower && v <= upper)
  const base = filtered.length > 0 ? filtered : sorted
  return Math.round(base.reduce((a, b) => a + b, 0) / base.length)
}

/**
 * 최빈값 반환 (동점이면 처음 나온 값)
 */
export function mode<T>(values: T[]): T {
  if (values.length === 0) throw new Error("mode: empty array")
  const counts = new Map<T, number>()
  for (const v of values) {
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  let maxCount = 0
  let result = values[0]
  for (const [v, count] of counts) {
    if (count > maxCount) {
      maxCount = count
      result = v
    }
  }
  return result
}

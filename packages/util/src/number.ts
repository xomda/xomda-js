export const isNumberLike = (val: unknown): val is number | string => {
  if (typeof val === 'number') return true
  if (typeof val !== 'string') return false
  return !isNaN(Number(val)) && !isNaN(parseFloat(val))
}

export const unPx = (val: string | number | undefined): number => {
  if (typeof val === 'number') return val
  if (!val) return 0
  return parseFloat(val)
}

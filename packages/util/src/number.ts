export const isNumberLike = (val: unknown): val is number | string => {
  if (typeof val === 'number') return true
  if (typeof val !== 'string') return false
  return !isNaN(Number(val)) && !isNaN(parseFloat(val))
}

import type { Coordinates, Filters, Restaurant } from '@/data/types'

// Computes straight-line distance from GCJ-02 positions used by the demo and AMap.
export function distanceKm(a: Coordinates, b: Coordinates) {
  const rad = Math.PI / 180
  const dLat = (b[1] - a[1]) * rad
  const dLng = (b[0] - a[0]) * rad
  return 6371 * 2 * Math.asin(Math.sqrt(Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLng / 2) ** 2))
}

// Apply explicit limits while keeping the restaurant order stable.
export function matchesFilters(r: Restaurant, f: Filters) {
  if ((f.maxBudget || f.minBudget) && r.price === null) return false
  if (f.maxBudget && r.price! > f.maxBudget) return false
  if (f.minBudget && r.price! < f.minBudget) return false
  if (f.radius && distanceKm(f.center, r.coordinates) > f.radius) return false
  if (f.cuisines.length && !f.cuisines.includes(r.cuisine)) return false
  if (f.noSpice && r.spice !== 0) return false
  if (f.allergy && (!r.allergens || r.allergens.includes(f.allergy))) return false
  return true
}

// Extracts explicit requirements locally until a real agent service is connected.
export function parseRequirements(text: string, previous: Filters): Filters {
  const f = { ...previous, cuisines: [...previous.cuisines], center: [...previous.center] as Coordinates }
  const budget = text.match(/(?:人均|预算|不超过|不能超过|最多|以内|不到)\s*[¥￥]?\s*(\d+)/) || text.match(/(\d+)\s*(?:元|块|以内)/)
  if (budget) f.maxBudget = Number(budget[1])
  const distance = text.match(/(\d+(?:\.\d+)?)\s*(?:公里|km)/i)
  if (distance) f.radius = Number(distance[1])
  const people = text.match(/(\d+)\s*(?:个人|人|位)/)
  if (people) f.people = Math.min(20, Math.max(1, Number(people[1])))
  if (/两个人|两人|约会/.test(text)) f.people = 2
  if (/一个人|独自/.test(text)) { f.people = 1; f.scene = '一个人吃' }
  if (/约会|浪漫|氛围/.test(text)) f.scene = '约会'
  if (/朋友|聚餐/.test(text)) f.scene = '朋友聚餐'
  if (/家人|家庭|父母/.test(text)) f.scene = '家庭聚会'
  if (/商务|客户/.test(text)) f.scene = '商务用餐'
  if (/安静/.test(text)) f.quiet = true
  if (/少辣|不太辣|清淡|不想吃太辣/.test(text)) f.mild = true
  if (/不能吃辣|不吃辣|不要辣/.test(text)) { f.noSpice = true; f.mild = true }
  if (/花生过敏/.test(text)) f.allergy = '花生'
  if (/虾过敏|海鲜过敏/.test(text)) f.allergy = '虾'
  return f
}

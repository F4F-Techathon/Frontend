// A balanced cast keeps its places throughout the discussion; only the light changes hands.
export function stageSlots(count: number) {
  const spread = count <= 2 ? .58 : count === 3 ? .92 : 1.04
  const scale = count <= 2 ? .96 : count === 3 ? .86 : count === 4 ? .74 : .63
  return Array.from({ length: count }, (_, index) => ({
    offset: count === 1 ? 0 : (index / (count - 1) * 2 - 1) * spread,
    scale,
  }))
}

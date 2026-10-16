import type { DebateMessage, Filters, Restaurant } from './types'

// Builds a bounded, source-linked demo discussion for the actually selected restaurants.
export function createDebate(selected: Restaurant[], filters: Filters): DebateMessage[] {
  return [1, 2, 3].flatMap((round) => selected.map((r, i) => {
    const other = selected[(i + 1) % selected.length]!
    let text = ''
    if (round === 1) text = `${r.character === 'rong' ? '来我屋头坐坐嘛！' : r.character === 'hua' ? '食饭最紧要啱自己。' : 'Bonsoir，今晚值得认真对待。'}我是${r.host}，代表${r.name}。${r.price ? `人均约 ¥${r.price}，` : '价格还得再问问，'}招牌是${r.specialty}。`
    if (round === 2) text = `${other.name}有自己的风格，我也说说我们的不同：${r.quiet === true ? '想坐下来慢慢聊天，我们这一桌会更合适。' : r.quiet === false ? '我们更适合喜欢热闹、一起分享的朋友。' : '安静程度还需要向店里确认。'}${filters.mild ? (r.spice === 0 ? '你刚提到想吃清淡些，这一点我们比较合适。' : '你想少辣，我会建议先向店里确认做法。') : r.intro}`
    if (round === 3) text = `最后替你划个重点：${filters.scene && r.scenes.includes(filters.scene) ? `如果是${filters.scene}，我们值得考虑。` : '适不适合，还是要看你今晚的心情。'}${r.caveat}选餐之前，把这些也一起放进考虑里。`
    return { id: `${r.id}-${round}`, restaurantId: r.id, speaker: r.host, text, round, topic: round === 1 ? '选手自我介绍' : round === 2 ? '聊聊你的在意' : '最后的真心话', evidenceIds: round === 1 ? [r.evidenceIds[0]!] : round === 2 ? [r.evidenceIds[1]!, r.evidenceIds[0]!] : [r.evidenceIds[2]!], state: round === 2 && i === 1 ? 'disagree' : 'speaking' }
  }))
}

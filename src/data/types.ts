export type CharacterId = 'rong' | 'hua' | 'pierre'
export type CharacterState = 'idle' | 'speaking' | 'listening' | 'thinking' | 'happy' | 'surprised' | 'disagree'
export type Coordinates = [number, number]

export interface Evidence {
  id: string
  restaurantId: string
  kind: 'business' | 'review' | 'summary'
  title: string
  text: string
  source: string
  date: string
  mock: boolean
  url?: string
}

export interface Restaurant {
  id: string
  name: string
  cuisine: string
  character: CharacterId
  host: string
  color: string
  cover: { src: string; alt: string; position?: string }
  price: number | null
  coordinates: Coordinates
  address: string
  hours: string | null
  tags: string[]
  scenes: string[]
  quiet: boolean | null
  spice: number | null
  allergens: string[] | null
  specialty: string
  intro: string
  caveat: string
  evidenceIds: string[]
}

export interface Filters {
  minBudget: number
  maxBudget: number
  radius: number
  cuisines: string[]
  scene: string
  people: number
  time: string
  quiet: boolean
  mild: boolean
  noSpice: boolean
  allergy: string
  locationName: string
  center: Coordinates
}

export interface DebateMessage {
  id: string
  restaurantId: string
  speaker: string
  text: string
  round: number
  topic: string
  evidenceIds: string[]
  state: CharacterState
}

export interface HistoryEntry extends DebateMessage {
  time: string
  user?: boolean
}

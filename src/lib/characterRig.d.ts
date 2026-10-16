import type { CharacterId } from '@/data/types'
interface VisualState { mouth: string; open: number; tilt: number; [key: string]: unknown }
interface Rig { svg: SVGSVGElement; render(state: VisualState): void }
interface Actor {
  e(t: number, expression: string): Actor
  p(t: number, pose: string): Actor
  look(t: number, x: number, y: number): Actor
  run(start: number, end: number, rate?: number): Actor
  act(t: number, name: string, duration?: number, amplitude?: number): Actor
  state(t: number): VisualState
}
export const RIG: { create(container: HTMLElement, who: CharacterId, id: string, opts?: {viewBox?: string}): Rig; Actor: new (rig: Rig, opts?: {seed?: number; expr?: string}) => Actor }

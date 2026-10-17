<template>
  <div class="theater" :class="{ 'is-entering': entering }" :style="{ '--lights': lights }" data-stage-scene>
    <div class="theater-wall"></div>
    <div class="marquee">
      <i v-for="n in 12" :key="n" :style="{ left: `${(n - 1) * 9.09}%`, opacity: entering ? segment(progress, n * .018, n * .018 + .18) : 1 }"></i>
      <b>{{ APP_NAME }}</b>
    </div>
    <div class="floor"></div>
    <div class="stage-lighting" aria-hidden="true">
      <div v-for="(restaurant, index) in restaurants" :key="restaurant.id" class="light-position"
        :class="{ active: activeId === restaurant.id && !listening }" :style="seatStyle(index)">
        <div class="spotlight"></div>
        <div class="light-pool"></div>
      </div>
    </div>
    <div v-for="(restaurant, index) in restaurants" :key="restaurant.id" class="actor-position"
      :class="{ active: activeId === restaurant.id && !listening }" :style="seatStyle(index)">
      <div class="actor" :style="figureStyle(restaurant.id, index)">
        <CharacterAvatar :character="restaurant.character" :name="restaurant.host"
          :state="actorState(restaurant.id)" :motion="actorMotion(restaurant.id)"
          :look-x="gazeDirection(index)"
          :direction="entering && (seats[index]?.offset || 0) > 0 ? -1 : 1" />
      </div>
      <div class="nameplate" :style="{ opacity: entering ? segment(progress, .6, .85) : 1 }">
        <b>{{ restaurant.host }}</b>
      </div>
    </div>
    <StageCurtain :progress="clothProgress" />
    <div class="stage-front"></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CharacterState, Restaurant } from '@/data/types'
import { APP_NAME } from '@/data/app'
import { easeInOut, easeOutBack, segment } from '@/lib/entranceMotion'
import { stageSlots } from '@/lib/stageLayout'
import CharacterAvatar from './CharacterAvatar.vue'
import StageCurtain from './StageCurtain.vue'

const props = withDefaults(defineProps<{
  restaurants: Restaurant[]
  activeId?: string
  paused?: boolean
  listening?: boolean
  speakingState?: CharacterState
  entering?: boolean
  progress?: number
}>(), { speakingState: 'speaking', progress: 1 })
const clothProgress = computed(() => props.entering ? easeInOut(segment(props.progress, .07, .9)) : 1)
const lights = computed(() => props.entering ? segment(props.progress, .25, .8) : 1)
const seats = computed(() => stageSlots(props.restaurants.length))
const speakerIndex = computed(() => props.restaurants.findIndex((r) => r.id === props.activeId))

// Light and character share fixed coordinates, independent of the current speaker.
function seatStyle(index: number) {
  const seat = seats.value[index]!
  return {
    '--seat-offset': seat.offset,
    '--seat-scale': seat.scale,
  }
}

// Listeners follow the speaker with their eyes and face the audience during an interruption.
function gazeDirection(index: number) {
  if (props.entering || props.listening || speakerIndex.value < 0 || speakerIndex.value === index) return 0
  return Math.sign(speakerIndex.value - index) * .65
}

function entryProgress(id: string) {
  const index = props.restaurants.findIndex((r) => r.id === id)
  return props.entering ? segment(props.progress, .2 + index * .065, .62 + index * .065) : 1
}

// Contestants run into their places behind the opening cloth and settle with a small bounce.
function figureStyle(id: string, index: number) {
  const progress = entryProgress(id)
  const eased = easeOutBack(progress)
  const offset = seats.value[index]!.offset
  const direction = offset < 0 ? -1 : offset > 0 ? 1 : -.32
  return {
    opacity: segment(progress, 0, .18),
    transform: `translate(calc(var(--entry-distance) * ${direction * (1 - easeInOut(progress))}), ${18 * (1 - eased)}px) scale(${.86 + .14 * eased})`,
  }
}

function actorMotion(id: string) {
  const progress = entryProgress(id)
  return props.entering && progress > 0 && progress < .9 ? 'run' : 'idle'
}

function actorState(id: string): CharacterState {
  if (props.entering) return entryProgress(id) > .85 ? 'happy' : 'idle'
  if (props.listening) return 'listening'
  if (props.activeId === id) return props.paused ? 'thinking' : props.speakingState
  return 'listening'
}
</script>

<style lang="less" scoped>
.theater {
  position: relative;
  --actor-height: clamp(135px, min(48vw, 27dvh), 350px);
  --side-offset: min(33%, 290px);
  --stage-front-height: 23px;
  --original-baseline: clamp(42px, 6vw, 65px);
  // Reserve the label line, padding, shadow and a gap above the stage front.
  --stage-baseline: max(var(--original-baseline), calc(var(--stage-front-height) + var(--label-size) * var(--line-compact) + 26px));
  --entry-distance: clamp(110px, 17vw, 210px);
  --light-ease: cubic-bezier(.22, .61, .36, 1);
  height: calc(clamp(260px, min(78vw, 42dvh), 560px) + var(--stage-baseline) - var(--original-baseline));
  flex-shrink: 0;
  overflow: hidden;
  isolation: isolate;

  .theater-wall {
    position: absolute;
    inset: 0;
    background: repeating-linear-gradient(90deg, #35203e 0, #35203e 23px, #3c2645 23px, #3c2645 25px);
    mask-image: linear-gradient(#000, #0003);
  }

  .marquee {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px 22px 6px;
    border: 2px solid #ab8046;
    background: #28172e;
    border-radius: 8px;
    width: clamp(168px, 24vw, 260px);
    margin: 9px auto 0;
    z-index: 12;
    box-shadow: 0 3px 0 #130a1a;

    b {
      font-family: var(--font-display);
      color: #f5dfac;
      font-size: var(--section-size);
      font-weight: var(--weight-regular);
      line-height: var(--line-heading);
      letter-spacing: var(--tracking-display);
      white-space: nowrap;
    }

    > i {
      position: absolute;
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: #efd390;
      box-shadow: 0 0 5px #e3b04b;
      top: -2px;
    }
  }

  .floor {
    position: absolute;
    height: clamp(95px, 14vw, 180px);
    bottom: 18px;
    left: -10%;
    right: -10%;
    background: repeating-linear-gradient(90deg, #8d6650 0, #8d6650 47px, #74523f 48px, #ac7c58 49px);
    transform: perspective(200px) rotateX(24deg);
    border-top: 2px solid #bc9065;
  }

  .stage-lighting {
    position: absolute;
    inset: 0;
    z-index: 1;
    pointer-events: none;

    .light-position {
      .spotlight {
        position: absolute;
        left: -70%;
        bottom: -6px;
        width: 240%;
        height: 175%;
        background: linear-gradient(180deg, #fff1cf08, #ffe6b31a 55%, #efc97c36);
        clip-path: polygon(44% 0, 56% 0, 100% 100%, 0 100%);
        mask-image: linear-gradient(90deg, transparent, #000 18%, #000 82%, transparent);
        opacity: 0;
        transition: opacity 1s var(--light-ease);
      }

      .light-pool {
        position: absolute;
        bottom: -9px;
        left: -17%;
        width: 134%;
        height: 26px;
        border-radius: 50%;
        background: radial-gradient(ellipse, #ffe4a77a, #ecc58133 48%, transparent 74%);
        opacity: calc(.18 * var(--lights, 1));
        transform: scale(.82);
        transition: opacity 1s var(--light-ease), transform 1.1s var(--light-ease);
      }

      &.active {
        .spotlight { opacity: var(--lights, 1); }
        .light-pool { opacity: var(--lights, 1); transform: scale(1.08); }
      }
    }
  }

  .light-position, .actor-position {
    position: absolute;
    width: calc(var(--actor-height) * 140 / 207);
    height: var(--actor-height);
    left: calc(50% + var(--side-offset) * var(--seat-offset));
    bottom: var(--stage-baseline);
    transform: translateX(-50%) scale(var(--seat-scale));
    transform-origin: 50% 100%;
  }

  .actor-position {
    z-index: 2;

    .actor {
      position: relative;
      height: 100%;
      width: 100%;
      z-index: 2;
      transform-origin: 50% 95%;
      filter: brightness(.78) saturate(.88);
      transition: filter .9s var(--light-ease);
    }

    .nameplate {
      position: absolute;
      top: calc(100% + 1px);
      left: 50%;
      transform: translateX(-50%);
      width: max-content;
      min-width: 68%;
      min-height: 28px;
      z-index: 3;
      border: 1px solid #92766a;
      background: #dfd0ba;
      border-radius: 7px;
      color: #66504d;
      box-shadow: 0 3px 0 #4e3340;
      text-align: center;
      padding: 5px 9px;
      line-height: var(--line-compact);
      transition: opacity .4s, color .8s var(--light-ease), background .8s var(--light-ease), border-color .8s var(--light-ease), box-shadow .8s var(--light-ease);

      b {
        font-size: calc(var(--label-size) / var(--seat-scale));
        display: block;
        white-space: nowrap;
        font-weight: var(--weight-semibold);
      }

    }

    &.active {
      .actor { filter: brightness(1.04) saturate(1.02); }
      .nameplate {
        color: #543c3e;
        background: #fff0cf;
        border-color: #e5bf7a;
        box-shadow: 0 3px 0 #4e3340, 0 0 18px #e3b04b30;
      }
    }
  }

  .stage-front {
    position: absolute;
    bottom: 0;
    height: var(--stage-front-height);
    width: 100%;
    background: linear-gradient(#6b453c, #362035);
    border-top: 3px solid #b48c5e;
    border-bottom: 3px solid #e3b04b22;
    z-index: 5;
  }

  &.is-entering {
    .stage-lighting .light-position {
      .spotlight, .light-pool { transition: none; }
    }
  }
}
</style>

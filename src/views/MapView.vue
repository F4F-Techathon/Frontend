<template>
  <section ref="page" class="map-page" :class="{ 'is-gathering': gathering }"><div class="map-header"><NavHeader title="在地图上挑选选手" :step="3" @back="router.push('/filter')"><button class="icon-btn filter-icon" aria-label="调整筛选条件" @click="filterOpen = true"><AppIcon name="filter" /></button></NavHeader><div class="map-summary"><span><b>{{ store.candidates.length }}</b> 家候选餐厅 <i>·</i> {{ store.filters.locationName }}</span><button class="text-btn" @click="listMode = !listMode"><AppIcon :name="listMode ? 'map' : 'list'" :size="15" />{{ listMode ? '看地图' : '看列表' }}</button></div><div class="condition-scroll"><button v-for="tag in store.conditionTags.slice(0, 5)" :key="tag.key" class="chip" @click="filterOpen = true">{{ tag.text }}</button></div></div>
    <div class="map-region"><AMapView ref="mapView" :gathering="gathering" :restaurants="visibleCandidates" :selected-ids="store.selectedIds" :center="store.filters.center" :radius="store.filters.radius" @select="focusId = $event" @bounds="bounds = $event; if (!gathering) moved = true" @failed="mapFailed = true" /><button v-if="moved && !listMode" class="area-button" @click="onlyArea = !onlyArea">{{ onlyArea ? '显示全部候选' : '只看当前区域' }}<AppIcon name="refresh" :size="12" /></button><button v-if="!listMode" class="locate-map icon-btn" aria-label="重新选择搜索位置" @click="locationOpen = true"><AppIcon name="locate" :size="21" /></button><div v-if="listMode" class="map-list"><p class="list-note">{{ onlyArea ? '当前地图视野内' : '全部候选' }} · {{ visibleCandidates.length }} 家</p><RestaurantCard v-for="restaurant in visibleCandidates" :key="restaurant.id" :restaurant="restaurant" compact selectable :selected="store.selectedIds.includes(restaurant.id)" @open="focusId = $event" @toggle="store.toggleSelection" /><div v-if="!visibleCandidates.length" class="empty-state"><AppIcon name="search" :size="35" /><h3>这里暂时没有候选餐厅</h3><button class="text-btn" @click="filterOpen = true">调整筛选范围</button></div></div><div v-if="mapFailed && !listMode" class="fallback-button"><button class="btn btn-secondary" @click="listMode = true">从列表挑选<AppIcon name="list" :size="18" /></button></div></div>
    <div class="selection-dock"><div class="dock-handle"></div><div class="dock-heading"><div><h2>今晚的选手 <span>{{ store.selected.length }} / 3</span></h2></div><button class="text-btn" :aria-expanded="expanded" @click="expanded = !expanded">{{ expanded ? '收起' : '展开' }}<AppIcon :name="expanded ? 'minus' : 'plus'" :size="14" /></button></div><div v-if="expanded" class="contestants"><div v-for="r in store.selected" :key="r.id" class="contestant" :data-contestant-id="r.id"><button class="remove" :aria-label="`移除${r.name}`" @click="store.toggleSelection(r.id)"><AppIcon name="close" :size="11" /></button><button class="avatar" :style="{ background: `${r.color}13` }" :aria-label="`查看${r.name}`" @click="focusId = r.id"><CharacterAvatar :character="r.character" :name="r.host" portrait /></button><b>{{ r.name }}</b><span>{{ r.price ? `¥${r.price}/人` : '价格未知' }}</span></div><button v-for="n in 3 - store.selected.length" :key="`empty${n}`" class="empty-slot" @click="listMode = true"><i><AppIcon name="plus" :size="20" /></i><span>虚位以待</span></button></div><button class="btn btn-primary" :disabled="store.selected.length < 2 || gathering" @click="start">{{ store.selected.length < 2 ? '再邀请一位，就能开场' : '召集选手，开始辩论！' }}<AppIcon name="ticket" :size="20" /></button></div>
    <BottomSheet :open="!!focused" :title="focused?.name || '餐厅预览'" @close="focusId = ''"><div v-if="focused" class="map-preview"><RestaurantCard :restaurant="focused" @open="router.push(`/restaurant/${focused.id}`)" /><p>{{ focused.intro }}</p><div class="chips"><span v-for="tag in focused.tags" :key="tag" class="chip green">{{ tag }}</span></div><p class="small muted">{{ focused.caveat }}</p><button class="btn" :class="store.selectedIds.includes(focused.id) ? 'btn-secondary' : 'btn-primary'" @click="store.toggleSelection(focused.id); focusId = ''"><AppIcon :name="store.selectedIds.includes(focused.id) ? 'minus' : 'plus'" :size="18" />{{ store.selectedIds.includes(focused.id) ? '取消选择' : '邀请 TA 加入辩论' }}</button></div></BottomSheet>
    <BottomSheet :open="filterOpen" title="调整今晚的范围" size="large" @close="closeFilters"><FilterFields /><template #footer><button class="btn btn-primary" @click="closeFilters">查看 {{ store.candidates.length }} 家候选<AppIcon name="check" :size="18" /></button></template></BottomSheet><LocationPicker :open="locationOpen" @close="locationOpen = false" />
  </section>
</template>
<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDiningStore } from '@/stores/dining'
import { useEntranceStore } from '@/stores/entrance'
import type { MapBounds } from '@/lib/amap'
import NavHeader from '@/components/NavHeader.vue'
import AMapView from '@/components/AMapView.vue'
import AppIcon from '@/components/AppIcon.vue'
import CharacterAvatar from '@/components/CharacterAvatar.vue'
import RestaurantCard from '@/components/RestaurantCard.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import FilterFields from '@/components/FilterFields.vue'
import LocationPicker from '@/components/LocationPicker.vue'
const store = useDiningStore(), router = useRouter(), focusId = ref(''), filterOpen = ref(false), locationOpen = ref(false), listMode = ref(false), expanded = ref(true), mapFailed = ref(false), moved = ref(false), onlyArea = ref(false), bounds = ref<MapBounds>()
const entrance = useEntranceStore()
const page = ref<HTMLElement>()
const mapView = ref<InstanceType<typeof AMapView>>()
const gathering = computed(() => entrance.active)
let layoutObserver: ResizeObserver | undefined
const focused = computed(() => store.candidates.find((r) => r.id === focusId.value))
const visibleCandidates = computed(() => onlyArea.value && bounds.value ? store.candidates.filter((r) => bounds.value!.contains(r.coordinates)) : store.candidates)
// The map stays full-height behind the header and dock, so their exit reveals more map smoothly.
onMounted(() => {
  store.prepareSelection()
  const header = page.value!.querySelector<HTMLElement>('.map-header')!
  const dock = page.value!.querySelector<HTMLElement>('.selection-dock')!
  const measure = () => {
    page.value?.style.setProperty('--map-header', `${header.offsetHeight}px`)
    page.value?.style.setProperty('--map-dock', `${dock.offsetHeight}px`)
  }
  measure()
  layoutObserver = new ResizeObserver(measure)
  layoutObserver.observe(header)
  layoutObserver.observe(dock)
})
onBeforeUnmount(() => layoutObserver?.disconnect())
function closeFilters() { filterOpen.value = false; store.prepareSelection(); onlyArea.value = false }
// Captures actual map anchors; list-only mode gathers from the selected avatar seats instead.
function start() {
  if (store.selected.length < 2 || entrance.active || !page.value) return
  const actors = [...store.selected]
  const rect = page.value.getBoundingClientRect()
  const target = { x: rect.left + rect.width / 2, y: rect.top + rect.height * .51 }
  const starts = actors.map((r, index) => {
    const avatar = page.value!.querySelector<HTMLElement>(`[data-contestant-id="${r.id}"] .avatar`)
    const box = avatar?.getBoundingClientRect()
    return box ? { x: box.left + box.width / 2, y: box.bottom } : { x: rect.left + rect.width * (index + 1) / (actors.length + 1), y: rect.top + rect.height * .38 }
  })
  const mapAvailable = mapView.value?.beginEntrance(actors) || false
  listMode.value = false
  entrance.begin({
    actors,
    mapAvailable,
    anchors: () => ({
      starts: actors.map((r, i) => (mapAvailable ? mapView.value?.project(r.coordinates) : undefined) || starts[i]!),
      target: (mapAvailable ? mapView.value?.project(store.filters.center) : undefined) || target,
    }),
    focusTarget: () => { if (mapAvailable) mapView.value?.focusTarget() },
  })
  void import('@/views/DebateView.vue')
}
</script>
<style lang="less" scoped>
.map-page {
  position: relative;
  isolation: isolate;
  --map-header: 147px;
  --map-dock: 235px;
  .map-header, .selection-dock { transition: transform .65s cubic-bezier(.22,.8,.25,1), opacity .4s; }
  &.is-gathering {
    .map-header { transform: translateY(-105%); opacity: 0; pointer-events: none; }
    .selection-dock { transform: translateY(110%); opacity: 0; pointer-events: none; }
    .area-button, .locate-map, .fallback-button { opacity: 0; pointer-events: none; }
  }
  height: 100dvh; min-height: 650px; display: flex; flex-direction: column; overflow: hidden; .map-header { background: var(--cream); z-index: 2; box-shadow: 0 4px 15px #2b1b3008; .filter-icon { border: 1px solid var(--line); width: 37px; height: 37px; } .map-summary { display: flex; align-items: center; justify-content: space-between; padding: 0 20px; font-size: 12px; >span { color: #827968; max-width: 75%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; b { color: var(--green); font: 500 19px var(--font-round); margin-right: 3px; } i { margin: 0 5px; font-style: normal; } } .text-btn { display: flex; gap: 4px; font-size: 10px; } } .condition-scroll { display: flex; gap: 6px; padding: 10px 20px 14px; overflow-x: auto; scrollbar-width: none; .chip { white-space: nowrap; font-size: 12px; padding: 6px 10px; } } } .map-region { position: absolute; inset: 0; z-index: 0; overflow: hidden; .area-button { position: absolute; top: calc(var(--map-header) + 15px); left: 50%; transform: translateX(-50%); background: var(--paper); border: 1px solid #d6cdb5; box-shadow: 0 3px 8px #2b1b3012; border-radius: 50px; display: flex; align-items: center; gap: 7px; padding: 9px 13px; font-size: 10px; white-space: nowrap; } .locate-map { position: absolute; bottom: calc(var(--map-dock) + 30px); left: 15px; background: var(--paper); border: 1px solid #d3cbb7; border-radius: 12px; box-shadow: 0 3px 8px #2b1b3015; } .map-list { position: absolute; top: var(--map-header); bottom: calc(var(--map-dock) - 14px); left: 0; right: 0; overflow-y: auto; padding: 14px 17px; background: #ede8dd; display: flex; flex-direction: column; gap: 9px; .list-note { color: var(--muted); font-size: 11px; margin: 1px 0 6px; } } .fallback-button { position: absolute; bottom: calc(var(--map-dock) + 35px); left: 20px; right: 20px; .btn { font-size: 12px; min-height: 46px; } } } .selection-dock { position: relative; z-index: 3; padding: 10px 20px calc(12px + env(safe-area-inset-bottom)); background: var(--paper); border-radius: 25px 25px 0 0; margin-top: auto; box-shadow: 0 -8px 30px #2b1b3015; .dock-handle { width: 30px; height: 3px; background: #d5cbbb; border-radius: 5px; margin: 0 auto 13px; } .dock-heading { display: flex; align-items: center; justify-content: space-between;  h2 { font-size: 17px; margin: 4px 0; span { color: #9c886d; font: 500 14px var(--font-round); margin-left: 7px; } } .text-btn { display: flex; gap: 5px; align-items: center; font-size: 10px; } }  .contestants { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 10px 0 19px; .contestant { text-align: center; position: relative; .avatar { width: 58px; height: 58px; border-radius: 50%; margin: 0 auto 7px; border: 1px solid #e6d9c7; padding: 0; display: block; } b { display: block; font-size: 12px; } >span { font-size: 11px; color: var(--muted); display: block; margin-top: 4px; } .remove { position: absolute; right: calc(50% - 36px); top: 0; z-index: 2; display: grid; place-items: center; width: 18px; height: 18px; border: 1px solid var(--line); border-radius: 50%; background: var(--paper); } } .empty-slot { border: 0; background: none; display: flex; flex-direction: column; align-items: center; gap: 10px; i { width: 58px; height: 58px; display: grid; place-items: center; border: 1px dashed #cbbca6; border-radius: 50%; color: #b9a68e; } span { font-size: 10px; color: #a18f78; } } }  } .map-preview { >p { font-size: 13px; line-height: 1.8; } .btn { margin-top: 20px; } } }
</style>

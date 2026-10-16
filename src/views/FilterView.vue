<template><section class="filter-page"><NavHeader title="确认需求" :step="2" @back="router.push('/input')" /><div class="page-content"><h2 class="page-title">先圈定一下范围</h2><FilterFields /><div class="section-heading"><h2>目前找到的餐厅 <span>{{ store.candidates.length }}</span></h2></div><div v-if="store.candidates.length" class="candidate-list"><RestaurantCard v-for="restaurant in store.candidates.slice(0, 4)" :key="restaurant.id" :restaurant="restaurant" @open="previewId = $event" /><p v-if="store.candidates.length > 4" class="remaining">还有 {{ store.candidates.length - 4 }} 家，去地图上慢慢挑</p></div><div v-else class="empty-state"><div class="empty-icon"><AppIcon name="search" :size="32" /></div><h3>范围有点小，<br />还没找到合适的餐厅。</h3><p>你的想法都还在，试试放宽其中一个条件。</p><button class="btn btn-secondary" @click="relax">扩大范围，放宽预算和类型</button></div></div><div class="bottom-action"><div class="summary"><span>当前候选 <b>{{ store.candidates.length }}</b> 家</span><button class="text-btn" @click="router.push('/input')">重新描述需求</button></div><button class="btn btn-primary" :disabled="!store.candidates.length" @click="toMap">去地图里看看<AppIcon name="arrow" :size="20" /></button></div><BottomSheet :open="!!preview" :title="preview?.name || '餐厅预览'" @close="previewId = ''"><div v-if="preview" class="preview"><RestaurantArt :name="preview.name" :color="preview.color" /><p>{{ preview.intro }}</p><div class="chips"><span v-for="tag in preview.tags" :key="tag" class="chip green">{{ tag }}</span></div><p class="small muted">{{ preview.cuisine }} · {{ preview.price ? `¥${preview.price}/人` : '人均未知' }} · {{ store.distance(preview.id) }} km</p><button class="btn btn-secondary" @click="router.push(`/restaurant/${preview.id}`)">看看餐厅资料<AppIcon name="arrow" :size="18" /></button></div></BottomSheet></section></template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDiningStore } from '@/stores/dining'
import { restaurants } from '@/data/restaurants'
import NavHeader from '@/components/NavHeader.vue'
import FilterFields from '@/components/FilterFields.vue'
import RestaurantCard from '@/components/RestaurantCard.vue'
import RestaurantArt from '@/components/RestaurantArt.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import AppIcon from '@/components/AppIcon.vue'
const store = useDiningStore(), router = useRouter(), previewId = ref('')
const preview = computed(() => restaurants.find((r) => r.id === previewId.value))
function toMap() { store.prepareSelection(); router.push('/map') }
function relax() { store.filters.radius = 5; store.filters.minBudget = 0; store.filters.maxBudget = 0; store.filters.cuisines = []; store.notify('已放宽范围，饮食限制仍保留') }
</script>
<style lang="less" scoped>
.filter-page { min-height: 100dvh; .page-content { padding-top: 14px; .page-title { font-size: 28px; line-height: 1.45; margin-bottom: 8px; } .section-heading h2 span { display: inline-block; min-width: 24px; padding: 3px 6px; margin-left: 4px; font: 500 14px var(--font-round); background: #e7ddc8; border-radius: 7px; text-align: center; } .candidate-list { display: flex; flex-direction: column; gap: 10px; .remaining { text-align: center; font-size: 11px; color: var(--muted); } } .notice { margin-top: 17px; } } .bottom-action { .summary { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--muted); margin: -5px 3px 5px; b { color: var(--ink); font: 500 20px var(--font-round); margin: 0 4px; } } } .preview { .restaurant-art { height: 170px; border-radius: 15px; } >p { font-size: 13px; line-height: 1.8; } .btn { margin-top: 20px; } } }
</style>

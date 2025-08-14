<script setup lang="ts">
import { onMounted, ref, computed, watch, onBeforeUnmount } from 'vue'

type Kind = 'normal' | 'enhanced'
interface NormalSkill {
  skill: string
  description?: string
  image?: string
  effects?: any[]
}
interface EnhancedSkill {
  enhanced_skill: string
  description?: string
  image?: string
  effects_by_level?: any[] | Record<string, any>
  effects_by_year?: Record<string, any[] | any>
}
interface SkillCardVM {
  kind: Kind
  name: string
  imageKey: string
  description: string
  effectsNormal?: any[]
  effectsByLevel?: any[] | Record<string, any>
}

const normalSkillData = ref<NormalSkill[]>([])
const enhancedSkillData = ref<EnhancedSkill[]>([])

const loading = ref(true)
const error = ref<string | null>(null)

const q = ref('')
const debouncedQ = ref('')
const type = ref<'all' | 'normal' | 'enhanced'>('normal')
const year = ref<string>('')
const yearsOptions = ref<string[]>([])
const level = ref<number>(1)

// --- debounce(검색) ----------------------------------------------------------
let qTimer: number | null = null
watch(q, (val) => {
  if (qTimer) window.clearTimeout(qTimer)
  qTimer = window.setTimeout(() => {
    debouncedQ.value = val.trim().toLowerCase()
  }, 150)
})
onBeforeUnmount(() => {
  if (qTimer) window.clearTimeout(qTimer)
})

// --- 인메모리 맵(빠른 조회) --------------------------------------------------
const normalMap = ref<Record<string, NormalSkill>>({})
const enhancedMap = ref<Record<string, EnhancedSkill>>({})

onMounted(async () => {
  try {
    const [normalSkillRes, enhancedSkillRes] = await Promise.all([
      fetch('/DB/normal_skill.json'),
      fetch('/DB/enhanced_skill.json')
    ])
    normalSkillData.value = await normalSkillRes.json()
    enhancedSkillData.value = await enhancedSkillRes.json()

    // map 캐싱
    const nmp: Record<string, NormalSkill> = {}
    normalSkillData.value.forEach(s => { if (s.skill) nmp[s.skill] = s })
    normalMap.value = nmp

    const emp: Record<string, EnhancedSkill> = {}
    enhancedSkillData.value.forEach(s => { if (s.enhanced_skill) emp[s.enhanced_skill] = s })
    enhancedMap.value = emp

    // yearsOptions 구성 (enhanced only)
    const yearSet = new Set<string>()
    enhancedSkillData.value.forEach((s) => {
      const byYear = s?.effects_by_year
      if (byYear && typeof byYear === 'object') {
        Object.keys(byYear).forEach((y) => yearSet.add(y))
      }
    })
    yearsOptions.value = Array.from(yearSet).sort().reverse()
    if (!year.value && yearsOptions.value.length) year.value = yearsOptions.value[0]
  } catch (e: any) {
    error.value = e?.message || '스킬 데이터를 불러오지 못했습니다.'
  } finally {
    loading.value = false
  }
})

// --- helpers (맵 기반) --------------------------------------------------------
const getNormal = (name: string) => normalMap.value[name]
const getEnhanced = (name: string) => enhancedMap.value[name]

function renderEffectItem(e: any): string {
  if (e == null) return ''
  if (typeof e === 'string') return e
  if (typeof e === 'number') return String(e)
  if (Array.isArray(e)) return e.map(renderEffectItem).join(', ')
  const parts: string[] = []
  Object.entries(e).forEach(([k, v]) => parts.push(`${k}: ${renderEffectItem(v)}`))
  return parts.join(' / ')
}

function levelEffects(card: SkillCardVM, lvl: number) {
  const byLevel = card?.effectsByLevel
  if (!byLevel) return []
  if (Array.isArray(byLevel)) {
    const idx = Math.min(Math.max(lvl, 1), byLevel.length) - 1
    const arr = byLevel[idx] ?? []
    return Array.isArray(arr) ? arr : [arr]
  }
  if (typeof byLevel === 'object') {
    const arr = (byLevel as Record<string, any>)[String(lvl)] ?? []
    return Array.isArray(arr) ? arr : [arr]
  }
  return []
}

function yearEffects(card: SkillCardVM, y?: string) {
  if (!y || card.kind !== 'enhanced') return []
  const raw = enhancedMap.value[card.name]?.effects_by_year?.[y]
  if (!raw) return []
  return Array.isArray(raw) ? raw : [raw]
}

// --- filtered source(한 번만 필터) -------------------------------------------
const listToRender = computed<SkillCardVM[]>(() => {
  // 검색어 준비
  const needle = debouncedQ.value
  const hasNeedle = needle.length > 0

  // 소스 선택 + 검색 (케이스 인식 최소화)
  const passNormal = (s: NormalSkill) => {
    if (!hasNeedle) return true
    const name = (s.skill ?? '').toLowerCase()
    const desc = (s.description ?? '').toLowerCase()
    return name.includes(needle) || desc.includes(needle)
  }
  const passEnhanced = (s: EnhancedSkill) => {
    if (!hasNeedle) return true
    const name = (s.enhanced_skill ?? '').toLowerCase()
    const desc = (s.description ?? '').toLowerCase()
    return name.includes(needle) || desc.includes(needle)
  }

  const normals = (type.value === 'normal' || type.value === 'all')
      ? normalSkillData.value.filter(passNormal).map<SkillCardVM>((s) => ({
        kind: 'normal',
        name: s.skill,
        imageKey: s.image || '',
        description: s.description ?? '',
        effectsNormal: s.effects ?? []
      }))
      : []

  const enhanceds = (type.value === 'enhanced' || type.value === 'all')
      ? enhancedSkillData.value.filter(passEnhanced).map<SkillCardVM>((s) => ({
        kind: 'enhanced',
        name: s.enhanced_skill,
        imageKey: s.image || '',
        description: s.description ?? '',
        effectsByLevel: s.effects_by_level ?? []
      }))
      : []

  if (type.value === 'normal') return normals
  if (type.value === 'enhanced') return enhanceds
  // all: 이름순(한글 로케일)
  return [...normals, ...enhanceds].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
})

// --- 이미지 오류 처리 ---------------------------------------------------------
function onImgError(e: Event) {
  const el = e.target as HTMLImageElement
  el.style.display = 'none'
  // fallback 블록이 나타나도록
}
</script>

<template>
  <div class="max-w-7xl mx-auto px-6 py-8">
    <!-- 헤더 -->
    <div class="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">스킬 목록</h1>

      <div class="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
        <!-- 탭 -->
        <div class="flex border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden">
          <button
              class="px-4 py-2 text-sm"
              :class="type==='normal' ? 'bg-gray-200 dark:bg-gray-700 font-semibold' : ''"
              @click="type='normal'">일반</button>
          <button
              class="px-4 py-2 text-sm"
              :class="type==='enhanced' ? 'bg-gray-200 dark:bg-gray-700 font-semibold' : ''"
              @click="type='enhanced'">강화</button>
          <button
              class="px-4 py-2 text-sm"
              :class="type==='all' ? 'bg-gray-200 dark:bg-gray-700 font-semibold' : ''"
              @click="type='all'">전체</button>
        </div>

        <!-- 검색 -->
        <input
            v-model="q"
            type="text"
            placeholder="스킬명/설명 검색..."
            class="w-full sm:w-64 border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        />
      </div>
    </div>

    <!-- 강화 옵션 -->
    <div v-if="type !== 'normal'" class="mb-6 flex flex-wrap gap-4">
      <div class="flex items-center gap-2">
        <span class="text-sm">레벨</span>
        <input type="range" min="1" max="10" v-model.number="level" class="w-28" />
        <span class="text-sm font-semibold">{{ level }}</span>
      </div>
      <div v-if="yearsOptions.length" class="flex items-center gap-2">
        <span class="text-sm">년도</span>
        <select v-model="year" class="border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-sm">
          <option v-for="y in yearsOptions" :key="y" :value="y">{{ y }}</option>
        </select>
      </div>
    </div>

    <!-- 로딩 -->
    <div v-if="loading" class="text-center py-10 text-gray-500">불러오는 중...</div>

    <!-- 에러 -->
    <div v-else-if="error" class="text-center py-10 text-red-500">{{ error }}</div>

    <!-- 카드 리스트 -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <div
          v-for="card in listToRender"
          :key="card.kind + ':' + card.name"
          class="border border-gray-300 dark:border-gray-700 rounded-md p-4 bg-white dark:bg-gray-900"
      >
        <!-- 제목 -->
        <div class="flex items-center gap-3 mb-3">
          <img
              v-if="card.imageKey"
              :src="`/assets/logos/skills/${card.imageKey}.png`"
              :alt="card.name"
              class="w-12 h-12 object-contain"
          />
          <div>
            <h3 class="font-semibold text-gray-900 dark:text-gray-100">{{ card.name }}</h3>
            <span v-if="type==='all'" class="text-xs text-gray-500">
              {{ card.kind === 'normal' ? '일반' : '강화' }}
            </span>
          </div>
        </div>

        <!-- 효과 -->
        <div v-if="card.kind === 'normal'" class=" text-sm">
         <pre>
           {{card.effectsNormal}}
         </pre>
        </div>

        <div v-else-if="card.kind === 'enhanced'" class="space-y-1 text-sm">
          <div v-for="(e, i) in levelEffects(card, level)" :key="'l'+i" class="text-gray-800 dark:text-gray-200">
            • {{ renderEffectItem(e) }}
          </div>
          <div v-for="(e, i) in yearEffects(card, year)" :key="'y'+i" class="text-gray-800 dark:text-gray-200">
            • {{ renderEffectItem(e) }}
          </div>
        </div>

        <!-- 설명 -->
        <p v-if="card.description" class="mt-3 text-xs text-gray-600 dark:text-gray-400">
          {{ card.description }}
        </p>
      </div>
    </div>

    <!-- 빈 상태 -->
    <div v-if="!loading && !error && !listToRender.length" class="text-center py-10 text-gray-500">
      조건에 맞는 스킬이 없습니다
    </div>
  </div>
</template>

<style>
/* range input */
.slider::-webkit-slider-thumb {
  appearance: none;
  height: 18px; width: 18px; border-radius: 50%;
  background: linear-gradient(45deg, #6366f1, #8b5cf6);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
  cursor: pointer; transition: all 0.2s ease;
}
.slider::-webkit-slider-thumb:hover { transform: scale(1.08); }
.slider::-webkit-slider-track { height: 8px; border-radius: 4px; background: linear-gradient(to right, #e5e7eb, #d1d5db); }
.slider::-moz-range-thumb {
  height: 18px; width: 18px; border-radius: 50%;
  background: linear-gradient(45deg, #6366f1, #8b5cf6);
  cursor: pointer; border: none; box-shadow: 0 4px 12px rgba(99,102,241,.3);
}

/* 두 줄 말줄임 */
.line-clamp-2 {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
</style>

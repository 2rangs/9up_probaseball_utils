<script setup lang="ts">
import { defineProps, defineEmits, computed, watch, onMounted, onBeforeUnmount, ref } from 'vue'
import { Star, Trash2, Search, Filter } from 'lucide-vue-next'
import type { PropType } from 'vue'

/* =========================
   Props / Emits
========================= */
const props = defineProps({
  allFields: Array as () => string[],
  selectFields: Array as () => string[],
  rarityField: String,
  filterOptions: Object as PropType<Record<string, string[]>>,
  fieldLabels: Object as PropType<Record<string, string>>,
  filters: Object as PropType<Record<string, any>>,
})
const emit = defineEmits(['update:filters'])

/* =========================
   공통 유틸
========================= */
const lc = (s: unknown) => String(s ?? '').toLowerCase()

/* =========================
   연도 옵션
========================= */
const currentYear = new Date().getFullYear()
const yearOptions = computed(() => {
  const years: string[] = []
  for (let y = currentYear; y >= 1982; y--) years.push(String(y))
  return years
})

/* =========================
   filterOptions 기본값 -> filters에 주입 (널 가드)
========================= */
watch(
    () => props.filterOptions,
    (options) => {
      if (!options) return
          ;['team', 'grade'].forEach((key) => {
        const list = (options as Record<string, string[]>)[key]
        const curr = (props.filters ?? {})[key]
        if (Array.isArray(list) && (!Array.isArray(curr) || curr.length === 0)) {
          emit('update:filters', { ...(props.filters ?? {}), [key]: [...list] })
        }
      })
    },
    { immediate: true, deep: true }
)

/* =========================
   필터 토글/업데이트
========================= */
const isSelected = (field: string, value: string) =>
    Array.isArray(props.filters?.[field]) && props.filters![field].includes(value)

const toggleFilter = (field: string, value: string) => {
  const selected = Array.isArray(props.filters?.[field]) ? [...props.filters![field]] : []
  const i = selected.indexOf(value)
  if (i !== -1) selected.splice(i, 1)
  else selected.push(value)
  emit('update:filters', { ...props.filters, [field]: selected })
}

const update = (field: string, value: any) => {
  emit('update:filters', { ...props.filters, [field]: value })
}

const clearAllFilters = () => {
  const cleared: Record<string, any> = {}
  Object.keys(props.filters ?? {}).forEach((k) => {
    cleared[k] = Array.isArray(props.filters?.[k]) ? [] : ''
  })
  emit('update:filters', cleared)
}

/* =========================
   등급 / 팀 전체선택
========================= */
const gradeOrder = ['DGN', 'TOP', 'ACE', 'HIT', 'POS', 'GG', 'TEA', 'SEA', 'ROY', 'MMVP', 'ASG']
const visibleGrades = computed(() => gradeOrder.filter((g) => props.filterOptions?.grade?.includes(g)))

const areAllGradesSelected = computed(() => {
  if (!visibleGrades.value.length) return false
  return visibleGrades.value.every((g) => isSelected('grade', g))
})

const areAllTeamsSelected = computed(() => {
  const teams = props.filterOptions?.team ?? []
  if (!teams.length) return false
  return teams.every((t) => isSelected('team', t))
})

const toggleAllGrades = () => {
  if (!visibleGrades.value.length) return
  emit('update:filters', {
    ...props.filters,
    grade: areAllGradesSelected.value ? [] : [...visibleGrades.value],
  })
}

const toggleAllTeams = () => {
  const teams = props.filterOptions?.team ?? []
  if (!teams.length) return
  emit('update:filters', {
    ...props.filters,
    team: areAllTeamsSelected.value ? [] : [...teams],
  })
}

/* =========================
   팀 로고
========================= */
const teamLogos: Record<string, string> = {
  kia: '/assets/logos/symbol/emblem_s_01_kia.png',
  haitai: '/assets/logos/symbol/emblem_s_01_haitai.png',
  samsung: '/assets/logos/symbol/emblem_s_02_samsung.png',
  lotte: '/assets/logos/symbol/emblem_s_03_lotte.png',
  kiwoom: '/assets/logos/symbol/emblem_s_04_kiwoom.png',
  nexen: '/assets/logos/symbol/emblem_s_04_nexen.png',
  binggrae: '/assets/logos/symbol/emblem_s_05_bingrae.png',
  hanwha: '/assets/logos/symbol/emblem_s_05_hanwha.png',
  lg: '/assets/logos/symbol/emblem_s_06_lg.png',
  mbc: '/assets/logos/symbol/emblem_s_06_mbc.png',
  doosan: '/assets/logos/symbol/emblem_s_07_doosan.png',
  ob: '/assets/logos/symbol/emblem_s_07_ob.png',
  sk: '/assets/logos/symbol/emblem_s_08_sk.png',
  ssg: '/assets/logos/symbol/emblem_s_08_ssg.png',
  nc: '/assets/logos/symbol/emblem_s_09_nc.png',
  kt: '/assets/logos/symbol/emblem_s_10_kt.png',
  sbw: '/assets/logos/symbol/emblem_s_11_sbw.png',
  hyundai: '/assets/logos/symbol/emblem_s_12_hyundai.png',
  pacific: '/assets/logos/symbol/emblem_s_13_pacific.png',
  sammi: '/assets/logos/symbol/emblem_s_14_sammi.png',
  chungbo: '/assets/logos/symbol/emblem_s_15_chungbo.png',
  dream: '/assets/logos/symbol/emblem_s_99_dream.png',
  nanum: '/assets/logos/symbol/emblem_s_99_nanum.png',
}

/* =========================
   스킬 리소스 (이미지/텍스트)
========================= */
const normalSkillData = ref<any[]>([])
const enhancedSkillData = ref<any[]>([])
onMounted(async () => {
  try {
    const [normalSkillRes, enhancedSkillRes] = await Promise.all([
      fetch('/DB/normal_skill.json'),
      fetch('/DB/enhanced_skill.json'),
    ])
    normalSkillData.value = await normalSkillRes.json()
    enhancedSkillData.value = await enhancedSkillRes.json()
  } catch {
    // 무시
  }
})

const matchSkillInfo = (skill: string, type: string, year?: string) => {
  if (type === 'normal') return normalSkillData.value.find((s) => s.skill === skill)?.image || ''
  if (type === 'enhanced') return enhancedSkillData.value.find((s) => s.enhanced_skill === skill)?.image || ''
  if (type === 'enhanced:GG') return enhancedSkillData.value.find((s) => s.enhanced_skill === skill)?.image || ''
  if (type === 'effects:normal') return normalSkillData.value.find((s) => s.skill === skill)?.effects || ''
  if (type === 'description:normal') return normalSkillData.value.find((s) => s.skill === skill)?.description || ''
  if (type === 'description:enhanced')
    return enhancedSkillData.value.find((s) => s.enhanced_skill === skill)?.description || []
  if (type === 'effects_by_level')
    return enhancedSkillData.value.find((s) => s.enhanced_skill === skill)?.effects_by_level || []
  if (type === 'effects_by_year')
    return enhancedSkillData.value.find((s) => s.enhanced_skill === skill)?.effects_by_year?.[year!] || []
  return ''
}

/* =========================
   라벨 변환
========================= */
function getSpecialFieldLabel(field: string, code: string): string {
  const handednessMap = { L: '좌', R: '우', S: '양' }
  const pitchingMap = { O: '오버핸드', S: '사이드암', U: '언더핸드' }
  const upper = code.toUpperCase()
  if (['battingHand', 'throwHand'].includes(field)) return handednessMap[upper] || code
  if (field === 'pitchingType') return pitchingMap[upper] || code
  return code
}

/* =========================
   검색(시너지 전용) 자동완성
========================= */
const searchInput = ref('')
const selectedTags = ref<string[]>(Array.isArray(props.filters?.search) ? [...props.filters!.search] : [])
watch(
    () => props.filters?.search,
    (v) => (selectedTags.value = Array.isArray(v) ? [...v] : []),
    { immediate: true }
)

// 제안 원천: synergy > searchSuggestions > suggestions
const suggestionList = computed<string[]>(() => {
  const fo = props.filterOptions
  if (!fo) return []
  const synergy = Array.isArray((fo as any).synergy) ? (fo as any).synergy : []
  const fallback =
      (Array.isArray((fo as any).searchSuggestions) && (fo as any).searchSuggestions) ||
      (Array.isArray((fo as any).suggestions) && (fo as any).suggestions) ||
      []
  const seen = new Set<string>(), out: string[] = []
  ;[...synergy, ...fallback].forEach((s) => {
    if (!seen.has(s)) {
      seen.add(s)
      out.push(s)
    }
  })
  return out
})

const collator = new Intl.Collator('ko-KR')
const scoreSuggestion = (s: string, term: string) => {
  const L = lc(s), T = lc(term)
  if (L === T) return 1000                      // 정확 일치
  if (L.includes(T) && /(고|대)\s*출신$/.test(L)) return 900 // ~고/대 출신
  if (L.startsWith(T)) return 800               // 접두 일치
  if (L.includes(T)) return 500                 // 부분 일치
  return 0
}

const filteredSuggestions = computed(() => {
  const termRaw = searchInput.value.trim()
  if (!termRaw) return []
  const term = lc(termRaw)
  const selectedSet = new Set(selectedTags.value.map(lc))
  return suggestionList.value
      .filter((s) => s && lc(s).includes(term) && !selectedSet.has(lc(s)))
      .map((s) => ({ s, sc: scoreSuggestion(s, term) }))
      .sort((a, b) => {
        if (b.sc !== a.sc) return b.sc - a.sc
        if (a.s.length !== b.s.length) return a.s.length - b.s.length
        return collator.compare(a.s, b.s)
      })
      .map((x) => x.s)
})

/* 자동완성 표시/닫힘 + 외부클릭 감지 */
const showSuggestions = ref(false)
const wrapperRef = ref<HTMLElement>()
const handleClickOutside = (e: MouseEvent) => {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target as Node)) {
    showSuggestions.value = false
  }
}
onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))

/* IME(한글) 안전 엔터 + 자동확정 */
const autoCommitSingle = true
const isComposing = ref(false)
const justEndedComposition = ref(false)
const onCompositionStart = () => { isComposing.value = true }
const onCompositionEnd = () => {
  isComposing.value = false
  justEndedComposition.value = true
  requestAnimationFrame(() => { justEndedComposition.value = false })
}
const commitByEnter = () => {
  if (isComposing.value || justEndedComposition.value) return
  const v = searchInput.value.trim()
  if (!v) return
  addTag(v)
  searchInput.value = ''
  showSuggestions.value = false
}
watch(filteredSuggestions, (list) => {
  if (!autoCommitSingle) return
  if (isComposing.value || justEndedComposition.value) return
  const term = searchInput.value.trim()
  if (!term) return
  if (list.length === 1 && lc(list[0]).startsWith(lc(term))) {
    addTag(list[0])
    searchInput.value = ''
    showSuggestions.value = false
  }
})

/* 태그 추가/제거 */
const addTag = (tag: string) => {
  if (!tag) return
  const exists = selectedTags.value.some((t) => lc(t) === lc(tag))
  if (!exists) {
    const next = [...selectedTags.value, tag]
    selectedTags.value = next
    emit('update:filters', { ...props.filters, search: next })
  }
  searchInput.value = ''
  showSuggestions.value = false
}

const removeTag = (tag: string) => {
  const next = selectedTags.value.filter((t) => lc(t) !== lc(tag))
  selectedTags.value = next
  emit('update:filters', { ...props.filters, search: next })
}

</script>

<template>
  <div class="max-w-[1280px] m-auto p-2 space-y-4">
    <!-- ===== Row 1: 스킬 | 강화 스킬 ===== -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- 스킬 -->
      <section class="bg-white/95 dark:bg-gray-900/95 rounded-lg p-4 shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{{ fieldLabels['skill'] }}</h3>
        <div class="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 p-2 bg-gray-50/80 dark:bg-gray-800/80">
          <div class="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-1">
            <button
                v-for="skill in props.filterOptions?.skill ?? []" :key="skill" :title="skill"
                @click="toggleFilter('skill', skill)"
                class="group relative w-[78px] sm:w-[70px] inline-flex flex-col items-center justify-center gap-2 rounded-xl border py-2 text-xs font-medium select-none
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-[border-color,filter] duration-100"
                :class="isSelected('skill', skill)
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600'">
              <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-lg" :class="isSelected('skill', skill) ? 'bg-white/20' : 'bg-gray-50 dark:bg-gray-700'">
                <img :src="`/assets/logos/skills/${matchSkillInfo(skill, 'normal')}.png`" :alt="skill" class="w-full h-full object-contain" loading="lazy" decoding="async" />
              </div>
              <span class="block w-full text-center font-semibold truncate">{{ skill }}</span>
            </button>
          </div>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
          선택된 {{ fieldLabels['skill'] }}: {{ Array.isArray(props.filters?.skill) ? props.filters!.skill.length : 0 }}개
        </p>
      </section>

      <!-- 강화 스킬 -->
      <section class="bg-white/95 dark:bg-gray-900/95 rounded-lg p-4 shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{{ fieldLabels['enhancedSkill'] }}</h3>
        <div class="max-h-48 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 p-2 bg-gray-50/80 dark:bg-gray-800/80">
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
            <button
                v-for="skill in props.filterOptions?.enhancedSkill ?? []" :key="skill"
                @click="toggleFilter('enhancedSkill', skill)"
                :class="['px-2 py-1 rounded-md text-xs font-medium border transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                       isSelected('enhancedSkill', skill)
                         ? 'bg-blue-500 text-white border-blue-500 shadow'
                         : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20']"
                :aria-pressed="isSelected('enhancedSkill', skill)">
              {{ skill }}
            </button>
          </div>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
          선택된 {{ fieldLabels['enhancedSkill'] }}: {{ Array.isArray(props.filters?.enhancedSkill) ? props.filters!.enhancedSkill.length : 0 }}개
        </p>
      </section>
    </div>

    <!-- ===== Row 2: 포지션(OF/IF/P&DH) | 연도 ===== -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[150px]">
      <!-- 포지션 -->
      <section class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 p-4 shadow-sm hover:shadow-md">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{{ fieldLabels['position'] }}</h3>

        <!-- 외야 -->
        <div class="mb-3">
          <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">외야</h4>
          <div class="grid grid-cols-3 gap-2">
            <button v-for="pos in ['LF','CF','RF']" :key="'of-'+pos"
                    @click="toggleFilter('position', pos)"
                    :class="['px-2 py-1.5 rounded-md text-sm font-bold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                       isSelected('position', pos) ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                                                   : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20']">
              {{ pos }}
            </button>
          </div>
        </div>

        <!-- 내야 -->
        <div class="mb-3">
          <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">내야</h4>
          <div class="grid grid-cols-5 gap-2">
            <button v-for="pos in ['1B','2B','SS','3B','C']" :key="'if-'+pos"
                    @click="toggleFilter('position', pos === '1B' ? 'B1' : pos === '2B' ? 'B2' : pos === '3B' ? 'B3' : pos)"
                    :class="['px-2 py-1.5 rounded-md text-sm font-bold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                       isSelected('position', (pos === '1B' ? 'B1' : pos === '2B' ? 'B2' : pos === '3B' ? 'B3' : pos)) ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                                                                                                                         : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20']">
              {{ pos }}
            </button>
          </div>
        </div>

        <!-- 투수/지명타자 -->
        <div>
          <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">투수 / 지명타자</h4>
          <div class="grid grid-cols-3 gap-2">
            <button v-for="pos in ['SP','RP','DH']" :key="'pd-'+pos"
                    @click="toggleFilter('position', pos)"
                    :class="['px-2 py-1.5 rounded-md text-sm font-bold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                       isSelected('position', pos) ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                                                   : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20']">
              {{ pos }}
            </button>
          </div>
        </div>
      </section>

      <!-- 연도 -->
      <section class="rounded-lg p-4 shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 flex flex-col">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{{ fieldLabels['year'] }}</h3>
        <div class="flex-1 overflow-y-auto max-h-108 rounded-lg border border-gray-200 dark:border-gray-700 p-2 bg-gray-50/80 dark:bg-gray-800/80">
          <div class="grid grid-cols-4 gap-3">
            <button
                v-for="year in yearOptions" :key="year"
                @click="toggleFilter('year', year)"
                :class="['px-2 py-1 rounded-md text-xs font-medium border transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                       isSelected('year', year) ? 'bg-blue-500 text-white border-blue-500 shadow'
                                                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20']">
              {{ year }}
            </button>
          </div>
        </div>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
          선택된 {{ fieldLabels['year'] }}: {{ Array.isArray(props.filters?.year) ? props.filters!.year.length : 0 }}개
        </p>
      </section>
    </div>

    <!-- ===== Row 3: 레어리티·등급 | 팀 ===== -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[150px]">
      <!-- 레어리티 + 등급 -->
      <section class="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 shadow-sm hover:shadow-md">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
          {{ fieldLabels['rarity'] }} · {{ fieldLabels['grade'] }}
        </h3>

        <!-- 레어도 -->
        <div class="flex gap-1.5">
          <button
              v-for="i in 6" :key="i"
              @click="update(rarityField!, i === props.filters[rarityField!] ? '' : i)"
              class="p-1.5 rounded-md transition-colors hover:bg-yellow-100/60 dark:hover:bg-yellow-900/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/60"
              :aria-pressed="i <= props.filters[rarityField!]"
              :title="`${i} Star`">
            <Star :class="i <= props.filters[rarityField!] ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'" class="w-5 h-5" fill="currentColor"/>
          </button>
        </div>

        <!-- 등급 아이콘 -->
        <div class="mt-4">
          <div class="mb-3 flex justify-end">
            <button
                @click="toggleAllGrades"
                class="px-3 py-1.5 text-sm font-medium rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
                :class="areAllGradesSelected
                ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100 dark:border-red-600 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/30'
                : 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 dark:border-blue-600 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30'">
              {{ areAllGradesSelected ? '전체 해제' : '전체 선택' }}
            </button>
          </div>

          <div class="grid grid-cols-5 gap-3">
            <button
                v-for="grade in visibleGrades" :key="grade"
                @click="toggleFilter('grade', grade)"
                class="relative rounded-md cursor-pointer flex items-center justify-center border transition-[filter,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60
                     bg-white/95 dark:bg-gray-900/90"
                :class="isSelected('grade', grade)
                ? 'border-blue-500 ring-1 ring-blue-300 shadow-sm'
                : 'border-gray-200 dark:border-gray-700 grayscale hover:grayscale-0 hover:brightness-95'">
              <img :src="`/assets/logos/grade/${grade}.png`" :alt="grade" class="h-auto w-20 object-contain" />
            </button>
          </div>
        </div>
      </section>

      <!-- 팀 -->
      <section class="rounded-lg p-4 shadow-sm hover:shadow-md border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95">
        <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">{{ fieldLabels['team'] }}</h3>

        <div class="mb-3 flex justify-end">
          <button
              @click="toggleAllTeams"
              class="px-3 py-1.5 text-sm font-medium rounded-md border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
              :class="areAllTeamsSelected
              ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100 dark:border-red-600 dark:text-red-400 dark:bg-red-900/20 dark:hover:bg-red-900/30'
              : 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 dark:border-blue-600 dark:text-blue-400 dark:bg-blue-900/20 dark:hover:bg-blue-900/30'">
            {{ areAllTeamsSelected ? '전체 해제' : '전체 선택' }}
          </button>
        </div>

        <div class="grid grid-cols-7 gap-2.5">
          <button
              v-for="team in props.filterOptions?.team ?? []"
              :key="team"
              @click="toggleFilter('team', team)"
              :title="team.toUpperCase()"
              class="relative p-1 rounded-md flex items-center justify-center border bg-white/95 dark:bg-gray-900/90 transition-[filter,border-color,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60"
              :class="[isSelected('team', team) ? 'border-blue-500 ring-1 ring-blue-300 shadow-sm' : 'border-gray-200 dark:border-gray-700 grayscale hover:grayscale-0 hover:brightness-95']">
            <img :src="teamLogos[team]" :alt="team" class="w-8 h-8 object-contain drop-shadow-sm" />
          </button>
        </div>
      </section>
    </div>

    <!-- ===== Row 4: 시너지 (전체폭) ===== -->
    <section class="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm">
      <label class="block text-xs font-semibold text-gray-600 dark:text-gray-300/90 mb-1">
        {{ fieldLabels['synergy'] }}
      </label>
      <div ref="wrapperRef" class="relative">
        <input
            v-model="searchInput"
            @focus="showSuggestions = true"
            @keydown.enter.prevent
            @keyup.enter.prevent="commitByEnter"
            @compositionstart="onCompositionStart"
            @compositionend="onCompositionEnd"
            placeholder="시너지 검색"
            class="w-full bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
        />
        <Search class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
        <!-- 자동완성 리스트 -->
        <ul v-if="showSuggestions && filteredSuggestions.length" class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-48 overflow-y-auto">
          <li v-for="suggestion in filteredSuggestions" :key="suggestion" @click="addTag(suggestion)" class="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700">
            {{ suggestion }}
          </li>
        </ul>
      </div>
      <!-- 선택된 태그 뱃지 -->
      <div class="flex flex-wrap gap-2 mt-2">
        <span v-for="tag in selectedTags" :key="tag" class="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 rounded-full">
          {{ tag }}
          <button @click="removeTag(tag)" class="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300">&times;</button>
        </span>
      </div>
    </section>
  </div>
</template>
<style scoped>
/* 작은 디테일 */
.drop-glow { filter: drop-shadow(0 0 6px rgba(250, 204, 21, 0.45)); }
/* 테마 전환 순간만 전체 트랜지션 비활성화 */
.theme-switching *, .theme-switching *::before, .theme-switching *::after { transition: none !important; animation: none !important; }
/* 스크롤바 통일 */
select::-webkit-scrollbar, .overflow-y-auto::-webkit-scrollbar { width: 8px; height: 8px; }
select::-webkit-scrollbar-track, .overflow-y-auto::-webkit-scrollbar-track { background: rgba(148,163,184,0.15); border-radius: 4px; }
select::-webkit-scrollbar-thumb, .overflow-y-auto::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.35); border-radius: 4px; }
select::-webkit-scrollbar-thumb:hover, .overflow-y-auto::-webkit-scrollbar-thumb:hover { background: rgba(100,116,139,0.55); }
/* 커서 */
button, select { cursor: pointer; }
input[type="text"] { cursor: text; }
/* 포커스 visible만 강조 (접근성) */
:focus { outline: none; }
/* 호버 보더 컬러 미세 업 */
input:hover, select:hover { border-color: #9ca3af; }
/* 라벨 컬러 부드럽게 */
.space-y-1 > label { transition: color .2s ease; }
/* 모션 감약 */
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; transform: none !important; }
}
</style>

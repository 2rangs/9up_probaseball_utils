<script setup lang="ts">
import { defineProps, defineEmits, computed, watch, onMounted, onBeforeUnmount, ref } from 'vue'
import { Star, Search, ChevronDown } from 'lucide-vue-next'
import type { PropType } from 'vue'

/* =========================
   Props / Emits
========================= */
const props = defineProps({
  tabKey: { type: String, default: 'Batters' }, // 탭 구분 키(Batters/Pitchers)
  allFields: Array as () => string[],
  selectFields: Array as () => string[],
  rarityField: String,
  filterOptions: Object as PropType<Record<string, string[]>>,
  fieldLabels: Object as PropType<Record<string, string>>,
  filters: Object as PropType<Record<string, any>>,
  // 자동완성 옵션
  synergyOptions: Array as () => string[] | undefined,
  nameOptions: Array as () => string[] | undefined,
})
const emit = defineEmits(['update:filters'])

/* =========================
   공통 토글/업데이트 (케이스 무시)
========================= */
const normVal = (v: unknown) => String(v ?? '').trim().toLowerCase()

const isSelected = (field: string, value: string) =>
  Array.isArray(props.filters?.[field]) &&
  props.filters![field].some((v: any) => normVal(v) === normVal(value))

const toggleFilter = (field: string, value: string) => {
  const picked: string[] = Array.isArray(props.filters?.[field]) ? [...props.filters![field]] : []
  const idx = picked.findIndex((v) => normVal(v) === normVal(value))
  if (idx !== -1) picked.splice(idx, 1)
  else picked.push(value)
  emit('update:filters', { ...(props.filters ?? {}), [field]: picked })
}

const update = (field: string, value: unknown) =>
  emit('update:filters', { ...(props.filters ?? {}), [field]: value })

/* =========================
   연도 옵션 (올해 제외)
========================= */
const currentYear = new Date().getFullYear()
const yearOptions = computed(() => {
  const years: string[] = []
  for (let y = currentYear - 1; y >= 1982; y--) years.push(String(y))
  return years
})

/* =========================
   포지션 / 등급 / 팀
========================= */
const gradeOrder = ['DGN','TOP','ACE','HIT','POS','GG','TEA','SEA','ROY','MMVP','ASG'] as const
const visibleGrades = computed(() =>
  gradeOrder.filter((g) => props.filterOptions?.grade?.includes(g))
)

const areAllGradesSelected = computed(
  () => visibleGrades.value.length > 0 && visibleGrades.value.every((g) => isSelected('grade', g))
)

/** ✅ 팀: ‘모두 선택된 경우’에만 true (선택 비었으면 false) */
const allTeamsSelected = computed(() => {
  const teams = props.filterOptions?.team ?? []
  if (!teams.length) return false
  const selArr: string[] = Array.isArray(props.filters?.team) ? props.filters!.team : []
  if (selArr.length === 0) return false
  const selSet = new Set(selArr.map(normVal))
  return teams.every(t => selSet.has(normVal(t)))
})

const toggleAllGrades = () => {
  if (!visibleGrades.value.length) return
  emit('update:filters', {
    ...(props.filters ?? {}),
    grade: areAllGradesSelected.value ? [] : [...visibleGrades.value]
  })
}

const toggleAllTeams = () => {
  const teams = props.filterOptions?.team ?? []
  if (!teams.length) return
  emit('update:filters', {
    ...(props.filters ?? {}),
    team: allTeamsSelected.value ? [] : [...teams]
  })
}

/** ✅ 팀 옵션 진입 시: 선택이 비어 있으면 “전체 선택”으로 초기화 */
watch(
  () => props.filterOptions?.team,
  (teams) => {
    if (!teams?.length) return
    const selected = props.filters?.team ?? []
    if (selected.length === 0) {
      emit('update:filters', { ...(props.filters ?? {}), team: [...teams] })
    }
  },
  { immediate: true }
)

/* =========================
   접힘 상태 (탭별로 보유 & 영구저장)
========================= */
type CollapsibleKey = 'skill' | 'enhancedSkill' | 'position' | 'year' | 'rgt'
type Collapses = Record<CollapsibleKey, boolean>

const DEFAULT_COLLAPSES: Collapses = {
  skill: false,
  enhancedSkill: false,
  position: false,
  year: false,
  rgt: false,
}

const LS_KEY = '9up.filter.collapses.v1'
const loadAllFromLS = (): Record<string, Collapses> => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}
const saveAllToLS = (obj: Record<string, Collapses>) =>
  localStorage.setItem(LS_KEY, JSON.stringify(obj))

const collapses = ref<Collapses>({ ...DEFAULT_COLLAPSES })
const setByTab = (tab: string) => {
  const all = loadAllFromLS()
  collapses.value = all[tab] ? { ...DEFAULT_COLLAPSES, ...all[tab] } : { ...DEFAULT_COLLAPSES }
}
const persistCurrent = () => {
  const all = loadAllFromLS()
  all[props.tabKey] = { ...collapses.value }
  saveAllToLS(all)
}
watch(() => props.tabKey, (t) => setByTab(t), { immediate: true })
watch(collapses, persistCurrent, { deep: true })
const toggleCollapse = (k: CollapsibleKey) => { collapses.value[k] = !collapses.value[k] }

/* =========================
   선택 개수/데이터 보유 여부
========================= */
const selectedCount = (field: 'skill' | 'enhancedSkill') =>
  Array.isArray(props.filters?.[field]) ? props.filters![field].length : 0
const hasSkills = computed(() => (props.filterOptions?.skill?.length ?? 0) > 0)
const hasEnhancedSkills = computed(() => (props.filterOptions?.enhancedSkill?.length ?? 0) > 0)

/* =========================
   팀 로고 / 스킬 아이콘
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
  nanum: '/assets/logos/symbol/emblem_s_99_nanum.png'
}

const normalSkillData = ref<any[]>([])
const enhancedSkillData = ref<any[]>([])
onMounted(async () => {
  const [n, e] = await Promise.all([
    fetch('/DB/normal_skill.json'),
    fetch('/DB/enhanced_skill.json')
  ])
  normalSkillData.value = await n.json()
  enhancedSkillData.value = await e.json()
})

const matchSkillInfo = (skill: string, type: string) => {
  if (type === 'normal') return normalSkillData.value.find((s) => s.skill === skill)?.image || ''
  if (type === 'enhanced' || type === 'enhanced:GG') return enhancedSkillData.value.find((s) => s.enhanced_skill === skill)?.image || ''
  return ''
}

/* =========================
   이름 입력 (부분 일치) + 자동완성
========================= */
const nameInput = ref('')
const nameWrapperRef = ref<HTMLElement | null>(null)
const showNameSuggestions = ref(false)
const nameActiveIndex = ref(-1)
const norm = (s: string) => (s ?? '').toLowerCase().trim()

watch(() => props.filters?.name, (v) => { nameInput.value = (v ?? '').toString() }, { immediate: true })
watch(nameInput, (v) => emit('update:filters', { ...(props.filters ?? {}), name: (v ?? '').toString() }))

const filteredNameSuggestions = computed(() => {
  const q = norm(nameInput.value)
  const src = Array.from(new Set((props.nameOptions ?? []).filter(Boolean)))
  const list = q ? src.filter(n => n.toLowerCase().includes(q)) : src
  return list.slice(0, 100)
})
const pickName = (val: string) => { nameInput.value = val; showNameSuggestions.value = false }
const moveName = (delta: number) => {
  if (!showNameSuggestions.value || filteredNameSuggestions.value.length === 0) return
  const n = filteredNameSuggestions.value.length
  nameActiveIndex.value = ((nameActiveIndex.value + delta + n) % n)
}
const onNameEnter = () => {
  if (showNameSuggestions.value && nameActiveIndex.value >= 0) pickName(filteredNameSuggestions.value[nameActiveIndex.value])
}

/* =========================
   시너지 자동완성 & 태그 (정확 일치 AND)
========================= */
const searchInput = ref('')
const showSuggestions = ref(false)
const isComposing = ref(false)
const wrapperRef = ref<HTMLElement | null>(null)
const selectedTags = ref<string[]>([])
const synergyActiveIndex = ref(-1)

const filteredSuggestions = computed(() => {
  const q = norm(searchInput.value)
  const picked = new Set(selectedTags.value.map(norm))
  return (props.synergyOptions ?? [])
    .filter((s) => !picked.has(norm(s)))
    .filter((s) => (q ? norm(s).includes(q) : true))
    .slice(0, 100)
})

const syncFromParent = () => {
  const src = props.filters?.synergy
  selectedTags.value = Array.isArray(src) ? [...new Set(src.filter(Boolean).map(String))] : []
}
watch(() => props.filters, syncFromParent, { immediate: true, deep: true })

const pushToParent = () => {
  const next = { ...(props.filters ?? {}) }
  next.synergy = [...selectedTags.value]
  emit('update:filters', next)
}
const addTag = (v: string) => {
  const val = (v ?? '').trim()
  if (!val) return
  if (!selectedTags.value.map(norm).includes(norm(val))) {
    selectedTags.value.push(val)
    pushToParent()
  }
  searchInput.value = ''
  showSuggestions.value = true
  synergyActiveIndex.value = -1
}
const removeTag = (v: string) => {
  selectedTags.value = selectedTags.value.filter((t) => norm(t) !== norm(v))
  pushToParent()
}
const moveSynergy = (delta: number) => {
  if (!showSuggestions.value || filteredSuggestions.value.length === 0) return
  const n = filteredSuggestions.value.length
  synergyActiveIndex.value = ((synergyActiveIndex.value + delta + n) % n)
}
const commitByEnter = () => {
  if (isComposing.value) return
  if (showSuggestions.value && synergyActiveIndex.value >= 0) return addTag(filteredSuggestions.value[synergyActiveIndex.value])
  if (searchInput.value.trim()) addTag(searchInput.value)
  else if (filteredSuggestions.value.length) addTag(filteredSuggestions.value[0])
}
const onCompositionStart = () => (isComposing.value = true)
const onCompositionEnd = () => (isComposing.value = false)
const onInputDelimit = (e: Event) => {
  const v = (e.target as HTMLInputElement).value
  const parts = v.split(/[,;]+|\s{2,}/).map((s) => s.trim()).filter(Boolean)
  if (parts.length > 1) {
    parts.forEach(addTag)
    searchInput.value = ''
  }
}
const onSynergyBackspace = (e: KeyboardEvent) => {
  if ((e.target as HTMLInputElement).value === '' && selectedTags.value.length > 0) {
    removeTag(selectedTags.value[selectedTags.value.length - 1])
  }
}

/* =========================
   바깥 클릭 → 드롭다운 닫기
========================= */
const onDocClick = (ev: MouseEvent) => {
  const t = ev.target as Node
  if (nameWrapperRef.value && !nameWrapperRef.value.contains(t)) showNameSuggestions.value = false
  if (wrapperRef.value && !wrapperRef.value.contains(t)) showSuggestions.value = false
}
onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div class="mx-auto max-w-[1280px] p-2 mt-2 space-y-4 md:space-y-6">

    <!-- ===== 본문: 2열 그리드 (좌: 스킬들, 우: 포지션/연도) ===== -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">

      <!-- === LEFT COLUMN: 스킬 + 강화 스킬 === -->
      <div class="space-y-4">
        <!-- 스킬 -->
        <section class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 shadow-sm">
          <button type="button" class="w-full px-4 py-3 flex items-center justify-between"
                  @click="toggleCollapse('skill')" :aria-expanded="collapses.skill">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200">{{ fieldLabels?.skill || '스킬' }}</h3>
            <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>선택 {{ selectedCount('skill') }}개</span>
              <ChevronDown class="w-4 h-4 transition-transform" :class="collapses.skill ? 'rotate-180' : ''"/>
            </div>
          </button>

          <div v-if="collapses.skill" class="p-4 pt-0">
            <div v-if="hasSkills"
                 class="overflow-y-auto overscroll-contain rounded-lg border border-gray-200 dark:border-gray-700 p-2 bg-gray-50/80 dark:bg-gray-800/80 max-h-56">
              <div class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-1.5 sm:gap-2">
                <button
                  v-for="skill in props.filterOptions?.skill ?? []" :key="skill" :title="skill"
                  @click="toggleFilter('skill', skill)"
                  class="group relative inline-flex flex-col items-center justify-center gap-2 rounded-xl border py-2 text-xs font-medium select-none
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-[border-color,filter,box-shadow] duration-100
                         w-[70px] md:w-[74px] lg:w-[78px]"
                  :class="isSelected('skill', skill)
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600'">
                  <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-lg"
                       :class="['bg-gray-50 dark:bg-gray-700', isSelected('skill', skill) ? 'ring-2 ring-blue-400 bg-white/10' : '', `bg-${matchSkillInfo(skill,'normal')}`]"/>
                  <span class="block w-full text-center font-semibold truncate">{{ skill }}</span>
                </button>
              </div>
            </div>
            <div v-else class="px-4 py-8 text-sm text-center text-gray-400 dark:text-gray-500">스킬 데이터가 없습니다.</div>
          </div>
        </section>

        <!-- 강화 스킬 -->
        <section class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 shadow-sm">
          <button type="button" class="w-full px-4 py-3 flex items-center justify-between"
                  @click="toggleCollapse('enhancedSkill')" :aria-expanded="collapses.enhancedSkill">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200">{{ fieldLabels?.enhancedSkill || '강화 스킬' }}</h3>
            <div class="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              <span>선택 {{ selectedCount('enhancedSkill') }}개</span>
              <ChevronDown class="w-4 h-4 transition-transform" :class="collapses.enhancedSkill ? 'rotate-180' : ''"/>
            </div>
          </button>

          <div v-if="collapses.enhancedSkill" class="p-4 pt-0">
            <div v-if="hasEnhancedSkills"
                 class="overflow-y-auto overscroll-contain rounded-lg border border-gray-200 dark:border-gray-700 p-2 bg-gray-50/80 dark:bg-gray-800/80 max-h-56">
              <div class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-1.5 sm:gap-2">
                <button
                  v-for="skill in props.filterOptions?.enhancedSkill ?? []" :key="skill" :title="skill"
                  @click="toggleFilter('enhancedSkill', skill)"
                  class="group relative inline-flex flex-col items-center justify-center gap-2 rounded-xl border py-2 text-xs font-medium select-none
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 transition-[border-color,filter,box-shadow] duration-100
                         w-[70px] md:w-[74px] lg:w-[78px]"
                  :class="isSelected('enhancedSkill', skill)
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600'">
                  <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-lg"
                       :class="['bg-gray-50 dark:bg-gray-700', isSelected('enhancedSkill', skill) ? 'ring-2 ring-blue-400 bg-white/10' : '', `bg-${matchSkillInfo(skill,'enhanced')}`]"/>
                  <span class="block w-full text-center font-semibold">{{ skill }}</span>
                </button>
              </div>
            </div>
            <div v-else class="px-4 py-8 text-sm text-center text-gray-400 dark:text-gray-500">강화 스킬 데이터가 없습니다.</div>
          </div>
        </section>
      </div>

      <!-- === RIGHT COLUMN: 포지션 + 연도 === -->
      <div class="space-y-4">
        <!-- 포지션 -->
        <section class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 shadow-sm">
          <button type="button" class="w-full px-4 py-3 flex items-center justify-between"
                  @click="toggleCollapse('position')" :aria-expanded="collapses.position">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200">{{ fieldLabels?.position || '포지션' }}</h3>
            <ChevronDown class="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform" :class="collapses.position ? 'rotate-180' : ''"/>
          </button>

          <div v-if="collapses.position" class="px-4 pb-4 space-y-4 sm:space-y-5">
            <div>
              <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">외야수 / 지명타자</h4>
              <div class="grid grid-cols-4 gap-2 sm:gap-4">
                <button v-for="pos in ['LF','CF','RF','DH']" :key="'of-'+pos"
                        @click="toggleFilter('position', pos)"
                        :class="['px-2 py-1.5 rounded-md text-sm font-bold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                                 isSelected('position', pos) ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                                                             : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20']">
                  {{ pos }}
                </button>
              </div>
            </div>

            <div>
              <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">내야</h4>
              <div class="grid grid-cols-5 gap-2 sm:gap-3">
                <button v-for="pos in ['1B','2B','SS','3B','C']" :key="'if-'+pos"
                        @click="toggleFilter('position', pos === '1B' ? 'B1' : pos === '2B' ? 'B2' : pos === '3B' ? 'B3' : pos)"
                        :class="['px-2 py-1.5 rounded-md text-sm font-bold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                                 isSelected('position', (pos === '1B' ? 'B1' : pos === '2B' ? 'B2' : pos === '3B' ? 'B3' : pos)) ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                                                                                                                                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20']">
                  {{ pos }}
                </button>
              </div>
            </div>

            <div>
              <h4 class="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">선발투수 / 중간계투</h4>
              <div class="grid grid-cols-3 gap-2 sm:gap-3">
                <button v-for="pos in ['SP','RP']" :key="'pd-'+pos"
                        @click="toggleFilter('position', pos)"
                        :class="['px-2 py-1.5 rounded-md text-sm font-bold border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                                 isSelected('position', pos) ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                                                             : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20']">
                  {{ pos }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- 연도 -->
        <section class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 shadow-sm">
          <button type="button" class="w-full px-4 py-3 flex items-center justify-between"
                  @click="toggleCollapse('year')" :aria-expanded="collapses.year">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200">{{ fieldLabels?.year || '연도' }}</h3>
            <ChevronDown class="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform" :class="collapses.year ? 'rotate-180' : ''"/>
          </button>

          <div v-if="collapses.year" class="flex-1 overflow-y-auto m-4 mt-2 rounded-lg border border-gray-200 dark:border-gray-700 p-2 bg-gray-50/80 dark:bg-gray-800/80">
            <div class="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2">
              <button
                v-for="year in yearOptions" :key="year"
                @click="toggleFilter('year', year)"
                :class="[
                  'inline-flex items-center justify-center px-2.5 py-1.5 rounded-md text-xs font-medium text-center border transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60',
                  isSelected('year', year)
                    ? 'bg-blue-500 text-white border-blue-500 shadow'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                ]"
              >
                {{ year }}
              </button>
            </div>
          </div>
        </section>
      </div>
        <!-- === FULL-WIDTH: 레어도 · 등급 · 팀 (3행, 반응형) === -->
<section class="col-span-full md:col-span-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 shadow-sm">
  <button
    type="button"
    class="w-full px-3 md:px-4 py-3 flex items-center justify-between"
    @click="toggleCollapse('rgt')"
    :aria-expanded="collapses.rgt"
  >
    <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-200">
      {{ (fieldLabels?.rarity || '레어도') }} · {{ (fieldLabels?.grade || '등급') }} · {{ (fieldLabels?.team || '팀') }}
    </h3>
    <ChevronDown
      class="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform"
      :class="collapses.rgt ? 'rotate-180' : ''"
    />
  </button>

<div v-if="collapses.rgt" class="p-2 sm:p-3 md:p-4 pt-0">
    <section class="rounded-lg bg-white/95 dark:bg-gray-900/95">
      <div class="divide-y divide-gray-200 dark:divide-gray-800">

        <!-- Row 1: 레어도 -->
        <div class="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-2.5 md:gap-3 px-3 sm:px-3.5 md:px-4 py-3 sm:py-2.5 md:py-3">
          <span class="text-xs sm:text-[11px] md:text-xs font-semibold text-gray-600 dark:text-gray-300/90 sm:w-12 md:w-14 leading-tight">
            {{ fieldLabels?.rarity || '레어도' }}
          </span>

          <!-- 모바일: 가로 스와이프, 스냅, 페이드 -->
          <div class="min-w-0 overflow-x-auto whitespace-nowrap no-scrollbar scroll-fade-x snap-x snap-mandatory touch-pan-x overscroll-x-contain -mx-1.5 sm:-mx-1 px-1.5 sm:px-1">
            <div class="inline-flex items-center gap-2 sm:gap-1.5 md:gap-2">
              <button
                v-for="i in 6" :key="'star-'+i"
                @click="update(props.rarityField!, i === (props.filters?.[props.rarityField!] ?? 0) ? '' : i)"
                class="p-2 sm:p-1.5 md:p-1.5 rounded-lg sm:rounded-md transition-colors hover:bg-yellow-100/60 dark:hover:bg-yellow-900/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/60 snap-start touch-manipulation"
                :aria-pressed="i <= (props.filters?.[props.rarityField!] ?? 0)"
                :title="`${i} Star`"
              >
                <Star
                  :class="i <= (props.filters?.[props.rarityField!] ?? 0) ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600'"
                  class="w-5 h-5 sm:w-4 sm:h-4 md:w-5 md:h-5"
                  fill="currentColor"
                />
              </button>
            </div>
          </div>

          <button
            v-if="props.filters?.[props.rarityField!]"
            @click="update(props.rarityField!, '')"
            class="order-3 sm:order-none justify-self-end sm:justify-self-end md:justify-self-end mt-2 sm:mt-1 md:mt-0 ml-0 md:ml-1 px-3 sm:px-2 py-1.5 sm:py-1 text-xs rounded-lg sm:rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 touch-manipulation"
          >
            초기화
          </button>
        </div>

        <!-- Row 2: 등급 -->
        <div class="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] md:grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-2.5 md:gap-3 px-3 sm:px-3.5 md:px-4 py-3 sm:py-2.5 md:py-3">
          <span class="text-xs sm:text-[11px] md:text-xs font-semibold text-gray-600 dark:text-gray-300/90 sm:w-12 md:w-14 leading-tight">
            {{ fieldLabels?.grade || '등급' }}
          </span>

          <div class="min-w-0 overflow-x-auto whitespace-nowrap no-scrollbar scroll-fade-x snap-x snap-mandatory touch-pan-x overscroll-x-contain -mx-1.5 sm:-mx-1 px-1.5 sm:px-1">
            <div class="inline-flex items-center gap-2 sm:gap-1.5 md:gap-2">
              <button
                v-for="grade in visibleGrades" :key="grade"
                @click="toggleFilter('grade', grade)"
                class="inline-flex items-center justify-center rounded-lg sm:rounded-md border bg-white/95 dark:bg-gray-900/90 transition-[filter,border-color,box-shadow] focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60 snap-start touch-manipulation"
                :class="isSelected('grade', grade)
                  ? 'border-blue-500 ring-1 ring-blue-300 shadow-sm'
                  : 'border-gray-200 dark:border-gray-700 grayscale hover:grayscale-0 hover:brightness-95'"
              >
                <!-- 모바일 기본 더 크게, 태블릿에서 중간, 데스크톱에서 더 크게 -->
                <img :src="`/assets/logos/grade/${grade}.png`" :alt="grade" class="w-16" />
              </button>
            </div>
          </div>

          <button
            @click="toggleAllGrades"
            class="order-3 sm:order-none justify-self-end mt-2 sm:mt-1 md:mt-0 px-3 sm:px-2 py-1.5 sm:py-1 text-xs rounded-lg sm:rounded-md border transition-colors touch-manipulation"
            :class="areAllGradesSelected
              ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100 dark:border-red-600 dark:text-red-400 dark:bg-red-900/20'
              : 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 dark:border-blue-600 dark:text-blue-400 dark:bg-blue-900/20'"
          >
            {{ areAllGradesSelected ? '해제' : '전체' }}
          </button>
        </div>

        <!-- Row 3: 팀 (responsive) -->
        <div class="px-3 sm:px-3.5 md:px-4 py-3 sm:py-2.5 md:py-3">
          <!-- 모바일/태블릿: 수직 레이아웃 -->
          <div class="md:hidden space-y-3">
            <!-- 라벨 -->
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-gray-600 dark:text-gray-300/90">
                {{ fieldLabels?.team || '팀' }}
              </span>
              <button
                @click="toggleAllTeams"
                class="px-3 py-1.5 text-xs rounded-lg border transition-colors touch-manipulation"
                :class="allTeamsSelected
                  ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100 dark:border-red-600 dark:text-red-400 dark:bg-red-900/20'
                  : 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 dark:border-blue-600 dark:text-blue-400 dark:bg-blue-900/20'"
              >
                {{ allTeamsSelected ? '해제' : '전체' }}
              </button>
            </div>
            
            <!-- 팀 그리드 -->
            <div class="grid grid-cols-5 gap-2">
              <button
                v-for="team in props.filterOptions?.team ?? []"
                :key="team"
                @click="toggleFilter('team', team)"
                :title="team.toUpperCase()"
                class="aspect-square p-1.5 rounded-lg border bg-white/95 dark:bg-gray-900/90
                       transition-[filter,border-color,box-shadow]
                       focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60
                       touch-manipulation"
                :class="isSelected('team', team)
                  ? 'border-blue-500 ring-1 ring-blue-300 shadow-sm'
                  : 'border-gray-200 dark:border-gray-700 grayscale hover:grayscale-0 hover:brightness-95'"
              >
                <img :src="teamLogos[team]" :alt="team"
                     class="w-full h-full object-contain drop-shadow-sm" />
              </button>
            </div>
          </div>

          <!-- 데스크톱: 기존 가로 레이아웃 -->
          <div class="hidden md:grid md:grid-cols-[auto_1fr_auto] items-center gap-3">
            <span class="text-xs font-semibold text-gray-600 dark:text-gray-300/90 w-14">
              {{ fieldLabels?.team || '팀' }}
            </span>

            <div class="min-w-0 overflow-x-auto whitespace-nowrap no-scrollbar scroll-fade-x snap-x snap-mandatory touch-pan-x overscroll-x-contain -mx-1 px-1">
              <div class="inline-flex items-center gap-2">
                <button
                  v-for="team in props.filterOptions?.team ?? []"
                  :key="team"
                  @click="toggleFilter('team', team)"
                  :title="team.toUpperCase()"
                  class="inline-flex p-1 rounded-md items-center justify-center border
                         bg-white/95 dark:bg-gray-900/90
                         transition-[filter,border-color,box-shadow]
                         focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400/60
                         snap-start"
                  :class="isSelected('team', team)
                    ? 'border-blue-500 ring-1 ring-blue-300 shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 grayscale hover:grayscale-0 hover:brightness-95'"
                >
                  <img :src="teamLogos[team]" :alt="team"
                       class="w-8 h-8 object-contain drop-shadow-sm" />
                </button>
              </div>
            </div>

            <button
              @click="toggleAllTeams"
              class="px-2 py-1 text-xs rounded-md border transition-colors"
              :class="allTeamsSelected
                ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100 dark:border-red-600 dark:text-red-400 dark:bg-red-900/20'
                : 'border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 dark:border-blue-600 dark:text-blue-400 dark:bg-blue-900/20'"
            >
              {{ allTeamsSelected ? '해제' : '전체' }}
            </button>
          </div>
        </div>

      </div>
    </section>
  </div>
</section>


    </div> <!-- /grid -->
    <!-- ===== Toolbar: 이름 · 시너지 ===== -->
    <section class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 shadow-sm p-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- 이름 -->
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-300/90 mb-1">
            {{ fieldLabels?.name || '이름' }} (부분 일치)
          </label>
          <div ref="nameWrapperRef" class="relative">
            <input
              v-model="nameInput"
              @focus="showNameSuggestions = true"
              @keydown.down.prevent="moveName(1)"
              @keydown.up.prevent="moveName(-1)"
              @keydown.enter.prevent="onNameEnter"
              @keydown.esc="showNameSuggestions = false"
              placeholder="선수명을 입력해 주세요."
              class="w-full bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
              role="combobox" aria-expanded="showNameSuggestions" aria-controls="name-suggest"
            />
            <Search class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />
            <ul
              v-if="showNameSuggestions && filteredNameSuggestions.length"
              id="name-suggest"
              class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-56 md:max-h-64 overflow-y-auto"
              role="listbox"
            >
              <li
                v-for="(suggestion, idx) in filteredNameSuggestions"
                :key="suggestion"
                @mousedown.prevent="pickName(suggestion)"
                @mouseenter="nameActiveIndex = idx"
                class="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                :class="idx === nameActiveIndex ? 'bg-gray-100 dark:bg-gray-700' : ''"
                role="option"
                :aria-selected="idx === nameActiveIndex"
              >
                {{ suggestion }}
              </li>
            </ul>
          </div>
        </div>

        <!-- 시너지 -->
        <div>
          <label class="block text-xs font-semibold text-gray-600 dark:text-gray-300/90 mb-1">
            {{ fieldLabels?.synergy || '시너지' }} (정확 일치 AND)
          </label>
          <div ref="wrapperRef" class="relative">
            <input
              v-model="searchInput"
              @input="onInputDelimit"
              @focus="showSuggestions = true"
              @keydown.down.prevent="moveSynergy(1)"
              @keydown.up.prevent="moveSynergy(-1)"
              @keydown.enter.prevent="commitByEnter"
              @keydown.esc="showSuggestions = false"
              @keydown.backspace="onSynergyBackspace"
              @compositionstart="onCompositionStart"
              @compositionend="onCompositionEnd"
              placeholder="시너지를 입력해 주세요."
              class="w-full bg-white/90 dark:bg-gray-900/90 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 pr-10 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500"
              role="combobox" aria-expanded="showSuggestions" aria-controls="syn-suggest"
            />
            <Search class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500 pointer-events-none" />

            <ul
              v-if="showSuggestions && filteredSuggestions.length"
              id="syn-suggest"
              class="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-56 md:max-h-64 overflow-y-auto"
              role="listbox"
            >
              <li
                v-for="(suggestion, idx) in filteredSuggestions"
                :key="suggestion"
                @mousedown.prevent="addTag(suggestion)"
                @mouseenter="synergyActiveIndex = idx"
                class="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                :class="idx === synergyActiveIndex ? 'bg-gray-100 dark:bg-gray-700' : ''"
                role="option"
                :aria-selected="idx === synergyActiveIndex"
              >
                {{ suggestion }}
              </li>
            </ul>
          </div>

          <!-- 태그 뱃지 -->
          <div class="flex flex-wrap gap-2 mt-2">
            <span
              v-for="tag in selectedTags" :key="tag"
              class="flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 rounded-full"
            >
              {{ tag }}
              <button @click="removeTag(tag)" class="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300" aria-label="태그 제거">&times;</button>
            </span>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>





<style scoped>
/* 아코디언 트랜지션 */
.acc-enter-active, .acc-leave-active {
  transition: transform .15s ease, opacity .15s ease;
  transform-origin: top;
}
.acc-enter-from, .acc-leave-to {
  opacity: 0;
  transform: scaleY(.98);
}
</style>


<style scoped>
.acc-enter-active, .acc-leave-active {
  transition: transform .15s ease, opacity .15s ease;
  transform-origin: top;
}
.acc-enter-from, .acc-leave-to {
  opacity: 0;
  transform: scaleY(.98);
}
/* ===== 작은 디테일들: 대비/그림자/애니 ===== */
.drop-glow {
  filter: drop-shadow(0 0 6px rgba(250, 204, 21, 0.45));
}
/* 전환 순간만 전체 트랜지션 비활성화 */
.theme-switching *, .theme-switching *::before, .theme-switching *::after {
  transition: none !important;
  animation: none !important;
}

/* 스크롤바 통일 */
select::-webkit-scrollbar,
.overflow-y-auto::-webkit-scrollbar { width: 8px; height: 8px; }
select::-webkit-scrollbar-track,
.overflow-y-auto::-webkit-scrollbar-track { background: rgba(148,163,184,0.15); border-radius: 4px; }
select::-webkit-scrollbar-thumb,
.overflow-y-auto::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.35); border-radius: 4px; }
select::-webkit-scrollbar-thumb:hover,
.overflow-y-auto::-webkit-scrollbar-thumb:hover { background: rgba(100,116,139,0.55); }

/* 커서 */
button, select { cursor: pointer; }
input[type="text"] { cursor: text; }

/* 포커스 visible만 강조 (접근성) */
:focus { outline: none; }

/* 호버 보더 컬러 미세 업 */
input:hover, select:hover { border-color: #9ca3af; }

/* 라벨 컬러 부드럽게 */
.space-y-1 > label { transition: color .2s ease; }

/* 모션 감약 사용자의 경우 전환 제거 */
@media (prefers-reduced-motion: reduce) {
  * { transition: none !important; transform: none !important; }
}
</style>

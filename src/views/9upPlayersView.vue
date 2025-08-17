<script setup lang="ts">
import { ref, computed, onMounted, watch, defineExpose } from 'vue'
import Papa from 'papaparse'
import PlayerTable from '@/components/table.vue'
import FilterPanel from '@/components/FilterPanel.vue'
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-vue-next'

/* =========================
   Tabs / State
========================= */
const tabs = ['Batters', 'Pitchers'] as const
const tabLabels: Record<string, string> = { Batters: '타자', Pitchers: '투수' }
const selectedTab = ref<typeof tabs[number]>('Batters')

const players = ref<Record<string, any>[]>([])
const selectedPlayer = ref<null | Record<string, any>>(null)
const filters = ref<Record<string, any>>({})

/* =========================
   Pagination (state)
========================= */
const currentPage = ref(1)
const pageSize = 20

/* =========================
   Autocomplete options
========================= */
const nameOptions = computed(() =>
  Array.from(new Set(players.value.map(p => String(p.name || '').trim()))).filter(Boolean)
)
const synergyOptions = ref<string[]>([])

/* =========================
   Field definitions
========================= */
const inputFields = ['name', 'team', 'year', 'skill', 'synergy'] as const
const rarityField = 'rarity'
const fieldLabels: Record<string, string> = {
  grade: '등급',
  rarity: '레어도',
  name: '이름',
  team: '팀',
  year: '연도',
  position: '포지션',
  handType: '투타',
  pitchingType: '투구 폼',
  battingHand: '타격 유형',
  throwHand: '투구 유형',
  skill: '스킬',
  synergy: '시너지',
  enhancedSkill: '강화 스킬',
  search: '이름/시너지 검색'
}

const selectFields = computed(() => {
  const common = ['grade', 'position', 'throwHand', 'skill', 'search', 'enhancedSkill'] as const
  return selectedTab.value === 'Pitchers'
    ? [...common, 'pitchingType']
    : [...common, 'battingHand']
})
const allFields = computed(() => [...inputFields, ...selectFields.value, rarityField])

/* =========================
   Table Columns
========================= */
const columns = ref([
  'grade', 'rarity', 'name', 'team', 'year', 'position', 'handType', 'pitchingType', 'synergy', 'open'
])

/* =========================
   Helpers
========================= */
const toCsvArray = (v: unknown) => {
  if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean)
  if (typeof v === 'string') {
    return v
      .split(/[,\u3001;、]+/)
      .map(s => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
  }
  return [String(v ?? '').trim()].filter(Boolean)
}

const toCsvArrayNoComma = (v: unknown) => {
  if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean)
  if (typeof v === 'string') {
    const t = v.trim()
    if (t.startsWith('[') && t.endsWith(']')) {
      try {
        const parsed = JSON.parse(t)
        return Array.isArray(parsed) ? parsed.map((x:any)=>String(x).trim()).filter(Boolean) : [t]
      } catch {}
    }
    return v
      .split(/[\u3001;、;]+/)
      .map(s => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean)
  }
  return [String(v ?? '').trim()].filter(Boolean)
}

const parseJsonArray = (v: unknown) => {
  try {
    if (typeof v === 'string') {
      const parsed = JSON.parse(v)
      return Array.isArray(parsed) ? parsed : [parsed]
    }
    return Array.isArray(v) ? v : [v]
  } catch {
    return []
  }
}

const lc = (s: unknown) => String(s ?? '').toLowerCase()
const normText = (s: unknown) =>
  String(s ?? '')
    .normalize('NFKC')
    .replace(/\u200B|\u200C|\u200D|\u2060/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

const dedupeCaseInsensitive = (list: string[]) => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const s of list) {
    const key = s.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      out.push(s)
    }
  }
  return out
}

/* =========================
   Synergy options loader
========================= */
async function loadSynergyOptions() {
  try {
    const res = await fetch('/DB/synergys.json')
    if (res.ok) {
      const json = await res.json()
      const arr: string[] = Array.isArray(json)
        ? json.map((x: any) => (typeof x === 'string' ? x : x?.synergy)).filter(Boolean)
        : []
      synergyOptions.value = dedupeCaseInsensitive(arr.map(s => String(s).trim()))
        .sort((a, b) => a.localeCompare(b))
      return
    }
  } catch {}

  // fallback: CSV에서 추출
  const tokens: string[] = []
  for (const p of players.value) toCsvArray(p.synergy).forEach(t => tokens.push(String(t)))
  synergyOptions.value = dedupeCaseInsensitive(tokens.map(s => s.trim()))
    .sort((a, b) => a.localeCompare(b))
}

/* =========================
   Filter Options
========================= */
const filterOptions = computed(() => {
  const options: Record<string, Set<string>> = {}
  const fieldsToScan = [...selectFields.value, 'team', 'grade', 'skill'] as const

  fieldsToScan.forEach(field => {
    options[field] = new Set<string>()
    players.value.forEach(p => {
      const raw = p[field as string]
      if (raw == null || raw === '') return

      if (field === 'position') {
        parseJsonArray(raw).forEach(val => options[field].add(String(val)))
      } else if (field === 'enhancedSkill') {
        toCsvArrayNoComma(raw).forEach(v => options[field].add(v))
      } else {
        toCsvArray(raw).forEach(val => options[field].add(val))
      }
    })
  })

  const searchSet = new Set<string>()
  players.value.forEach(p => {
    if (p.name) searchSet.add(String(p.name).trim())
    toCsvArray(p.synergy).forEach(v => searchSet.add(v))
    toCsvArray(p.team).forEach(v => searchSet.add(v))
    toCsvArray(p.skill).forEach(v => searchSet.add(v))
  })
  options['searchSuggestions'] = searchSet

  return Object.fromEntries(
    Object.entries(options).map(([field, set]) => [field, [...set].sort((a, b) => a.localeCompare(b))])
  )
})

/* =========================
   Preprocessed players
========================= */
type Prepared = {
  raw: Record<string, any>
  nameNorm: string
  teamLc: string[]
  skillLc: string[]
  enhancedSkillLc: string[]
  positionLc: string[]
  yearsNum: number[]
  synergyNormSet: Set<string>
}

const preparedPlayers = computed<Prepared[]>(() =>
  players.value.map((p) => ({
    raw: p,
    nameNorm: normText(p.name),
    teamLc: toCsvArray(p.team).map(lc),
    skillLc: toCsvArray(p.skill).map(lc),
    enhancedSkillLc: toCsvArrayNoComma(p.enhancedSkill).map(lc),
    positionLc: parseJsonArray(p.position).map(lc),
    yearsNum: parseJsonArray(p.year).map((n) => Number(n)).filter((n) => !Number.isNaN(n)),
    synergyNormSet: new Set(toCsvArray(p.synergy).map(normText)),
  }))
)

/* =========================
   Filtering
========================= */
const filteredPlayers = computed(() => {
  return preparedPlayers.value.filter(pp => {
    const p = pp.raw

    return allFields.value.every((field) => {
      const selected = filters.value[field]

      if (!selected || (Array.isArray(selected) && selected.length === 0)) return true

      if (field === rarityField) {
        return Number(p[field]) === Number(selected)
      }

      if (field === 'team') {
        return (selected as string[]).some(sel => pp.teamLc.includes(lc(sel)))
      }

      if (field === 'year') {
        return (selected as string[]).every(sel => pp.yearsNum.includes(Number(sel)))
      }

      if (field === 'skill') {
        return (selected as string[]).every(sel => pp.skillLc.includes(lc(sel)))
      }

      if (field === 'enhancedSkill') {
        return (selected as string[]).every(sel => pp.enhancedSkillLc.includes(lc(sel)))
      }

      if (field === 'position') {
        return (selected as string[]).every(sel => pp.positionLc.includes(lc(sel)))
      }

      if (field === 'name') {
        const want = normText(selected)
        return want === '' ? true : pp.nameNorm.includes(want)
      }

      if (field === 'synergy') {
        const terms = Array.isArray(selected)
          ? (selected as string[]).map(normText)
          : String(selected).split(/[,\s]+/).filter(Boolean).map(normText)

        if (terms.length === 0) return true
        return terms.every(term => pp.synergyNormSet.has(term))
      }

      if (Array.isArray(selected)) {
        return (selected as unknown[]).map(String).includes(String(p[field]))
      }
      return String(p[field]) === String(selected)
    })
  }).map(pp => pp.raw)
})

/* =========================
   Pagination (derived + helpers)
========================= */
const totalCount = computed(() => filteredPlayers.value.length)     // ⬅ 필터 적용 후 총 개수
const totalAll   = computed(() => players.value.length)             // ⬅ 필터 무시(현재 탭 데이터 전체) 총 개수

const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize)))
const paginatedPlayers = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredPlayers.value.slice(start, start + pageSize)
})

const pageStartIndex = computed(() => Math.max(0, (currentPage.value - 1) * pageSize))
const pageEndIndex = computed(() =>
  Math.min(pageStartIndex.value + paginatedPlayers.value.length, totalCount.value)
)

const page = computed({
  get: () => currentPage.value,
  set: (v: number) => { currentPage.value = v }
})

function goToPage(pn: number) {
  if (!Number.isFinite(pn)) return
  const max = Math.max(1, totalPages.value)
  currentPage.value = Math.min(Math.max(1, pn), max)
}

/* =========================
   Watchers
========================= */
watch(
  () => ({ ...filters.value }),
  () => { currentPage.value = 1 },
  { deep: true }
)

watch(selectedTab, () => {
  loadCsv()
  selectedPlayer.value = null
  const keepGrade = filters.value.grade
  filters.value = { grade: keepGrade, search: [] }
  currentPage.value = 1
})

/* =========================
   Load CSV
========================= */
onMounted(loadCsv)

async function loadCsv() {
  const path = '/DB/sample_sorted.csv'
  const res = await fetch(path)
  const text = await res.text()
  Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    complete: async (results) => {
      players.value = results.data as Record<string, any>[]
      filters.value.grade = filterOptions.value.grade ?? []
      if (typeof filters.value.name !== 'string') filters.value.name = ''
      if (!Array.isArray(filters.value.synergy)) filters.value.synergy = []
      if (!Array.isArray(filters.value.search)) filters.value.search = []
      currentPage.value = 1
      await loadSynergyOptions()
    }
  })
}

/* =========================
   Expose counts (외부에서 접근 가능)
========================= */
defineExpose({
  totalFiltered: totalCount,
  totalAll
})
</script>

<template>
  <div class="min-h-screen space-y-8 font-sans">
    <!-- Filters -->
    <FilterPanel
      :all-fields="allFields"
      :select-fields="selectFields"
      :rarity-field="rarityField"
      :filter-options="filterOptions"
      :field-labels="fieldLabels"
      :synergy-options="synergyOptions"
      :name-options="nameOptions"
      v-model:filters="filters"
    />

    <!-- Table -->
    <PlayerTable :items="paginatedPlayers" :columns="columns" />

    <!-- Pagination with Lucide icons -->
    <div v-if="totalPages > 1" class="mt-6 flex flex-col items-center gap-3">
      <nav class="inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
        <!-- First -->
        <button
          class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-l-md
                 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300
                 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:pointer-events-none
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          :disabled="page === 1"
          @click="goToPage(1)"
          aria-label="첫 페이지">
          <ChevronsLeft class="h-4 w-4" />
          <span class="sr-only">첫 페이지</span>
        </button>

        <!-- Prev -->
        <button
          class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700
                 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300
                 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:pointer-events-none
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          :disabled="page === 1"
          @click="goToPage(page - 1)"
          aria-label="이전">
          <ChevronLeft class="h-4 w-4" />
          <span class="sr-only">이전</span>
        </button>

        <!-- Page indicator -->
        <span
          class="px-4 py-2 text-sm border border-gray-300 dark:border-gray-700
                 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200">
          {{ page }} / {{ totalPages }}
        </span>

        <!-- Next -->
        <button
          class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700
                 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300
                 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:pointer-events-none
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          :disabled="page === totalPages"
          @click="goToPage(page + 1)"
          aria-label="다음">
          <ChevronRight class="h-4 w-4" />
          <span class="sr-only">다음</span>
        </button>

        <!-- Last -->
        <button
          class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-r-md
                 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300
                 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:pointer-events-none
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          :disabled="page === totalPages"
          @click="goToPage(totalPages)"
          aria-label="마지막 페이지">
          <ChevronsRight class="h-4 w-4" />
          <span class="sr-only">마지막 페이지</span>
        </button>
      </nav>

      <!-- start–end / total (표시는 유지, 필요없으면 이 블록 삭제) -->
      <div class="text-xs text-gray-500 dark:text-gray-400">
        {{ totalCount ? (pageStartIndex + 1) : 0 }}–{{ pageEndIndex }} / {{ totalCount }}
        <!-- 전체 데이터 총 개수: {{ totalAll }} -->
      </div>
    </div>
  </div>
</template>

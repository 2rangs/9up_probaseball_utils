<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Papa from 'papaparse'
import PlayerTable from '@/components/table.vue'
import FilterPanel from '@/components/FilterPanel.vue'
import { Search, Filter, Star, User } from 'lucide-vue-next'

/** Tabs and State */
const tabs = ['Batters', 'Pitchers'] as const
const tabLabels: Record<string, string> = { Batters: '타자', Pitchers: '투수' }
const selectedTab = ref<typeof tabs[number]>('Batters')
const players = ref<Record<string, any>[]>([])
const selectedPlayer = ref<null | Record<string, any>>(null)
const filters = ref<Record<string, any>>({})
const currentPage = ref(1)
const pageSize = 20

/** Field Definitions */
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

/** Table Columns */
const columns = ref([
  'grade', 'rarity', 'name', 'team', 'year', 'position', 'handType', 'pitchingType', 'synergy', 'open'
])

/** ---------- helpers ---------- */
const toCsvArray = (v: unknown) =>
    (typeof v === 'string'
        ? v.split(',').map(s => s.trim()).filter(Boolean)
        : Array.isArray(v)
            ? v.map(s => String(s).trim()).filter(Boolean)
            : [String(v ?? '').trim()].filter(Boolean))

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
const includesAny = (hay: string[], needle: string) => hay.some(h => h.includes(needle))
const everyTermMatchesSomeField = (terms: string[], hay: string[]) =>
    terms.every(t => includesAny(hay, lc(t)))

/** Filter Option Extraction */
const filterOptions = computed(() => {
  const options: Record<string, Set<string>> = {}
  const fieldsToScan = [...selectFields.value, 'team', 'grade', 'skill'] as const

  fieldsToScan.forEach(field => {
    options[field] = new Set<string>()
    players.value.forEach(p => {
      const raw = p[field as string]
      if (!raw) return

      if (field === 'position') {
        parseJsonArray(raw).forEach(val => options[field].add(String(val)))
      } else if (field === 'enhancedSkill') {
        options[field].add(String(raw))
      } else {
        toCsvArray(raw).forEach(val => options[field].add(val))
      }
    })
  })

  // 자동완성 제안(이름/시너지/팀/스킬 통합)
  const searchSet = new Set<string>()
  players.value.forEach(p => {
    if (p.name) searchSet.add(String(p.name).trim())
    if (p.synergy) toCsvArray(p.synergy).forEach(v => searchSet.add(v))
    toCsvArray(p.team).forEach(v => searchSet.add(v))
    toCsvArray(p.skill).forEach(v => searchSet.add(v))
  })
  options['searchSuggestions'] = searchSet

  return Object.fromEntries(
      Object.entries(options).map(([field, set]) => [field, [...set].sort((a, b) => a.localeCompare(b))])
  )
})

/** Filtering Logic (개선) */
const filteredPlayers = computed(() => {
  return players.value.filter(p => {
    return allFields.value.every((field) => {
      const selected = filters.value[field]

      // 비선택 상태는 통과
      if (!selected || (Array.isArray(selected) && selected.length === 0)) return true

      // rarity(단일 숫자)
      if (field === rarityField) {
        return Number(p[field]) === Number(selected)
      }

      // team (CSV/배열 허용, OR 매칭)
      if (field === 'team') {
        const playerTeams = toCsvArray(p.team).map(lc)
        return (selected as string[]).some(sel => playerTeams.includes(lc(sel)))
      }

      // year (JSON/배열/단일 숫자 허용, AND 매칭)
      if (field === 'year') {
        const playerYears = parseJsonArray(p.year).map(n => Number(n))
        return (selected as string[]).every(sel => playerYears.includes(Number(sel)))
      }

      // skill (CSV/배열 허용, AND 매칭)
      if (field === 'skill') {
        const playerSkills = toCsvArray(p.skill).map(lc)
        return (selected as string[]).every(sel => playerSkills.includes(lc(sel)))
      }

      // position (JSON 배열 기대, AND 매칭)
      if (field === 'position') {
        const playerPos = parseJsonArray(p.position).map(lc)
        return (selected as string[]).every(sel => playerPos.includes(lc(sel)))
      }

      // search (문자열/배열 모두 허용)
      // - 태그(terms)는 AND
      // - 각 태그는 name/synergy/skill/team 중 "하나라도" 포함되면 매치(OR)
      if (field === 'search') {
        const terms: string[] = Array.isArray(selected)
            ? selected
            : String(selected).split(/[,\s]+/).filter(Boolean)

        if (terms.length === 0) return true

        // 시너지 토큰 배열 (정확 비교 위해 trim/lowercase 정규화)
        const synergyTokens = toCsvArray(p.synergy).map(lc)

        // 모든 검색어가 시너지에 정확히 포함돼야 함 (AND)
        return terms.every(t => synergyTokens.includes(lc(t)))
      }


      // // 자유 입력 필드(부분 문자열 포함)
      // if ((inputFields as readonly string[]).includes(field)) {
      //   return lc(p[field]).includes(lc(selected))
      // }

      // 일반 배열 필터(정확 일치, OR)
      if (Array.isArray(selected)) {
        return (selected as unknown[]).map(String).includes(String(p[field]))
      }

      // 기본: 정확 일치
      return String(p[field]) === String(selected)
    })
  })
})

/** Pagination */
const paginatedPlayers = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredPlayers.value.slice(start, start + pageSize)
})

const totalPages = computed(() => Math.ceil(filteredPlayers.value.length / pageSize))

const pageNumbers = computed(() => {
  const maxButtons = 7
  const total = totalPages.value
  const current = currentPage.value

  if (total <= maxButtons) return [...Array(total).keys()].map(i => i + 1)

  const start = Math.max(2, current - 2)
  const end = Math.min(total - 1, current + 2)
  const range: (number | '...')[] = []

  if (start > 2) range.push('...')
  for (let i = start; i <= end; i++) range.push(i)
  if (end < total - 1) range.push('...')

  return [1, ...range, total]
})

/** Watch Tab Switch */
watch(selectedTab, () => {
  loadCsv()
  selectedPlayer.value = null
  // grade는 유지, 나머지는 초기화(다중선택을 고려해 배열로 초기화)
  const keepGrade = filters.value.grade
  filters.value = { grade: keepGrade, search: [] }
  currentPage.value = 1
})

/** Load CSV */
onMounted(loadCsv)

async function loadCsv() {
  // const path = selectedTab.value === 'Batters'
  //     ? '/DB/9UP_ProBaseball_PlayerDB_202507_Batters.csv'
  //     : '/DB/9UP_ProBaseball_PlayerDB_202507_Pitchers.csv'
  const path = '/DB/sample_sorted.csv'

  const res = await fetch(path)
  const text = await res.text()
  Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      players.value = results.data as Record<string, any>[]
      // 기본 grade 옵션 세팅 (빈 배열이면 전체로 간주)
      filters.value.grade = filterOptions.value.grade ?? []
      // 검색은 배지 배열 기반
      if (!Array.isArray(filters.value.search)) filters.value.search = []
      currentPage.value = 1
    }
  })
}
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
        v-model:filters="filters"
    />
    <!-- Table -->
    <PlayerTable :items="paginatedPlayers" :columns="columns" />

    <!-- Pagination -->
    <div class="flex justify-center items-center gap-1 mb-8 flex-wrap">
      <button
          :disabled="currentPage === 1"
          @click="currentPage--"
          class="px-3 py-1 rounded-md border border-blue-500 text-blue-500 text-sm hover:bg-white disabled:opacity-40 cursor-pointer"
      >
        Prev
      </button>

      <button
          v-for="page in pageNumbers"
          :key="page + ''"
          @click="typeof page === 'number' && (currentPage = page)"
          :disabled="page === '...'"
          :class="page === currentPage ? 'bg-blue-500 text-white ' : 'hover:bg-blue-400 hover:text-white'"
          class="px-3 py-1 rounded-md text-sm disabled:cursor-default cursor-pointer"
      >
        {{ page }}
      </button>

      <button
          :disabled="currentPage === totalPages"
          @click="currentPage++"
          class="px-3 py-1  border border-blue-500 text-blue-500 rounded-md text-sm hover:bg-white disabled:opacity-40 cursor-pointer"
      >
        Next
      </button>
    </div>
  </div>
</template>

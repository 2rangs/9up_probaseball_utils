<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Papa from 'papaparse'
import PlayerTable from '@/components/table.vue'
import FilterPanel from '@/components/FilterPanel.vue'
import { Search, Filter, Star, User } from 'lucide-vue-next'

/** Tabs and State */
const tabs = ['Batters', 'Pitchers']
const tabLabels: Record<string, string> = {
  Batters: '타자',
  Pitchers: '투수',
}
const selectedTab = ref<'Batters' | 'Pitchers'>('Batters')
const players = ref<Record<string, any>[]>([])
const selectedPlayer = ref(null)
const filters = ref<Record<string, any>>({})
const currentPage = ref(1)
const pageSize = 20

/** Field Definitions */
const inputFields = ['name', 'team', 'year', 'skill', 'synergy']
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
  const common = ['grade', 'position', 'throwHand', 'skill', 'search', 'enhancedSkill']
  return selectedTab.value === 'Pitchers'
      ? [...common, 'pitchingType']
      : [...common, 'battingHand']
})

const allFields = computed(() => [...inputFields, ...selectFields.value, rarityField])

/** Table Columns */
const columns = ref([
  'grade', 'rarity', 'name', 'team', 'year', 'position', 'handType', 'pitchingType', 'synergy', 'open'
])

/** Filter Option Extraction */
const filterOptions = computed(() => {
  const options: Record<string, Set<string>> = {}
  const fieldsToScan = [...selectFields.value, 'team', 'grade', 'skill']

  fieldsToScan.forEach(field => {
    options[field] = new Set()

    players.value.forEach(p => {
      const raw = p[field]
      if (!raw) return

      if (field === 'position') {
        try {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) {
            parsed.forEach(val => options[field].add(String(val)))
          }
        } catch {}
      } else {
        raw.split(',').forEach(val => {
          const trimmed = val.trim()
          if (trimmed) options[field].add(trimmed)
        })
      }
    })
  })

  return Object.fromEntries(
      Object.entries(options).map(([field, set]) => [field, [...set].sort()])
  )
})

/** Filtering Logic */
const filteredPlayers = computed(() => {
  return players.value.filter(p => {
    return allFields.value.every(field => {
      const selected = filters.value[field]

      if (!selected || (Array.isArray(selected) && selected.length === 0)) return true

      if (field === rarityField) {
        return Number(p[field]) === Number(selected)
      }

      if (field === 'team') {
        const playerTeams = typeof p.team === 'string'
            ? p.team.split(',').map(t => t.trim())
            : Array.isArray(p.team)
                ? p.team.map(t => t.trim())
                : [String(p.team || '')]
        return selected.some((sel: string) => playerTeams.includes(sel.trim()))
      }
      if (field === 'year') {
        let playerYears: number[] = []

        try {
          if (typeof p.year === 'string') {
            const parsed = JSON.parse(p.year)
            playerYears = Array.isArray(parsed) ? parsed : [parsed]
          } else if (Array.isArray(p.year)) {
            playerYears = p.year
          } else {
            playerYears = [p.year]
          }
        } catch {
          playerYears = []
        }

        return selected.every((sel: string) => playerYears.includes(Number(sel))) // ✅ AND
      }


      if (field === 'skill') {
        const playerSkill = typeof p.skill === 'string'
            ? p.skill.split(',').map(s => s.trim())
            : Array.isArray(p.skill)
                ? p.skill
                : [String(p.skill)]
        return selected.every((sel: string) => playerSkill.includes(sel))
      }

      if (field === 'position') {
        try {
          const playerPos = JSON.parse(p.position || '[]')
          return selected.every((sel: string) => playerPos.includes(sel))
        } catch {
          return false
        }
      }

      if (field === 'search') {
        const keyword = selected.toLowerCase()
        return [p.name, p.synergy].some(val => String(val || '').toLowerCase().includes(keyword))
      }

      if (inputFields.includes(field)) {
        return String(p[field] ?? '').toLowerCase().includes(String(selected).toLowerCase())
      }

      if (Array.isArray(selected)) {
        return selected.includes(p[field])
      }

      return p[field] === selected
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
  const range = []

  if (start > 2) range.push('...')
  for (let i = start; i <= end; i++) range.push(i)
  if (end < total - 1) range.push('...')

  return [1, ...range, total]
})

/** Watch Tab Switch */
watch(selectedTab, () => {
  loadCsv()
  selectedPlayer.value = null
  Object.keys(filters.value).forEach(k => {
    if (k !== 'grade') filters.value[k] = ''
  })
  currentPage.value = 1
})

/** Load CSV */
onMounted(loadCsv)

async function loadCsv() {
  const path = selectedTab.value === 'Batters'
      ? '/DB/9UP_ProBaseball_PlayerDB_202507_Batters.csv'
      : '/DB/9UP_ProBaseball_PlayerDB_202507_Pitchers.csv'

  const res = await fetch(path)
  const text = await res.text()
  Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      players.value = results.data
      filters.value.grade = filterOptions.value.grade ?? []
    }
  })
}
</script>

<template>
  <div class="min-h-screen pt-4 space-y-8 font-sans">
    <div class="flex gap-4 w-[1280px] mx-auto p-2">
      <button
          v-for="tab in tabs"
          :key="tab"
          @click="selectedTab = tab"
          :class="[
        'px-5 py-2 rounded-lg font-semibold transition-transform cursor-pointer',
        selectedTab === tab
          ? 'bg-blue-500 text-white hover:bg-blue-600'
          : 'bg-white text-black border border-blue-400 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
      ]"
      >
        {{ tabLabels[tab] }}
      </button>
    </div>

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
    <div class="flex justify-center items-center gap-1 mt-8 flex-wrap">
      <button
          :disabled="currentPage === 1"
          @click="currentPage--"
          class="px-3 py-1 border border-[#e7cf86] rounded-md text-sm hover:bg-[#333] disabled:opacity-40"
      >
        Prev
      </button>

      <button
          v-for="page in pageNumbers"
          :key="page + ''"
          @click="typeof page === 'number' && (currentPage = page)"
          :disabled="page === '...'"
          :class="page === currentPage ? 'bg-[#e7cf86] text-black' : 'hover:bg-[#e7cf86]'"
          class="px-3 py-1 border border-[#e7cf86] rounded-md text-sm disabled:cursor-default"
      >
        {{ page }}
      </button>

      <button
          :disabled="currentPage === totalPages"
          @click="currentPage++"
          class="px-3 py-1 border border-[#e7cf86] rounded-md text-sm hover:bg-[#333] disabled:opacity-40"
      >
        Next
      </button>
    </div>
  </div>
</template>

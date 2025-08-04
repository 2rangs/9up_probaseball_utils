<script setup>
import PlayerTable from './table.vue'
import {ref, computed, onMounted, watch} from 'vue'
import Papa from 'papaparse'
import {
  Search, Filter, Star, User
} from 'lucide-vue-next'
import FilterPanel from "./FilterPanel.vue";

const tabs = ['Batters', 'Pitchers']
const selectedTab = ref('Batters')

const players = ref([])
const selectedPlayer = ref(null)
const filters = ref({})
const currentPage = ref(1)
const pageSize = 20

const inputFields = ['name', 'team', 'year', 'skill', 'synergy']
const selectFields = ['grade', 'position', 'battingHand', 'throwHand', 'pitchingType', 'skill','enhancedSkill']
const rarityField = 'rarity'
const allFields = [...inputFields, ...selectFields, rarityField]

const columns = ref([
  'grade', 'rarity', 'name', 'team', 'year', 'position', 'handType', 'pitchingType', 'synergy', 'open'
])

const filterOptions = computed(() => {
  const options = {}

  // 포함할 필드
  const fieldsToScan = [...selectFields, 'team', 'grade', 'skill']

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
  console.log(options)

  return Object.fromEntries(
      Object.entries(options).map(([field, set]) => [field, [...set].sort()])
  )
})


const filteredPlayers = computed(() => {
  return players.value.filter(p => {
    return allFields.every(field => {
      const selected = filters.value[field]

      if (!selected || (Array.isArray(selected) && selected.length === 0)) return true

      // ⭐ rarity (숫자 비교)
      if (field === rarityField) {
        return Number(p[field]) === Number(selected)
      }

      // 🧢 팀: 다중 OR 조건
      if (field === 'team') {
        if (typeof selected === 'string') {
          return String(p[field] ?? '').toLowerCase().includes(String(selected).toLowerCase())
        }
        if (!Array.isArray(selected)) return false

        let playerTeams = []
        if (typeof p.team === 'string') {
          playerTeams = p.team.split(',').map(t => t.trim()).filter(t => t !== '')
        } else if (Array.isArray(p.team)) {
          playerTeams = p.team.map(t => String(t).trim()).filter(t => t !== '')
        } else {
          playerTeams = [String(p.team || '').trim()].filter(t => t !== '')
        }

        return selected.some(sel => playerTeams.includes(String(sel).trim()))
      }

      // 🗓 year: 다중 OR 조건 (ex: [2011, 2012])
      if (field === 'year') {
        if (!Array.isArray(selected)) return false

        let playerYears = []
        try {
          if (typeof p.year === 'string') {
            playerYears = JSON.parse(p.year)
          } else if (Array.isArray(p.year)) {
            playerYears = p.year
          } else {
            playerYears = [Number(p.year)]
          }
        } catch {
          return false
        }

        return selected.some(sel => playerYears.includes(Number(sel)))
      }
if (field === 'skill') {
  if (!Array.isArray(selected)) return false

  const playerSkill = typeof p.skill === 'string'
    ? p.skill.split(',').map(s => s.trim())
    : Array.isArray(p.skill)
      ? p.skill
      : [String(p.skill)]

  return selected.every(sel => playerSkill.includes(String(sel)))
}



      // ⚾ 포지션: 다중 AND 조건
      if (field === 'position') {
        try {
          const playerPos = JSON.parse(p.position || '[]')
          if (!Array.isArray(playerPos)) return false
          return Array.isArray(selected) && selected.every(sel => playerPos.includes(sel))
        } catch {
          return false
        }
      }

      // 🔍 문자열 포함 검색
      if (inputFields.includes(field) && field !== 'team') {
        return String(p[field] ?? '').toLowerCase().includes(String(selected).toLowerCase())
      }

      // 🎖 등급: 다중 OR 조건
      if (Array.isArray(selected)) {
        return selected.includes(p[field])
      }

      return p[field] === selected
    })
  })
})

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

watch(selectedTab, () => {
  loadCsv()
  selectedPlayer.value = null
  Object.keys(filters.value).forEach(k => filters.value[k] = '')
  currentPage.value = 1
})

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
    }
  })
}
</script>

<template>
  <div class="min-h-screen  p-8 space-y-8 font-sans">
    <!-- Tabs -->
    <div class="flex gap-4">
      <button
          v-for="tab in tabs"
          :key="tab"
          @click="selectedTab = tab"
          :class="selectedTab === tab ? 'bg-[#e7cf86] text-black shadow-md scale-105' : 'bg-[#1a1a1a] text-[#e7cf86] hover:bg-[#333] border border-[#e7cf86]'"
          class="px-5 py-2 rounded-lg font-semibold transition-transform"
      >
        {{ tab }}
      </button>
    </div>

    <FilterPanel
        :all-fields="allFields"
        :select-fields="selectFields"
        :rarity-field="rarityField"
        :filter-options="filterOptions"
        v-model:filters="filters"
    />


    <!-- Player Table -->
    <PlayerTable :items="paginatedPlayers" :columns="columns"/>

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

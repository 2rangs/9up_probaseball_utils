<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Papa from 'papaparse'

const bettersPath = '/DB/9UP_ProBaseball_PlayerDB_202507_Betters.csv'
const pitchersPath = '/DB/9UP_ProBaseball_PlayerDB_202507_Pitchers.csv'

const betters = ref<any[]>([])
const pitchers = ref<any[]>([])
const lineup = ref<Record<string, any[]>>({
  LF: [], CF: [], RF: [], '3B': [], SS: [], '2B': [], '1B': [], C: [], DH: [],
  SP: [], RP: [], SUB: []
})
const synergyResult = ref<{ powerFlat: number, powerPercent: number }>({ powerFlat: 0, powerPercent: 0 })

const getId = (p: any) => `${p.name}-${p.year}`
const usedIds = new Set<string>()

const loadCsv = async (path: string): Promise<any[]> => {
  const res = await fetch(path)
  const text = await res.text()
  return new Promise(resolve => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: results => resolve(results.data)
    })
  })
}

const parseSynergy = (p: any) => (p.synergy || '').split(',').map((s: string) => s.trim()).filter(Boolean)

function countAllSynergy(players: any[]) {
  const counter = new Map<string, number>()
  for (const p of players) {
    for (const s of parseSynergy(p)) {
      counter.set(s, (counter.get(s) || 0) + 1)
    }
  }
  return counter
}

function sharedSynergyScore(p: any, globalCount: Map<string, number>) {
  return parseSynergy(p).reduce((sum, s) => sum + ((globalCount.get(s) || 1) - 1), 0)
}

function pick(players: any[], pos: string, count: number, globalCount: Map<string, number>) {
  return players
      .filter(p => p.position?.includes(pos))
      .filter(p => !usedIds.has(getId(p)))
      .sort((a, b) => sharedSynergyScore(b, globalCount) - sharedSynergyScore(a, globalCount))
      .slice(0, count)
      .map(p => {
        usedIds.add(getId(p))
        return p
      })
}

function buildLineup() {
  const all = [...betters.value, ...pitchers.value]
  usedIds.clear()
  const counter = countAllSynergy(all)

  lineup.value.LF = pick(betters.value, 'LF', 1, counter)
  lineup.value.CF = pick(betters.value, 'CF', 1, counter)
  lineup.value.RF = pick(betters.value, 'RF', 1, counter)
  lineup.value['3B'] = pick(betters.value, '3B', 1, counter)
  lineup.value.SS = pick(betters.value, 'SS', 1, counter)
  lineup.value['2B'] = pick(betters.value, '2B', 1, counter)
  lineup.value['1B'] = pick(betters.value, '1B', 1, counter)
  lineup.value.C = pick(betters.value, 'C', 1, counter)
  lineup.value.DH = pick(betters.value, 'DH', 1, counter)
  lineup.value.SP = pick(pitchers.value, 'SP', 5, counter)
  lineup.value.RP = pick(pitchers.value, 'RP', 6, counter)
  lineup.value.SUB = all
      .filter(p => !usedIds.has(getId(p)))
      .sort((a, b) => sharedSynergyScore(b, counter) - sharedSynergyScore(a, counter))
      .slice(0, 8)

  synergyResult.value = analyzeLineupSynergy(Object.values(lineup.value).flat())
}

function analyzeLineupSynergy(players: any[]) {
  const synergyMap = new Map<string, number>()
  for (const p of players) {
    for (const s of parseSynergy(p)) {
      synergyMap.set(s, (synergyMap.get(s) || 0) + 1)
    }
  }

  let powerFlat = 0
  let powerPercent = 0

  // 구단
  for (const [s, count] of synergyMap) {
    if (/해태|KIA|LG|두산|삼성|한화|키움|NC|SSG|롯데|KT/.test(s)) {
      if (count >= 20) powerFlat += 250
      else if (count >= 10) powerFlat += 100
    }
  }

  // 연도
  const yearMap = new Map<string, number>()
  for (const [s, count] of synergyMap) {
    const year = s.match(/(19|20)\d{2}/)?.[0]
    if (year) yearMap.set(year, (yearMap.get(year) || 0) + count)
  }
  for (const count of yearMap.values()) {
    if (count >= 20) powerPercent += 7
    else if (count >= 10) powerPercent += 5
    else if (count >= 5) powerPercent += 2
  }

  // 고등학교
  for (const [s, count] of synergyMap) {
    if (/고$/.test(s) && s.includes('출신') && count >= 3) powerFlat += 50
  }

  // 대학교
  for (const [s, count] of synergyMap) {
    if (/대$/.test(s) && s.includes('출신') && count >= 3) powerPercent += 2
  }

  // MVP 계열
  const mvpKeywords = ['MVP', '이영민 타격상']
  let mvpCount = 0
  for (const [s, count] of synergyMap) {
    if (mvpKeywords.some(k => s.includes(k))) mvpCount += count
  }
  if (mvpCount >= 3) powerPercent += 2

  // 기록 시너지
  for (const [s, count] of synergyMap) {
    if (count >= 3) powerPercent += 5
    else if (count >= 2) powerPercent += 3
  }

  return { powerFlat, powerPercent }
}

onMounted(async () => {
  betters.value = await loadCsv(bettersPath)
  pitchers.value = await loadCsv(pitchersPath)
  buildLineup()
})
</script>

<template>
  <div class="p-6 space-y-6">
    <div v-for="(players, pos) in lineup" :key="pos">
      <h2 class="font-bold text-xl">{{ pos }}</h2>
      <ul class="pl-4 list-disc">
        <li v-for="p in players" :key="p.name + p.year">
          {{ p.name }} ({{ p.year }}) - {{ p.synergy }}
        </li>
      </ul>
    </div>

    <div class="mt-8 p-4 bg-gray-50 rounded border text-sm">
      <p>🔋 <strong>파워 보너스</strong>: {{ synergyResult.powerFlat }}</p>
      <p>⚡ <strong>퍼센트 보너스</strong>: {{ synergyResult.powerPercent }}%</p>
    </div>
  </div>
</template>

<style scoped>
ul li {
  line-height: 1.5;
}
</style>

<template>
  <div class="w-full h-screen p-5 box-border bg-gray-50">
    <div class="h-full flex gap-5">
      <!-- ================= 좌측: 선수 테이블(이름 기본 + 시너지 AND 고급) ================= -->
      <section class="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col h-[calc(100vh-2.5rem)] min-w-[380px] w-[460px]">
        <header class="p-4 border-b border-gray-100 bg-white sticky top-0 z-20">
          <h1 class="text-lg font-semibold text-gray-900">선수 목록</h1>
        </header>

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
      </section>

      <!-- ================= 중앙: 간결 슬롯 ================= -->
      <section class="rounded-2xl border border-gray-200 bg-white relative overflow-hidden flex-1 min-w-[760px] max-w-[980px] shadow-sm">
        <div class="p-4 border-b border-gray-100 bg-white/90 backdrop-blur sticky top-0 z-10 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-gray-700">라인업 배치</h3>
          <div class="text-xs text-gray-500">슬롯 카드를 클릭해 제거</div>
        </div>

        <div class="p-4 space-y-5">
          <!-- 타자 -->
          <div class="grid grid-cols-12 gap-4">
            <div class="col-span-12">
              <h4 class="text-xs font-semibold text-gray-500 mb-2">외야</h4>
              <div class="grid grid-cols-3 gap-2">
                <SlotChip label="LF" :player="lineup.LF" @clear="clearSlot('LF')" />
                <SlotChip label="CF" :player="lineup.CF" @clear="clearSlot('CF')" />
                <SlotChip label="RF" :player="lineup.RF" @clear="clearSlot('RF')" />
              </div>
            </div>
            <div class="col-span-12">
              <h4 class="text-xs font-semibold text-gray-500 mb-2">내야</h4>
              <div class="grid grid-cols-5 gap-2">
                <SlotChip label="C"  :player="lineup.C"  @clear="clearSlot('C')"  />
                <SlotChip label="1B" :player="lineup['1B']" @clear="clearSlot('1B')" />
                <SlotChip label="2B" :player="lineup['2B']" @clear="clearSlot('2B')" />
                <SlotChip label="3B" :player="lineup['3B']" @clear="clearSlot('3B')" />
                <SlotChip label="SS" :player="lineup.SS" @clear="clearSlot('SS')" />
              </div>
            </div>
            <div class="col-span-12">
              <h4 class="text-xs font-semibold text-gray-500 mb-2">지타</h4>
              <div class="grid grid-cols-1 gap-2">
                <SlotChip label="DH" :player="lineup.DH" @clear="clearSlot('DH')" />
              </div>
            </div>
          </div>

          <div class="h-px bg-gray-100"></div>

          <!-- 투수 -->
          <div class="grid grid-cols-12 gap-4">
            <div class="col-span-12">
              <h4 class="text-xs font-semibold text-gray-500 mb-2">선발</h4>
              <div class="grid grid-cols-5 gap-2">
                <TinySlot v-for="i in 5" :key="'SP'+i" :label="'SP'+i" :player="lineup['SP'+i]" @clear="clearSlot(('SP'+i) as any)" />
              </div>
            </div>
            <div class="col-span-12">
              <h4 class="text-xs font-semibold text-gray-500 mb-2">중간계투</h4>
              <div class="grid grid-cols-6 gap-2">
                <TinySlot v-for="i in 6" :key="'RP'+i" :label="'RP'+i" :player="lineup['RP'+i]" @clear="clearSlot(('RP'+i) as any)" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ================= 우측: 시너지(활성/비활성) ================= -->
      <section class="rounded-xl border border-gray-200 bg-white p-5 h-[calc(100vh-2.5rem)] overflow-y-auto min-w-[360px]">
        <div class="sticky top-0 pb-3 bg-white z-10">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900">시너지 현황</h2>
            <div class="flex items-center gap-2 text-xs">
              <span class="px-2 py-1 rounded border border-emerald-200 text-emerald-700 bg-emerald-50">활성 {{ activeList.length }}</span>
              <span class="px-2 py-1 rounded border border-gray-200 text-gray-600 bg-gray-50">비활성 {{ inactiveList.length }}</span>
              <button class="px-2 py-1.5 rounded border border-gray-300 hover:bg-gray-50 text-gray-600" @click="reloadSynergy">재로드</button>
            </div>
          </div>
        </div>

        <!-- 활성 -->
        <h3 class="mt-2 mb-2 text-sm font-semibold text-emerald-700">활성 시너지</h3>
        <div v-if="!activeList.length" class="text-sm text-gray-500 mb-4">발동된 시너지가 없습니다.</div>
        <ul v-else class="space-y-3 mb-6">
          <li v-for="s in activeList" :key="s.name" class="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="inline-block px-2 py-0.5 text-xs font-semibold bg-emerald-600 text-white rounded">{{ s.name }}</span>
                <span class="text-xs text-emerald-800/80">({{ s.count }}명)</span>
              </div>
              <div class="text-xs text-emerald-800/70">{{ s.condText }}</div>
            </div>
            <div class="mt-2 text-xs">
              <span class="inline-block px-2 py-1 border bg-white text-emerald-700 border-emerald-300 rounded text-xs font-medium">
                {{ STAT_LABEL[s.chosen.stat] || s.chosen.stat }} +{{ s.chosen.bonus.value }}{{ s.chosen.bonus.unit==='percent'?'%':'' }}
              </span>
            </div>
            <div class="mt-2 flex flex-wrap gap-1">
              <span v-for="n in s.appliesTo" :key="n" class="text-[11px] text-emerald-700 bg-white border border-emerald-200 rounded px-1.5 py-0.5">{{ n }}</span>
            </div>
          </li>
        </ul>

        <!-- 비활성 -->
        <h3 class="mb-2 text-sm font-semibold text-gray-700">비활성 / 인원 부족</h3>
        <div v-if="!inactiveList.length" class="text-sm text-gray-500">비활성 항목이 없습니다.</div>
        <ul v-else class="space-y-3">
          <li v-for="s in inactiveList" :key="s.name" class="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="inline-block px-2 py-0.5 text-xs font-semibold bg-gray-700 text-white rounded">{{ s.name }}</span>
                <span class="text-xs text-gray-600">({{ s.count }}명)</span>
              </div>
              <div class="text-xs text-gray-600">{{ s.nextText }}</div>
            </div>

            <div class="mt-2 h-2 rounded bg-white border border-gray-200 overflow-hidden">
              <div class="h-full bg-blue-500" :style="{ width: s.progress + '%' }"></div>
            </div>
            <div class="mt-1 text-[11px] text-gray-500">다음 단계까지 {{ s.needLeft }}명 부족 (목표 {{ s.nextNeed }}명)</div>

            <div class="mt-2 text-[12px] text-gray-700 italic">
              활성화 시: <span class="font-medium not-italic">{{ s.nextEffectTitle }}</span>
              <span v-if="s.nextEffectDesc" class="text-gray-500"> — {{ s.nextEffectDesc }}</span>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Lineup Builder – 통합/클린 버전
 * - CSV 단일 소스 로드
 * - 이름 기본 검색 + (선택) 시너지 AND
 * - 슬롯 배치 + 시너지 인덱스(활성/비활성/다음 효과)
 */
import { ref, computed, onMounted, defineComponent, h } from 'vue'
import Papa from 'papaparse'
import PlayerTable from "@/components/table.vue";
import FilterPanel from "@/components/FilterPanel.vue";

/** ---------- 타입 ---------- */
type Raw = Record<string, any>
type CountOp = '==' | '>=' | '<=' | '>' | '<' | 'between'
interface JsonBonus { unit: 'percent' | 'fixed'; value: number }
interface JsonCond  {
  count: (
      | { op: Exclude<CountOp,'between'>, value: number }
      | { op: 'between', min: number, max: number }
      ),
  stat: string,
  bonus: JsonBonus
}
interface JsonSynergy {
  id: number | string
  synergy: string
  synergy_effect?: string
  description?: string
  stackable?: boolean
  conditions: JsonCond[]
}
interface Player {
  id: string
  name: string
  team: string
  position: string
  synergy?: string
  _slotKeys: SlotKey[]
  _synergyTags: string[]
}
type SlotKey = typeof SLOT_ORDER[number]
type Filters = { name?: string; synergy?: string[]; advancedOn?: boolean }

/** ---------- 상수/라벨 ---------- */
const STAT_LABEL: Record<string, string> = {
  power: '파워', contact: '컨택', defense: '수비', running: '주루',
  control: '제구', movement: '무브먼트', stuff: '구위',
  longHitSuppression: '장타 억제', homeRunSuppression: '홈런 억제', runnerControl: '주자 억제'
}
const SLOT_LABEL: Record<string, string> = {
  C: '포수', '1B': '1루', '2B': '2루', '3B': '3루', SS: '유격',
  LF: '좌익', CF: '중견', RF: '우익', DH: '지타', SP: '선발', RP: '불펜'
}
const HITTER_KEYS = ['C','1B','2B','3B','SS','LF','CF','RF','DH'] as const
const SP_KEYS = ['SP1','SP2','SP3','SP4','SP5'] as const
const RP_KEYS = ['RP1','RP2','RP3','RP4','RP5','RP6'] as const
const SLOT_ORDER = ['C','1B','2B','3B','SS','LF','CF','RF','DH','SP','RP'] as const

/** ---------- 유틸 ---------- */
const norm = (s: string) => s.trim()
const cmp = (op: CountOp, lhs: number, rhsOrMin?: number, max?: number) => {
  if (op === '==') return lhs === (rhsOrMin ?? 0)
  if (op === '>=') return lhs >= (rhsOrMin ?? 0)
  if (op === '<=') return lhs <= (rhsOrMin ?? 0)
  if (op === '>')  return lhs >  (rhsOrMin ?? 0)
  if (op === '<')  return lhs <  (rhsOrMin ?? 0)
  if (op === 'between') return lhs >= (rhsOrMin ?? 0) && lhs <= (max ?? Number.POSITIVE_INFINITY)
  return false
}
const parsePositions = (raw: any): string[] => {
  const s = String(raw ?? '').trim()
  if (!s) return []
  if (s.startsWith('[') && s.endsWith(']')) {
    try { const a = JSON.parse(s); return (Array.isArray(a)?a:[]).map((x:any)=>String(x).trim()) } catch {}
  }
  return s.split(/[,/|]/g).map(x=>x.trim()).filter(Boolean)
}
const mapToSlotKey = (code: string): SlotKey | null => {
  const c = code.toUpperCase()
  if (c === '1B' || c === 'B1') return '1B'
  if (c === '2B' || c === 'B2') return '2B'
  if (c === '3B' || c === 'B3') return '3B'
  if (c === 'SS') return 'SS'
  if (c === 'LF') return 'LF'
  if (c === 'CF') return 'CF'
  if (c === 'RF') return 'RF'
  if (c === 'C')  return 'C'
  if (c === 'DH' || c === 'O') return 'DH'
  if (c === 'SP') return 'SP'
  if (c === 'RP') return 'RP'
  return null
}
const isPitcher = (p: Player) =>
    p._slotKeys.includes('SP') || p._slotKeys.includes('RP') || /(^|\W)P(\W|$)/i.test(p.position)

/** ---------- 상태 ---------- */
const players = ref<Player[]>([])
const synergys = ref<JsonSynergy[]>([])
const tableFilters = ref<Filters>({ name: '', synergy: [], advancedOn: false })
const currentPage = ref(1)
const pageSize = ref(18)
const tableKey = ref(0)

type LineupState = {
  C: Player|null, '1B': Player|null, '2B': Player|null, '3B': Player|null, SS: Player|null,
  LF: Player|null, CF: Player|null, RF: Player|null, DH: Player|null,
  SP1: Player|null, SP2: Player|null, SP3: Player|null, SP4: Player|null, SP5: Player|null,
  RP1: Player|null, RP2: Player|null, RP3: Player|null, RP4: Player|null, RP5: Player|null, RP6: Player|null
}
const lineup = ref<LineupState>({
  C: null, '1B': null, '2B': null, '3B': null, SS: null,
  LF: null, CF: null, RF: null, DH: null,
  SP1: null, SP2: null, SP3: null, SP4: null, SP5: null,
  RP1: null, RP2: null, RP3: null, RP4: null, RP5: null, RP6: null
})

/** ---------- 데이터 로딩 ---------- */
const readSynergyField = (p: Raw): string => {
  const raw = p.synergy ?? p['시너지'] ?? p['Synergy'] ?? p['synergy_tags'] ?? p['tags'] ?? ''
  return String(raw)
}
const parseTags = (raw: string): string[] =>
    raw.split(/[,\-\/|;]+/g).map(s => s.trim()).filter(Boolean)
const normalizePlayer = (p: Raw): Player => {
  const posCodes = parsePositions(p.position ?? p['포지션'])
  const kset = new Set<SlotKey>()
  posCodes.forEach(c => { const k = mapToSlotKey(c); if (k) kset.add(k) })
  const tags = parseTags(readSynergyField(p))
  return {
    id: String(p.id ?? (globalThis.crypto as any)?.randomUUID?.() ?? Math.random()),
    name: String(p.name ?? p['이름'] ?? ''),
    team: String(p.team ?? p['팀'] ?? ''),
    position: String(p.position ?? p['포지션'] ?? ''),
    synergy: readSynergyField(p),
    _slotKeys: Array.from(kset),
    _synergyTags: tags.map(norm)
  }
}
const loadCsv = async () => {
  const url = new URL('/DB/sample_sorted.csv', location.origin).href
  const txt = await (await fetch(url, { cache: 'no-store' })).text()
  Papa.parse(txt, {
    header: true, skipEmptyLines: true, worker: true,
    complete: (res:any) => { players.value = (res.data as Raw[]).map(normalizePlayer) }
  })
}
const loadSynergy = async () => {
  const url = new URL('/DB/synergys.json', location.origin).href
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`synergy load: HTTP ${res.status}`)
  const json = await res.json()
  if (!Array.isArray(json)) throw new Error('synergys.json must be an array')
  synergys.value = json
}
const reloadSynergy = async () => {
  try { await loadSynergy() } catch (e) { console.error(e); alert('시너지 파일 로드 실패') }
}
onMounted(async () => {
  currentPage.value = 1
  tableKey.value++
  await Promise.all([loadCsv(), loadSynergy()])
})

/** ---------- 자동완성 소스 ---------- */
const nameOptions = computed(() =>
    Array.from(new Set(players.value.map(p => p.name).filter(Boolean)))
)
const synergyOptions = computed(() =>
    Array.from(new Set(synergys.value.map(s => s.synergy).filter(Boolean)))
)

/** ---------- 테이블 필터 ---------- */
const onUpdateTableFilters = (v: Filters) => { tableFilters.value = v; currentPage.value = 1 }

/** 이름만 필터 + (옵션) 시너지 AND */
const filteredPlayers = computed(() => {
  const nameQ = (tableFilters.value.name ?? '').toLowerCase().trim()
  const synTags = (tableFilters.value.synergy ?? []).map(s => s.toLowerCase().trim())
  const useAdvanced = !!tableFilters.value.advancedOn

  return players.value.filter(p => {
    if (nameQ && !p.name.toLowerCase().includes(nameQ)) return false
    if (useAdvanced && synTags.length) {
      const ptags = p._synergyTags.map(t => t.toLowerCase().trim())
      for (const t of synTags) if (!ptags.includes(t)) return false
    }
    return true
  })
})
const total = computed(() => filteredPlayers.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)))
const pageData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredPlayers.value.slice(start, start + pageSize.value)
})
const goFirst = () => { currentPage.value = 1 }
const goPrev  = () => { currentPage.value = Math.max(1, currentPage.value - 1) }
const goNext  = () => { currentPage.value = Math.min(totalPages.value, currentPage.value + 1) }
const goLast  = () => { currentPage.value = totalPages.value }

/** ---------- 라인업 배치 ---------- */
const clearSlot = (slot: keyof LineupState) => { lineup.value[slot] = null }
const assignToSlot = (slot: string|undefined, p: Player) => {
  if (!slot) return
  if (slot === 'DH') {
    if (isPitcher(p)) { alert('DH에는 타자만 가능합니다.'); return }
  } else if (slot.startsWith('SP')) {
    if (!p._slotKeys.includes('SP')) { alert('선발 슬롯에는 선발 가능한 투수만.'); return }
  } else if (slot.startsWith('RP')) {
    if (!p._slotKeys.includes('RP')) { alert('불펜 슬롯에는 불펜 가능한 투수만.'); return }
  } else {
    const key = slot as SlotKey
    if (!p._slotKeys.includes(key)) { alert(`${SLOT_LABEL[key]} 슬롯에 배치 불가한 선수입니다.`); return }
  }
  (Object.keys(lineup.value) as (keyof LineupState)[]).forEach(k => {
    if (lineup.value[k]?.id === p.id) lineup.value[k] = null
  })
  lineup.value[slot as keyof LineupState] = p
}
const autoAssign = (p: Player) => {
  const hittersOrder: (keyof LineupState)[] = ['C','1B','2B','3B','SS','LF','CF','RF','DH']
  const spOrder: (keyof LineupState)[] = ['SP1','SP2','SP3','SP4','SP5']
  const rpOrder: (keyof LineupState)[] = ['RP1','RP2','RP3','RP4','RP5','RP6']
  ;(Object.keys(lineup.value) as (keyof LineupState)[]).forEach(k => {
    if (lineup.value[k]?.id === p.id) lineup.value[k] = null
  })
  if (!isPitcher(p)) {
    for (const k of hittersOrder) {
      if (k === 'DH') { if (!isPitcher(p) && !lineup.value[k]) { lineup.value[k] = p; return } }
      else if ((p._slotKeys as any).includes(k) && !lineup.value[k]) { lineup.value[k] = p; return }
    }
    alert('배치 가능한 타자 슬롯이 없습니다.')
  } else {
    if (p._slotKeys.includes('SP')) for (const k of spOrder) if (!lineup.value[k]) { lineup.value[k] = p; return }
    if (p._slotKeys.includes('RP')) for (const k of rpOrder) if (!lineup.value[k]) { lineup.value[k] = p; return }
    alert('배치 가능한 투수 슬롯이 없습니다.')
  }
}

/** ---------- 시너지 인덱스/상태 ---------- */
const lineupTags = computed(() => {
  const tags: string[] = []
  ;(Object.keys(lineup.value) as (keyof LineupState)[]).forEach(k => {
    const p = lineup.value[k]; if (!p) return
    tags.push(...p._synergyTags.map(norm))
  })
  return tags
})

function buildSynergyIndex() {
  const index = new Map<string, {
    count: number
    chosen: JsonCond | null
    condText: string | null
    appliesTo: string[]
    next: { cond: JsonCond, need: number, text: string } | null
    synergy: JsonSynergy
  }>()
  const tags = lineupTags.value

  for (const s of synergys.value) {
    const name = norm(s.synergy)
    const count = tags.filter(t => norm(t) === name).length

    const all = s.conditions.map(c => {
      const isBetween = 'op' in c.count && c.count.op === 'between'
      const upper = isBetween ? (c.count as any).max : (c.count as any).value
      const lower = isBetween ? (c.count as any).min : (c.count as any).value
      const text  = isBetween ? `between ${lower}~${upper}명` : `${(c.count as any).op} ${upper}명`
      return { raw: c, upper: Number(upper ?? 0), text }
    }).sort((a,b) => a.upper - b.upper)

    const matched = all.filter(({raw}) => {
      const cc:any = raw.count
      return cc.op === 'between' ? cmp('between', count, cc.min, cc.max) : cmp(cc.op, count, cc.value)
    })

    let chosen: JsonCond | null = null
    let condText: string | null = null
    if (matched.length) {
      matched.sort((a,b) => (b.upper - a.upper) || ((b.raw.bonus.value??0) - (a.raw.bonus.value??0)))
      chosen = matched[0].raw
      condText = matched[0].text
    }

    const bigger = all.find(c => count < c.upper) || null
    const next = bigger ? { cond: bigger.raw, need: bigger.upper, text: bigger.text } : null

    const appliesTo = chosen
        ? (Object.values(lineup.value).filter(Boolean) as Player[])
            .filter(p => p._synergyTags.map(norm).includes(name))
            .map(p => p.name)
        : []

    index.set(name, { count, chosen, condText, appliesTo, next, synergy: s })
  }
  return index
}
const synergyIndex = computed(buildSynergyIndex)

const activeList = computed(() => {
  const out: Array<{ name: string, count: number, chosen: JsonCond, appliesTo: string[], condText: string }> = []
  for (const [name, rec] of synergyIndex.value.entries()) {
    if (!rec.chosen) continue
    out.push({ name, count: rec.count, chosen: rec.chosen, appliesTo: rec.appliesTo, condText: rec.condText! })
  }
  return out.sort((a,b) => (b.chosen.bonus.value ?? 0) - (a.chosen.bonus.value ?? 0))
})

const inactiveList = computed(() => {
  const out: Array<{
    name: string
    count: number
    nextNeed: number
    needLeft: number
    progress: number
    nextText: string
    nextEffectTitle: string
    nextEffectDesc?: string
  }> = []
  for (const [name, rec] of synergyIndex.value.entries()) {
    if (rec.chosen || !rec.next) continue
    const nextNeed = rec.next.need
    const needLeft = Math.max(0, nextNeed - rec.count)
    const allConds = rec.synergy.conditions
    const maxNeed = allConds.reduce((m,c)=>{
      const isBetween = 'op' in c.count && c.count.op==='between'
      const u = isBetween ? (c.count as any).max : (c.count as any).value
      return Math.max(m, Number(u ?? 0))
    }, nextNeed)
    const progress = Math.max(0, Math.min(100, Math.round((rec.count / maxNeed) * 100)))

    const stat = rec.next.cond.stat
    const bonus = rec.next.cond.bonus
    const title = `${STAT_LABEL[stat] || stat} +${bonus.value}${bonus.unit==='percent'?'%':''}`
    const desc  = rec.synergy.synergy_effect || rec.synergy.description || ''

    out.push({
      name,
      count: rec.count,
      nextNeed,
      needLeft,
      progress,
      nextText: `다음 단계: ${nextNeed}명 필요`,
      nextEffectTitle: title,
      nextEffectDesc: desc || undefined
    })
  }
  return out.sort((a,b) => a.needLeft - b.needLeft)
})

/** ---------- 선수별 보너스 합산 ---------- */
function bonusesForPlayer(p: Player): Record<string, { percent: number, fixed: number }> {
  const sum: Record<string, { percent: number, fixed: number }> = {}
  const tags = new Set(p._synergyTags.map(norm))
  for (const [name, rec] of synergyIndex.value.entries()) {
    if (!rec.chosen) continue
    if (!tags.has(name)) continue
    const stat = rec.chosen.stat
    if (!sum[stat]) sum[stat] = { percent: 0, fixed: 0 }
    if (rec.chosen.bonus.unit === 'percent') sum[stat].percent += rec.chosen.bonus.value
    else sum[stat].fixed += rec.chosen.bonus.value
  }
  return sum
}
const perPlayerBadges = (p: Player) => {
  const b = bonusesForPlayer(p)
  const out: Array<{ key: string, text: string, title: string }> = []
  for (const [stat, v] of Object.entries(b)) {
    const txt = []
    if (v.percent) txt.push(`+${v.percent}%`)
    if (v.fixed)   txt.push(`+${v.fixed}`)
    if (!txt.length) continue
    out.push({
      key: stat,
      text: `${STAT_LABEL[stat] || stat} ${txt.join(' · ')}`,
      title: `시너지 합산: ${txt.join(' / ')}`
    })
  }
  return out
}

/** ---------- 슬롯 컴포넌트 ---------- */
const SlotChip = defineComponent({
  name: 'SlotChip',
  props: { label: { type: String, required: true }, player: { type: Object as () => Player|null, default: null } },
  emits: ['clear'],
  setup: (props, { emit }) => () =>
      h('div', { class: 'rounded-xl border border-gray-200 bg-white px-3 py-2 min-h-[60px] shadow-sm' }, [
        h('div', { class: 'flex items-center justify-between gap-2' }, [
          h('span', { class: 'text-xs font-semibold text-gray-600' }, props.label),
          props.player
              ? h('button', { class: 'text-[11px] px-1.5 py-0.5 border border-gray-300 rounded hover:bg-gray-50 text-gray-600', onClick: () => emit('clear') }, '제거')
              : null
        ]),
        props.player
            ? h('div', { class: 'mt-1' }, [
              h('div', { class: 'text-sm font-medium text-gray-800 truncate' }, props.player.name),
              h('div', { class: 'text-[11px] text-gray-500 truncate' }, `${props.player.team} · ${props.player.position}`),
              h('div', { class: 'mt-1.5 flex flex-wrap gap-1' },
                  (() => {
                    const b = bonusesForPlayer(props.player!)
                    return Object.entries(b).map(([stat, v]) => {
                      const txt: string[] = []
                      if (v.percent) txt.push(`+${v.percent}%`)
                      if (v.fixed) txt.push(`+${v.fixed}`)
                      if (!txt.length) return null
                      return h('span', { class: 'inline-flex items-center px-1.5 py-0.5 text-[10px] rounded border border-emerald-300 text-emerald-700 bg-emerald-50' }, `${STAT_LABEL[stat] || stat} ${txt.join(' · ')}`)
                    }).filter(Boolean) as any
                  })()
              )
            ])
            : h('div', { class: 'text-[11px] text-gray-400 mt-1' }, '비어있음')
      ])
})
const TinySlot = defineComponent({
  name: 'TinySlot',
  props: { label: { type: String, required: true }, player: { type: Object as () => Player|null, default: null } },
  emits: ['clear'],
  setup: (props, { emit }) => () =>
      h('div', { class: 'rounded-lg bg-white border border-gray-200 px-2 py-1.5 min-h-[50px] shadow-sm' }, [
        h('div', { class: 'text-[11px] font-semibold text-gray-600 mb-1' }, props.label),
        props.player
            ? h('div', { class: 'text-[11px] flex items-center justify-between gap-2' }, [
              h('span', { class: 'truncate font-medium text-gray-700' }, props.player.name),
              h('button', { class: 'text-[10px] px-1.5 py-0.5 border border-gray-300 rounded hover:bg-gray-50 text-gray-500', onClick: () => emit('clear') }, '×')
            ])
            : h('div', { class: 'text-[11px] text-gray-400' }, '비어있음')
      ])
})
</script>

<style scoped>
button:disabled { opacity: .5; cursor: not-allowed; }
</style>

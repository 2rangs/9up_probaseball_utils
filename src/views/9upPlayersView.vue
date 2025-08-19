<script setup lang="ts">
/**
 * Lineup Builder – 통합/클린 + 검색/테이블 고도화
 * - FilterPanel(allFields 방식)과 완전 호환
 * - 모든 조건 필터(이름/팀/연도/등급/포지션/스킬/강화스킬/시너지 AND) 적용
 * - 좌측 테이블에 등급 아이콘 렌더
 */
import { ref, computed, onMounted, defineComponent, h, nextTick, watch } from 'vue'
import Papa from 'papaparse'
import FilterPanel from '@/components/FilterPanel.vue'

/* =========================
   공통 상수/라벨
========================= */
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
interface PlayerRow { _id: string } // 좌측 테이블 행 식별용

const STAT_LABEL: Record<string, string> = {
  power: '파워', contact: '컨택', defense: '수비', running: '주루',
  control: '제구', movement: '무브먼트', stuff: '구위',
  longHitSuppression: '장타 억제', homeRunSuppression: '홈런 억제', runnerControl: '주자 억제'
}

/* =========================
   필드/컬럼 정의 (FilterPanel 호환)
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
  battingHand: '타격 유형',
  throwHand: '투구 유형',
  pitchingType: '투구 폼',
  skill: '스킬',
  synergy: '시너지',
  enhancedSkill: '강화 스킬',
  search: '이름/시너지 검색'
}
const selectFields = computed(() => [
  'grade', 'position', 'battingHand', 'throwHand', 'pitchingType', 'skill', 'search', 'enhancedSkill'
] as const)
const allFields = computed(() => [...inputFields, ...selectFields.value, rarityField])

/* =========================
   상태
========================= */
const players = ref<Raw[]>([])
const filters = ref<Record<string, any>>({})
const synergyOptions = ref<string[]>([])
const currentPage = ref(1)
const pageSize = 20

/* =========================
   유틸
========================= */
const CSV_SPLIT = /[,\u3001;、]+/
const lc = (s: unknown) => String(s ?? '').toLowerCase().trim()
const normText = (s: unknown) =>
    String(s ?? '')
        .normalize('NFKC')
        .replace(/\u200B|\u200C|\u200D|\u2060/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase()
const toArray = (v: any, { allowComma = true }: { allowComma?: boolean } = {}) => {
  if (Array.isArray(v)) return v.map((x:any)=>String(x).trim()).filter(Boolean)
  const s = String(v ?? '').trim()
  if (!s) return []
  if (s.startsWith('[') && s.endsWith(']')) {
    try { const a = JSON.parse(s); return Array.isArray(a) ? a.map((x:any)=>String(x).trim()).filter(Boolean) : [] } catch {}
  }
  const splitter = allowComma ? CSV_SPLIT : /[\u3001;、;]+/
  return s.split(splitter).map(x=>x.replace(/^["']|["']$/g,'').trim()).filter(Boolean)
}
const gradeIcon = (g?: string) => g ? `/assets/grades/${String(g).toUpperCase()}.png` : '/assets/grades/UNKNOWN.png'

/* =========================
   자동완성 소스
========================= */
const nameOptions = computed(() =>
    Array.from(new Set(players.value.map(p => String(p.name || '').trim()))).filter(Boolean)
)

/* =========================
   Synergy 목록 로드
========================= */
async function loadSynergyOptions() {
  try {
    const res = await fetch('/DB/synergys.json', { cache: 'no-store' })
    if (res.ok) {
      const json = await res.json()
      const arr: string[] = Array.isArray(json)
          ? json.map((x: any) => (typeof x === 'string' ? x : x?.synergy)).filter(Boolean)
          : []
      synergyOptions.value = Array.from(new Set(arr.map(s => String(s).trim()))).sort((a,b)=>a.localeCompare(b))
      return
    }
  } catch {}
  // fallback: CSV에서 수집
  const tokens: string[] = []
  for (const p of players.value) toArray(p.synergy).forEach(t => tokens.push(String(t)))
  synergyOptions.value = Array.from(new Set(tokens.map(s => s.trim()))).sort((a,b)=>a.localeCompare(b))
}

/* =========================
   Filter Options
========================= */
const filterOptions = computed(() => {
  const opts: Record<string, Set<string>> = {}
  const scan = [...selectFields.value, 'team', 'grade', 'skill'] as const
  for (const f of scan) {
    opts[f] = new Set<string>()
    for (const p of players.value) {
      const raw = p[f as string]; if (raw==null || raw==='') continue
      if (f === 'position')       toArray(raw).forEach(v => opts[f].add(String(v)))
      else if (f === 'enhancedSkill') toArray(raw, { allowComma:false }).forEach(v => opts[f].add(v))
      else                        toArray(raw).forEach(v => opts[f].add(v))
    }
  }
  // 검색 제안
  const searchSet = new Set<string>()
  for (const p of players.value) {
    if (p.name) searchSet.add(String(p.name).trim())
    toArray(p.synergy).forEach(v => searchSet.add(v))
    toArray(p.team).forEach(v => searchSet.add(v))
    toArray(p.skill).forEach(v => searchSet.add(v))
  }
  opts['searchSuggestions'] = searchSet
  return Object.fromEntries(Object.entries(opts).map(([k,set]) => [k, [...set].sort((a,b)=>a.localeCompare(b))]))
})

/* =========================
   Preprocessed players
========================= */
type Prepared = {
  raw: Raw
  nameNorm: string
  teamLc: string[]
  skillLc: string[]
  enhancedSkillLc: string[]
  positionLc: string[]
  yearsNum: number[]
  synergyNormSet: Set<string>
}
const preparedPlayers = computed<Prepared[]>(() =>
    players.value.map(p => ({
      raw: p,
      nameNorm: normText(p.name),
      teamLc: toArray(p.team).map(lc),
      skillLc: toArray(p.skill).map(lc),
      enhancedSkillLc: toArray(p.enhancedSkill, { allowComma:false }).map(lc),
      positionLc: toArray(p.position).map(lc),
      yearsNum: toArray(p.year).map((n:any)=>Number(n)).filter((n:any)=>!Number.isNaN(n)),
      synergyNormSet: new Set(toArray(p.synergy).map(normText))
    }))
)

/* =========================
   Filtering
========================= */
const filteredPlayers = computed(() => {
  return preparedPlayers.value
      .filter(({ raw: p, teamLc, skillLc, enhancedSkillLc, positionLc, yearsNum, nameNorm, synergyNormSet }) => {
        for (const field of allFields.value) {
          const sel = filters.value[field]
          if (!sel || (Array.isArray(sel) && sel.length===0)) continue

          if (field === rarityField) { if (Number(p[field]) !== Number(sel)) return false; continue }
          if (field === 'team')      { if (!(sel as string[]).some(s => teamLc.includes(lc(s)))) return false; continue }
          if (field === 'year')      { if (!(sel as string[]).every(s => yearsNum.includes(Number(s)))) return false; continue }
          if (field === 'skill')     { if (!(sel as string[]).every(s => skillLc.includes(lc(s)))) return false; continue }
          if (field === 'enhancedSkill') { if (!(sel as string[]).every(s => enhancedSkillLc.includes(lc(s)))) return false; continue }
          if (field === 'position')  { if (!(sel as string[]).every(s => positionLc.includes(lc(s)))) return false; continue }
          if (field === 'name') {
            const want = normText(sel)
            if (want && !nameNorm.includes(want)) return false
            continue
          }
          if (field === 'synergy') {
            const terms = Array.isArray(sel) ? (sel as string[]).map(normText)
                : String(sel).split(/[,\s]+/).filter(Boolean).map(normText)
            if (terms.length && !terms.every(t => synergyNormSet.has(t))) return false
            continue
          }

          // 기본 동등 비교
          if (Array.isArray(sel)) {
            if (!(sel as unknown[]).map(String).includes(String(p[field]))) return false
          } else {
            if (String(p[field]) !== String(sel)) return false
          }
        }
        return true
      })
      .map(pp => ({ _id: String(pp.raw.id ?? `${pp.raw.name}-${pp.raw.team}-${pp.raw.year}`), ...pp.raw })) as (Raw & PlayerRow)[]
})

/* =========================
   Pagination
========================= */
const totalCount = computed(() => filteredPlayers.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(totalCount.value / pageSize)))
const paginatedPlayers = computed(() => {
  const start = (currentPage.value-1) * pageSize
  return filteredPlayers.value.slice(start, start + pageSize)
})
const page = computed({
  get: () => currentPage.value,
  set: (v:number) => currentPage.value = Math.min(Math.max(1, Math.trunc(v||1)), totalPages.value)
})
const goToPage = (pn:number) => { page.value = pn }

/* =========================
   Watchers
========================= */
watch(() => ({ ...filters.value }), () => { currentPage.value = 1 }, { deep: true })

/* =========================
   Load CSV
========================= */
onMounted(loadCsv)
async function loadCsv() {
  const res = await fetch('/DB/sample_sorted.csv', { cache: 'no-store' })
  const text = await res.text()
  const out: Raw[] = []
  Papa.parse(text, { header:true, skipEmptyLines:true, complete: ({ data }) => { (data as Raw[]).forEach(r=>out.push(r)) } })
  players.value = out
  await nextTick()

  // 초기 필터 셋업
  const grades = (filterOptions.value.grade ?? []) as string[]
  if (!Array.isArray(filters.value.grade) || filters.value.grade.length===0) filters.value.grade = grades
  if (typeof filters.value.name !== 'string') filters.value.name = ''
  if (!Array.isArray(filters.value.synergy))  filters.value.synergy = []
  if (!Array.isArray(filters.value.search))   filters.value.search  = []

  await loadSynergyOptions()
  currentPage.value = 1
}

/* =========================
   라인업/시너지 (필요한 부분만)
========================= */
type SlotKey = 'C'|'1B'|'2B'|'3B'|'SS'|'LF'|'CF'|'RF'|'DH'|'SP'|'RP'
type LineupState = {
  C: Raw|null, '1B': Raw|null, '2B': Raw|null, '3B': Raw|null, SS: Raw|null,
  LF: Raw|null, CF: Raw|null, RF: Raw|null, DH: Raw|null,
  SP1: Raw|null, SP2: Raw|null, SP3: Raw|null, SP4: Raw|null, SP5: Raw|null,
  RP1: Raw|null, RP2: Raw|null, RP3: Raw|null, RP4: Raw|null, RP5: Raw|null, RP6: Raw|null
}
const lineup = ref<LineupState>({
  C:null,'1B':null,'2B':null,'3B':null,SS:null, LF:null,CF:null,RF:null,DH:null,
  SP1:null,SP2:null,SP3:null,SP4:null,SP5:null, RP1:null,RP2:null,RP3:null,RP4:null,RP5:null,RP6:null
})
const SLOT_LABEL: Record<string,string> = { C:'포수','1B':'1루','2B':'2루','3B':'3루',SS:'유격',LF:'좌익',CF:'중견',RF:'우익',DH:'지타',SP:'선발',RP:'불펜' }
const isPitcher = (p: Raw) => /(^|\W)P(\W|$)|SP|RP/i.test(String(p.position ?? ''))
const clearSlot = (slot: keyof LineupState) => { lineup.value[slot] = null }
const assignToSlot = (slot: string|undefined, p: Raw) => {
  if (!slot) return
  if (slot === 'DH') { if (isPitcher(p)) { alert('DH에는 타자만 가능합니다.'); return } }
  else if (slot.startsWith('SP')) { if (!toArray(p.position).map(x=>x.toUpperCase()).includes('SP')) { alert('선발만 배치 가능'); return } }
  else if (slot.startsWith('RP')) { if (!toArray(p.position).map(x=>x.toUpperCase()).includes('RP')) { alert('불펜만 배치 가능'); return } }
  else {
    const ok = toArray(p.position).map(x=>x.toUpperCase()).includes(slot.toUpperCase())
    if (!ok) { alert(`${SLOT_LABEL[slot]} 슬롯에 배치 불가`); return }
  }
  (Object.keys(lineup.value) as (keyof LineupState)[]).forEach(k => { if (lineup.value[k]?.id === p.id) lineup.value[k] = null })
  lineup.value[slot as keyof LineupState] = p
}
const SlotChip = defineComponent({
  name: 'SlotChip',
  props: { label: { type:String, required:true }, player: { type: Object as ()=>Raw|null, default:null } },
  emits: ['clear'],
  setup: (props, { emit }) => () =>
      h('div', { class:'rounded-xl border border-gray-200 bg-white px-3 py-2 min-h-[60px] shadow-sm' }, [
        h('div', { class:'flex items-center justify-between gap-2' }, [
          h('span', { class:'text-xs font-semibold text-gray-600' }, props.label),
          props.player ? h('button', { class:'text-[11px] px-1.5 py-0.5 border border-gray-300 rounded hover:bg-gray-50 text-gray-600', onClick:()=>emit('clear') }, '제거') : null
        ]),
        props.player
            ? h('div', { class:'mt-1' }, [
              h('div', { class:'text-sm font-medium text-gray-800 truncate' }, String(props.player.name || '')),
              h('div', { class:'text-[11px] text-gray-500 truncate' }, `${props.player.team ?? ''} · ${props.player.position ?? ''}`),
            ])
            : h('div', { class:'text-[11px] text-gray-400 mt-1' }, '비어있음')
      ])
})
const TinySlot = defineComponent({
  name: 'TinySlot',
  props: { label: { type:String, required:true }, player:{ type:Object as ()=>Raw|null, default:null } },
  emits: ['clear'],
  setup: (props,{emit}) => () =>
      h('div', { class:'rounded-lg bg-white border border-gray-200 px-2 py-1.5 min-h-[50px] shadow-sm' }, [
        h('div', { class:'text-[11px] font-semibold text-gray-600 mb-1' }, props.label),
        props.player
            ? h('div', { class:'text-[11px] flex items-center justify-between gap-2' }, [
              h('span', { class:'truncate font-medium text-gray-700' }, String(props.player.name||'')),
              h('button', { class:'text-[10px] px-1.5 py-0.5 border border-gray-300 rounded hover:bg-gray-50 text-gray-500', onClick:()=>emit('clear') }, '×')
            ])
            : h('div', { class:'text-[11px] text-gray-400' }, '비어있음')
      ])
})

/* =========================
   시너지 집계 (우측 패널)
========================= */
const synergys = ref<JsonSynergy[]>([])
const reloadSynergy = async () => { try { await loadSynergy() } catch(e){ console.error(e); alert('시너지 파일 로드 실패') } }
async function loadSynergy() {
  const res = await fetch('/DB/synergys.json', { cache: 'no-store' })
  if (!res.ok) throw new Error(`synergy load: ${res.status}`)
  const json = await res.json()
  if (!Array.isArray(json)) throw new Error('synergys.json must be an array')
  synergys.value = json
}
onMounted(async () => { await loadSynergy() })

const lineupTags = computed(() => {
  const tags: string[] = []
  ;(Object.keys(lineup.value) as (keyof LineupState)[]).forEach(k => {
    const p = lineup.value[k]; if (!p) return
    toArray(p.synergy).forEach(t => tags.push(t.trim()))
  })
  return tags
})
function cmp(op: CountOp, lhs: number, rhsOrMin?: number, max?: number) {
  if (op==='==') return lhs === (rhsOrMin ?? 0)
  if (op=== '>=') return lhs >= (rhsOrMin ?? 0)
  if (op=== '<=') return lhs <= (rhsOrMin ?? 0)
  if (op===  '>') return lhs >  (rhsOrMin ?? 0)
  if (op===  '<') return lhs <  (rhsOrMin ?? 0)
  if (op==='between') return lhs >= (rhsOrMin ?? 0) && lhs <= (max ?? Number.POSITIVE_INFINITY)
  return false
}
const synergyIndex = computed(() => {
  const index = new Map<string, {
    count: number, chosen: JsonCond|null, condText: string|null,
    appliesTo: string[], next: { cond: JsonCond, need: number, text: string } | null, synergy: JsonSynergy
  }>()
  const tags = lineupTags.value.map(t => t.trim())
  for (const s of synergys.value) {
    const name = String(s.synergy).trim()
    const count = tags.filter(t => t === name).length
    const all = s.conditions.map(c => {
      const isBetween = 'op' in c.count && c.count.op==='between'
      const upper = isBetween ? (c.count as any).max : (c.count as any).value
      const lower = isBetween ? (c.count as any).min : (c.count as any).value
      const text  = isBetween ? `between ${lower}~${upper}명` : `${(c.count as any).op} ${upper}명`
      return { raw:c, upper:Number(upper ?? 0), text }
    }).sort((a,b)=>a.upper-b.upper)
    const matched = all.filter(({raw}) => {
      const c:any = raw.count
      return c.op==='between' ? cmp('between', count, c.min, c.max) : cmp(c.op, count, c.value)
    })
    let chosen: JsonCond|null = null, condText: string|null = null
    if (matched.length) { matched.sort((a,b)=>(b.upper-a.upper) || ((b.raw.bonus.value??0)-(a.raw.bonus.value??0))); chosen = matched[0].raw; condText = matched[0].text }
    const bigger = all.find(c => count < c.upper) || null
    const next = bigger ? { cond:bigger.raw, need:bigger.upper, text:bigger.text } : null
    const appliesTo = chosen
        ? (Object.values(lineup.value).filter(Boolean) as Raw[])
            .filter(p => toArray(p.synergy).map(t=>t.trim()).includes(name))
            .map(p => String(p.name||''))
        : []
    index.set(name, { count, chosen, condText, appliesTo, next, synergy: s })
  }
  return index
})
const activeList = computed(() => {
  const out: Array<{ name:string, count:number, chosen:JsonCond, appliesTo:string[], condText:string }> = []
  for (const [name, rec] of synergyIndex.value.entries()) if (rec.chosen)
    out.push({ name, count:rec.count, chosen:rec.chosen, appliesTo:rec.appliesTo, condText:rec.condText! })
  return out.sort((a,b)=> (b.chosen.bonus.value??0) - (a.chosen.bonus.value??0))
})
const inactiveList = computed(() => {
  const out: Array<{name:string,count:number,nextNeed:number,needLeft:number,progress:number,nextText:string,nextEffectTitle:string,nextEffectDesc?:string}> = []
  for (const [name, rec] of synergyIndex.value.entries()) {
    if (rec.chosen || !rec.next) continue
    const nextNeed = rec.next.need
    const needLeft = Math.max(0, nextNeed - rec.count)
    const maxNeed = rec.synergy.conditions.reduce((m,c)=>{
      const isBetween = 'op' in c.count && c.count.op==='between'
      const u = isBetween ? (c.count as any).max : (c.count as any).value
      return Math.max(m, Number(u ?? 0))
    }, nextNeed)
    const progress = Math.max(0, Math.min(100, Math.round((rec.count / maxNeed) * 100)))
    const stat = rec.next.cond.stat, bonus = rec.next.cond.bonus
    const title = `${STAT_LABEL[stat] || stat} +${bonus.value}${bonus.unit==='percent'?'%':''}`
    const desc  = rec.synergy.synergy_effect || rec.synergy.description || ''
    out.push({ name, count:rec.count, nextNeed, needLeft, progress, nextText:`다음 단계: ${nextNeed}명 필요`, nextEffectTitle:title, nextEffectDesc: desc || undefined })
  }
  return out.sort((a,b)=>a.needLeft-b.needLeft)
})
</script>

<template>
  <div class="w-full h-screen p-5 box-border bg-gray-50">
    <div class="h-full flex gap-5">
      <!-- ================= 좌측: 선수 테이블(이름 기본 + 시너지 AND 고급) ================= -->
      <section class="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col h-[calc(100vh-2.5rem)] min-w-[380px] w-[520px]">
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

        <!-- ======= 테이블(등급 아이콘 포함) ======= -->
        <div class="flex-1 overflow-y-auto">
          <table class="w-full text-sm">
            <thead class="sticky top-0 bg-gray-50 border-y">
            <tr class="text-gray-600">
              <th class="px-3 py-2 text-left w-24">등급</th>
              <th class="px-3 py-2 text-left w-32">이름</th>
              <th class="px-3 py-2 text-left">팀</th>
              <th class="px-3 py-2 text-left w-24">연도</th>
              <th class="px-3 py-2 text-left">포지션</th>
              <th class="px-3 py-2 text-left">스킬</th>
              <th class="px-3 py-2 text-left">시너지</th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="p in paginatedPlayers" :key="p._id" class="border-t hover:bg-blue-50/30">
              <td class="px-3 py-2">
                <div class="flex items-center gap-2">
                  <img :src="`/public/assets/logo/grade/${p.grade}.png`" class="w-5 h-5" alt="grade" />
                  <span class="text-gray-800">{{ p.grade }}</span>
                </div>
              </td>
              <td class="px-3 py-2 font-medium text-gray-900">{{ p.name }}</td>
              <td class="px-3 py-2 text-gray-700">{{ p.team }}</td>
              <td class="px-3 py-2 text-gray-700">{{ (toArray(p.year).join(', ')) }}</td>
              <td class="px-3 py-2 text-gray-700">{{ (toArray(p.position).join(', ')) }}</td>
              <td class="px-3 py-2 text-gray-700 truncate max-w-[200px]">
                {{ (toArray(p.skill).slice(0,5).join(', ')) }}<span v-if="toArray(p.skill).length>5">…</span>
              </td>
              <td class="px-3 py-2 text-gray-700 truncate max-w-[220px]">
                {{ (toArray(p.synergy).slice(0,5).join(', ')) }}<span v-if="toArray(p.synergy).length>5">…</span>
              </td>
            </tr>
            <tr v-if="!paginatedPlayers.length">
              <td colspan="7" class="px-3 py-10 text-center text-gray-500">선수 없음</td>
            </tr>
            </tbody>
          </table>
        </div>

        <!-- 페이징 -->
        <div v-if="totalPages > 1" class="p-3 border-t flex items-center justify-end gap-2">
          <button class="px-2 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-50"
                  :disabled="page===1" @click="goToPage(1)">«</button>
          <button class="px-2 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-50"
                  :disabled="page===1" @click="goToPage(page-1)">‹</button>
          <span class="px-2 text-sm">{{ page }} / {{ totalPages }}</span>
          <button class="px-2 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-50"
                  :disabled="page===totalPages" @click="goToPage(page+1)">›</button>
          <button class="px-2 py-1.5 border border-gray-300 rounded text-xs hover:bg-gray-50 disabled:opacity-50"
                  :disabled="page===totalPages" @click="goToPage(totalPages)">»</button>
        </div>

        <!-- 만약 기존 PlayerTable을 꼭 써야 하면 위 테이블을 주석 처리하고 아래를 해제하세요 -->
        <!-- <PlayerTable :items="paginatedPlayers" :columns="columns" /> -->
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

<style scoped>
button:disabled { opacity: .5; cursor: not-allowed; }
thead th { position: sticky; top: 0; }
</style>

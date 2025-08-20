<script setup lang="ts">
import { ref, computed, onMounted, defineComponent, h, nextTick, watch, reactive } from 'vue'
import Papa from 'papaparse'
import { Star, ChevronDown, ChevronUp } from 'lucide-vue-next'

/* =========================
   타입
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
interface PlayerRow { _id: string }

interface TeamHistory { key: string; name: string; logo: string }
interface TeamSetting { id: number|string; key: string; name: string; history: TeamHistory[] }

/* =========================
   상수/라벨
========================= */
const STAT_LABEL: Record<string, string> = {
  power: '파워', contact: '컨택', defense: '수비', running: '주루',
  control: '제구', movement: '무브먼트', stuff: '구위',
  longHitSuppression: '장타 억제', homeRunSuppression: '홈런 억제', runnerControl: '주자 억제'
}
const CSV_SPLIT = /[,\u3001;、]+/

/* =========================
   유틸
========================= */
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

/* 포지션 표기 정규화: B1/B2/B3 → 1B/2B/3B 등 */
const POS_ALIAS: Record<string, string> = {
  // 1루/2루/3루
  'b1': '1B', '1b': '1B', '1': '1B', '1루': '1B',
  'b2': '2B', '2b': '2B', '2': '2B', '2루': '2B',
  'b3': '3B', '3b': '3B', '3': '3B', '3루': '3B',
  // 포수/유격
  'c': 'C', '포': 'C',
  'ss': 'SS', '유격': 'SS',
  // 외야
  'lf': 'LF', '좌익': 'LF',
  'cf': 'CF', '중견': 'CF',
  'rf': 'RF', '우익': 'RF',
  // 투/지타
  'sp': 'SP', '선발': 'SP',
  'rp': 'RP', '불펜': 'RP',
  'dh': 'DH', '지타': 'DH',
}
function normalizePos(p: any): string {
  const s = String(p ?? '').trim()
  if (!s) return ''
  const lower = s.toLowerCase()
  return POS_ALIAS[lower] ?? s.toUpperCase()
}

function translateDirection(v: string | null | undefined) {
  const s = String(v ?? '').toUpperCase()
  if (!s) return '양'
  if (s === 'L' || s.includes('LEFT')) return '좌'
  if (s === 'R' || s.includes('RIGHT')) return '우'
  if (s === 'S' || s.includes('SWITCH')) return '양'
  return s
}
function translatePitchingType(v: string | null | undefined) {
  const s = String(v ?? '').toUpperCase()
  if (s.includes('OVER')) return '오버핸드'
  if (s.includes('THREE') || s.includes('3/4') || s.includes('LOW')) return '쓰리쿼터'
  if (s.includes('SIDE')) return '사이드암'
  if (s.includes('SUB') || s.includes('UNDER')) return '언더핸드'
  return v ?? ''
}

/* =========================
   로딩/데이터
========================= */
const isLoading = ref(true)
const players = ref<Raw[]>([])

onMounted(loadCsv)
async function loadCsv() {
  try{
    const res = await fetch('/DB/sample_sorted.csv', { cache: 'no-store' })
    const text = await res.text()
    const out: Raw[] = []
    Papa.parse(text, { header:true, skipEmptyLines:true, complete: ({ data }) => { (data as Raw[]).forEach(r=>out.push(r)) } })
    players.value = out
    await nextTick()
    await loadSynergyOptions()
  } finally {
    isLoading.value = false
  }
}

/* =========================
   팀 설정 (로고/이름)
========================= */
const teamData = ref<TeamSetting[]>([])

function findTeamLogoByKey(teamKey: string): string | null {
  for (const team of teamData.value) {
    for (const history of team.history) {
      if (history.key === teamKey) return history.logo
    }
  }
  return null
}
function findTeamLogoByName(teamKeyOrName: string): string {
  const key = String(teamKeyOrName ?? '')
  for (const team of teamData.value) {
    if (team.key === key) return team.name
    for (const h of team.history) {
      if (h.key === key || h.name === key) return h.name
    }
  }
  return key
}
function findTeamLogoByKeyOrFallback(teamKey: string): string {
  const logo = findTeamLogoByKey(teamKey)
  return logo ?? '/assets/logos/teams/unknown.png'
}

/* =========================
   검색 상태
========================= */
const q = reactive<{
  name: string
  search: string
  team: string[]
  year: string[]
  grade: string[]
  position: string[]
  skill: string[]
  enhancedSkill: string[]
  synergy: string[]
  rarity: number | null
}>({
  name: '',
  search: '',
  team: [],
  year: [],
  grade: [],
  position: [],
  skill: [],
  enhancedSkill: [],
  synergy: [],
  rarity: null
})

/* =========================
   활성 필터 요약칩
========================= */
const activeChips = computed(() => {
  const chips: Array<{key:string,label:string,value:string,clear:()=>void}> = []
  const push = (key:string,label:string,val:any,clear:()=>void) => {
    if (val == null) return
    if (Array.isArray(val) && val.length===0) return
    const value = Array.isArray(val) ? val.join(', ') : String(val)
    if (!value) return
    chips.push({ key, label, value, clear })
  }
  push('name','이름', q.name, () => q.name = '')
  push('search','검색', q.search, () => q.search = '')
  push('team','팀', q.team, () => q.team = [])
  push('year','연도', q.year, () => q.year = [])
  push('grade','등급', q.grade, () => q.grade = [])
  push('position','포지션', q.position, () => q.position = [])
  push('skill','스킬', q.skill, () => q.skill = [])
  push('enhancedSkill','강화', q.enhancedSkill, () => q.enhancedSkill = [])
  push('synergy','시너지', q.synergy, () => q.synergy = [])
  if (q.rarity !== null) push('rarity','레어도', q.rarity, () => q.rarity = null)
  return chips
})

/* =========================
   고급토글/옵션
========================= */
const advancedOpen = ref(false)
const opts = computed(() => {
  const o: Record<string, Set<string>> = {
    team: new Set(), year: new Set(), grade: new Set(), position: new Set(), skill: new Set(), enhancedSkill: new Set(),
  }
  for (const p of players.value) {
    toArray(p.team).forEach(v => o.team.add(v))
    toArray(p.year).forEach(v => o.year.add(String(v)))
    toArray(p.grade).forEach(v => o.grade.add(v))
    toArray(p.position).forEach(v => o.position.add(v))
    toArray(p.skill).forEach(v => o.skill.add(v))
    toArray(p.enhancedSkill, { allowComma:false }).forEach(v => o.enhancedSkill.add(v))
  }
  return {
    team: [...o.team].sort(),
    year: [...o.year].sort((a,b)=>Number(a)-Number(b)),
    grade: [...o.grade].sort(),
    position: [...o.position].sort(),
    skill: [...o.skill].sort(),
    enhancedSkill: [...o.enhancedSkill].sort(),
  }
})

/* =========================
   시너지 옵션 로드
========================= */
const synergyOptions = ref<string[]>([])
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
  const tokens: string[] = []
  for (const p of players.value) toArray(p.synergy).forEach(t => tokens.push(String(t)))
  synergyOptions.value = Array.from(new Set(tokens.map(s => s.trim()))).sort((a,b)=>a.localeCompare(b))
}

/* =========================
   전처리
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
   필터링
========================= */
const filteredPlayers = computed(() => {
  const tokens = q.search
      ? q.search.split(/[,\s]+/).map(t=>t.trim()).filter(Boolean).map(normText)
      : []

  return preparedPlayers.value
      .filter(({ raw: p, nameNorm, teamLc, positionLc, skillLc, enhancedSkillLc, yearsNum, synergyNormSet }) => {
        if (q.name && !nameNorm.includes(normText(q.name))) return false
        if (q.team.length && !q.team.some(t => teamLc.includes(lc(t)))) return false
        if (q.year.length && !q.year.every(y => yearsNum.includes(Number(y)))) return false
        if (q.grade.length && !q.grade.map(String).includes(String(p.grade))) return false
        if (q.rarity != null && Number(p.rarity) !== Number(q.rarity)) return false
        if (q.position.length && !q.position.every(v => positionLc.includes(lc(v)))) return false
        if (q.skill.length && !q.skill.every(v => skillLc.includes(lc(v)))) return false
        if (q.enhancedSkill.length && !q.enhancedSkill.every(v => enhancedSkillLc.includes(lc(v)))) return false
        if (q.synergy.length && !q.synergy.map(normText).every(t => synergyNormSet.has(t))) return false

        if (tokens.length) {
          const hay = new Set<string>([
            nameNorm, ...teamLc, ...positionLc, ...skillLc, ...Array.from(synergyNormSet), ...yearsNum.map(String)
          ])
          const ok = tokens.some(t => hay.has(t) || nameNorm.includes(t))
          if (!ok) return false
        }
        return true
      })
      .map(pp => ({ _id: String(pp.raw.id ?? `${pp.raw.name}-${pp.raw.team}-${pp.raw.year}`), ...pp.raw })) as (Raw & PlayerRow)[]
})

/* =========================
   정렬
========================= */
const sortKey = ref<'name'|'team'|'synergy'|null>(null)
const sortDir = ref<'asc'|'desc'>('asc')
const sortedPlayers = computed(() => {
  if (!sortKey.value) return filteredPlayers.value
  const dir = sortDir.value==='asc' ? 1 : -1
  return [...filteredPlayers.value].sort((a:any,b:any)=>{
    const getVal = (row:any) => {
      if (sortKey.value==='synergy') return toArray(row.synergy).join(', ')
      if (sortKey.value==='team') return toArray(row.team).join(', ')
      return (row[sortKey.value!] ?? '').toString()
    }
    const va = getVal(a), vb = getVal(b)
    return va.localeCompare(vb, undefined, { numeric:true, sensitivity:'base' }) * dir
  })
})

/* =========================
   페이지네이션
========================= */
const pageSize = 20
const currentPage = ref(1)
watch(q, () => { currentPage.value = 1 }, { deep: true })
watch([sortKey, sortDir], () => { currentPage.value = 1 })

const total = computed(() => sortedPlayers.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const paginatedPlayers = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return sortedPlayers.value.slice(start, start + pageSize)
})

function goFirst(){ currentPage.value = 1 }
function goPrev(){ if (currentPage.value>1) currentPage.value-- }
function goNext(){ if (currentPage.value<totalPages.value) currentPage.value++ }
function goLast(){ currentPage.value = totalPages.value }
function resetFilters(){
  q.name=''; q.search='';
  q.team=[]; q.year=[]; q.grade=[]; q.position=[]; q.skill=[]; q.enhancedSkill=[]; q.synergy=[];
  q.rarity=null;
  sortKey.value = null; sortDir.value = 'asc'
}

/* =========================
   라인업/슬롯
========================= */
const lineup = ref({
  C:null,'1B':null,'2B':null,'3B':null,SS:null, LF:null,CF:null,RF:null,DH:null,
  SP1:null,SP2:null,SP3:null,SP4:null,SP5:null, RP1:null,RP2:null,RP3:null,RP4:null,RP5:null,RP6:null
} as Record<string, Raw|null>)
const SLOT_LABEL: Record<string,string> = { C:'포수','1B':'1루','2B':'2루','3B':'3루',SS:'유격',LF:'좌익',CF:'중견',RF:'우익',DH:'지타',SP:'선발',RP:'불펜' }
const isPitcher = (p: Raw) => /(^|\W)P(\W|$)|SP|RP/i.test(String(p.position ?? ''))
const clearSlot = (slot: keyof typeof lineup.value) => { lineup.value[slot] = null }

/* 선택한 슬롯으로 바로 배치(정규화 + JSON.parse 우선) */
const assignToSlot = (slot: string | undefined, p: Raw) => {
  if (!slot) return

  // 1) position 배열 추출 + 정규화
  let posList: string[] = []
  try {
    const parsed = typeof p.position === 'string' ? JSON.parse(p.position) : p.position
    posList = (Array.isArray(parsed) ? parsed : toArray(p.position)).map(normalizePos).filter(Boolean)
  } catch {
    posList = toArray(p.position).map(normalizePos).filter(Boolean)
  }

  const s = normalizePos(slot)

  // 2) 슬롯별 검증
  if (s === 'DH') {
    if (isPitcher(p)) { alert('DH에는 타자만 가능합니다.'); return }
  } else if (s.startsWith('SP')) {
    if (!posList.includes('SP')) { alert('선발만 배치 가능'); return }
  } else if (s.startsWith('RP')) {
    if (!posList.includes('RP')) { alert('불펜만 배치 가능'); return }
  } else {
    if (!posList.includes(s)) { alert(`${SLOT_LABEL[s] ?? s} 슬롯에 배치 불가`); return }
  }

  // 3) 동일 선수 중복 제거 후 지정 슬롯에 세팅
  Object.keys(lineup.value).forEach(k => { if (lineup.value[k]?.id === p.id) lineup.value[k] = null })
  lineup.value[s] = p
}

/* 자동 배치(보강: 정규화 기반) */
const autoAssign = (p: Raw) => {
  if (!p) return
  Object.keys(lineup.value).forEach(k => { if (lineup.value[k]?.id === p.id) lineup.value[k] = null })

  // 정규화된 포지션 리스트
  const posList = (() => {
    try {
      const parsed = typeof p.position === 'string' ? JSON.parse(p.position) : p.position
      return (Array.isArray(parsed) ? parsed : toArray(p.position)).map(normalizePos).filter(Boolean)
    } catch {
      return toArray(p.position).map(normalizePos).filter(Boolean)
    }
  })()

  const isPit = posList.includes('SP') || posList.includes('RP')

  if (!isPit) {
    const order = ['C','1B','2B','3B','SS','LF','CF','RF','DH'] as const
    for (const k of order) {
      if (k === 'DH') {
        if (!lineup.value[k]) { lineup.value[k] = p; return }
      } else if (posList.includes(k)) {
        if (!lineup.value[k]) { lineup.value[k] = p; return }
      }
    }
    alert('배치 가능한 타자 슬롯이 없습니다.')
  } else {
    const spOrder = ['SP1','SP2','SP3','SP4','SP5'] as const
    const rpOrder = ['RP1','RP2','RP3','RP4','RP5','RP6'] as const
    if (posList.includes('SP')) for (const k of spOrder) if (!lineup.value[k]) { lineup.value[k] = p; return }
    if (posList.includes('RP')) for (const k of rpOrder) if (!lineup.value[k]) { lineup.value[k] = p; return }
    alert('배치 가능한 투수 슬롯이 없습니다.')
  }
}

/* =========================
   슬롯 컴포넌트
========================= */
const SlotChip = defineComponent({
  name: 'SlotChip',
  props: { label: { type:String, required:true }, player: { type: Object as ()=>Raw|null, default:null } },
  emits: ['clear'],
  setup: (props, { emit }) => () =>
      h('div', { class:'rounded-xl border border-gray-200 bg-white/80 backdrop-blur px-3 py-2 min-h-[64px] shadow-sm hover:shadow transition-shadow' }, [
        h('div', { class:'flex items-center justify-between gap-2' }, [
          h('span', { class:'text-xs font-semibold text-gray-700' }, props.label),
          props.player ? h('button', { class:'text-[10px] px-1.5 py-0.5 border border-gray-300/80 rounded hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors', onClick:()=>emit('clear') }, '제거') : null
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
      h('div', { class:'rounded-lg bg-white/80 border border-gray-200 px-2 py-1.5 min-h-[50px] shadow-sm hover:shadow transition-shadow' }, [
        h('div', { class:'text-[11px] font-semibold text-gray-700 mb-1' }, props.label),
        props.player
            ? h('div', { class:'text-[11px] flex items-center justify-between gap-2' }, [
              h('span', { class:'truncate font-medium text-gray-700' }, String(props.player.name||'')),
              h('button', { class:'text-[10px] px-1.5 py-0.5 border border-gray-300/80 rounded hover:bg-gray-50 text-gray-500 hover:text-gray-700 transition-colors', onClick:()=>emit('clear') }, '×')
            ])
            : h('div', { class:'text-[11px] text-gray-400' }, '비어있음')
      ])
})

/* =========================
   시너지 계산
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

onMounted(async () => {
  try {
    await loadSynergy()
  } catch(e){
    console.error(e)
  }

  try {
    const res = await fetch('/DB/setting.json', { cache: 'no-store' })
    if (!res.ok) throw new Error(`setting.json ${res.status}`)
    const json = await res.json()
    teamData.value = Array.isArray(json) ? (json as TeamSetting[]) : []
  } catch (e) {
    console.error('팀 세팅 로드 실패', e)
    teamData.value = []
  }
})

const lineupTags = computed(() => {
  const tags: string[] = []
  Object.keys(lineup.value).forEach(k => {
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

/* =========================
   모바일 카드: 더보기 상태
========================= */
const expandedRowIndex = ref<number | null>(null)
const toggleExpanded = (i: number) => {
  expandedRowIndex.value = expandedRowIndex.value === i ? null : i
}
</script>

<template>
  <div class="w-full h-screen p-5 box-border bg-gray-50">
    <div class="h-full flex gap-5">
      <!-- ============== 좌측: 자체 검색폼 + 카드 리스트 ============== -->
      <section class="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col h-[calc(100vh-2.5rem)] min-w-[400px] w-[520px]">
        <header class="p-4 border-b border-gray-100 bg-white sticky top-0 z-30">
          <h1 class="text-lg font-semibold text-gray-900">선수 목록</h1>
        </header>

        <!-- 상단 요약 바 -->
        <div class="px-4 py-2 bg-white border-b border-gray-100 sticky top-[64px] z-20">
          <div class="flex items-center gap-2">
            <span class="inline-flex items-center gap-1 text-xs font-medium text-gray-700">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none"><path d="M21 21l-4.2-4.2M11 19a8 8 0 100-16 8 8 0 000 16z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              필터
            </span>
            <div class="flex flex-wrap gap-1.5">
              <button v-for="chip in activeChips" :key="chip.key"
                      @click="chip.clear()"
                      class="group inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200">
                <span class="font-medium text-gray-700">{{ chip.label }}</span>
                <span class="text-gray-500">·</span>
                <span class="text-gray-600">{{ chip.value }}</span>
                <svg class="w-3 h-3 text-gray-500 group-hover:text-gray-700" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 8.586l4.95-4.95 1.414 1.414L11.414 10l4.95 4.95-1.414 1.414L10 11.414l-4.95 4.95-1.414-1.414L8.586 10l-4.95-4.95L5.05 3.636 10 8.586z" clip-rule="evenodd"/></svg>
              </button>
              <span v-if="!activeChips.length" class="text-xs text-gray-400">선택된 필터 없음</span>
            </div>
            <div class="ml-auto flex items-center gap-2">
              <span class="text-xs text-gray-500">총 {{ total }}명</span>
              <button type="button" class="px-2 py-1.5 text-xs border rounded hover:bg-gray-50"
                      @click="resetFilters">전체 초기화</button>
            </div>
          </div>
        </div>

        <!-- 검색폼 -->
        <form class="p-3 border-b border-gray-100 grid grid-cols-2 gap-2 text-xs sticky top-[104px] bg-white z-10" @submit.prevent>
          <!-- 이름 -->
          <div class="col-span-2">
            <label class="block mb-1 font-medium text-gray-700">이름</label>
            <input v-model.trim="q.name" type="text" placeholder="예: 이정후" class="w-full border rounded px-2 py-1.5"/>
          </div>

          <!-- 통합 검색 -->
          <div class="col-span-2">
            <label class="block mb-1 font-medium text-gray-700">통합 검색(이름/팀/연도/포지션/시너지/스킬)</label>
            <input v-model.trim="q.search" type="text" placeholder="쉼표/공백 구분" class="w-full border rounded px-2 py-1.5"/>
          </div>

          <!-- 고급 필터 토글 -->
          <div class="col-span-2 -mt-1 mb-1">
            <button type="button" @click="advancedOpen = !advancedOpen" class="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50">
              <svg class="w-3.5 h-3.5 transition-transform" :class="advancedOpen ? 'rotate-180' : ''" viewBox="0 0 24 24" fill="none"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              고급 필터 {{ advancedOpen ? '숨기기' : '펼치기' }}
            </button>
          </div>

          <!-- 고급 영역 -->
          <div class="contents" v-show="advancedOpen">
            <!-- 팀 / 연도 -->
            <div>
              <label class="block mb-1 font-medium text-gray-700">팀</label>
              <select v-model="q.team" multiple class="w-full border rounded px-2 py-1.5 h-24">
                <option v-for="t in opts.team" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div>
              <label class="block mb-1 font-medium text-gray-700">연도</label>
              <select v-model="q.year" multiple class="w-full border rounded px-2 py-1.5 h-24">
                <option v-for="y in opts.year" :key="y" :value="y">{{ y }}</option>
              </select>
            </div>

            <!-- 등급 / 레어도 -->
            <div>
              <label class="block mb-1 font-medium text-gray-700">등급</label>
              <select v-model="q.grade" multiple class="w-full border rounded px-2 py-1.5 h-24">
                <option v-for="g in opts.grade" :key="g" :value="g">{{ g }}</option>
              </select>
            </div>
            <div>
              <label class="block mb-1 font-medium text-gray-700">레어도(정수)</label>
              <input v-model.number="q.rarity" type="number" min="0" class="w-full border rounded px-2 py-1.5"/>
            </div>

            <!-- 포지션 / 스킬 -->
            <div>
              <label class="block mb-1 font-medium text-gray-700">포지션</label>
              <select v-model="q.position" multiple class="w-full border rounded px-2 py-1.5 h-24">
                <option v-for="p in opts.position" :key="p" :value="p">{{ p }}</option>
              </select>
            </div>
            <div>
              <label class="block mb-1 font-medium text-gray-700">스킬</label>
              <select v-model="q.skill" multiple class="w-full border rounded px-2 py-1.5 h-24">
                <option v-for="s in opts.skill" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>

            <!-- 강화스킬 / 시너지 -->
            <div>
              <label class="block mb-1 font-medium text-gray-700">강화 스킬</label>
              <select v-model="q.enhancedSkill" multiple class="w-full border rounded px-2 py-1.5 h-24">
                <option v-for="s in opts.enhancedSkill" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
            <div>
              <label class="block mb-1 font-medium text-gray-700">시너지</label>
              <select v-model="q.synergy" multiple class="w-full border rounded px-2 py-1.5 h-24">
                <option v-for="s in synergyOptions" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>

            <div class="col-span-2 flex gap-2 mt-1">
              <div class="text-gray-500 self-center">총 {{ total }}명 · {{ currentPage }} / {{ totalPages }}</div>
              <div class="ml-auto flex gap-1">
                <button type="button" class="px-2 py-1 border rounded" @click="goFirst" :disabled="currentPage===1" aria-label="첫 페이지">First</button>
                <button type="button" class="px-2 py-1 border rounded" @click="goPrev" :disabled="currentPage===1" aria-label="이전 페이지">Prev</button>
                <button type="button" class="px-2 py-1 border rounded" @click="goNext" :disabled="currentPage===totalPages" aria-label="다음 페이지">Next</button>
                <button type="button" class="px-2 py-1 border rounded" @click="goLast" :disabled="currentPage===totalPages" aria-label="마지막 페이지">Last</button>
              </div>
            </div>
          </div>
        </form>

        <!-- 카드 리스트 -->
        <div class="grid gap-3 flex-1 overflow-auto">
          <article
              v-for="(item, index) in paginatedPlayers"
              :key="'card-' + index"
              class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
              @click="autoAssign(item)"
              @keydown.enter.prevent="autoAssign(item)"
              tabindex="0"
          >
            <div class="p-4 flex items-start gap-4">
              <!-- 등급 배지 -->
              <div class="shrink-0 w-16 h-16 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center">
                <img :src="`/assets/logos/grade/${item.grade}.png`" :alt="item.grade" class="w-16 h-16 object-contain select-none" />
              </div>

              <!-- 본문 -->
              <div class="flex-1 min-w-0">
                <!-- 이름 + 희귀도 -->
                <div class="flex items-start justify-between gap-3">
                  <h3 class="text-base font-bold text-gray-900 dark:text-gray-100 truncate">
                    {{ item.name }}
                  </h3>
                  <div class="flex gap-0.5 shrink-0">
                    <Star v-for="i in Number(item.rarity)" :key="'m-star-' + i" class="w-4 h-4 text-yellow-400" fill="currentColor" />
                  </div>
                </div>

                <!-- 팀 + 연도 -->
                <div class="mt-1 flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                  <div class="flex items-center gap-2">
                    <img :src="findTeamLogoByKeyOrFallback(item.team)" :alt="item.team" class="w-5 h-5 object-contain" />
                    <span class="truncate">{{ findTeamLogoByName(item.team) }}</span>
                  </div>
                  <span class="text-gray-300">•</span>
                  <span>{{ item.year || '해당 없음' }}</span>
                </div>

                <!-- 포지션 / 투타 / 타입 -->
                <div class="mt-2 flex flex-wrap items-center gap-2">
                  <span
                      v-for="pos in Array.from(new Set(toArray(item.position).map(normalizePos))).filter(Boolean)"
                      :key="pos"
                      class="px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 border border-blue-200"
                  >
                    {{ pos }}
                  </span>
                  <span class="px-2 py-0.5 rounded-full text-xs bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {{ translateDirection(item.throwHand) }}투 {{ translateDirection(item.battingHand) }}타
                  </span>
                  <span v-if="item.pitchingType" class="px-2 py-0.5 rounded-full text-xs bg-purple-50 text-purple-700 border border-purple-200">
                    {{ translatePitchingType(item.pitchingType) }}
                  </span>
                </div>

                <!-- 시너지 -->
                <div class="mt-3 w-full rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2">
                  <p
                      class="text-sm text-gray-800 dark:text-gray-100 leading-snug whitespace-pre-line break-words"
                      :style="expandedRowIndex === index ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }"
                  >
                    {{ item.synergy }}
                  </p>
                  <button
                      v-if="(item.synergy || '').length > 40"
                      @click.stop="toggleExpanded(index)"
                      :aria-expanded="expandedRowIndex === index"
                      class="mt-2 inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 hover:text-blue-600 transition"
                  >
                    <component :is="expandedRowIndex === index ? ChevronUp : ChevronDown" class="w-3.5 h-3.5" />
                    <span>{{ expandedRowIndex === index ? '접기' : '더보기' }}</span>
                  </button>
                </div>

                <!-- 포지션 추가 버튼 -->
                <div class="mt-3 flex flex-wrap justify-end gap-2">
                  <button
                      v-for="pos in Array.from(new Set(toArray(item.position).map(normalizePos))).filter(Boolean)"
                      :key="pos"
                      @click.stop="assignToSlot(pos, item)"
                      class="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-sm text-emerald-700 hover:bg-emerald-100"
                  >
                    {{ pos }}
                  </button>
                  <button
                      v-if="!isPitcher(item)"
                      @click.stop="assignToSlot('DH', item)"
                      class="px-2 py-1 rounded border border-emerald-200 bg-emerald-50 text-sm text-emerald-700 hover:bg-emerald-100"
                  >
                    DH
                  </button>
                </div>

              </div>
            </div>
          </article>

          <!-- empty state -->
          <div v-if="!paginatedPlayers.length" class="col-span-full">
            <div class="border border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center">
              <div class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">조건에 맞는 선수가 없습니다</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">필터를 줄이거나 초기화해 보세요.</div>
              <div class="mt-3">
                <button class="px-2.5 py-1.5 text-xs rounded border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800" @click="resetFilters">
                  필터 초기화
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 하단 페이지네이션 바 -->
        <div class="sticky bottom-0 z-10 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 px-3 py-2 flex items-center gap-2 md:hidden">
          <span class="text-xs text-gray-500">페이지 {{ currentPage }} / {{ totalPages }}</span>
          <div class="ml-auto flex gap-1">
            <button type="button" class="px-2 py-1 border rounded" @click="goFirst" :disabled="currentPage===1">First</button>
            <button type="button" class="px-2 py-1 border rounded" @click="goPrev" :disabled="currentPage===1">Prev</button>
            <button type="button" class="px-2 py-1 border rounded" @click="goNext" :disabled="currentPage===totalPages">Next</button>
            <button type="button" class="px-2 py-1 border rounded" @click="goLast" :disabled="currentPage===totalPages">Last</button>
          </div>
        </div>
      </section>

      <!-- ================= 중앙: 라인업 슬롯 ================= -->
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
              <div class="h-full" :style="{ width: s.progress + '%', background: 'linear-gradient(90deg, rgba(96,165,250,1) 0%, rgba(99,102,241,1) 100%)' }"></div>
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
button:disabled { opacity:.5; cursor:not-allowed; }
</style>

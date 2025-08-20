<script setup lang="ts">
import { ref, computed, onMounted, defineComponent, h, nextTick, watch, reactive } from 'vue'
import Papa from 'papaparse'
import { Star, Search, Filter, ChevronLeft, ChevronRight, Users } from 'lucide-vue-next'

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
  'b1': '1B', '1b': '1B', '1': '1B', '1루': '1B',
  'b2': '2B', '2b': '2B', '2': '2B', '2루': '2B',
  'b3': '3B', '3b': '3B', '3': '3B', '3루': '3B',
  'c': 'C', '포': 'C',
  'ss': 'SS', '유격': 'SS',
  'lf': 'LF', '좌익': 'LF',
  'cf': 'CF', '중견': 'CF',
  'rf': 'RF', '우익': 'RF',
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
  search: string
  position: string[]
  team: string[]
  synergy: string[]
  rarity: number | null
}>({
  search: '',
  position: [],
  team: [],
  synergy: [],
  rarity: null
})

/* =========================
   고급토글/옵션
========================= */
const advancedOpen = ref(false)
const opts = computed(() => {
  const o: Record<string, Set<string>> = {
    team: new Set(), position: new Set()
  }
  for (const p of players.value) {
    toArray(p.team).forEach(v => o.team.add(v))
    toArray(p.position).forEach(v => o.position.add(v))
  }
  return {
    team: [...o.team].sort(),
    position: [...o.position].sort()
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
  positionLc: string[]
  yearsNum: number[]
  synergyNormSet: Set<string>
}
const preparedPlayers = computed<Prepared[]>(() =>
    players.value.map(p => ({
      raw: p,
      nameNorm: normText(p.name),
      teamLc: toArray(p.team).map(lc),
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
      .filter(({ raw: p, nameNorm, teamLc, positionLc, yearsNum, synergyNormSet }) => {
        if (q.team.length && !q.team.some(t => teamLc.includes(lc(t)))) return false
        if (q.rarity != null && Number(p.rarity) !== Number(q.rarity)) return false
        if (q.position.length && !q.position.every(v => positionLc.includes(lc(v)))) return false
        if (q.synergy.length && !q.synergy.map(normText).every(t => synergyNormSet.has(t))) return false

        if (tokens.length) {
          const hay = new Set<string>([
            nameNorm, ...teamLc, ...positionLc, ...Array.from(synergyNormSet), ...yearsNum.map(String)
          ])
          const ok = tokens.some(t => hay.has(t) || nameNorm.includes(t))
          if (!ok) return false
        }
        return true
      })
      .map(pp => ({ _id: String(pp.raw.id ?? `${pp.raw.name}-${pp.raw.team}-${pp.raw.year}`), ...pp.raw })) as (Raw & PlayerRow)[]
})

/* =========================
   페이지네이션
========================= */
const pageSize = 50
const currentPage = ref(1)
watch(q, () => { currentPage.value = 1 }, { deep: true })

const total = computed(() => filteredPlayers.value.length)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const paginatedPlayers = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredPlayers.value.slice(start, start + pageSize)
})

function goPage(page: number) { 
  if (page >= 1 && page <= totalPages.value) currentPage.value = page 
}
function resetFilters(){
  q.search=''; q.team=[]; q.position=[]; q.synergy=[]; q.rarity=null
}

/* =========================
   라인업/슬롯
========================= */
const lineup = ref({
  C:null,'1B':null,'2B':null,'3B':null,SS:null, LF:null,CF:null,RF:null,DH:null,
  SP1:null,SP2:null,SP3:null,SP4:null,SP5:null, RP1:null,RP2:null,RP3:null,RP4:null,RP5:null,RP6:null,
  BENCH1:null,BENCH2:null,BENCH3:null,BENCH4:null,BENCH5:null,BENCH6:null,BENCH7:null,BENCH8:null
} as Record<string, Raw|null>)

const isPitcher = (p: Raw) => {
  const positions = toArray(p.position).map(normalizePos)
  return positions.includes('SP') || positions.includes('RP')
}

const clearSlot = (slot: string) => { 
  lineup.value[slot] = null 
}

/* 선택한 슬롯으로 바로 배치 */
const assignToSlot = (slot: string, p: Raw) => {
  if (!slot || !p) return

  let posList: string[] = []
  try {
    const parsed = typeof p.position === 'string' ? JSON.parse(p.position) : p.position
    posList = (Array.isArray(parsed) ? parsed : toArray(p.position)).map(normalizePos).filter(Boolean)
  } catch {
    posList = toArray(p.position).map(normalizePos).filter(Boolean)
  }

  const s = normalizePos(slot)
  
  // 기존 동일 선수 제거
  Object.keys(lineup.value).forEach(k => { 
    if (lineup.value[k]?.id === p.id) {
      lineup.value[k] = null 
    }
  })

  if (s === 'DH') {
    if (isPitcher(p)) { 
      alert('DH에는 타자만 가능합니다.')
      return 
    }
    lineup.value['DH'] = p
  } else if (s === 'SP') {
    if (!posList.includes('SP')) { 
      alert('선발 투수만 가능합니다.')
      return 
    }
    const spSlots = ['SP1','SP2','SP3','SP4','SP5'] as const
    const emptySlot = spSlots.find(slot => !lineup.value[slot])
    if (emptySlot) {
      lineup.value[emptySlot] = p
    } else {
      alert('모든 선발 슬롯이 차있습니다.')
    }
  } else if (s === 'RP') {
    if (!posList.includes('RP')) { 
      alert('중계/마무리 투수만 가능합니다.')
      return 
    }
    const rpSlots = ['RP1','RP2','RP3','RP4','RP5','RP6'] as const
    const emptySlot = rpSlots.find(slot => !lineup.value[slot])
    if (emptySlot) {
      lineup.value[emptySlot] = p
    } else {
      alert('모든 중계 슬롯이 차있습니다.')
    }
  } else if (s.startsWith('SP')) {
    if (!posList.includes('SP')) { 
      alert('선발 투수만 가능합니다.')
      return 
    }
    lineup.value[s] = p
  } else if (s.startsWith('RP')) {
    if (!posList.includes('RP')) { 
      alert('중계/마무리 투수만 가능합니다.')
      return 
    }
    lineup.value[s] = p
  } else if (s.startsWith('BENCH')) {
    // 벤치는 모든 선수 가능
    lineup.value[s] = p
  } else {
    if (!posList.includes(s)) { 
      alert(`${s} 슬롯에 배치할 수 없습니다. 선수 포지션: ${posList.join(', ')}`)
      return 
    }
    lineup.value[s] = p
  }
}

/* 자동 배치 */
const autoAssign = (p: Raw) => {
  if (!p) return
  
  // 기존 동일 선수 제거
  Object.keys(lineup.value).forEach(k => { 
    if (lineup.value[k]?.id === p.id) {
      lineup.value[k] = null 
    }
  })

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
    // 타자 배치
    const order = ['C','1B','2B','3B','SS','LF','CF','RF','DH'] as const
    for (const k of order) {
      if (k === 'DH') {
        if (!lineup.value[k]) { 
          lineup.value[k] = p
          return 
        }
      } else if (posList.includes(k)) {
        if (!lineup.value[k]) { 
          lineup.value[k] = p
          return 
        }
      }
    }
    
    // 메인 포지션이 없으면 벤치에 배치
    const benchSlots = ['BENCH1','BENCH2','BENCH3','BENCH4','BENCH5','BENCH6','BENCH7','BENCH8'] as const
    for (const k of benchSlots) {
      if (!lineup.value[k]) { 
        lineup.value[k] = p
        return 
      }
    }
    
    alert('배치 가능한 슬롯이 없습니다.')
  } else {
    // 투수 배치
    const spOrder = ['SP1','SP2','SP3','SP4','SP5'] as const
    const rpOrder = ['RP1','RP2','RP3','RP4','RP5','RP6'] as const
    
    if (posList.includes('SP')) {
      for (const k of spOrder) {
        if (!lineup.value[k]) { 
          lineup.value[k] = p
          return 
        }
      }
    }
    
    if (posList.includes('RP')) {
      for (const k of rpOrder) {
        if (!lineup.value[k]) { 
          lineup.value[k] = p
          return 
        }
      }
    }
    
    // 투수 포지션이 없으면 벤치에 배치
    const benchSlots = ['BENCH1','BENCH2','BENCH3','BENCH4','BENCH5','BENCH6','BENCH7','BENCH8'] as const
    for (const k of benchSlots) {
      if (!lineup.value[k]) { 
        lineup.value[k] = p
        return 
      }
    }
    
    alert('배치 가능한 슬롯이 없습니다.')
  }
}

/* 벤치로 배치 */
const assignToBench = (p: Raw) => {
  if (!p) return
  
  // 기존 동일 선수 제거
  Object.keys(lineup.value).forEach(k => { 
    if (lineup.value[k]?.id === p.id) {
      lineup.value[k] = null 
    }
  })
  
  const benchSlots = ['BENCH1','BENCH2','BENCH3','BENCH4','BENCH5','BENCH6','BENCH7','BENCH8'] as const
  for (const k of benchSlots) {
    if (!lineup.value[k]) { 
      lineup.value[k] = p
      return 
    }
  }
  
  alert('모든 벤치 슬롯이 차있습니다.')
}

/* =========================
   시너지 계산
========================= */
const synergys = ref<JsonSynergy[]>([])

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

// 시너지 포함 관계 확인 (선수 숫자 기준으로 하위 시너지 자동 적용)
const getSynergyIncludes = (targetSynergy: string, playerSynergies: string[]): boolean => {
  // 정확한 일치 먼저 확인
  if (playerSynergies.includes(targetSynergy)) return true
  
  const targetMatch = targetSynergy.match(/(\D*)(\d+)(\D*)/)
  if (!targetMatch) return false
  
  const [, targetPrefix, targetNumber, targetSuffix] = targetMatch
  const targetNum = parseInt(targetNumber)
  
  // 4자리 숫자는 연도로 간주하여 포함 관계에서 제외
  if (targetNumber.length === 4) {
    return false
  }
  
  // 동명이인 시너지는 포함 관계에서 제외 (정확한 매칭만 허용)
  if (targetPrefix.includes('동명이인') || targetSuffix.includes('동명이인')) {
    return false
  }
  
  // 선수가 가진 시너지 중에서 같은 종류이면서 숫자가 더 큰 것이 있는지 확인
  return playerSynergies.some(playerSynergy => {
    const playerMatch = playerSynergy.match(/(\D*)(\d+)(\D*)/)
    if (!playerMatch) return false
    
    const [, playerPrefix, playerNumber, playerSuffix] = playerMatch
    const playerNum = parseInt(playerNumber)
    
    // 4자리 숫자는 연도로 간주하여 포함 관계에서 제외
    if (playerNumber.length === 4) {
      return false
    }
    
    // 동명이인 시너지는 포함 관계에서 제외
    if (playerPrefix.includes('동명이인') || playerSuffix.includes('동명이인')) {
      return false
    }
    
    // 같은 종류의 클럽이고, 플레이어의 숫자가 타겟 숫자보다 크거나 같으면 포함
    return (
      playerPrefix.trim() === targetPrefix.trim() &&
      playerSuffix.trim() === targetSuffix.trim() &&
      playerNum >= targetNum
    )
  })
}

const synergyIndex = computed(() => {
  const index = new Map<string, {
    count: number, chosen: JsonCond|null, condText: string|null,
    appliesTo: string[], next: { cond: JsonCond, need: number, text: string } | null, synergy: JsonSynergy
  }>()
  
  for (const s of synergys.value) {
    const name = String(s.synergy).trim()
    
    const count = (Object.values(lineup.value).filter(Boolean) as Raw[])
      .filter(player => {
        const playerSynergies = toArray(player.synergy).map(t => t.trim())
        return getSynergyIncludes(name, playerSynergies)
      }).length
      
    const all = s.conditions.map(c => {
      const isBetween = 'op' in c.count && c.count.op==='between'
      const upper = isBetween ? (c.count as any).max : (c.count as any).value
      const lower = isBetween ? (c.count as any).min : (c.count as any).value
      const text  = isBetween ? `${lower}~${upper}명` : `${upper}명 이상`
      return { raw:c, upper:Number(upper ?? 0), text }
    }).sort((a,b)=>a.upper-b.upper)
    
    const matched = all.filter(({raw}) => {
      const c:any = raw.count
      return c.op==='between' ? cmp('between', count, c.min, c.max) : cmp(c.op, count, c.value)
    })
    
    let chosen: JsonCond|null = null, condText: string|null = null
    if (matched.length) { 
      matched.sort((a,b)=>(b.upper-a.upper) || ((b.raw.bonus.value??0)-(a.raw.bonus.value??0)))
      chosen = matched[0].raw
      condText = matched[0].text 
    }
    
    const bigger = all.find(c => count < c.upper) || null
    const next = bigger ? { cond:bigger.raw, need:bigger.upper, text:`${bigger.upper}명 필요` } : null
    
    const appliesTo = chosen
        ? (Object.values(lineup.value).filter(Boolean) as Raw[])
            .filter(player => {
              const playerSynergies = toArray(player.synergy).map(t => t.trim())
              return getSynergyIncludes(name, playerSynergies)
            })
            .map(p => String(p.name||''))
        : []
        
    index.set(name, { count, chosen, condText, appliesTo, next, synergy: s })
  }
  return index
})

const activeList = computed(() => {
  const out: Array<{ name:string, count:number, chosen:JsonCond, appliesTo:string[], condText:string, isIncluded:boolean, includedBy:string[] }> = []
  
  for (const [name, rec] of synergyIndex.value.entries()) {
    if (rec.chosen) {
      // 이 시너지가 다른 상위 시너지에 포함되는지 확인
      const includedBy: string[] = []
      for (const [otherName, otherRec] of synergyIndex.value.entries()) {
        if (otherName !== name && otherRec.chosen && getSynergyIncludes(name, [otherName])) {
          includedBy.push(otherName)
        }
      }
      
      out.push({ 
        name, 
        count: rec.count, 
        chosen: rec.chosen, 
        appliesTo: rec.appliesTo, 
        condText: rec.condText!,
        isIncluded: includedBy.length > 0,
        includedBy: includedBy.sort()
      })
    }
  }
  
  // 모든 활성 시너지 표시 
  return out.sort((a,b)=> (b.chosen.bonus.value??0) - (a.chosen.bonus.value??0))
})

const inactiveList = computed(() => {
  const out: Array<{name:string,count:number,nextNeed:number,needLeft:number,progress:number,nextText:string,nextEffectTitle:string}> = []
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
    out.push({ name, count:rec.count, nextNeed, needLeft, progress, nextText:rec.next.text, nextEffectTitle:title })
  }
  return out.sort((a,b)=>a.needLeft-b.needLeft)
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
    <div class="container mx-auto px-4 py-6">
      <div class="grid grid-cols-12 gap-6 h-screen">
        
        <!-- 좌측: 검색 & 선수 목록 -->
        <div class="col-span-4 bg-white rounded-lg shadow-sm border flex flex-col max-h-screen">
          <!-- 헤더 -->
          <div class="p-4 bg-blue-600 text-white rounded-t-lg">
            <div class="flex items-center gap-3">
              <Search class="w-5 h-5" />
              <h1 class="text-lg font-bold">선수 검색</h1>
            </div>
            <div class="text-sm opacity-90 mt-1">총 {{ total }}명</div>
          </div>

          <!-- 검색 필터 -->
          <div class="p-4 border-b bg-gray-50">
            <!-- 통합 검색 -->
            <div class="relative mb-3">
              <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input 
                v-model.trim="q.search" 
                type="text" 
                placeholder="이름, 팀, 포지션, 시너지 검색..."
                class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              />
            </div>

            <!-- 필터 토글 -->
            <button 
              @click="advancedOpen = !advancedOpen"
              class="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 bg-white px-3 py-2 rounded border w-full justify-between"
            >
              <div class="flex items-center gap-2">
                <Filter class="w-4 h-4" />
                <span>상세 필터</span>
              </div>
              <span class="text-xs bg-gray-100 px-2 py-1 rounded">{{ advancedOpen ? '숨기기' : '펼치기' }}</span>
            </button>

            <!-- 고급 필터 -->
            <div v-if="advancedOpen" class="mt-3 space-y-3 p-3 bg-white rounded border">
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">포지션</label>
                <select v-model="q.position" multiple class="w-full border border-gray-300 rounded px-2 py-1 text-sm h-20">
                  <option v-for="p in opts.position" :key="p" :value="p">{{ p }}</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">팀</label>
                <select v-model="q.team" multiple class="w-full border border-gray-300 rounded px-2 py-1 text-sm h-20">
                  <option v-for="t in opts.team" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">시너지</label>
                <select v-model="q.synergy" multiple class="w-full border border-gray-300 rounded px-2 py-1 text-sm h-20">
                  <option v-for="s in synergyOptions" :key="s" :value="s">{{ s }}</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">레어도</label>
                <input v-model.number="q.rarity" type="number" min="0" class="w-full border border-gray-300 rounded px-2 py-1 text-sm">
              </div>

              <button @click="resetFilters" class="w-full py-2 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700">
                필터 초기화
              </button>
            </div>
          </div>

          <!-- 페이지네이션 -->
          <div class="px-4 py-2 border-b bg-gray-50 text-sm flex items-center justify-between">
            <span class="text-gray-600">{{ currentPage }} / {{ totalPages }} 페이지</span>
            <div class="flex gap-1">
              <button @click="goPage(currentPage-1)" :disabled="currentPage<=1" class="p-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50">
                <ChevronLeft class="w-4 h-4" />
              </button>
              <button @click="goPage(currentPage+1)" :disabled="currentPage>=totalPages" class="p-1 border border-gray-300 rounded hover:bg-white disabled:opacity-50">
                <ChevronRight class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- 선수 목록 -->
          <div class="flex-1 overflow-auto">
            <div 
              v-for="(player, index) in paginatedPlayers" 
              :key="index"
              @click="autoAssign(player)"
              class="p-3 border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition-colors"
            >
              <div class="flex items-start gap-3">
                <!-- 등급 -->
                <div class="w-10 h-10 bg-gray-100 rounded flex items-center justify-center shrink-0">
                  <img :src="`/assets/logos/grade/${player.grade}.png`" :alt="player.grade" class="w-8 h-8 object-contain" />
                </div>

                <div class="flex-1 min-w-0">
                  <!-- 이름 & 별 -->
                  <div class="flex items-center gap-2 mb-1">
                    <h3 class="font-semibold text-gray-900 truncate text-sm">{{ player.name }}</h3>
                    <div class="flex">
                      <Star v-for="i in Number(player.rarity)" :key="i" class="w-3 h-3 text-yellow-400" fill="currentColor" />
                    </div>
                  </div>

                  <!-- 팀 & 연도 -->
                  <div class="flex items-center gap-2 text-xs text-gray-600 mb-2">
                    <img :src="findTeamLogoByKeyOrFallback(player.team)" :alt="player.team" class="w-4 h-4 object-contain" />
                    <span>{{ findTeamLogoByName(player.team) }} ({{ player.year }})</span>
                  </div>

                  <!-- 포지션 -->
                  <div class="flex flex-wrap gap-1 mb-2">
                    <span 
                      v-for="pos in Array.from(new Set(toArray(player.position).map(normalizePos))).filter(Boolean)" 
                      :key="pos"
                      class="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded font-medium"
                    >
                      {{ pos }}
                    </span>
                  </div>

                  <!-- 포지션 배치 버튼 -->
                  <div class="flex flex-wrap gap-1">
                    <button
                      v-for="pos in Array.from(new Set(toArray(player.position).map(normalizePos))).filter(Boolean)"
                      :key="pos"
                      @click.stop="assignToSlot(pos, player)"
                      class="px-2 py-1 text-xs border border-emerald-300 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 transition-colors"
                    >
                      {{ pos }}
                    </button>
                    <button
                      v-if="!isPitcher(player)"
                      @click.stop="assignToSlot('DH', player)"
                      class="px-2 py-1 text-xs border border-emerald-300 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 transition-colors"
                    >
                      DH
                    </button>
                    <button
                      @click.stop="assignToBench(player)"
                      class="px-2 py-1 text-xs border border-gray-300 bg-gray-50 text-gray-700 rounded hover:bg-gray-100 transition-colors"
                    >
                      벤치
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- 검색 결과 없음 -->
            <div v-if="!paginatedPlayers.length" class="p-8 text-center text-gray-500">
              <div class="text-lg mb-2">검색 결과가 없습니다</div>
              <button @click="resetFilters" class="text-blue-600 hover:underline">필터 초기화</button>
            </div>
          </div>
        </div>

        <!-- 중앙: 라인업 -->
        <div class="col-span-5 bg-white rounded-lg shadow-sm border flex flex-col max-h-screen">
          <!-- 헤더 -->
          <div class="p-4 bg-purple-600 text-white rounded-t-lg">
            <div class="flex items-center gap-3">
              <Users class="w-5 h-5" />
              <h2 class="text-lg font-bold">라인업 배치</h2>
            </div>
            <div class="text-sm opacity-90 mt-1">배치된 선수: {{ Object.values(lineup).filter(Boolean).length }}/28명</div>
          </div>

          <div class="flex-1 overflow-auto p-4 space-y-4">
            <!-- 타자진 -->
            <div class="bg-blue-50 p-4 rounded-lg">
              <h3 class="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                <Users class="w-4 h-4" />
                타자진
              </h3>
              
              <!-- 외야 -->
              <div class="mb-3">
                <div class="text-xs text-gray-600 mb-2">외야</div>
                <div class="grid grid-cols-3 gap-2">
                  <div v-for="pos in ['LF', 'CF', 'RF']" :key="pos" class="bg-white border border-gray-200 rounded-lg p-2 min-h-[60px]">
                    <div class="text-xs font-semibold text-gray-700 mb-1">{{ pos }}</div>
                    <div v-if="lineup[pos]" class="space-y-1">
                      <div class="text-sm font-semibold text-gray-900">{{ lineup[pos].name }}</div>
                      <div class="text-xs text-gray-600">{{ lineup[pos].team }}</div>
                      <button @click="clearSlot(pos)" class="text-xs text-red-600 hover:text-red-800 font-medium">제거</button>
                    </div>
                    <div v-else class="text-xs text-gray-400">비어있음</div>
                  </div>
                </div>
              </div>

              <!-- 내야 -->
              <div class="mb-3">
                <div class="text-xs text-gray-600 mb-2">내야</div>
                <div class="grid grid-cols-5 gap-2">
                  <div v-for="pos in ['C', '1B', '2B', '3B', 'SS']" :key="pos" class="bg-white border border-gray-200 rounded-lg p-2 min-h-[60px]">
                    <div class="text-xs font-semibold text-gray-700 mb-1">{{ pos }}</div>
                    <div v-if="lineup[pos]" class="space-y-1">
                      <div class="text-sm font-semibold text-gray-900">{{ lineup[pos].name }}</div>
                      <div class="text-xs text-gray-600">{{ lineup[pos].team }}</div>
                      <button @click="clearSlot(pos)" class="text-xs text-red-600 hover:text-red-800 font-medium">제거</button>
                    </div>
                    <div v-else class="text-xs text-gray-400">비어있음</div>
                  </div>
                </div>
              </div>

              <!-- DH -->
              <div>
                <div class="text-xs text-gray-600 mb-2">지명타자</div>
                <div class="grid grid-cols-1 gap-2 max-w-xs">
                  <div class="bg-white border border-gray-200 rounded-lg p-2 min-h-[60px]">
                    <div class="text-xs font-semibold text-gray-700 mb-1">DH</div>
                    <div v-if="lineup.DH" class="space-y-1">
                      <div class="text-sm font-semibold text-gray-900">{{ lineup.DH.name }}</div>
                      <div class="text-xs text-gray-600">{{ lineup.DH.team }}</div>
                      <button @click="clearSlot('DH')" class="text-xs text-red-600 hover:text-red-800 font-medium">제거</button>
                    </div>
                    <div v-else class="text-xs text-gray-400">비어있음</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 투수진 -->
            <div class="bg-purple-50 p-4 rounded-lg">
              <h3 class="text-sm font-bold text-purple-800 mb-3 flex items-center gap-2">
                <Users class="w-4 h-4" />
                투수진
              </h3>
              
              <!-- 선발 -->
              <div class="mb-3">
                <div class="text-xs text-gray-600 mb-2">선발</div>
                <div class="grid grid-cols-5 gap-2">
                  <div v-for="i in 5" :key="'SP'+i" class="bg-white border border-gray-200 rounded-lg p-2 min-h-[60px]">
                    <div class="text-xs font-semibold text-gray-700 mb-1">SP{{ i }}</div>
                    <div v-if="lineup['SP'+i]" class="space-y-1">
                      <div class="text-sm font-semibold text-gray-900">{{ lineup['SP'+i].name }}</div>
                      <div class="text-xs text-gray-600">{{ lineup['SP'+i].team }}</div>
                      <button @click="clearSlot('SP'+i)" class="text-xs text-red-600 hover:text-red-800 font-medium">제거</button>
                    </div>
                    <div v-else class="text-xs text-gray-400">비어있음</div>
                  </div>
                </div>
              </div>

              <!-- 중계 -->
              <div>
                <div class="text-xs text-gray-600 mb-2">중계 & 마무리</div>
                <div class="grid grid-cols-6 gap-2">
                  <div v-for="i in 6" :key="'RP'+i" class="bg-white border border-gray-200 rounded-lg p-2 min-h-[60px]">
                    <div class="text-xs font-semibold text-gray-700 mb-1">RP{{ i }}</div>
                    <div v-if="lineup['RP'+i]" class="space-y-1">
                      <div class="text-sm font-semibold text-gray-900">{{ lineup['RP'+i].name }}</div>
                      <div class="text-xs text-gray-600">{{ lineup['RP'+i].team }}</div>
                      <button @click="clearSlot('RP'+i)" class="text-xs text-red-600 hover:text-red-800 font-medium">제거</button>
                    </div>
                    <div v-else class="text-xs text-gray-400">비어있음</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- 벤치 -->
            <div class="bg-gray-50 p-4 rounded-lg">
              <h3 class="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                <Users class="w-4 h-4" />
                벤치 (8명)
              </h3>
              
              <div class="grid grid-cols-4 gap-2">
                <div v-for="i in 8" :key="'BENCH'+i" class="bg-white border border-gray-200 rounded-lg p-2 min-h-[60px]">
                  <div class="text-xs font-semibold text-gray-700 mb-1">벤치{{ i }}</div>
                  <div v-if="lineup['BENCH'+i]" class="space-y-1">
                    <div class="text-sm font-semibold text-gray-900">{{ lineup['BENCH'+i].name }}</div>
                    <div class="text-xs text-gray-600">{{ lineup['BENCH'+i].team }}</div>
                    <button @click="clearSlot('BENCH'+i)" class="text-xs text-red-600 hover:text-red-800 font-medium">제거</button>
                  </div>
                  <div v-else class="text-xs text-gray-400">비어있음</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 우측: 시너지 -->
        <div class="col-span-3 bg-white rounded-lg shadow-sm border flex flex-col max-h-screen">
          <!-- 헤더 -->
          <div class="p-4 bg-green-600 text-white rounded-t-lg">
            <div class="flex items-center gap-3">
              <Star class="w-5 h-5" />
              <h2 class="text-lg font-bold">시너지 현황</h2>
            </div>
            <div class="text-sm opacity-90 mt-1">활성: {{ activeList.length }}개</div>
          </div>

          <div class="flex-1 overflow-auto p-4 space-y-4">
            <!-- 활성 시너지 -->
            <div>
              <h3 class="text-sm font-bold text-green-700 mb-3 flex items-center gap-2">
                ✅ 활성 시너지
              </h3>
              <div v-if="!activeList.length" class="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border">
                발동된 시너지가 없습니다.
              </div>
              <div v-else class="space-y-3">
                <div v-for="s in activeList" :key="s.name" class="bg-green-50 border border-green-200 p-3 rounded-lg">
                  <div class="flex items-start justify-between mb-2">
                    <div class="flex-1">
                      <div class="text-sm font-bold text-green-800">
                        {{ s.name }}
                        <span v-if="s.isIncluded" class="text-xs text-blue-600 font-normal">
                          ({{ s.includedBy.join(', ') }}에 포함됨)
                        </span>
                      </div>
                    </div>
                    <div class="text-xs text-green-600 bg-white px-2 py-1 rounded border">{{ s.count }}명</div>
                  </div>
                  <div class="text-sm text-green-700 font-semibold mb-2 bg-white px-2 py-1 rounded border border-green-300">
                    {{ STAT_LABEL[s.chosen.stat] || s.chosen.stat }} +{{ s.chosen.bonus.value }}{{ s.chosen.bonus.unit==='percent'?'%':'' }}
                  </div>
                  <div class="text-xs text-green-600">
                    <span class="font-medium">적용 대상:</span> {{ s.appliesTo.join(', ') }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 비활성 시너지 -->
            <div>
              <h3 class="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                ⏳ 비활성 시너지
              </h3>
              <div v-if="!inactiveList.length" class="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border">
                비활성 시너지가 없습니다.
              </div>
              <div v-else class="space-y-3">
                <div v-for="s in inactiveList" :key="s.name" class="bg-gray-50 border border-gray-200 p-3 rounded-lg">
                  <div class="flex items-center justify-between mb-2">
                    <div class="text-sm font-semibold text-gray-800">{{ s.name }}</div>
                    <div class="text-xs text-gray-600 bg-white px-2 py-1 rounded border">{{ s.count }}명</div>
                  </div>
                  <div class="text-sm text-gray-700 mb-2 font-medium">{{ s.nextEffectTitle }}</div>
                  <div class="text-xs text-red-600 mb-2 font-medium">{{ s.nextText }}</div>
                  <div class="bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div class="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all duration-500" :style="{width: s.progress + '%'}"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
button:disabled { 
  opacity: 0.5; 
  cursor: not-allowed; 
}

* { 
  scroll-behavior: smooth; 
}

::-webkit-scrollbar { 
  width: 6px; 
}

::-webkit-scrollbar-track { 
  background: #f1f5f9; 
  border-radius: 3px;
}

::-webkit-scrollbar-thumb { 
  background: linear-gradient(180deg, #3b82f6 0%, #8b5cf6 100%);
  border-radius: 3px; 
}

::-webkit-scrollbar-thumb:hover { 
  background: linear-gradient(180deg, #2563eb 0%, #7c3aed 100%);
}

.container {
  max-width: 1400px;
}

/* 호버 효과 */
.transition-colors {
  transition: all 0.2s ease;
}
</style>
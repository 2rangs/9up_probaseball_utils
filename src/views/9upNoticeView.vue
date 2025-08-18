<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { marked } from 'marked'
import { 
  Search, 
  RefreshCw, 
  ExternalLink, 
  Download, 
  Calendar, 
  Archive, 
  Tag, 
  AlertCircle,
  List,
  Github,
  ChevronDown,
  FileText,
  Clock
} from 'lucide-vue-next'

interface GithubAsset {
  id: number
  name: string
  browser_download_url: string
  size: number
  download_count: number
}

interface GithubRelease {
  id: number
  tag_name: string
  name: string | null
  body: string | null
  draft: boolean
  prerelease: boolean
  created_at: string
  published_at: string | null
  html_url: string
  assets: GithubAsset[]
}

const owner = '2rangs'
const repo = '9up_probaseball_utils'
const perPage = 10

const releases = ref<GithubRelease[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
const nextUrl = ref<string | null>(null)
const aborter = ref<AbortController | null>(null)
const expandedReleases = ref<Set<number>>(new Set())

const q = ref('')
const includePrereleases = ref(false)
const includeDrafts = ref(false)

function parseLinkHeader(link: string | null): Record<string, string> {
  const map: Record<string, string> = {}
  if (!link) return map
  link.split(',').forEach(part => {
    const match = part.match(/<([^>]+)>;\s*rel="([^"]+)"/)
    if (match) map[match[2]] = match[1]
  })
  return map
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).format(d)
}

function formatBytes(bytes: number): string {
  if (!bytes && bytes !== 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`
}

function renderMarkdown(md: string | null): string {
  const raw = md ?? ''
  return String(marked.parse(raw))
}

async function fetchPage(url: string, replace = false) {
  loading.value = true
  error.value = null

  if (aborter.value) aborter.value.abort()
  const controller = new AbortController()
  aborter.value = controller

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal
    })

    if (!res.ok) {
      if (res.status === 404) throw new Error('레포지터리를 찾을 수 없습니다.')
      throw new Error(`요청 실패 (${res.status})`)
    }

    const data: GithubRelease[] = await res.json()
    const linkMap = parseLinkHeader(res.headers.get('Link'))
    nextUrl.value = linkMap['next'] ?? null

    releases.value = replace ? data : [...releases.value, ...data]
    
    // 첫 번째 릴리즈(최신)는 자동으로 펼치기
    if (replace && data.length > 0) {
      expandedReleases.value.add(data[0].id)
    }
  } catch (e: any) {
    if (e?.name === 'AbortError') return
    error.value = e?.message ?? '요청 중 오류가 발생했습니다.'
  } finally {
    loading.value = false
  }
}

function refresh() {
  releases.value = []
  nextUrl.value = null
  expandedReleases.value.clear()
  fetchPage(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=${perPage}`, true)
}

async function loadMore() {
  if (!nextUrl.value) return
  await fetchPage(nextUrl.value)
}

function toggleRelease(releaseId: number) {
  if (expandedReleases.value.has(releaseId)) {
    expandedReleases.value.delete(releaseId)
  } else {
    expandedReleases.value.add(releaseId)
  }
}

function isExpanded(releaseId: number) {
  return expandedReleases.value.has(releaseId)
}

onMounted(() => refresh())
onBeforeUnmount(() => { if (aborter.value) aborter.value.abort() })

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  let arr = releases.value.filter(r => (
    (includeDrafts.value || !r.draft) &&
    (includePrereleases.value || !r.prerelease)
  ))
  if (term) {
    arr = arr.filter(r =>
      r.tag_name.toLowerCase().includes(term) ||
      (r.name ?? '').toLowerCase().includes(term) ||
      (r.body ?? '').toLowerCase().includes(term)
    )
  }
  return arr
})

const lastUpdated = computed(() => filtered.value[0]?.published_at || filtered.value[0]?.created_at)
</script>

<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <section class="max-w-[1280px] mx-auto p-4 space-y-4">
      <!-- Header -->
      <header class=" rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm p-4">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div class="flex items-center gap-3">
            <div class="p-2 rounded-lg bg-blue-500 text-white">
              <Github class="w-5 h-5" />
            </div>
            <div>
              <h1 class="text-xl lg:text-2xl font-semibold text-gray-900 dark:text-white">
                GitHub Releases
              </h1>
              <div class="flex items-center gap-3 mt-1 text-sm text-gray-600 dark:text-gray-400">
                <a 
                  :href="`https://github.com/${owner}/${repo}/releases`" 
                  target="_blank" 
                  class="inline-flex items-center gap-1 hover:text-blue-500 transition-colors"
                >
                  <ExternalLink class="w-3 h-3" />
                  Releases 페이지 열기
                </a>
                <span v-if="lastUpdated" class="hidden sm:flex items-center gap-1">
                  <Clock class="w-3 h-3" />
                  최신: {{ formatDate(lastUpdated) }}
                </span>
              </div>
            </div>
          </div>
          <button 
            @click="refresh" 
            :disabled="loading"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw class="w-4 h-4" :class="{ 'animate-spin': loading }" />
            새로고침
          </button>
        </div>
      </header>

      <!-- Controls -->
      <div class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
        <div class="flex flex-col lg:flex-row lg:items-center gap-4">
          <div class="relative flex-1">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              v-model="q" 
              type="search" 
              placeholder="태그, 제목, 본문으로 검색하기..." 
              class="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500" 
            />
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div v-if="error" class="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-start gap-3">
            <AlertCircle class="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <h3 class="font-semibold text-red-900 dark:text-red-100">오류가 발생했습니다</h3>
              <p class="text-sm text-red-700 dark:text-red-300 mt-1">{{ error }}</p>
            </div>
          </div>
          <button 
            @click="refresh" 
            class="px-3 py-1.5 rounded-lg bg-red-100 dark:bg-red-800/50 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800"
          >
            재시도
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading && releases.length === 0" class="space-y-4">
        <div v-for="n in 3" :key="n" class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 animate-pulse">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
            <div class="space-y-2 flex-1">
              <div class="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
              <div class="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
          <div class="space-y-2">
            <div class="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded"></div>
            <div class="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="filtered.length === 0" class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 text-center">
        <div class="w-12 h-12 mx-auto mb-3 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <List class="w-6 h-6 text-gray-400" />
        </div>
        <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">릴리즈가 없습니다</h3>
        <p class="text-gray-600 dark:text-gray-400">조건에 맞는 릴리즈를 찾을 수 없습니다.</p>
      </div>

      <!-- Releases List -->
      <div v-else class="space-y-4">
        <div 
          v-for="rel in filtered" 
          :key="rel.id" 
          class="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden"
        >
          <!-- Release Header (클릭 가능) -->
          <div 
            @click="toggleRelease(rel.id)"
            class="p-4 border-b border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div class="flex items-start gap-3">
                <div class="p-2 rounded-lg bg-blue-500 text-white">
                  <Tag class="w-4 h-4" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 mb-1">
                    <span class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {{ rel.tag_name }}
                    </span>
                    <a 
                      :href="rel.html_url" 
                      target="_blank" 
                      @click.stop
                      class="text-gray-400 hover:text-blue-500 transition-colors"
                    >
                      <ExternalLink class="w-4 h-4" />
                    </a>
                  </div>
                  <h3 v-if="rel.name" class="text-base text-gray-700 dark:text-gray-300 mb-2">{{ rel.name }}</h3>
                  <div class="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                    <div class="flex items-center gap-1">
                      <Calendar class="w-4 h-4" />
                      {{ formatDate(rel.published_at || rel.created_at) }}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <!-- Release Body (접을 수 있는 부분) -->
          <div v-show="isExpanded(rel.id)" class="transition-all duration-200">
            <div class="p-4 prose dark:prose-invert max-w-none prose-sm">
              <div v-html="renderMarkdown(rel.body)"></div>
            </div>

            <!-- Assets -->
            <div v-if="rel.assets?.length" class="p-4 bg-gray-50 dark:bg-gray-800/50">
              <div class="flex items-center gap-2 mb-3">
                <Archive class="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <h4 class="text-sm font-semibold text-gray-900 dark:text-gray-100">다운로드 파일</h4>
                <span class="px-2 py-0.5 rounded text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{{ rel.assets.length }}</span>
              </div>
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-2">
                <a
                  v-for="a in rel.assets"
                  :key="a.id"
                  :href="a.browser_download_url"
                  target="_blank"
                  class="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                >
                  <div class="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/50">
                    <Download class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="font-medium text-gray-900 dark:text-gray-100 truncate">{{ a.name }}</div>
                    <div class="text-sm text-gray-600 dark:text-gray-400">
                      {{ formatBytes(a.size) }} · {{ a.download_count.toLocaleString() }} 다운로드
                    </div>
                  </div>
                  <ChevronDown class="w-4 h-4 text-gray-400 rotate-[-90deg]" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Load More -->
      <div v-if="nextUrl && filtered.length" class="flex justify-center pt-4">
        <button 
          @click="loadMore" 
          :disabled="loading"
          class="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          <ChevronDown class="w-4 h-4" :class="{ 'animate-bounce': loading }" />
          더 불러오기
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Prose customization */
.prose :where(p):not(:first-child) { 
  margin-top: 0.75rem; 
}

.prose :where(pre) { 
  max-width: 100%; 
  overflow: auto; 
  border-radius: 0.5rem;
}

.prose :where(code) {
  background-color: rgb(243 244 246);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
  line-height: 1.25rem;
}

.dark .prose :where(code) {
  background-color: rgb(31 41 55);
}

.prose :where(h1, h2, h3, h4, h5, h6) {
  color: rgb(17 24 39);
}

.dark .prose :where(h1, h2, h3, h4, h5, h6) {
  color: rgb(243 244 246);
}

.prose :where(blockquote) {
  border-left: 4px solid rgb(59 130 246);
  background-color: rgb(239 246 255);
  border-radius: 0 0.5rem 0.5rem 0;
}

.dark .prose :where(blockquote) {
  border-left-color: rgb(59 130 246);
  background-color: rgba(59 130 246, 0.1);
}
</style>
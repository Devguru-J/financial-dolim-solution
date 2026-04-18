import { useEffect, useState } from 'react'
import { Activity, ArrowDownRight, ArrowUpRight, Building2, CalendarClock, CheckCircle2, Clock, Minus, TrendingUp } from 'lucide-react'
import { fetchImports, fetchResidualDiff } from '@/lib/api'
import type { ResidualDiffResponse, ResidualDiffVehicle } from '@/lib/api'
import type { WorkbookImport } from '@/types/imports'

type LenderCode = 'mg-capital' | 'bnk-capital' | 'woori-card'

interface LenderInfo {
  code: LenderCode
  name: string
  shortName: string
  accentClass: string
}

const LENDERS: LenderInfo[] = [
  { code: 'mg-capital', name: 'MG캐피탈', shortName: 'MG', accentClass: 'from-blue-500 to-blue-600' },
  { code: 'bnk-capital', name: 'BNK캐피탈', shortName: 'BNK', accentClass: 'from-orange-500 to-orange-600' },
  { code: 'woori-card', name: '우리카드', shortName: '우리', accentClass: 'from-sky-500 to-sky-600' },
]

const GERMAN_BRANDS = ['BMW', 'BENZ', 'AUDI']

interface LenderSnapshot {
  code: LenderCode
  name: string
  shortName: string
  accentClass: string
  loading: boolean
  connected: boolean | null
  activeImport: WorkbookImport | null
  previousImport: WorkbookImport | null
  totalImports: number
  vehicleCount: number | null
}

interface DashboardState {
  lenders: LenderSnapshot[]
  globalLoading: boolean
  anyConnected: boolean | null
}

function readVehicleCount(meta: Record<string, unknown>): number | null {
  const analysis = meta?.analysis
  if (analysis && typeof analysis === 'object') {
    const count = (analysis as Record<string, unknown>).vehicleProgramCount
    if (typeof count === 'number') return count
  }
  return null
}

function daysSince(isoDate: string): number {
  const ms = Date.now() - new Date(isoDate).getTime()
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)))
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

export function DashboardPage() {
  const [state, setState] = useState<DashboardState>({
    lenders: LENDERS.map((l) => ({
      ...l,
      loading: true,
      connected: null,
      activeImport: null,
      previousImport: null,
      totalImports: 0,
      vehicleCount: null,
    })),
    globalLoading: true,
    anyConnected: null,
  })

  useEffect(() => {
    const load = async () => {
      const results = await Promise.all(
        LENDERS.map(async (l) => {
          try {
            const data = await fetchImports(l.code)
            const imports = data.imports ?? []
            const active = imports.find((i) => i.isActive) ?? null
            const history = imports.filter((i) => i.id !== active?.id)
            const previous = history[0] ?? null
            return {
              ...l,
              loading: false,
              connected: data.connected,
              activeImport: active,
              previousImport: previous,
              totalImports: imports.length,
              vehicleCount: active ? readVehicleCount(active.meta) : null,
            } satisfies LenderSnapshot
          } catch {
            return {
              ...l,
              loading: false,
              connected: false,
              activeImport: null,
              previousImport: null,
              totalImports: 0,
              vehicleCount: null,
            } satisfies LenderSnapshot
          }
        })
      )
      const anyConnected = results.some((r) => r.connected === true)
      setState({ lenders: results, globalLoading: false, anyConnected })
    }
    load()
  }, [])

  const { lenders, globalLoading, anyConnected } = state
  const activeCount = lenders.filter((l) => l.activeImport).length

  return (
    <div className="p-6 max-w-6xl mx-auto flex flex-col gap-5">
      {/* ── Status banner ── */}
      <div className="animate-fade-up" style={{ animationDelay: '0ms' }}>
        <StatusBanner loading={globalLoading} connected={anyConnected} activeCount={activeCount} />
      </div>

      {/* ── Main: lender cards + poster ── */}
      <div
        className="grid gap-4 animate-fade-up"
        style={{ gridTemplateColumns: '1fr 280px', animationDelay: '60ms' }}
      >
        <div className="grid gap-3">
          {lenders.map((lender, i) => (
            <LenderStatusCard key={lender.code} lender={lender} animationDelay={i * 40} />
          ))}
        </div>
        <div className="rounded-[2rem] border border-border bg-white shadow-[var(--shadow-elev-2)] overflow-hidden self-start">
          <img src="/reference-poster.png" alt="" className="w-full block" />
        </div>
      </div>

      {/* ── Monthly workbook diff ── */}
      <div className="animate-fade-up" style={{ animationDelay: '120ms' }}>
        <MonthlyDiffPanel lenders={lenders} />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Status banner
───────────────────────────────────────────── */
function StatusBanner({
  loading,
  connected,
  activeCount,
}: {
  loading: boolean
  connected: boolean | null
  activeCount: number
}) {
  const isOk = connected === true

  return (
    <div
      className={`rounded-[2rem] border px-6 py-4 flex items-center gap-5 transition-colors duration-500 ${
        loading ? 'bg-muted/40 border-border' : isOk ? 'bg-emerald-50 border-emerald-200/80' : 'bg-amber-50 border-amber-200/80'
      }`}
    >
      <div className="relative shrink-0">
        {!loading && (
          <span className={`absolute inset-0 rounded-full ping-ring ${isOk ? 'bg-emerald-400' : 'bg-amber-400'}`} />
        )}
        <div
          className={`relative w-3 h-3 rounded-full transition-colors ${
            loading ? 'bg-muted-foreground/30' : isOk ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
        />
      </div>

      <div className="flex-1 min-w-0">
        {loading ? (
          <>
            <div className="skeleton h-4 w-32 rounded mb-1.5" />
            <div className="skeleton h-3 w-48 rounded" />
          </>
        ) : (
          <>
            <div className={`text-sm font-semibold tracking-tight leading-none ${isOk ? 'text-emerald-900' : 'text-amber-900'}`}>
              {isOk ? '해결책 정상 가동 중' : 'DB 연결 없음'}
            </div>
            <div className={`text-xs mt-1.5 ${isOk ? 'text-emerald-700' : 'text-amber-700'}`}>
              {isOk ? `금융사 ${activeCount}/3곳 활성 · 운용리스 견적 서비스 가동` : '.dev.vars의 DATABASE_URL을 확인하세요'}
            </div>
          </>
        )}
      </div>

      {!loading && isOk && (
        <div className="shrink-0 text-right">
          <div className="text-[10px] font-semibold text-emerald-700 uppercase tracking-widest mb-1 leading-none flex items-center gap-1 justify-end">
            <Activity size={9} />
            가동 중
          </div>
          <div className="text-sm font-bold font-mono text-emerald-900 tracking-tight">
            {activeCount} / 3
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Lender status card
───────────────────────────────────────────── */
function LenderStatusCard({ lender, animationDelay }: { lender: LenderSnapshot; animationDelay: number }) {
  const { loading, activeImport, vehicleCount, totalImports } = lender
  const hasActive = Boolean(activeImport)

  const importedDays = activeImport ? daysSince(activeImport.importedAt) : null
  const importedLabel =
    importedDays === 0 ? '오늘' : importedDays === 1 ? '1일 전' : `${importedDays}일 전`

  return (
    <div
      className="rounded-[2rem] border border-border shadow-[var(--shadow-elev-2)] animate-fade-up overflow-hidden grid min-h-[82px]"
      style={{ gridTemplateColumns: '64px 1fr 128px', animationDelay: `${animationDelay}ms` }}
    >
      {/* Left accent chip */}
      <div className={`flex items-center justify-center bg-gradient-to-b ${lender.accentClass}`}>
        <div className="text-white text-sm font-black tracking-tight">{lender.shortName}</div>
      </div>

      {/* Middle content */}
      <div className="px-5 py-4 bg-white flex flex-col justify-center min-w-0 border-x border-border">
        {loading ? (
          <>
            <div className="skeleton h-4 w-28 rounded mb-2" />
            <div className="skeleton h-3 w-40 rounded" />
          </>
        ) : hasActive ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-foreground tracking-tight">{lender.name}</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                활성
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Building2 size={10} />
              <span className="font-mono">{activeImport?.versionLabel}</span>
              <span className="text-muted-foreground/40">·</span>
              <CalendarClock size={10} />
              <span>{importedLabel}</span>
              {totalImports > 1 && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span>누적 {totalImports}건</span>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="text-sm font-semibold text-foreground tracking-tight mb-1">{lender.name}</div>
            <div className="text-[11px] text-muted-foreground">활성 워크북 없음 · 임포트 필요</div>
          </>
        )}
      </div>

      {/* Right vehicle-count column */}
      <div className="flex flex-col items-center justify-center bg-muted/50">
        {loading ? (
          <div className="skeleton h-6 w-12 rounded" />
        ) : hasActive ? (
          <>
            <div className="text-2xl font-black font-mono tabular-nums text-foreground leading-none tracking-tighter">
              {vehicleCount ?? '—'}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1.5 uppercase tracking-widest font-semibold">
              취급 차량
            </div>
          </>
        ) : (
          <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
            —
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Monthly workbook diff panel
───────────────────────────────────────────── */
function MonthlyDiffPanel({ lenders }: { lenders: LenderSnapshot[] }) {
  const [activeTab, setActiveTab] = useState<LenderCode>('mg-capital')
  const [diffMap, setDiffMap] = useState<Partial<Record<LenderCode, ResidualDiffResponse | 'loading' | 'error'>>>({})

  const active = lenders.find((l) => l.code === activeTab)!
  const current = diffMap[activeTab]

  useEffect(() => {
    if (active.loading) return
    if (!active.activeImport || !active.previousImport) return
    if (diffMap[activeTab]) return

    setDiffMap((prev) => ({ ...prev, [activeTab]: 'loading' }))
    fetchResidualDiff({
      lenderCode: activeTab,
      term: 60,
      brands: GERMAN_BRANDS,
    })
      .then((res) => setDiffMap((prev) => ({ ...prev, [activeTab]: res })))
      .catch(() => setDiffMap((prev) => ({ ...prev, [activeTab]: 'error' })))
  }, [activeTab, active.loading, active.activeImport, active.previousImport, diffMap])

  return (
    <div className="rounded-[2rem] border border-border bg-white shadow-[var(--shadow-elev-2)] overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-2.5">
        <TrendingUp size={13} className="text-primary shrink-0" strokeWidth={2} />
        <span className="text-sm font-semibold text-foreground tracking-tight">월별 워크북 변동</span>
        <span className="text-[10px] text-muted-foreground font-mono">
          {GERMAN_BRANDS.join(' · ')} · 60개월 기준잔가율
        </span>
        <div className="ml-auto flex items-center gap-1">
          {lenders.map((l) => (
            <button
              key={l.code}
              onClick={() => setActiveTab(l.code)}
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-md transition-colors ${
                activeTab === l.code
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {l.shortName}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {active.loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-10 rounded-lg" />
            ))}
          </div>
        ) : !active.activeImport ? (
          <EmptyDiff message="활성 워크북이 없습니다. 임포트 탭에서 엑셀을 업로드하세요." variant="warning" />
        ) : !active.previousImport ? (
          <BaselineState lender={active} />
        ) : current === 'loading' || !current ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-10 rounded-lg" />
            ))}
          </div>
        ) : current === 'error' ? (
          <EmptyDiff message="변동 데이터를 불러오지 못했습니다." variant="warning" />
        ) : (
          <DiffResult lender={active} diff={current} />
        )}
      </div>
    </div>
  )
}

function DiffResult({ lender, diff }: { lender: LenderSnapshot; diff: ResidualDiffResponse }) {
  const prevDate = diff.previousImport ? formatDate(diff.previousImport.importedAt) : '—'
  const currDate = diff.activeImport ? formatDate(diff.activeImport.importedAt) : '—'
  const nothingChanged = diff.changed.length === 0 && diff.added.length === 0 && diff.removed.length === 0

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 border border-border">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Clock size={11} />
          <span>이전</span>
          <span className="font-mono text-foreground">{diff.previousImport?.versionLabel}</span>
          <span className="text-muted-foreground/60">({prevDate})</span>
        </div>
        <div className="text-muted-foreground/40">→</div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-muted-foreground">현재</span>
          <span className="font-mono text-foreground font-semibold">{diff.activeImport?.versionLabel}</span>
          <span className="text-muted-foreground/60">({currDate})</span>
        </div>
      </div>

      {nothingChanged ? (
        <EmptyDiff
          message={`${lender.name} — 독일 3사 기준 잔가율 변동 없음`}
          variant="info"
        />
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: diff.changed.length > 0 ? '1fr' : '1fr' }}>
          {diff.changed.length > 0 && (
            <DiffSection title="잔가율 변동" count={diff.changed.length}>
              <DiffTable rows={diff.changed} />
            </DiffSection>
          )}
          <div className="grid grid-cols-2 gap-3">
            {diff.added.length > 0 && (
              <DiffSection title="신규 편입" count={diff.added.length} accent="added">
                <CompactList rows={diff.added} />
              </DiffSection>
            )}
            {diff.removed.length > 0 && (
              <DiffSection title="제외" count={diff.removed.length} accent="removed">
                <CompactList rows={diff.removed} />
              </DiffSection>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function DiffSection({
  title,
  count,
  accent,
  children,
}: {
  title: string
  count: number
  accent?: 'added' | 'removed'
  children: React.ReactNode
}) {
  const accentClass =
    accent === 'added'
      ? 'text-emerald-700'
      : accent === 'removed'
        ? 'text-red-700'
        : 'text-foreground'
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-3.5 py-2 border-b border-border bg-muted/30 flex items-center gap-2">
        <span className={`text-xs font-semibold ${accentClass}`}>{title}</span>
        <span className="text-[10px] font-mono text-muted-foreground">{count}건</span>
      </div>
      {children}
    </div>
  )
}

function DiffTable({ rows }: { rows: ResidualDiffVehicle[] }) {
  return (
    <div className="divide-y divide-border">
      {rows.slice(0, 15).map((row, i) => (
        <DiffRow key={`${row.vehicleKey ?? row.displayName}-${i}`} row={row} />
      ))}
      {rows.length > 15 && (
        <div className="px-3.5 py-2 text-[11px] text-muted-foreground text-center">
          + 외 {rows.length - 15}건
        </div>
      )}
    </div>
  )
}

function DiffRow({ row }: { row: ResidualDiffVehicle }) {
  const delta = row.deltaPct
  const rising = delta != null && delta > 0
  const falling = delta != null && delta < 0
  const Arrow = rising ? ArrowUpRight : falling ? ArrowDownRight : Minus
  const deltaColor = rising ? 'text-blue-700' : falling ? 'text-red-700' : 'text-muted-foreground'
  const deltaBg = rising ? 'bg-blue-50' : falling ? 'bg-red-50' : 'bg-muted/40'

  return (
    <div className="px-3.5 py-2 flex items-center gap-3 hover:bg-muted/20 transition-colors">
      <div className="text-[9px] font-black text-primary tracking-wider w-8 shrink-0">
        {row.brandCode.slice(0, 3)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-foreground truncate">{row.displayName}</div>
        {row.vehicleKey && (
          <div className="text-[10px] font-mono text-muted-foreground/70 truncate">{row.vehicleKey}</div>
        )}
      </div>
      <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums shrink-0">
        <span className="text-muted-foreground">{formatRate(row.previousRate)}</span>
        <span className="text-muted-foreground/40">→</span>
        <span className="text-foreground font-semibold">{formatRate(row.currentRate)}</span>
      </div>
      <div
        className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold font-mono tabular-nums shrink-0 ${deltaColor} ${deltaBg}`}
        style={{ minWidth: 68, justifyContent: 'flex-end' }}
      >
        <Arrow size={10} />
        {delta != null ? `${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(2)}p` : '—'}
      </div>
    </div>
  )
}

function CompactList({ rows }: { rows: ResidualDiffVehicle[] }) {
  return (
    <div className="divide-y divide-border max-h-[180px] overflow-y-auto">
      {rows.slice(0, 20).map((row, i) => (
        <div key={`${row.vehicleKey ?? row.displayName}-${i}`} className="px-3.5 py-1.5 flex items-center gap-2">
          <div className="text-[9px] font-black text-primary tracking-wider w-8 shrink-0">
            {row.brandCode.slice(0, 3)}
          </div>
          <div className="text-[11px] text-foreground truncate flex-1">{row.displayName}</div>
          <div className="text-[10px] font-mono text-muted-foreground shrink-0">
            {formatRate(row.currentRate ?? row.previousRate)}
          </div>
        </div>
      ))}
      {rows.length > 20 && (
        <div className="px-3.5 py-2 text-[11px] text-muted-foreground text-center">
          + 외 {rows.length - 20}건
        </div>
      )}
    </div>
  )
}

function formatRate(rate: number | null): string {
  if (rate == null) return '—'
  return `${(rate * 100).toFixed(1)}%`
}

function BaselineState({ lender }: { lender: LenderSnapshot }) {
  const activeDate = lender.activeImport ? formatDate(lender.activeImport.importedAt) : '—'
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200/60 flex items-center justify-center">
        <CheckCircle2 size={22} className="text-emerald-600" strokeWidth={1.75} />
      </div>
      <div>
        <div className="text-sm font-semibold text-foreground mb-1">기준선 설정됨</div>
        <div className="text-xs text-muted-foreground leading-relaxed max-w-[360px]">
          {lender.name} 현재 워크북({activeDate})이 비교 기준선으로 설정되었습니다.
          <br />
          다음 워크북을 업로드하면 이전 버전 대비 <strong className="text-foreground">고잔가·일반잔가·금리 변동</strong>이 여기에 표시됩니다.
        </div>
      </div>
      <DiffSchemaPreview />
    </div>
  )
}

function EmptyDiff({
  message,
  variant = 'info',
}: {
  message: string
  variant?: 'info' | 'warning'
}) {
  const palette =
    variant === 'warning'
      ? 'bg-amber-50 border-amber-200/60 text-amber-800'
      : 'bg-blue-50 border-blue-200/60 text-blue-800'
  return (
    <div className={`px-4 py-3 rounded-lg border text-xs leading-relaxed ${palette}`}>
      {message}
    </div>
  )
}

function DiffSchemaPreview() {
  const rows = [
    { label: '고잔가 변동', count: '—', description: '최대잔가율이 바뀐 차종' },
    { label: '일반잔가 변동', count: '—', description: '표준 잔가율이 바뀐 차종' },
    { label: '기본 금리 변동', count: '—', description: '브랜드·딜러별 baseIrrRate 변동' },
    { label: '신규 편입 / 제외', count: '—', description: '새로 추가되거나 빠진 차량' },
  ]
  return (
    <div className="w-full max-w-[480px] mt-3 grid grid-cols-2 gap-2">
      {rows.map((row) => (
        <div
          key={row.label}
          className="flex flex-col gap-0.5 px-3 py-2.5 rounded-lg border border-dashed border-border bg-muted/20 text-left"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-foreground">{row.label}</span>
            <span className="text-xs font-mono text-muted-foreground/60">{row.count}</span>
          </div>
          <span className="text-[10px] text-muted-foreground/80 leading-tight">{row.description}</span>
        </div>
      ))}
    </div>
  )
}

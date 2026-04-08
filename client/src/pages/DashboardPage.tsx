import { useEffect, useState } from 'react'
import { Database, FileSpreadsheet, Car, BarChart3, ShieldCheck, Clock, Tag } from 'lucide-react'
import { fetchImports } from '@/lib/api'
import type { WorkbookImport } from '@/types/imports'

interface DashboardState {
  loading: boolean
  connected: boolean | null
  activeImport: WorkbookImport | null
  recentImports: WorkbookImport[]
  brands: string[]
  totalImports: number
}

function getAnalysis(meta: Record<string, unknown>) {
  const a = meta?.analysis
  if (a && typeof a === 'object') {
    const rec = a as Record<string, unknown>
    return {
      vehicleProgramCount: (rec.vehicleProgramCount as number) ?? null,
      residualMatrixRowCount: (rec.residualMatrixRowCount as number) ?? null,
      brandRatePolicyCount: (rec.brandRatePolicyCount as number) ?? null,
    }
  }
  return null
}

export function DashboardPage() {
  const [state, setState] = useState<DashboardState>({
    loading: true,
    connected: null,
    activeImport: null,
    recentImports: [],
    brands: [],
    totalImports: 0,
  })

  useEffect(() => {
    const load = async () => {
      try {
        const [importsData, brandsData] = await Promise.all([
          fetchImports('mg-capital'),
          fetch('/api/catalog/brands?lenderCode=mg-capital').then((r) => r.json()),
        ])
        const activeImport = importsData.imports?.find((i) => i.isActive) ?? null
        const brands: string[] = (brandsData?.brands ?? []).map(
          (b: { brand: string } | string) => (typeof b === 'string' ? b : b.brand)
        )
        setState({
          loading: false,
          connected: importsData.connected,
          activeImport,
          recentImports: importsData.imports?.slice(0, 6) ?? [],
          brands,
          totalImports: importsData.imports?.length ?? 0,
        })
      } catch {
        setState((prev) => ({ ...prev, loading: false, connected: false }))
      }
    }
    load()
  }, [])

  const { loading, connected, activeImport, recentImports, brands, totalImports } = state
  const analysis = activeImport ? getAnalysis(activeImport.meta) : null

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-5">

      {/* ── Status bar ── */}
      <div className="animate-fade-up" style={{ animationDelay: '0ms' }}>
        <StatusBanner loading={loading} connected={connected} totalImports={totalImports} activeImport={activeImport} />
      </div>

      {/* ── Main bento: [workbook · history] ── */}
      <div
        className="grid gap-4 animate-fade-up"
        style={{ gridTemplateColumns: '1fr 280px', animationDelay: '60ms' }}
      >
        {/* Left: active workbook */}
        <WorkbookCard loading={loading} connected={connected} activeImport={activeImport} analysis={analysis} />

        {/* Right: import history */}
        <HistoryPanel loading={loading} connected={connected} recentImports={recentImports} totalImports={totalImports} />
      </div>

      {/* ── Brand catalog ── */}
      <div className="animate-fade-up" style={{ animationDelay: '120ms' }}>
        <BrandCatalog loading={loading} connected={connected} brands={brands} />
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
  totalImports,
  activeImport,
}: {
  loading: boolean
  connected: boolean | null
  totalImports: number
  activeImport: WorkbookImport | null
}) {
  const isOk = connected === true

  return (
    <div
      className={`rounded-2xl border px-6 py-4 flex items-center gap-5 transition-colors duration-500 ${
        loading
          ? 'bg-muted/40 border-border'
          : isOk
            ? 'bg-emerald-50 border-emerald-200/80'
            : 'bg-amber-50 border-amber-200/80'
      }`}
    >
      {/* Pulsing status dot */}
      <div className="relative shrink-0">
        {!loading && (
          <span
            className={`absolute inset-0 rounded-full ping-ring ${isOk ? 'bg-emerald-400' : 'bg-amber-400'}`}
          />
        )}
        <div
          className={`relative w-3 h-3 rounded-full transition-colors ${
            loading ? 'bg-muted-foreground/30' : isOk ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
        />
      </div>

      {/* Status text */}
      <div className="flex-1 min-w-0">
        {loading ? (
          <>
            <div className="skeleton h-4 w-32 rounded mb-1.5" />
            <div className="skeleton h-3 w-48 rounded" />
          </>
        ) : (
          <>
            <div
              className={`text-sm font-semibold tracking-tight leading-none ${isOk ? 'text-emerald-900' : 'text-amber-900'}`}
            >
              {isOk ? '해결책 정상 가동 중' : 'DB 연결 없음'}
            </div>
            <div className={`text-xs mt-1.5 ${isOk ? 'text-emerald-700' : 'text-amber-700'}`}>
              {isOk
                ? `MG캐피탈 운용리스 · 총 ${totalImports}개 임포트 기록`
                : '.dev.vars의 DATABASE_URL을 확인하세요'}
            </div>
          </>
        )}
      </div>

      {/* Right: version chip */}
      {!loading && activeImport && (
        <div className="shrink-0 text-right">
          <div className="text-[10px] font-semibold text-emerald-700 uppercase tracking-widest mb-1 leading-none flex items-center gap-1 justify-end">
            <Database size={9} />
            활성 워크북
          </div>
          <div className="text-sm font-bold font-mono text-emerald-900 tracking-tight">
            {activeImport.versionLabel}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Active workbook card
───────────────────────────────────────────── */
function WorkbookCard({
  loading,
  connected,
  activeImport,
  analysis,
}: {
  loading: boolean
  connected: boolean | null
  activeImport: WorkbookImport | null
  analysis: ReturnType<typeof getAnalysis>
}) {
  const importedAt = activeImport
    ? new Date(activeImport.importedAt).toLocaleString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null

  return (
    <div className="rounded-2xl border border-border bg-white shadow-[0_20px_60px_-15px_rgba(29,51,184,0.08)] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-2.5">
        <FileSpreadsheet size={13} className="text-primary shrink-0" strokeWidth={2} />
        <span className="text-sm font-semibold text-foreground tracking-tight">활성 워크북</span>
      </div>

      {loading ? (
        <WorkbookSkeleton />
      ) : activeImport ? (
        <>
          {/* File info */}
          <div className="px-5 py-4 border-b border-border bg-primary/[0.025]">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1 leading-none">
              파일명
            </div>
            <div className="text-[15px] font-semibold text-foreground tracking-tight leading-snug break-all">
              {activeImport.sourceFileName}
            </div>
            <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2.5">
              <MetaChip label={activeImport.versionLabel} accent />
              <MetaChip label={activeImport.lenderName} />
              <MetaChip label={importedAt ?? ''} />
              <span
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200/80"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {activeImport.status}
              </span>
            </div>
          </div>

          {/* Data metrics — asymmetric: left hero / right stacked */}
          {analysis && (
            <div className="flex-1 grid" style={{ gridTemplateColumns: '2fr 3fr' }}>
              {/* Left: vehicle count hero */}
              <div className="flex flex-col justify-center px-5 py-6 border-r border-border">
                <div className="flex items-center gap-1.5 mb-3">
                  <Car size={11} className="text-primary" strokeWidth={2} />
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest leading-none">
                    차량 프로그램
                  </div>
                </div>
                <div className="text-5xl font-black font-mono tabular-nums text-primary leading-none tracking-tighter">
                  {analysis.vehicleProgramCount ?? '—'}
                </div>
                <div className="text-xs text-muted-foreground mt-2">등록된 차량 트림</div>
              </div>

              {/* Right: residual matrix + policy stacked */}
              <div className="flex flex-col divide-y divide-border">
                <div className="flex-1 flex items-center gap-4 px-5 py-5">
                  <BarChart3 size={14} className="text-muted-foreground shrink-0" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest leading-none mb-1.5">
                      잔가 매트릭스
                    </div>
                    <div className="text-2xl font-black font-mono tabular-nums text-foreground leading-none">
                      {analysis.residualMatrixRowCount ?? '—'}
                      <span className="text-sm font-normal text-muted-foreground ml-1">행</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 flex items-center gap-4 px-5 py-5">
                  <ShieldCheck size={14} className="text-muted-foreground shrink-0" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest leading-none mb-1.5">
                      금리 정책
                    </div>
                    <div className="text-2xl font-black font-mono tabular-nums text-foreground leading-none">
                      {analysis.brandRatePolicyCount ?? '—'}
                      <span className="text-sm font-normal text-muted-foreground ml-1">건</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ID footer */}
          <div className="px-5 py-2.5 border-t border-border bg-muted/30">
            <span className="text-[10px] font-mono text-muted-foreground">{activeImport.id}</span>
          </div>
        </>
      ) : (
        <EmptyWorkbook connected={connected} />
      )}
    </div>
  )
}

function WorkbookSkeleton() {
  return (
    <div className="p-5 flex flex-col gap-4">
      <div className="skeleton h-5 w-3/4 rounded-md" />
      <div className="skeleton h-3 w-1/2 rounded" />
      <div className="flex gap-2 mt-1">
        <div className="skeleton h-5 w-20 rounded-full" />
        <div className="skeleton h-5 w-16 rounded-full" />
        <div className="skeleton h-5 w-24 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 mt-2">
        <div className="skeleton h-20 rounded-xl" />
        <div className="flex flex-col gap-3">
          <div className="skeleton h-9 rounded-lg" />
          <div className="skeleton h-9 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

function EmptyWorkbook({ connected }: { connected: boolean | null }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-16 gap-4">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
        <FileSpreadsheet size={22} className="text-muted-foreground" strokeWidth={1.5} />
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold text-foreground mb-1">
          {connected === false ? 'DB 미연결' : '활성 워크북 없음'}
        </div>
        <div className="text-xs text-muted-foreground leading-relaxed max-w-[220px]">
          {connected === false
            ? '.dev.vars의 DATABASE_URL을 확인하세요'
            : '워크북 임포트 탭에서 엑셀 파일을 업로드하세요'}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Import history panel
───────────────────────────────────────────── */
function HistoryPanel({
  loading,
  connected,
  recentImports,
  totalImports,
}: {
  loading: boolean
  connected: boolean | null
  recentImports: WorkbookImport[]
  totalImports: number
}) {
  return (
    <div className="rounded-2xl border border-border bg-white shadow-[0_20px_60px_-15px_rgba(29,51,184,0.08)] overflow-hidden self-start">
      <img src="/reference-poster.png" alt="" className="w-full block" />
    </div>
  )
}

/* ─────────────────────────────────────────────
   Brand catalog
───────────────────────────────────────────── */
function BrandCatalog({
  loading,
  connected,
  brands,
}: {
  loading: boolean
  connected: boolean | null
  brands: string[]
}) {
  return (
    <div className="rounded-2xl border border-border bg-white shadow-[0_20px_60px_-15px_rgba(29,51,184,0.08)] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border flex items-center gap-2.5">
        <Tag size={13} className="text-primary shrink-0" strokeWidth={2} />
        <span className="text-sm font-semibold text-foreground tracking-tight">브랜드 카탈로그</span>
        {!loading && brands.length > 0 && (
          <span className="ml-auto text-[11px] font-mono text-muted-foreground">{brands.length}개</span>
        )}
      </div>

      <div className="p-5">
        {loading ? (
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="skeleton h-9 rounded-xl" style={{ width: `${60 + (i % 4) * 18}px` }} />
            ))}
          </div>
        ) : brands.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Tag size={22} className="text-muted-foreground/30" strokeWidth={1.5} />
            <span className="text-xs text-muted-foreground">
              {connected === false ? 'DB 미연결' : '활성 워크북을 임포트하면 브랜드 목록이 표시됩니다'}
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {brands.map((brand, i) => (
              <div
                key={brand}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-muted/30 hover:bg-muted hover:border-primary/30 transition-all duration-200 cursor-default animate-fade-up"
                style={{ animationDelay: `${i * 30}ms` }}
              >
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-[9px] font-black text-primary tracking-wider">
                  {brand.slice(0, 2).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-foreground tracking-tight">{brand}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Shared primitives
───────────────────────────────────────────── */
function MetaChip({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <span
      className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
        accent
          ? 'bg-primary/10 text-primary border-primary/25'
          : 'bg-muted text-muted-foreground border-border'
      }`}
    >
      {label}
    </span>
  )
}

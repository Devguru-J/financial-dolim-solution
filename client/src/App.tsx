import { useState } from 'react'
import { LayoutDashboard, Calculator, FileSpreadsheet } from 'lucide-react'
import { QuotePage } from '@/pages/QuotePage'
import { ImportPage } from '@/pages/ImportPage'
import { DashboardPage } from '@/pages/DashboardPage'

type Page = 'dashboard' | 'quote' | 'import'

const NAV: { id: Page; label: string; Icon: React.ElementType }[] = [
  { id: 'dashboard',  label: '종합현황판',      Icon: LayoutDashboard },
  { id: 'quote',      label: '값어림 계산',      Icon: Calculator },
  { id: 'import',     label: '문건 들여오기',  Icon: FileSpreadsheet },
]

export function App() {
  const [page, setPage] = useState<Page>('dashboard')

  return (
    <div className="h-[100dvh] flex overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-[220px] shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">
        {/* Brand */}
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shrink-0 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_4px_12px_rgba(29,51,184,0.4)]">
              <span className="text-white font-black text-[9px] tracking-widest select-none">DR</span>
            </div>
            <div className="leading-none">
              <div className="text-[13px] font-semibold text-white tracking-tight leading-snug">도림 자동차 견적 해결책</div>
              <div className="text-[11px] text-white/35 tracking-wide mt-0.5">혁명적인 값어림 계산 체계</div>
            </div>
          </div>

          {/* Lender chip */}
          <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl border border-white/[0.08] bg-white/[0.04]">
            <span className="text-[10px] font-medium text-white/40 tracking-wide">MG캐피탈</span>
            <span className="text-white/15 text-xs">·</span>
            <span className="text-[10px] font-bold text-primary tracking-wider uppercase">운용리스</span>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 h-px bg-white/[0.06] mb-2" />

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5">
          {NAV.map(({ id, label, Icon }) => {
            const active = page === id
            return (
              <button
                key={id}
                onClick={() => setPage(id)}
                className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-medium transition-all duration-150 group
                  ${active
                    ? 'bg-white/[0.10] text-white'
                    : 'text-white/35 hover:text-white/65 hover:bg-white/[0.05]'
                  }`}
              >
                {/* Active accent bar */}
                {active && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary" />
                )}
                <Icon
                  size={15}
                  strokeWidth={active ? 2 : 1.75}
                  className={`shrink-0 transition-colors ${active ? 'text-primary' : 'text-white/30 group-hover:text-white/50'}`}
                />
                <span className="tracking-tight">{label}</span>
              </button>
            )
          })}
        </nav>

        {/* Footer status */}
        <div className="mx-4 h-px bg-white/[0.06]" />
        <div className="px-5 py-4 flex items-center gap-2">
          <div className="relative w-1.5 h-1.5 shrink-0">
            <span className="absolute inset-0 rounded-full bg-emerald-400 ping-ring" />
            <span className="relative block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
          <span className="text-[10px] text-white/25 tracking-wider">해결책 가동 중</span>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 overflow-auto">
        {page === 'dashboard' && <DashboardPage />}
        {page === 'quote'     && <QuotePage />}
        {page === 'import'    && <ImportPage />}
      </main>

    </div>
  )
}

export default App

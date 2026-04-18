import { Card } from '@/components/ui/card'
import { formatKrw, roundUpToNearestHundred } from '@/lib/residual'
import type { QuoteResult } from '@/types/quote'

interface QuoteResultCardProps {
  result: QuoteResult
  lenderName: string
  lenderCode?: string
  isBest?: boolean
}

export function QuoteResultCard({ result, lenderName, lenderCode, isBest = false }: QuoteResultCardProps) {
  const displayMonthlyPayment = roundUpToNearestHundred(result.monthlyPayment)
  const leaseTermMonths = result.majorInputs.leaseTermMonths
  const totalCost = result.monthlyPayment * leaseTermMonths + result.residual.amount

  const ownerTag = result.majorInputs.ownershipType === 'company' ? '법인' : '고객명의'
  const isHighResidual =
    result.residual.maxRateDecimal != null &&
    result.residual.rateDecimal >= result.residual.maxRateDecimal
  const residualTag = isHighResidual ? '고잔가' : '일반잔가'
  const matrixGroup = result.residual.matrixGroup ?? ''

  // Woori Card 잔가보장수수료 lump-sum: 유효금리(RATE 역산)를 메인, 기본 IRR을 보조로
  const isWoori = lenderCode === 'woori-card'
  const mainRate = isWoori ? result.rates.effectiveAnnualRateDecimal : result.rates.annualRateDecimal
  const subRate = isWoori ? result.rates.annualRateDecimal : result.rates.effectiveAnnualRateDecimal
  const mainRatePercent = `${(mainRate * 100).toFixed(3)}%`
  const subRatePercent = `${(subRate * 100).toFixed(3)}%`

  return (
    <Card
      className={`rounded-[2rem] shadow-[var(--shadow-elev-3)] border overflow-hidden relative py-0 gap-0 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elev-4)] ${
        isBest ? 'border-accent/30' : 'border-border'
      }`}
    >
      {/* Accent bar top (vivid blue when best) */}
      <div className={`h-[3px] ${isBest ? 'bg-accent' : isHighResidual ? 'bg-primary' : 'bg-border'}`} />

      {/* Header */}
      <div className="px-6 pt-5 pb-3 flex items-center justify-between">
        <span className="text-[0.92rem] font-semibold tracking-tight text-foreground">
          {lenderName}
        </span>
        <div className="flex items-center gap-1.5">
          {isBest && <ResultBadge variant="accent">최저가</ResultBadge>}
          <ResultBadge variant="neutral">{ownerTag}</ResultBadge>
          <ResultBadge variant={isHighResidual ? 'accent' : 'neutral'}>{residualTag}</ResultBadge>
        </div>
      </div>

      {/* Monthly hero */}
      <div className="px-6 pb-5">
        <div className="flex items-baseline gap-1.5">
          <span
            className={`font-mono tabular-nums font-semibold tracking-[-0.03em] leading-none text-[2.1rem] ${
              isBest ? 'text-accent' : isHighResidual ? 'text-primary' : 'text-foreground'
            }`}
          >
            {formatKrw(displayMonthlyPayment)}
          </span>
          <span className="text-[0.82rem] font-normal text-muted-foreground">/ 월</span>
        </div>
        <div className="text-[0.7rem] text-muted-foreground/70 mt-1.5 font-mono tabular-nums">
          내부값 {formatKrw(result.monthlyPayment)}
        </div>
      </div>

      {/* Details */}
      <div className="px-6 pb-5 pt-4 border-t border-border grid grid-cols-1 gap-2.5">
        <DetailRow label="IRR" value={mainRatePercent} />
        {mainRatePercent !== subRatePercent && (
          <DetailRow
            label={isWoori ? '기본 IRR' : '유효 IRR'}
            value={subRatePercent}
            muted
          />
        )}
        <DetailRow
          label="잔가율"
          value={`${(result.residual.rateDecimal * 100).toFixed(2)}%`}
        />
        <DetailRow label="잔존가치" value={formatKrw(result.residual.amount)} />
        <DetailRow
          label="총 구매비용"
          value={formatKrw(totalCost)}
          hint={`${leaseTermMonths}개월 + 잔존가치`}
        />
      </div>

      {/* Footer: matrix group */}
      {matrixGroup && (
        <div className="px-6 py-3 bg-[#fafaf9] border-t border-border flex items-center justify-between">
          <span className="text-[0.72rem] text-muted-foreground">
            매트릭스 그룹{' '}
            <span className="font-mono text-foreground font-medium">{matrixGroup}</span>
          </span>
        </div>
      )}

      {/* Warnings */}
      {result.warnings && result.warnings.length > 0 && (
        <div className="border-t border-border px-6 py-3 flex flex-col gap-1.5">
          {result.warnings.map((w, i) => (
            <div
              key={i}
              className="text-[0.76rem] text-amber-800 bg-amber-50 border border-amber-200/70 rounded-lg px-3 py-2"
            >
              {w}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function ResultBadge({
  variant,
  children,
}: {
  variant: 'accent' | 'neutral'
  children: React.ReactNode
}) {
  const cls =
    variant === 'accent'
      ? 'bg-accent/10 text-accent'
      : 'bg-black/[0.04] text-muted-foreground'
  return (
    <span
      className={`text-[0.62rem] font-semibold uppercase tracking-[0.06em] px-1.5 py-0.5 rounded ${cls}`}
    >
      {children}
    </span>
  )
}

function DetailRow({
  label,
  value,
  hint,
  muted = false,
}: {
  label: string
  value: string
  hint?: string
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[0.78rem] text-muted-foreground">{label}</span>
      <span className="flex flex-col items-end gap-0.5">
        <span
          className={`font-mono tabular-nums text-[0.84rem] font-medium ${
            muted ? 'text-muted-foreground' : 'text-foreground'
          }`}
        >
          {value}
        </span>
        {hint && <span className="text-[0.64rem] text-muted-foreground/70">{hint}</span>}
      </span>
    </div>
  )
}

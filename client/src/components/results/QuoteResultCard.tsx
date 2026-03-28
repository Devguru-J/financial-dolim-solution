import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatKrw, roundUpToNearestHundred } from '@/lib/residual'
import type { QuoteResult } from '@/types/quote'

interface QuoteResultCardProps {
  result: QuoteResult
}

export function QuoteResultCard({ result }: QuoteResultCardProps) {
  const displayMonthlyPayment = roundUpToNearestHundred(result.monthlyPayment)
  const leaseTermMonths = result.majorInputs.leaseTermMonths
  const totalCost = result.monthlyPayment * leaseTermMonths + result.residual.amount

  const ownerTag =
    result.majorInputs.ownershipType === 'company' ? '법인' : '고객명의'
  const isHighResidual =
    result.residual.maxRateDecimal != null &&
    result.residual.rateDecimal >= result.residual.maxRateDecimal
  const residualTag = isHighResidual ? '고잔가' : '일반잔가'
  const matrixGroup = result.residual.matrixGroup ?? ''

  const irrPercent = `${(result.rates.annualRateDecimal * 100).toFixed(3)}%`
  const effectivePercent = `${(result.rates.effectiveAnnualRateDecimal * 100).toFixed(3)}%`

  return (
    <Card className="overflow-hidden shadow-[0_12px_30px_rgba(29,51,184,0.15)]">
      {/* Header */}
      <CardHeader className="py-2.5 px-4 border-b border-border bg-muted/60 flex flex-row items-center gap-2 flex-wrap space-y-0">
        <span className="font-semibold text-sm text-foreground mr-1">MG캐피탈</span>
        <Badge variant="outline" className="text-[10px] font-medium">
          {ownerTag}
        </Badge>
        <Badge
          variant="outline"
          className={`text-[10px] font-medium ${
            isHighResidual ? 'bg-primary/10 text-primary border-primary/30' : ''
          }`}
        >
          {residualTag}
        </Badge>
        {matrixGroup && (
          <Badge variant="outline" className="text-[10px] font-medium">
            {matrixGroup}
          </Badge>
        )}
      </CardHeader>

      <CardContent className="p-0">
        <div className="flex divide-x divide-border">
          {/* Left: monthly payment hero */}
          <div className="flex-1 px-5 py-4 bg-primary/[0.03]">
            <div className="text-[10px] font-semibold text-muted-foreground tracking-widest uppercase mb-3 leading-none">월 납입금</div>
            <div className="text-3xl font-normal tracking-tight font-mono tabular-nums text-primary leading-none">
              {formatKrw(displayMonthlyPayment)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              내부값 {formatKrw(result.monthlyPayment)}
            </div>
          </div>

          {/* Right: stacked secondary metrics */}
          <div className="w-48 flex flex-col divide-y divide-border">
            <SecRow
              label="IRR"
              value={irrPercent}
              sub={irrPercent !== effectivePercent ? `유효 ${effectivePercent}` : undefined}
            />
            <SecRow
              label="잔가율"
              value={`${(result.residual.rateDecimal * 100).toFixed(2)}%`}
              sub={formatKrw(result.residual.amount)}
            />
            <SecRow
              label="총 구매비용"
              value={formatKrw(totalCost)}
              sub={`${leaseTermMonths}개월 + 잔존가치`}
              small
            />
          </div>
        </div>

        {/* Warnings */}
        {result.warnings && result.warnings.length > 0 && (
          <div className="border-t border-border px-4 py-3 space-y-1">
            {result.warnings.map((w, i) => (
              <div
                key={i}
                className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2"
              >
                {w}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SecRow({
  label,
  value,
  sub,
  small = false,
}: {
  label: string
  value: string
  sub?: string
  small?: boolean
}) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 leading-none">
        {label}
      </div>
      <div className={`font-normal font-mono tabular-nums text-foreground leading-none ${small ? 'text-sm' : 'text-base'}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-muted-foreground mt-1">{sub}</div>}
    </div>
  )
}

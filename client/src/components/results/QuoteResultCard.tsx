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
  const totalCost = displayMonthlyPayment * leaseTermMonths + result.residual.amount

  const ownerTag =
    result.majorInputs.ownershipType === 'company' ? '법인' : '고객명의'
  const isHighResidual =
    result.residual.maxRateDecimal != null &&
    result.residual.rateDecimal >= result.residual.maxRateDecimal
  const residualTag = isHighResidual ? '고잔가' : '일반잔가'
  const matrixGroup = result.residual.matrixGroup ?? ''

  const irrPercent = result.irrAnnualDecimal
    ? `${(result.irrAnnualDecimal * 100).toFixed(3)}%`
    : '-'
  const effectivePercent = result.effectiveAnnualRateDecimal
    ? `${(result.effectiveAnnualRateDecimal * 100).toFixed(3)}%`
    : irrPercent

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardHeader className="bg-muted py-2.5 px-4 flex flex-row items-center gap-2 flex-wrap">
        <span className="font-bold text-sm">MG캐피탈</span>
        <Badge variant="outline" className="text-xs">
          {ownerTag}
        </Badge>
        <Badge
          variant="outline"
          className={`text-xs ${
            isHighResidual ? 'bg-blue-50 text-blue-700 border-blue-200' : ''
          }`}
        >
          {residualTag}
        </Badge>
        {matrixGroup && (
          <Badge variant="outline" className="text-xs">
            {matrixGroup}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-2">
          {/* 월 납입금 */}
          <ResultCell bg accent borderRight borderBottom>
            <ResultLabel>월 납입금</ResultLabel>
            <ResultValue accent>{formatKrw(displayMonthlyPayment)}</ResultValue>
            <ResultSub>내부값 {formatKrw(result.monthlyPayment)}</ResultSub>
          </ResultCell>

          {/* IRR */}
          <ResultCell borderBottom>
            <ResultLabel>IRR</ResultLabel>
            <ResultValue>{irrPercent}</ResultValue>
            <ResultSub>유효 {effectivePercent}</ResultSub>
          </ResultCell>

          {/* 잔가 */}
          <ResultCell bg borderRight>
            <ResultLabel>잔가</ResultLabel>
            <ResultValue>
              {(result.residual.rateDecimal * 100).toFixed(2)}%
            </ResultValue>
            <ResultSub>{formatKrw(result.residual.amount)}</ResultSub>
          </ResultCell>

          {/* 총 구매비용 */}
          <ResultCell>
            <ResultLabel>총 구매비용</ResultLabel>
            <ResultValue small>{formatKrw(totalCost)}</ResultValue>
            <ResultSub>
              월납입금×{leaseTermMonths}개월+잔존가치
            </ResultSub>
          </ResultCell>
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

function ResultCell({
  children,
  bg = false,
  accent = false,
  borderRight = false,
  borderBottom = false,
}: {
  children: React.ReactNode
  bg?: boolean
  accent?: boolean
  borderRight?: boolean
  borderBottom?: boolean
}) {
  return (
    <div
      className={[
        'p-4',
        bg ? 'bg-muted' : '',
        borderRight ? 'border-r border-border' : '',
        borderBottom ? 'border-b border-border' : '',
      ].join(' ')}
    >
      {children}
    </div>
  )
}

function ResultLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold text-muted-foreground tracking-wider uppercase mb-1.5">
      {children}
    </div>
  )
}

function ResultValue({
  children,
  accent = false,
  small = false,
}: {
  children: React.ReactNode
  accent?: boolean
  small?: boolean
}) {
  return (
    <div
      className={[
        'font-extrabold tracking-tight',
        small ? 'text-lg' : 'text-xl',
        accent ? 'text-blue-600' : 'text-foreground',
      ].join(' ')}
    >
      {children}
    </div>
  )
}

function ResultSub({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs text-muted-foreground mt-1">{children}</div>
  )
}

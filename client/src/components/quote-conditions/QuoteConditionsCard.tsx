import { useId } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { LeaseTerm, AnnualMileage } from '@/types/quote'

export type BnkDealerOption = { dealerName: string; baseIrrRate: number }

interface QuoteConditionsCardProps {
  leaseTermMonths: LeaseTerm
  annualMileageKm: AnnualMileage
  depositMode: 'amount' | 'percent'
  depositValue: string
  upfrontMode: 'amount' | 'percent'
  upfrontValue: string
  residualMode: 'high' | 'standard'
  cmFeeRate: string
  agFeeRate: string
  affiliateExempt: boolean
  evSubsidy: boolean
  evSubsidyAmount: string
  showAdvanced: boolean
  annualIrrRateOverride: string
  annualEffectiveRateOverride: string
  paymentRateOverride: string
  bnkDealers: BnkDealerOption[]
  bnkDealerName: string
  onTermChange: (v: LeaseTerm) => void
  onMileageChange: (v: AnnualMileage) => void
  onDepositModeChange: (v: 'amount' | 'percent') => void
  onDepositValueChange: (v: string) => void
  onUpfrontModeChange: (v: 'amount' | 'percent') => void
  onUpfrontValueChange: (v: string) => void
  onResidualModeChange: (v: 'high' | 'standard') => void
  onCmFeeRateChange: (v: string) => void
  onAgFeeRateChange: (v: string) => void
  onAffiliateExemptChange: (v: boolean) => void
  onEvSubsidyChange: (v: boolean) => void
  onEvSubsidyAmountChange: (v: string) => void
  onToggleAdvanced: () => void
  onAnnualIrrRateOverrideChange: (v: string) => void
  onAnnualEffectiveRateOverrideChange: (v: string) => void
  onPaymentRateOverrideChange: (v: string) => void
  onBnkDealerNameChange: (v: string) => void
}

export function QuoteConditionsCard(props: QuoteConditionsCardProps) {
  const {
    leaseTermMonths,
    annualMileageKm,
    depositMode,
    depositValue,
    upfrontMode,
    upfrontValue,
    residualMode,
    cmFeeRate,
    agFeeRate,
    affiliateExempt,
    evSubsidy,
    evSubsidyAmount,
    showAdvanced,
    annualIrrRateOverride,
    annualEffectiveRateOverride,
    paymentRateOverride,
    onTermChange,
    onMileageChange,
    onDepositModeChange,
    onDepositValueChange,
    onUpfrontModeChange,
    onUpfrontValueChange,
    onResidualModeChange,
    onCmFeeRateChange,
    onAgFeeRateChange,
    onAffiliateExemptChange,
    onEvSubsidyChange,
    onEvSubsidyAmountChange,
    onToggleAdvanced,
    onAnnualIrrRateOverrideChange,
    onAnnualEffectiveRateOverrideChange,
    onPaymentRateOverrideChange,
    bnkDealers,
    bnkDealerName,
    onBnkDealerNameChange,
  } = props

  const uid = useId()

  return (
    <Card className="shadow-[0_20px_40px_-12px_rgba(25,28,31,0.08)]">
      <CardHeader className="py-3 px-4 border-b border-border flex flex-row items-center gap-2.5 space-y-0">
        <div className="w-1 h-3.5 rounded-sm bg-primary" />
        <CardTitle className="text-sm font-semibold text-foreground">견적 조건</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-[120px_1fr_120px_1fr]">
          {/* Row 1: 판매사 / 기간 */}
          <FieldLabel>판매사</FieldLabel>
          <FieldCell borderRight>
            {bnkDealers.length > 0 ? (
              <select
                value={bnkDealerName}
                onChange={(e) => onBnkDealerNameChange(e.target.value)}
                className="w-full h-8 px-2 text-xs bg-muted border border-border rounded"
              >
                <option value="">자동 (첫번째 제휴사)</option>
                {bnkDealers.map((d) => (
                  <option key={d.dealerName} value={d.dealerName}>
                    {d.dealerName} ({(d.baseIrrRate * 100).toFixed(2)}%)
                  </option>
                ))}
              </select>
            ) : (
              <select
                className="w-full h-8 px-2 text-xs bg-muted border border-border rounded opacity-50"
                disabled
              >
                <option>비활성</option>
              </select>
            )}
          </FieldCell>
          <FieldLabel>기간(개월)</FieldLabel>
          <FieldCell>
            <Select
              value={String(leaseTermMonths)}
              onValueChange={(v) => onTermChange(Number(v) as LeaseTerm)}
            >
              <SelectTrigger className="h-8 text-xs font-mono tabular-nums">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {([12, 24, 36, 48, 60] as LeaseTerm[]).map((t) => (
                  <SelectItem key={t} value={String(t)} className="font-mono tabular-nums">
                    {t}개월
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldCell>

          {/* Row 2: 제휴수수료 / 약정거리 */}
          <FieldLabel>제휴수수료</FieldLabel>
          <FieldCell borderRight>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="radio"
                name={`${uid}-affiliate`}
                className=""
                checked={affiliateExempt}
                onChange={() => onAffiliateExemptChange(true)}
              />
              비해당
            </label>
            <label className="flex items-center gap-1 text-xs cursor-pointer ml-3">
              <input
                type="radio"
                name={`${uid}-affiliate`}
                className=""
                checked={!affiliateExempt}
                onChange={() => onAffiliateExemptChange(false)}
              />
              해당
            </label>
          </FieldCell>
          <FieldLabel>약정거리</FieldLabel>
          <FieldCell>
            <Select
              value={String(annualMileageKm)}
              onValueChange={(v) => onMileageChange(Number(v) as AnnualMileage)}
            >
              <SelectTrigger className="h-8 text-xs font-mono tabular-nums">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {([10000, 15000, 20000, 30000, 35000, 40000] as AnnualMileage[]).map((m) => (
                  <SelectItem key={m} value={String(m)} className="font-mono tabular-nums">
                    {m % 10000 === 0 ? `${m / 10000}만km` : `${(m / 10000).toFixed(1)}만km`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldCell>

          {/* Row 3: 보증금 / 잔존가치 */}
          <FieldLabel>보증금</FieldLabel>
          <FieldCell borderRight>
            <AmountPercentInput
              mode={depositMode}
              value={depositValue}
              onModeChange={onDepositModeChange}
              onValueChange={onDepositValueChange}
            />
          </FieldCell>
          <FieldLabel>잔존가치</FieldLabel>
          <FieldCell>
            <div className="flex items-center gap-3 h-8">
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="residualMode"
                  checked={residualMode === 'high'}
                  onChange={() => onResidualModeChange('high')}
                  className="accent-blue-600"
                />
                고잔가
              </label>
              <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                <input
                  type="radio"
                  name="residualMode"
                  checked={residualMode === 'standard'}
                  onChange={() => onResidualModeChange('standard')}
                  className="accent-blue-600"
                />
                일반잔가
              </label>
            </div>
          </FieldCell>

          {/* Row 4: 선납금 / CM수수료 */}
          <FieldLabel>선납금</FieldLabel>
          <FieldCell borderRight>
            <AmountPercentInput
              mode={upfrontMode}
              value={upfrontValue}
              onModeChange={onUpfrontModeChange}
              onValueChange={onUpfrontValueChange}
            />
          </FieldCell>
          <FieldLabel>CM수수료</FieldLabel>
          <FieldCell>
            <input
              className="w-full h-8 px-2 text-xs bg-muted border border-border rounded font-mono tabular-nums"
              value={cmFeeRate}
              onChange={(e) => onCmFeeRateChange(e.target.value)}
              placeholder="0%"
            />
          </FieldCell>

          {/* Row 5: 전기차 보조금 / AG수수료 */}
          <FieldLabel last>전기차 보조금</FieldLabel>
          <FieldCell borderRight last>
            <label className="flex items-center gap-1 text-xs cursor-pointer">
              <input
                type="radio"
                name={`${uid}-evSubsidy`}
                className=""
                checked={!evSubsidy}
                onChange={() => onEvSubsidyChange(false)}
              />
              비해당
            </label>
            <label className="flex items-center gap-1 text-xs cursor-pointer ml-3">
              <input
                type="radio"
                name={`${uid}-evSubsidy`}
                className=""
                checked={evSubsidy}
                onChange={() => onEvSubsidyChange(true)}
              />
              해당
            </label>
            {evSubsidy && (
              <input
                className="flex-1 h-8 px-2 text-xs bg-muted border border-border rounded ml-2 font-mono tabular-nums"
                value={evSubsidyAmount}
                onChange={(e) => onEvSubsidyAmountChange(e.target.value)}
                placeholder="0"
              />
            )}
          </FieldCell>
          <FieldLabel last>AG수수료</FieldLabel>
          <FieldCell last>
            <input
              className="w-full h-8 px-2 text-xs bg-muted border border-border rounded font-mono tabular-nums"
              value={agFeeRate}
              onChange={(e) => onAgFeeRateChange(e.target.value)}
              placeholder="0%"
            />
          </FieldCell>
        </div>

        {/* Advanced overrides (collapsible) */}
        <details className="border-t border-border" open={showAdvanced}>
          <summary
            className="px-4 py-2 text-xs text-muted-foreground cursor-pointer hover:bg-muted select-none"
            onClick={(e) => {
              e.preventDefault()
              onToggleAdvanced()
            }}
          >
            고급 설정 (override)
          </summary>
          <div className="px-4 pb-3 grid grid-cols-3 gap-2">
            <div>
              <div className="text-xs text-muted-foreground mb-1">연 IRR override</div>
              <input
                className="w-full h-8 px-2 text-xs bg-muted border border-border rounded font-mono tabular-nums"
                value={annualIrrRateOverride}
                onChange={(e) => onAnnualIrrRateOverrideChange(e.target.value)}
                placeholder="빈칸 = 자동"
              />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">유효 IRR override</div>
              <input
                className="w-full h-8 px-2 text-xs bg-muted border border-border rounded font-mono tabular-nums"
                value={annualEffectiveRateOverride}
                onChange={(e) => onAnnualEffectiveRateOverrideChange(e.target.value)}
                placeholder="빈칸 = 자동"
              />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">월 납입률 override</div>
              <input
                className="w-full h-8 px-2 text-xs bg-muted border border-border rounded font-mono tabular-nums"
                value={paymentRateOverride}
                onChange={(e) => onPaymentRateOverrideChange(e.target.value)}
                placeholder="빈칸 = 자동"
              />
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}

function FieldLabel({
  children,
  last = false,
}: {
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      className={`px-3 text-xs font-semibold text-foreground bg-muted flex items-center border-r border-border min-h-10 ${!last ? 'border-b border-border' : ''}`}
    >
      {children}
    </div>
  )
}

function FieldCell({
  children,
  borderRight = false,
  last = false,
}: {
  children: React.ReactNode
  borderRight?: boolean
  last?: boolean
}) {
  return (
    <div
      className={`px-2 py-1.5 flex items-center gap-1.5 ${borderRight ? 'border-r border-border' : ''} ${!last ? 'border-b border-border' : ''}`}
    >
      {children}
    </div>
  )
}

function AmountPercentInput({
  mode,
  value,
  onModeChange,
  onValueChange,
}: {
  mode: 'amount' | 'percent'
  value: string
  onModeChange: (v: 'amount' | 'percent') => void
  onValueChange: (v: string) => void
}) {
  return (
    <>
      <select
        className="h-8 px-1.5 text-xs bg-muted border border-border rounded"
        value={mode}
        onChange={(e) => onModeChange(e.target.value as 'amount' | 'percent')}
      >
        <option value="amount">금액</option>
        <option value="percent">%</option>
      </select>
      <input
        className="flex-1 h-8 px-2 text-xs bg-muted border border-border rounded font-mono tabular-nums"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder="0"
      />
    </>
  )
}

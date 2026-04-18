import { useId } from 'react'
import { SlidersHorizontal, ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/card'
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
    <Card className="shadow-[var(--shadow-elev-2)] border border-border overflow-hidden py-0 gap-0">
      {/* Header */}
      <div className="px-7 py-4 border-b border-border flex items-center gap-2.5">
        <span className="w-5 h-5 rounded-md flex items-center justify-center bg-accent/10 text-accent">
          <SlidersHorizontal size={12} strokeWidth={2.2} />
        </span>
        <span className="text-[0.95rem] font-semibold text-foreground tracking-tight">견적 조건</span>
      </div>

      {/* Body */}
      <div className="px-7 py-6">
        <div className="grid grid-cols-2 gap-5">
          {/* 판매사 */}
          <FormField label="판매사">
            {bnkDealers.length > 0 ? (
              <select
                value={bnkDealerName}
                onChange={(e) => onBnkDealerNameChange(e.target.value)}
                className="form-input w-full"
              >
                <option value="">자동 (첫번째 제휴사)</option>
                {bnkDealers.map((d) => (
                  <option key={d.dealerName} value={d.dealerName}>
                    {d.dealerName} ({(d.baseIrrRate * 100).toFixed(2)}%)
                  </option>
                ))}
              </select>
            ) : (
              <select className="form-input w-full opacity-50" disabled>
                <option>비활성</option>
              </select>
            )}
          </FormField>

          {/* 기간 */}
          <FormField label="리스 기간">
            <Select
              value={String(leaseTermMonths)}
              onValueChange={(v) => onTermChange(Number(v) as LeaseTerm)}
            >
              <SelectTrigger className="form-input form-input-mono w-full">
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
          </FormField>

          {/* 제휴수수료 */}
          <FormField label="제휴수수료">
            <RadioGroupRow
              name={`${uid}-affiliate`}
              options={[
                { value: true, label: '비해당' },
                { value: false, label: '해당' },
              ]}
              selected={affiliateExempt}
              onChange={onAffiliateExemptChange}
            />
          </FormField>

          {/* 약정거리 */}
          <FormField label="약정 주행거리">
            <Select
              value={String(annualMileageKm)}
              onValueChange={(v) => onMileageChange(Number(v) as AnnualMileage)}
            >
              <SelectTrigger className="form-input form-input-mono w-full">
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
          </FormField>

          {/* 보증금 */}
          <FormField label="보증금">
            <AmountPercentInput
              mode={depositMode}
              value={depositValue}
              onModeChange={onDepositModeChange}
              onValueChange={onDepositValueChange}
            />
          </FormField>

          {/* 잔존가치 */}
          <FormField label="잔존가치">
            <RadioGroupRow
              name={`${uid}-residual`}
              options={[
                { value: 'high' as const, label: '고잔가' },
                { value: 'standard' as const, label: '일반잔가' },
              ]}
              selected={residualMode}
              onChange={onResidualModeChange}
            />
          </FormField>

          {/* 선납금 */}
          <FormField label="선납금">
            <AmountPercentInput
              mode={upfrontMode}
              value={upfrontValue}
              onModeChange={onUpfrontModeChange}
              onValueChange={onUpfrontValueChange}
            />
          </FormField>

          {/* CM수수료 */}
          <FormField label="CM 수수료">
            <input
              className="form-input form-input-mono w-full"
              value={cmFeeRate}
              onChange={(e) => onCmFeeRateChange(e.target.value)}
              placeholder="0%"
            />
          </FormField>

          {/* 전기차 보조금 */}
          <FormField label="전기차 보조금">
            {evSubsidy ? (
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <RadioGroupRow
                    name={`${uid}-evSubsidy`}
                    options={[
                      { value: false, label: '비해당' },
                      { value: true, label: '해당' },
                    ]}
                    selected={evSubsidy}
                    onChange={onEvSubsidyChange}
                  />
                </div>
                <input
                  className="form-input form-input-mono w-32 shrink-0"
                  value={evSubsidyAmount}
                  onChange={(e) => onEvSubsidyAmountChange(e.target.value)}
                  placeholder="금액"
                />
              </div>
            ) : (
              <RadioGroupRow
                name={`${uid}-evSubsidy`}
                options={[
                  { value: false, label: '비해당' },
                  { value: true, label: '해당' },
                ]}
                selected={evSubsidy}
                onChange={onEvSubsidyChange}
              />
            )}
          </FormField>

          {/* AG수수료 */}
          <FormField label="AG 수수료">
            <input
              className="form-input form-input-mono w-full"
              value={agFeeRate}
              onChange={(e) => onAgFeeRateChange(e.target.value)}
              placeholder="0%"
            />
          </FormField>
        </div>

        {/* Advanced overrides */}
        <details className="mt-5 border-t border-border -mx-7 px-7 pt-4" open={showAdvanced}>
          <summary
            className="flex items-center gap-2 cursor-pointer select-none text-[0.78rem] font-medium text-muted-foreground hover:text-foreground transition-colors list-none"
            onClick={(e) => {
              e.preventDefault()
              onToggleAdvanced()
            }}
          >
            <ChevronDown
              size={14}
              strokeWidth={2}
              className={`transition-transform ${showAdvanced ? 'rotate-0' : '-rotate-90'}`}
            />
            <span>고급 설정 (override)</span>
          </summary>
          <div className="mt-4 grid grid-cols-3 gap-4">
            <FormField label="연 IRR override">
              <input
                className="form-input form-input-mono w-full"
                value={annualIrrRateOverride}
                onChange={(e) => onAnnualIrrRateOverrideChange(e.target.value)}
                placeholder="빈칸 = 자동"
              />
            </FormField>
            <FormField label="유효 IRR override">
              <input
                className="form-input form-input-mono w-full"
                value={annualEffectiveRateOverride}
                onChange={(e) => onAnnualEffectiveRateOverrideChange(e.target.value)}
                placeholder="빈칸 = 자동"
              />
            </FormField>
            <FormField label="월 납입률 override">
              <input
                className="form-input form-input-mono w-full"
                value={paymentRateOverride}
                onChange={(e) => onPaymentRateOverrideChange(e.target.value)}
                placeholder="빈칸 = 자동"
              />
            </FormField>
          </div>
        </details>
      </div>
    </Card>
  )
}

function FormField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[0.72rem] font-medium text-muted-foreground tracking-[0.01em]">
        {label}
      </label>
      {children}
    </div>
  )
}

function RadioGroupRow<T>({
  name,
  options,
  selected,
  onChange,
}: {
  name: string
  options: { value: T; label: string }[]
  selected: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center gap-2">
      {options.map((opt) => {
        const isSelected = selected === opt.value
        return (
          <label
            key={opt.label}
            className={`flex-1 flex items-center justify-center gap-2 h-10 px-3 rounded-lg border cursor-pointer text-[0.82rem] font-medium transition-colors ${
              isSelected
                ? 'border-accent/40 bg-accent/[0.06] text-primary'
                : 'border-input bg-white text-muted-foreground hover:border-input/80 hover:text-foreground'
            }`}
          >
            <input
              type="radio"
              name={name}
              checked={isSelected}
              onChange={() => onChange(opt.value)}
              className="size-3.5 cursor-pointer"
            />
            {opt.label}
          </label>
        )
      })}
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
    <div className="flex items-center gap-2">
      <select
        className="form-input w-24"
        value={mode}
        onChange={(e) => onModeChange(e.target.value as 'amount' | 'percent')}
      >
        <option value="amount">금액</option>
        <option value="percent">%</option>
      </select>
      <input
        className="form-input form-input-mono flex-1"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        placeholder="0"
      />
    </div>
  )
}

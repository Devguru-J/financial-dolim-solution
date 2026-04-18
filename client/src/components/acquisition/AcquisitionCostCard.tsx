import { Receipt } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { formatKrw } from '@/lib/residual'
import type { AcquisitionTaxMode } from '@/types/quote'

interface AcquisitionCostCardProps {
  acquisitionTaxIncluded: boolean
  acquisitionTaxMode: AcquisitionTaxMode
  acquisitionTaxAmount: number
  acquisitionTaxReduction: string
  acquisitionTaxAmountOverride: string
  deliveryFeeIncluded: boolean
  deliveryFee: string
  miscFeeIncluded: boolean
  miscFee: string
  publicBondIncluded: boolean
  publicBondCost: string
  totalAcquisitionCost: number
  onAcquisitionTaxIncludedToggle: (checked: boolean) => void
  onAcquisitionTaxModeChange: (mode: AcquisitionTaxMode) => void
  onAcquisitionTaxReductionChange: (value: string) => void
  onAcquisitionTaxAmountOverrideChange: (value: string) => void
  onDeliveryFeeToggle: (checked: boolean) => void
  onDeliveryFeeChange: (value: string) => void
  onMiscFeeToggle: (checked: boolean) => void
  onMiscFeeChange: (value: string) => void
  onPublicBondToggle: (checked: boolean) => void
  onPublicBondChange: (value: string) => void
}

export function AcquisitionCostCard({
  acquisitionTaxIncluded,
  acquisitionTaxMode,
  acquisitionTaxAmount,
  acquisitionTaxReduction,
  acquisitionTaxAmountOverride,
  deliveryFeeIncluded,
  deliveryFee,
  miscFeeIncluded,
  miscFee,
  publicBondIncluded,
  publicBondCost,
  totalAcquisitionCost,
  onAcquisitionTaxIncludedToggle,
  onAcquisitionTaxModeChange,
  onAcquisitionTaxReductionChange,
  onAcquisitionTaxAmountOverrideChange,
  onDeliveryFeeToggle,
  onDeliveryFeeChange,
  onMiscFeeToggle,
  onMiscFeeChange,
  onPublicBondToggle,
  onPublicBondChange,
}: AcquisitionCostCardProps) {
  return (
    <Card className="shadow-[var(--shadow-elev-2)] border border-border overflow-hidden py-0 gap-0">
      {/* Header */}
      <div className="px-7 py-4 border-b border-border flex items-center gap-2.5">
        <span className="w-5 h-5 rounded-md flex items-center justify-center bg-accent/10 text-accent">
          <Receipt size={12} strokeWidth={2.2} />
        </span>
        <span className="text-[0.95rem] font-semibold text-foreground tracking-tight">취득원가 산출</span>
      </div>

      {/* Body */}
      <div className="px-7 py-6">
        <div className="grid grid-cols-2 gap-5">
          {/* 취득세 감면 */}
          <FormField label="취득세 감면">
            <div className="flex items-center gap-2">
              <select
                className="form-input flex-1 min-w-0"
                value={acquisitionTaxMode}
                onChange={(e) => onAcquisitionTaxModeChange(e.target.value as AcquisitionTaxMode)}
              >
                <option value="automatic">자동 (7%)</option>
                <option value="ratio">면제 (0%)</option>
                <option value="reduction">금액 감면</option>
                <option value="amount">고정 금액</option>
              </select>
              {acquisitionTaxMode === 'reduction' && (
                <input
                  className="form-input form-input-mono w-28"
                  value={acquisitionTaxReduction}
                  onChange={(e) => onAcquisitionTaxReductionChange(e.target.value)}
                  placeholder="감면액"
                />
              )}
              {acquisitionTaxMode === 'amount' && (
                <input
                  className="form-input form-input-mono w-28"
                  value={acquisitionTaxAmountOverride}
                  onChange={(e) => onAcquisitionTaxAmountOverrideChange(e.target.value)}
                  placeholder="세액"
                />
              )}
            </div>
          </FormField>

          {/* 탁송료 */}
          <FormField label="탁송료">
            <CheckInput
              checked={deliveryFeeIncluded}
              onToggle={onDeliveryFeeToggle}
              value={deliveryFee}
              onValueChange={onDeliveryFeeChange}
            />
          </FormField>

          {/* 취득세 포함 */}
          <FormField label="취득세 포함" hint="세액 자동 산출">
            <CheckDisplay
              checked={acquisitionTaxIncluded}
              onToggle={onAcquisitionTaxIncludedToggle}
              value={acquisitionTaxIncluded ? formatKrw(acquisitionTaxAmount) : '₩ 0'}
              highlight
            />
          </FormField>

          {/* 부대비용 */}
          <FormField label="부대비용">
            <CheckInput
              checked={miscFeeIncluded}
              onToggle={onMiscFeeToggle}
              value={miscFee}
              onValueChange={onMiscFeeChange}
            />
          </FormField>

          {/* 공채 할인 (span 2 so 취득원가 gets its own wide row below) */}
          <FormField label="공채 할인" span={2}>
            <CheckInput
              checked={publicBondIncluded}
              onToggle={onPublicBondToggle}
              value={publicBondCost}
              onValueChange={onPublicBondChange}
            />
          </FormField>
        </div>

        {/* Total acquisition cost — prominent summary row */}
        <div className="mt-6 pt-5 border-t border-border flex items-baseline justify-between">
          <span className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground/80">
            취득원가
          </span>
          <span className="font-mono tabular-nums text-[1.35rem] font-semibold tracking-tight text-primary">
            {formatKrw(totalAcquisitionCost)}
          </span>
        </div>
      </div>
    </Card>
  )
}

function FormField({
  label,
  hint,
  span,
  children,
}: {
  label: string
  hint?: string
  span?: number
  children: React.ReactNode
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${span === 2 ? 'col-span-2' : ''}`}>
      <label className="text-[0.72rem] font-medium text-muted-foreground tracking-[0.01em] flex items-center gap-2">
        <span>{label}</span>
        {hint && <span className="text-[0.65rem] text-muted-foreground/60 font-normal">{hint}</span>}
      </label>
      {children}
    </div>
  )
}

function CheckInput({
  checked,
  onToggle,
  value,
  onValueChange,
}: {
  checked: boolean
  onToggle: (v: boolean) => void
  value: string
  onValueChange: (v: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1.5 px-3 h-10 rounded-lg border border-input bg-white cursor-pointer hover:border-input/80 transition-colors shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="size-3.5 cursor-pointer"
        />
        <span className="text-[0.78rem] text-muted-foreground font-medium">포함</span>
      </label>
      <input
        className="form-input form-input-mono flex-1"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        disabled={!checked}
        placeholder="0"
      />
    </div>
  )
}

function CheckDisplay({
  checked,
  onToggle,
  value,
  highlight = false,
}: {
  checked: boolean
  onToggle: (v: boolean) => void
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1.5 px-3 h-10 rounded-lg border border-input bg-white cursor-pointer hover:border-input/80 transition-colors shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="size-3.5 cursor-pointer"
        />
        <span className="text-[0.78rem] text-muted-foreground font-medium">포함</span>
      </label>
      <div
        className={`flex-1 h-10 px-[14px] rounded-lg flex items-center font-mono tabular-nums text-[0.88rem] font-medium ${
          highlight
            ? 'bg-primary/[0.05] border border-primary/25 text-primary'
            : 'bg-[#fafaf9] border border-border text-foreground'
        }`}
      >
        {value}
      </div>
    </div>
  )
}

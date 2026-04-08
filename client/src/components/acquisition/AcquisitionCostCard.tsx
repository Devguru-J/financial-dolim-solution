import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    <Card className="shadow-[0_20px_40px_-12px_rgba(25,28,31,0.08)]">
      <CardHeader className="py-3 px-4 border-b border-border flex flex-row items-center gap-2.5 space-y-0">
        <div className="w-1 h-3.5 rounded-sm bg-primary" />
        <CardTitle className="text-sm font-semibold text-foreground">취득원가 산출</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-[120px_1fr_120px_1fr]">
          {/* Row 1: 취득세 감면 / 탁송료 */}
          <FieldLabel>취득세 감면</FieldLabel>
          <FieldCell borderRight>
            <div className="flex items-center gap-1.5 w-full">
              <select
                className="h-8 px-2 text-xs bg-muted border border-border rounded flex-1 min-w-0"
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
                  className="w-24 h-8 px-2 text-xs bg-muted border border-border rounded font-mono tabular-nums"
                  value={acquisitionTaxReduction}
                  onChange={(e) => onAcquisitionTaxReductionChange(e.target.value)}
                  placeholder="감면액"
                />
              )}
              {acquisitionTaxMode === 'amount' && (
                <input
                  className="w-24 h-8 px-2 text-xs bg-muted border border-border rounded font-mono tabular-nums"
                  value={acquisitionTaxAmountOverride}
                  onChange={(e) => onAcquisitionTaxAmountOverrideChange(e.target.value)}
                  placeholder="세액"
                />
              )}
            </div>
          </FieldCell>
          <FieldLabel>탁송료</FieldLabel>
          <FieldCell>
            <CheckboxInput
              checked={deliveryFeeIncluded}
              label="포함"
              value={deliveryFee}
              onToggle={onDeliveryFeeToggle}
              onValueChange={onDeliveryFeeChange}
            />
          </FieldCell>

          {/* Row 2: 취득세 포함 / 부대비용 */}
          <FieldLabel>취득세 포함</FieldLabel>
          <FieldCell borderRight>
            <CheckboxDisplay
              checked={acquisitionTaxIncluded}
              onToggle={onAcquisitionTaxIncludedToggle}
              displayValue={
                acquisitionTaxIncluded ? formatKrw(acquisitionTaxAmount) : '₩ 0'
              }
              highlight
            />
          </FieldCell>
          <FieldLabel>부대비용</FieldLabel>
          <FieldCell>
            <CheckboxInput
              checked={miscFeeIncluded}
              label="포함"
              value={miscFee}
              onToggle={onMiscFeeToggle}
              onValueChange={onMiscFeeChange}
            />
          </FieldCell>

          {/* Row 3: 공채 할인 / 취득원가 */}
          <FieldLabel last>공채 할인</FieldLabel>
          <FieldCell borderRight last>
            <CheckboxInput
              checked={publicBondIncluded}
              label="포함"
              value={publicBondCost}
              onToggle={onPublicBondToggle}
              onValueChange={onPublicBondChange}
            />
          </FieldCell>
          <FieldLabel last>취득원가</FieldLabel>
          <FieldCell last>
            <div className="w-full h-8 px-2 text-xs bg-primary/8 border border-primary/25 rounded flex items-center font-normal font-mono tabular-nums text-primary">
              {formatKrw(totalAcquisitionCost)}
            </div>
          </FieldCell>
        </div>
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

function CheckboxInput({
  checked,
  label,
  value,
  onToggle,
  onValueChange,
}: {
  checked: boolean
  label: string
  value: string
  onToggle: (v: boolean) => void
  onValueChange: (v: string) => void
}) {
  return (
    <>
      <input
        type="checkbox"
        className=""
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        className="flex-1 h-8 px-2 text-xs bg-muted border border-border rounded font-mono tabular-nums"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        disabled={!checked}
        placeholder="0"
      />
    </>
  )
}

function CheckboxDisplay({
  checked,
  onToggle,
  displayValue,
  highlight = false,
}: {
  checked: boolean
  onToggle: (v: boolean) => void
  displayValue: string
  highlight?: boolean
}) {
  return (
    <>
      <input
        type="checkbox"
        className=""
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <span className="text-xs text-muted-foreground">포함</span>
      <div
        className={`flex-1 h-8 px-2 text-xs rounded flex items-center font-mono tabular-nums ${
          highlight
            ? 'bg-primary/8 border border-primary/25 text-primary'
            : 'bg-muted border border-border'
        }`}
      >
        {displayValue}
      </div>
    </>
  )
}

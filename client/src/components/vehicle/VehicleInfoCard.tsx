import { Car } from 'lucide-react'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatKrw } from '@/lib/residual'
import type { CatalogBrand, CatalogModel } from '@/types/catalog'

interface VehicleInfoCardProps {
  brands: CatalogBrand[]
  models: CatalogModel[]
  brandsLoading: boolean
  modelsLoading: boolean
  selectedBrand: string
  selectedModel: CatalogModel | null
  vehiclePrice: string
  discountPrice: string
  baseResidualRate: number | null
  maxResidualRate: number | null
  onBrandChange: (brand: string) => void
  onModelChange: (modelName: string) => void
  onVehiclePriceChange: (value: string) => void
  onDiscountPriceChange: (value: string) => void
}

export function VehicleInfoCard({
  brands,
  models,
  brandsLoading,
  modelsLoading,
  selectedBrand,
  selectedModel,
  vehiclePrice,
  discountPrice,
  baseResidualRate,
  maxResidualRate,
  onBrandChange,
  onModelChange,
  onVehiclePriceChange,
  onDiscountPriceChange,
}: VehicleInfoCardProps) {
  const finalPrice =
    (Number(vehiclePrice.replace(/,/g, '')) || 0) -
    (Number(discountPrice.replace(/,/g, '')) || 0)

  return (
    <Card className="shadow-[var(--shadow-elev-2)] border border-border overflow-hidden py-0 gap-0">
      {/* Header */}
      <div className="px-7 py-4 border-b border-border flex items-center gap-2.5">
        <span className="w-5 h-5 rounded-md flex items-center justify-center bg-accent/10 text-accent">
          <Car size={12} strokeWidth={2.2} />
        </span>
        <span className="text-[0.95rem] font-semibold text-foreground tracking-tight">차량 정보</span>
      </div>

      {/* Body */}
      <div className="px-7 py-6">
        <div className="grid grid-cols-4 gap-5">
          <FormField label="Brand">
            <Select
              value={selectedBrand}
              onValueChange={(v) => v != null && onBrandChange(v)}
              disabled={brandsLoading}
            >
              <SelectTrigger className="form-input w-full">
                <SelectValue placeholder={brandsLoading ? '로딩 중...' : '브랜드 선택'} />
              </SelectTrigger>
              <SelectContent>
                {brands.map((b) => (
                  <SelectItem key={b.brand} value={b.brand}>
                    {b.brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="Model" hint="비활성">
            <Select disabled>
              <SelectTrigger className="form-input w-full opacity-50">
                <SelectValue placeholder="브랜드가 선택되면 활성화" />
              </SelectTrigger>
            </Select>
          </FormField>

          <FormField label="Trim" span={2}>
            <Select
              value={selectedModel?.modelName ?? ''}
              onValueChange={(v) => v != null && onModelChange(v)}
              disabled={modelsLoading || !selectedBrand}
            >
              <SelectTrigger className="form-input w-full">
                <SelectValue placeholder={modelsLoading ? '로딩 중...' : '트림 선택'} />
              </SelectTrigger>
              <SelectContent className="min-w-72">
                {models.map((m) => (
                  <SelectItem key={m.modelName} value={m.modelName}>
                    {m.modelName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          <FormField label="차량 가격">
            <input
              className="form-input form-input-mono w-full"
              value={vehiclePrice}
              onChange={(e) => onVehiclePriceChange(e.target.value)}
              placeholder="0"
            />
          </FormField>

          <FormField label="옵션 가격">
            <div className="form-value-display">0</div>
          </FormField>

          <FormField label="할인 가격" span={2}>
            <input
              className="form-input form-input-mono w-full"
              value={discountPrice}
              onChange={(e) => onDiscountPriceChange(e.target.value)}
              placeholder="0"
            />
          </FormField>
        </div>

        {/* Selected vehicle hint strip */}
        {selectedModel && (
          <div className="mt-5 px-4 py-2.5 rounded-lg bg-muted/50 border border-border/60 text-xs text-muted-foreground tracking-tight">
            <span className="font-mono tabular-nums text-foreground">
              기본차량가 {Number(selectedModel.vehiclePrice).toLocaleString('ko-KR')}
            </span>
            {selectedModel.vehicleClass && ` · ${selectedModel.vehicleClass}`}
            {selectedModel.engineDisplacementCc && ` · ${selectedModel.engineDisplacementCc.toLocaleString()}cc`}
            {selectedModel.highResidualAllowed && ' · 고잔가 가능'}
            {selectedModel.residualPromotionCode && ` · 프로모션 ${selectedModel.residualPromotionCode}`}
          </div>
        )}

        {/* Summary row */}
        <div className="mt-6 pt-5 border-t border-border grid grid-cols-3 gap-4">
          <SummaryItem label="최종차량가" value={formatKrw(finalPrice)} accent />
          <SummaryItem
            label={`일반잔가${baseResidualRate != null ? ` · ${(baseResidualRate * 100).toFixed(2)}%` : ''}`}
            value={baseResidualRate != null ? formatKrw(Math.floor(finalPrice * baseResidualRate / 1000) * 1000) : '—'}
          />
          <SummaryItem
            label={`최대잔가${maxResidualRate != null ? ` · ${(maxResidualRate * 100).toFixed(2)}%` : ''}`}
            value={maxResidualRate != null ? formatKrw(finalPrice * maxResidualRate) : '—'}
          />
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

function SummaryItem({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground/80">
        {label}
      </span>
      <span className={`font-mono tabular-nums text-[1.05rem] font-medium tracking-tight ${accent ? 'text-primary' : 'text-foreground'}`}>
        {value}
      </span>
    </div>
  )
}

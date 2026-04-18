import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    <Card className="shadow-[var(--shadow-elev-2)]">
      <CardHeader className="py-3 px-4 border-b border-border flex flex-row items-center gap-2.5 space-y-0">
        <div className="w-1 h-3.5 rounded-sm bg-primary" />
        <CardTitle className="text-sm font-semibold text-foreground">차량 정보</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-[120px_1fr_120px_1fr]">
          {/* Row 1: Brand / 차량 가격 */}
          <FieldLabel>Brand</FieldLabel>
          <FieldCell borderRight>
            <Select
              value={selectedBrand}
              onValueChange={(v) => v != null && onBrandChange(v)}
              disabled={brandsLoading}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue
                  placeholder={brandsLoading ? '로딩 중...' : '브랜드 선택'}
                />
              </SelectTrigger>
              <SelectContent>
                {brands.map((b) => (
                  <SelectItem key={b.brand} value={b.brand}>
                    {b.brand}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldCell>
          <FieldLabel>차량 가격</FieldLabel>
          <FieldCell>
            <input
              className="w-full h-8 px-2 text-xs bg-muted border border-border rounded font-mono tabular-nums"
              value={vehiclePrice}
              onChange={(e) => onVehiclePriceChange(e.target.value)}
              placeholder="0"
            />
          </FieldCell>

          {/* Row 2: Model (disabled) / 옵션 가격 (read-only) */}
          <FieldLabel>Model</FieldLabel>
          <FieldCell borderRight>
            <Select disabled>
              <SelectTrigger className="h-8 text-xs opacity-50">
                <SelectValue placeholder="모델 선택 (비활성)" />
              </SelectTrigger>
            </Select>
          </FieldCell>
          <FieldLabel>옵션 가격</FieldLabel>
          <FieldCell>
            <div className="h-8 px-2 text-xs bg-muted border border-border rounded flex items-center text-muted-foreground font-mono tabular-nums">
              0
            </div>
          </FieldCell>

          {/* Row 3: Trim / 할인 가격 */}
          <FieldLabel last>Trim</FieldLabel>
          <FieldCell borderRight last>
            <Select
              value={selectedModel?.modelName ?? ''}
              onValueChange={(v) => v != null && onModelChange(v)}
              disabled={modelsLoading || !selectedBrand}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue
                  placeholder={modelsLoading ? '로딩 중...' : '트림 선택'}
                />
              </SelectTrigger>
              <SelectContent className="min-w-72">
                {models.map((m) => (
                  <SelectItem key={m.modelName} value={m.modelName}>
                    {m.modelName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldCell>
          <FieldLabel last>할인 가격</FieldLabel>
          <FieldCell last>
            <input
              className="w-full h-8 px-2 text-xs bg-muted border border-border rounded font-mono tabular-nums"
              value={discountPrice}
              onChange={(e) => onDiscountPriceChange(e.target.value)}
              placeholder="0"
            />
          </FieldCell>
        </div>

        {/* Summary info line */}
        {selectedModel && (
          <div className="mx-3 my-2 px-3 py-2 bg-muted rounded text-xs text-muted-foreground">
            기본차량가 {Number(selectedModel.vehiclePrice).toLocaleString('ko-KR')}
            {selectedModel.vehicleClass && ` · ${selectedModel.vehicleClass}`}
            {selectedModel.engineDisplacementCc &&
              ` · ${selectedModel.engineDisplacementCc.toLocaleString()}cc`}
            {selectedModel.highResidualAllowed && ' · 고잔가 가능'}
            {selectedModel.residualPromotionCode &&
              ` · 프로모션 ${selectedModel.residualPromotionCode}`}
          </div>
        )}

        {/* Summary stat row */}
        <div className="border-t border-border grid grid-cols-3 divide-x divide-border">
          <StatItem label="최종차량가" value={formatKrw(finalPrice)} accent />
          <StatItem
            label={`일반잔가${baseResidualRate != null ? ` (${(baseResidualRate * 100).toFixed(2)}%)` : ''}`}
            value={baseResidualRate != null ? formatKrw(Math.floor(finalPrice * baseResidualRate / 1000) * 1000) : '—'}
          />
          <StatItem
            label={`최대잔가${maxResidualRate != null ? ` (${(maxResidualRate * 100).toFixed(2)}%)` : ''}`}
            value={maxResidualRate != null ? formatKrw(finalPrice * maxResidualRate) : '—'}
          />
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
      className={`px-3 text-xs font-semibold text-foreground bg-muted flex items-center border-r border-border ${!last ? 'border-b border-border' : ''}`}
      style={{ minHeight: 40 }}
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
      className={`px-2 py-1.5 flex items-center ${borderRight ? 'border-r border-border' : ''} ${!last ? 'border-b border-border' : ''}`}
    >
      {children}
    </div>
  )
}

function StatItem({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5 leading-none">{label}</div>
      <div className={`text-sm font-normal font-mono tabular-nums ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</div>
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { VehicleInfoCard } from '@/components/vehicle/VehicleInfoCard'
import { AcquisitionCostCard } from '@/components/acquisition/AcquisitionCostCard'
import { QuoteConditionsCard } from '@/components/quote-conditions/QuoteConditionsCard'
import { QuoteResultCard } from '@/components/results/QuoteResultCard'
import { useCatalog, getResidualPreviews } from '@/hooks/useCatalog'
import { useQuote } from '@/hooks/useQuote'
import { parsePercentInput } from '@/lib/residual'
import type { LeaseTerm, AnnualMileage, QuotePayload } from '@/types/quote'

export function QuotePage() {
  const catalog = useCatalog()
  const quote = useQuote()

  // --- Vehicle inputs ---
  const [vehiclePrice, setVehiclePrice] = useState('')
  const [discountPrice, setDiscountPrice] = useState('0')

  // --- Acquisition cost ---
  const [acquisitionTaxIncluded, setAcquisitionTaxIncluded] = useState(true)
  const [acquisitionTaxFullRate, setAcquisitionTaxFullRate] = useState(true) // true=0.07, false=0
  const [deliveryFeeIncluded, setDeliveryFeeIncluded] = useState(false)
  const [deliveryFee, setDeliveryFee] = useState('0')
  const [miscFeeIncluded, setMiscFeeIncluded] = useState(false)
  const [miscFee, setMiscFee] = useState('0')
  const [publicBondIncluded, setPublicBondIncluded] = useState(false)
  const [publicBondCost, setPublicBondCost] = useState('0')

  // --- Quote conditions ---
  const [leaseTermMonths, setLeaseTermMonths] = useState<LeaseTerm>(60)
  const [annualMileageKm, setAnnualMileageKm] = useState<AnnualMileage>(20000)
  const [depositMode, setDepositMode] = useState<'amount' | 'percent'>('amount')
  const [depositValue, setDepositValue] = useState('0')
  const [upfrontMode, setUpfrontMode] = useState<'amount' | 'percent'>('amount')
  const [upfrontValue, setUpfrontValue] = useState('0')
  const [residualRate, setResidualRate] = useState('')
  const [cmFeeRate, setCmFeeRate] = useState('0%')
  const [agFeeRate, setAgFeeRate] = useState('0%')
  const [affiliateExempt, setAffiliateExempt] = useState(true)
  const [evSubsidy, setEvSubsidy] = useState(false)
  const [evSubsidyAmount, setEvSubsidyAmount] = useState('0')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [annualIrrRateOverride, setAnnualIrrRateOverride] = useState('')
  const [annualEffectiveRateOverride, setAnnualEffectiveRateOverride] = useState('')
  const [paymentRateOverride, setPaymentRateOverride] = useState('')

  // Load brands on mount
  useEffect(() => {
    void catalog.loadBrands()
  }, [])

  // Auto-fill vehicle price and residual when trim changes
  useEffect(() => {
    if (!catalog.selectedModel) return
    setVehiclePrice(String(catalog.selectedModel.vehiclePrice))
    const previews = getResidualPreviews(catalog.selectedModel, leaseTermMonths)
    if (previews.max != null) {
      setResidualRate(`${(previews.max * 100).toFixed(2)}%`)
    }
  }, [catalog.selectedModel?.modelName])

  // Update residual when term changes
  useEffect(() => {
    if (!catalog.selectedModel) return
    const previews = getResidualPreviews(catalog.selectedModel, leaseTermMonths)
    if (previews.max != null) {
      setResidualRate(`${(previews.max * 100).toFixed(2)}%`)
    }
  }, [leaseTermMonths])

  // --- Derived values ---
  const rawVehiclePrice = Number(vehiclePrice.replace(/,/g, '')) || 0
  const rawDiscount = Number(discountPrice.replace(/,/g, '')) || 0
  const discountedPrice = rawVehiclePrice - rawDiscount

  const acquisitionTaxRate = (acquisitionTaxIncluded && acquisitionTaxFullRate) ? 0.07 : 0
  const acquisitionTaxAmount = acquisitionTaxIncluded && acquisitionTaxFullRate
    ? Math.floor((discountedPrice / 1.1) * 0.07 / 10) * 10
    : 0

  const totalAcquisitionCost =
    discountedPrice +
    acquisitionTaxAmount +
    10000 + // stampDuty
    (deliveryFeeIncluded ? Number(deliveryFee) || 0 : 0) +
    (miscFeeIncluded ? Number(miscFee) || 0 : 0) +
    (publicBondIncluded ? Number(publicBondCost) || 0 : 0)

  function computeAbsoluteAmount(mode: 'amount' | 'percent', value: string): number {
    if (mode === 'amount') return Number(value.replace(/,/g, '')) || 0
    return Math.round(discountedPrice * (Number(value) || 0) / 100)
  }

  const depositAmount = computeAbsoluteAmount(depositMode, depositValue)
  const upfrontPayment = computeAbsoluteAmount(upfrontMode, upfrontValue)

  const previews = getResidualPreviews(catalog.selectedModel, leaseTermMonths)

  function buildPayload(): QuotePayload | null {
    if (!catalog.selectedModel || !catalog.selectedBrand) return null
    return {
      lenderCode: 'mg-capital',
      productType: 'operating_lease',
      brand: catalog.selectedBrand,
      modelName: catalog.selectedModel.modelName,
      affiliateType: affiliateExempt ? '비제휴사' : 'KCC오토',
      directModelEntry: false,
      ownershipType: 'company',
      leaseTermMonths,
      annualMileageKm,
      upfrontPayment,
      depositAmount,
      quotedVehiclePrice: rawVehiclePrice,
      discountAmount: rawDiscount,
      acquisitionTaxRateOverride: acquisitionTaxRate,
      stampDuty: 10000,
      includePublicBondCost: publicBondIncluded,
      publicBondCost: publicBondIncluded ? Number(publicBondCost) || 0 : undefined,
      includeMiscFeeAmount: miscFeeIncluded,
      miscFeeAmount: miscFeeIncluded ? Number(miscFee) || 0 : undefined,
      includeDeliveryFeeAmount: deliveryFeeIncluded,
      deliveryFeeAmount: deliveryFeeIncluded ? Number(deliveryFee) || 0 : undefined,
      selectedResidualRateOverride: parsePercentInput(residualRate),
      cmFeeRate: parsePercentInput(cmFeeRate),
      agFeeRate: parsePercentInput(agFeeRate),
      insuranceYearlyAmount: 0,
      lossDamageAmount: 0,
      annualIrrRateOverride: parsePercentInput(annualIrrRateOverride),
      annualEffectiveRateOverride: parsePercentInput(annualEffectiveRateOverride),
      paymentRateOverride: parsePercentInput(paymentRateOverride),
    }
  }

  const handleCalculate = useCallback(() => {
    const payload = buildPayload()
    if (!payload) return
    void quote.calculate(payload)
  }, [catalog.selectedModel, catalog.selectedBrand, leaseTermMonths, annualMileageKm,
      vehiclePrice, discountPrice, depositAmount, upfrontPayment, residualRate,
      cmFeeRate, agFeeRate, affiliateExempt, acquisitionTaxIncluded, acquisitionTaxFullRate,
      deliveryFeeIncluded, deliveryFee, miscFeeIncluded, miscFee,
      publicBondIncluded, publicBondCost,
      annualIrrRateOverride, annualEffectiveRateOverride, paymentRateOverride])

  const handleResetSelectedResidual = useCallback(() => {
    setResidualRate('')
    if (catalog.selectedModel) {
      const p = getResidualPreviews(catalog.selectedModel, leaseTermMonths)
      if (p.max != null) setResidualRate(`${(p.max * 100).toFixed(2)}%`)
    }
    quote.reset()
  }, [catalog.selectedModel, leaseTermMonths])

  return (
    <div className="p-4 grid grid-cols-[1fr_420px] gap-4 min-h-screen bg-background">
      {/* Left: Form */}
      <div className="flex flex-col gap-3">
        <VehicleInfoCard
          brands={catalog.brands}
          models={catalog.models}
          brandsLoading={catalog.brandsLoading}
          modelsLoading={catalog.modelsLoading}
          selectedBrand={catalog.selectedBrand}
          selectedModel={catalog.selectedModel}
          vehiclePrice={vehiclePrice}
          discountPrice={discountPrice}
          baseResidualRate={previews.base}
          maxResidualRate={previews.max}
          onBrandChange={(brand) => void catalog.selectBrand(brand)}
          onModelChange={catalog.selectModel}
          onVehiclePriceChange={setVehiclePrice}
          onDiscountPriceChange={setDiscountPrice}
        />

        <AcquisitionCostCard
          acquisitionTaxIncluded={acquisitionTaxIncluded}
          acquisitionTaxRate={acquisitionTaxFullRate ? 0.07 : 0}
          acquisitionTaxAmount={acquisitionTaxAmount}
          deliveryFeeIncluded={deliveryFeeIncluded}
          deliveryFee={deliveryFee}
          miscFeeIncluded={miscFeeIncluded}
          miscFee={miscFee}
          publicBondIncluded={publicBondIncluded}
          publicBondCost={publicBondCost}
          totalAcquisitionCost={totalAcquisitionCost}
          onAcquisitionTaxIncludedToggle={setAcquisitionTaxIncluded}
          onAcquisitionTaxRateChange={setAcquisitionTaxFullRate}
          onDeliveryFeeToggle={setDeliveryFeeIncluded}
          onDeliveryFeeChange={setDeliveryFee}
          onMiscFeeToggle={setMiscFeeIncluded}
          onMiscFeeChange={setMiscFee}
          onPublicBondToggle={setPublicBondIncluded}
          onPublicBondChange={setPublicBondCost}
        />

        <QuoteConditionsCard
          leaseTermMonths={leaseTermMonths}
          annualMileageKm={annualMileageKm}
          depositMode={depositMode}
          depositValue={depositValue}
          upfrontMode={upfrontMode}
          upfrontValue={upfrontValue}
          residualRate={residualRate}
          cmFeeRate={cmFeeRate}
          agFeeRate={agFeeRate}
          affiliateExempt={affiliateExempt}
          evSubsidy={evSubsidy}
          evSubsidyAmount={evSubsidyAmount}
          showAdvanced={showAdvanced}
          annualIrrRateOverride={annualIrrRateOverride}
          annualEffectiveRateOverride={annualEffectiveRateOverride}
          paymentRateOverride={paymentRateOverride}
          onTermChange={setLeaseTermMonths}
          onMileageChange={setAnnualMileageKm}
          onDepositModeChange={setDepositMode}
          onDepositValueChange={setDepositValue}
          onUpfrontModeChange={setUpfrontMode}
          onUpfrontValueChange={setUpfrontValue}
          onResidualRateChange={setResidualRate}
          onCmFeeRateChange={setCmFeeRate}
          onAgFeeRateChange={setAgFeeRate}
          onAffiliateExemptChange={setAffiliateExempt}
          onEvSubsidyChange={setEvSubsidy}
          onEvSubsidyAmountChange={setEvSubsidyAmount}
          onToggleAdvanced={() => setShowAdvanced((v) => !v)}
          onAnnualIrrRateOverrideChange={setAnnualIrrRateOverride}
          onAnnualEffectiveRateOverrideChange={setAnnualEffectiveRateOverride}
          onPaymentRateOverrideChange={setPaymentRateOverride}
        />

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="text-xs" onClick={() => {}}>
            엑셀 기본값 적용
          </Button>
          <Button
            className="flex-1 text-sm font-semibold"
            disabled={quote.loading || !catalog.selectedModel}
            onClick={handleCalculate}
          >
            {quote.loading ? '계산 중...' : '견적 계산'}
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={handleResetSelectedResidual}>
            잔가 선택값 지우기
          </Button>
        </div>

        {quote.error && (
          <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
            {quote.error}
          </div>
        )}
      </div>

      {/* Right: Result */}
      <div className="flex flex-col gap-3">
        {quote.result ? (
          <QuoteResultCard result={quote.result} />
        ) : (
          <div className="border border-dashed border-border rounded-lg flex items-center justify-center text-muted-foreground text-sm min-h-48">
            {quote.loading ? '계산 중...' : '계산 전 상태'}
          </div>
        )}
      </div>
    </div>
  )
}

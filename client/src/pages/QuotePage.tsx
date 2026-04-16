import { useState, useEffect } from 'react'
import { VehicleInfoCard } from '@/components/vehicle/VehicleInfoCard'
import { AcquisitionCostCard } from '@/components/acquisition/AcquisitionCostCard'
import { QuoteConditionsCard } from '@/components/quote-conditions/QuoteConditionsCard'
import { QuoteResultCard } from '@/components/results/QuoteResultCard'
import { useCatalog, getResidualPreviews } from '@/hooks/useCatalog'
import { fetchBnkDealers, type BnkDealer } from '@/lib/api'
import { useMultiQuote } from '@/hooks/useMultiQuote'
import { parsePercentInput } from '@/lib/residual'
import type { LeaseTerm, AnnualMileage, QuotePayload, AcquisitionTaxMode } from '@/types/quote'

export function QuotePage() {
  const catalog = useCatalog()
  const multiQuote = useMultiQuote()

  // --- Vehicle inputs ---
  const [vehiclePrice, setVehiclePrice] = useState('')
  const [discountPrice, setDiscountPrice] = useState('0')

  // --- Acquisition cost ---
  const [acquisitionTaxIncluded, setAcquisitionTaxIncluded] = useState(true)
  const [acquisitionTaxMode, setAcquisitionTaxMode] = useState<AcquisitionTaxMode>('automatic')
  const [acquisitionTaxReduction, setAcquisitionTaxReduction] = useState('0')
  const [acquisitionTaxAmountOverride, setAcquisitionTaxAmountOverride] = useState('0')
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
  const [residualMode, setResidualMode] = useState<'high' | 'standard'>('high')
  const [cmFeeRate, setCmFeeRate] = useState('0%')
  const [agFeeRate, setAgFeeRate] = useState('0%')
  const [affiliateExempt, setAffiliateExempt] = useState(true)
  const [evSubsidy, setEvSubsidy] = useState(false)
  const [evSubsidyAmount, setEvSubsidyAmount] = useState('0')
  const [bnkDealers, setBnkDealers] = useState<BnkDealer[]>([])
  const [bnkDealerName, setBnkDealerName] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [annualIrrRateOverride, setAnnualIrrRateOverride] = useState('')
  const [annualEffectiveRateOverride, setAnnualEffectiveRateOverride] = useState('')
  const [paymentRateOverride, setPaymentRateOverride] = useState('')

  // Load brands on mount
  useEffect(() => {
    void catalog.loadBrands()
  }, [])

  // Auto-fill vehicle price when trim changes
  useEffect(() => {
    if (!catalog.selectedModel) return
    setVehiclePrice(String(catalog.selectedModel.vehiclePrice))
  }, [catalog.selectedModel?.modelName])

  // Fetch BNK dealers when brand changes — default to 비제휴
  useEffect(() => {
    if (catalog.selectedBrand) {
      fetchBnkDealers(catalog.selectedBrand).then((dealers) => {
        setBnkDealers(dealers)
        const nonAffiliate = dealers.find((d) => d.dealerName.includes('비제휴'))
        setBnkDealerName(nonAffiliate?.dealerName ?? '')
      }).catch(() => { setBnkDealers([]); setBnkDealerName('') })
    } else {
      setBnkDealers([])
      setBnkDealerName('')
    }
  }, [catalog.selectedBrand])

  // Update residual when term changes
  // residualMode (high/standard) is sent to each engine — engines resolve their own rates

  // --- Derived values ---
  const rawVehiclePrice = Number(vehiclePrice.replace(/,/g, '')) || 0
  const rawDiscount = Number(discountPrice.replace(/,/g, '')) || 0
  const discountedPrice = rawVehiclePrice - rawDiscount

  const automaticAcquisitionTax = Math.floor((discountedPrice / 1.1) * 0.07 / 10) * 10
  const numericReduction = Number(acquisitionTaxReduction.replace(/,/g, '')) || 0
  const numericAmountOverride = Number(acquisitionTaxAmountOverride.replace(/,/g, '')) || 0
  const computedAcquisitionTax =
    acquisitionTaxMode === 'ratio' ? 0
    : acquisitionTaxMode === 'reduction' ? Math.max(0, automaticAcquisitionTax - numericReduction)
    : acquisitionTaxMode === 'amount' ? numericAmountOverride
    : automaticAcquisitionTax
  const acquisitionTaxAmount = acquisitionTaxIncluded ? computedAcquisitionTax : 0

  const totalAcquisitionCost =
    discountedPrice +
    acquisitionTaxAmount +
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

  function buildPayload(): Omit<QuotePayload, 'lenderCode'> | null {
    if (!catalog.selectedModel || !catalog.selectedBrand) return null
    return {
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
      evSubsidyAmount: evSubsidy ? Number(evSubsidyAmount.replace(/,/g, '')) || 0 : undefined,
      acquisitionTaxMode,
      acquisitionTaxRateOverride: acquisitionTaxMode === 'ratio' ? 0 : undefined,
      acquisitionTaxReduction: acquisitionTaxMode === 'reduction' ? numericReduction : undefined,
      acquisitionTaxAmountOverride: acquisitionTaxMode === 'amount' ? numericAmountOverride : undefined,
      // stampDuty omitted — each lender engine uses its own default (MG=10000, BNK=0)
      includePublicBondCost: publicBondIncluded,
      publicBondCost: publicBondIncluded ? Number(publicBondCost) || 0 : undefined,
      includeMiscFeeAmount: miscFeeIncluded,
      miscFeeAmount: miscFeeIncluded ? Number(miscFee) || 0 : undefined,
      includeDeliveryFeeAmount: deliveryFeeIncluded,
      deliveryFeeAmount: deliveryFeeIncluded ? Number(deliveryFee) || 0 : undefined,
      bnkDealerName: bnkDealerName || undefined,
      residualMode,
      cmFeeRate: parsePercentInput(cmFeeRate),
      agFeeRate: parsePercentInput(agFeeRate),
      insuranceYearlyAmount: 0,
      lossDamageAmount: 0,
      annualIrrRateOverride: parsePercentInput(annualIrrRateOverride),
      annualEffectiveRateOverride: parsePercentInput(annualEffectiveRateOverride),
      paymentRateOverride: parsePercentInput(paymentRateOverride),
    }
  }

  const handleCalculate = () => {
    const payload = buildPayload()
    if (!payload) return
    void multiQuote.calculateAll(payload)
  }

  return (
    <div className="p-5 grid grid-cols-[minmax(0,720px)_440px] gap-5 min-h-[100dvh]">
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
          acquisitionTaxMode={acquisitionTaxMode}
          acquisitionTaxAmount={acquisitionTaxAmount}
          acquisitionTaxReduction={acquisitionTaxReduction}
          acquisitionTaxAmountOverride={acquisitionTaxAmountOverride}
          deliveryFeeIncluded={deliveryFeeIncluded}
          deliveryFee={deliveryFee}
          miscFeeIncluded={miscFeeIncluded}
          miscFee={miscFee}
          publicBondIncluded={publicBondIncluded}
          publicBondCost={publicBondCost}
          totalAcquisitionCost={totalAcquisitionCost}
          onAcquisitionTaxIncludedToggle={setAcquisitionTaxIncluded}
          onAcquisitionTaxModeChange={setAcquisitionTaxMode}
          onAcquisitionTaxReductionChange={setAcquisitionTaxReduction}
          onAcquisitionTaxAmountOverrideChange={setAcquisitionTaxAmountOverride}
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
          residualMode={residualMode}
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
          onResidualModeChange={setResidualMode}
          onCmFeeRateChange={setCmFeeRate}
          onAgFeeRateChange={setAgFeeRate}
          onAffiliateExemptChange={setAffiliateExempt}
          onEvSubsidyChange={setEvSubsidy}
          onEvSubsidyAmountChange={setEvSubsidyAmount}
          onToggleAdvanced={() => setShowAdvanced((v) => !v)}
          onAnnualIrrRateOverrideChange={setAnnualIrrRateOverride}
          onAnnualEffectiveRateOverrideChange={setAnnualEffectiveRateOverride}
          onPaymentRateOverrideChange={setPaymentRateOverride}
          bnkDealers={bnkDealers}
          bnkDealerName={bnkDealerName}
          onBnkDealerNameChange={setBnkDealerName}
        />

        {/* Action row */}
        <div className="flex flex-col gap-2">
          {/* Primary CTA */}
          <button
            disabled={multiQuote.isAnyLoading || !catalog.selectedModel}
            onClick={handleCalculate}
            className="w-full h-11 rounded-xl bg-primary text-white text-sm font-semibold tracking-tight flex items-center justify-center gap-2 shadow-[0_4px_16px_rgba(29,51,184,0.3)] hover:bg-primary/90 transition-all duration-150 active:scale-[0.985] active:translate-y-px active:shadow-[0_2px_8px_rgba(29,51,184,0.2)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {multiQuote.isAnyLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                계산 중
              </>
            ) : '견적 계산'}
          </button>

        </div>

      </div>

      {/* Right: Results */}
      <div className="flex flex-col gap-3 sticky top-5 h-fit">
        {multiQuote.hasAnyResult || multiQuote.isAnyLoading ? (
          multiQuote.entries.map(({ lenderCode, lenderName, result, loading, error, notAvailable }) => {
            if (notAvailable) return null
            if (loading) {
              return (
                <div key={lenderCode} className="rounded-2xl border border-border bg-white shadow-[0_12px_30px_rgba(29,51,184,0.08)] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border bg-muted/60 flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{lenderName}</span>
                    <span className="w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin ml-auto" />
                  </div>
                  <div className="p-5 flex flex-col gap-2">
                    <div className="skeleton h-8 w-40 rounded" />
                    <div className="skeleton h-4 w-24 rounded" />
                  </div>
                </div>
              )
            }
            if (error) {
              return (
                <div key={lenderCode} className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-amber-200 flex items-center gap-2">
                    <span className="font-semibold text-sm text-amber-800">{lenderName}</span>
                  </div>
                  <div className="px-4 py-3 text-xs text-amber-700 leading-relaxed">{error}</div>
                </div>
              )
            }
            if (result) {
              return <QuoteResultCard key={lenderCode} result={result} lenderName={lenderName} lenderCode={lenderCode} />
            }
            return null
          })
        ) : (
          <div className="border border-dashed border-border rounded-xl bg-card flex flex-col items-center justify-center text-center gap-3 min-h-64 px-8">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">견적 준비 완료</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">차량과 조건을 선택한 뒤<br />견적 계산을 눌러주세요</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

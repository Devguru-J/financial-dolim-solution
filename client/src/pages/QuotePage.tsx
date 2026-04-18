import { useState, useEffect } from 'react'
import { VehicleInfoCard } from '@/components/vehicle/VehicleInfoCard'
import { AcquisitionCostCard } from '@/components/acquisition/AcquisitionCostCard'
import { QuoteConditionsCard } from '@/components/quote-conditions/QuoteConditionsCard'
import { QuoteResultCard } from '@/components/results/QuoteResultCard'
import { useCatalog, getResidualPreviews } from '@/hooks/useCatalog'
import { fetchBnkDealers, type BnkDealer } from '@/lib/api'
import { useMultiQuote } from '@/hooks/useMultiQuote'
import { parsePercentInput, formatKrw, roundUpToNearestHundred } from '@/lib/residual'
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

  // Compute best (lowest monthly payment) lender among successful results
  const successfulEntries = multiQuote.entries.filter(
    (e) => !e.notAvailable && !e.error && e.result != null
  )
  const lowestPmt =
    successfulEntries.length > 0
      ? Math.min(...successfulEntries.map((e) => roundUpToNearestHundred(e.result!.monthlyPayment)))
      : null
  const highestPmt =
    successfulEntries.length > 0
      ? Math.max(...successfulEntries.map((e) => roundUpToNearestHundred(e.result!.monthlyPayment)))
      : null

  return (
    <div className="px-10 pt-8 pb-16 max-w-[1100px] mx-auto min-h-[100dvh]">
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[1.65rem] font-bold tracking-[-0.03em] text-foreground">값어림 계산</h1>
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent/[0.08] border border-accent/15 text-[0.76rem] font-medium text-accent">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-[pulse-dot_2s_ease-in-out_infinite]" />
          멀티 렌더 병렬 계산 가동
        </div>
      </div>

      {/* Form section */}
      <div className="flex flex-col gap-4">
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
            className="w-full h-11 rounded-xl bg-primary text-white text-sm font-semibold tracking-tight flex items-center justify-center gap-2 shadow-[0_4px_14px_rgba(26,58,92,0.22)] hover:bg-primary/90 transition-all duration-150 active:scale-[0.985] active:translate-y-px active:shadow-[0_2px_6px_rgba(26,58,92,0.18)] disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
          >
            {multiQuote.isAnyLoading ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                계산 중
              </>
            ) : '값어림 계산'}
          </button>

        </div>

      </div>

      {/* Results section — 3-column grid after calculation */}
      {(multiQuote.hasAnyResult || multiQuote.isAnyLoading) && (
        <div className="mt-8 grid grid-cols-3 gap-4">
          {multiQuote.entries.map(({ lenderCode, lenderName, result, loading, error, notAvailable }) => {
            if (notAvailable) return null
            if (loading) {
              return (
                <div key={lenderCode} className="rounded-2xl border border-border bg-white shadow-[var(--shadow-elev-2)] overflow-hidden">
                  <div className="h-[3px] bg-border" />
                  <div className="px-6 pt-5 pb-3 flex items-center justify-between">
                    <span className="text-[0.92rem] font-semibold text-foreground">{lenderName}</span>
                    <span className="w-3 h-3 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
                  </div>
                  <div className="px-6 pb-5 flex flex-col gap-2">
                    <div className="skeleton h-8 w-40 rounded" />
                    <div className="skeleton h-4 w-24 rounded" />
                  </div>
                  <div className="px-6 py-4 pt-4 border-t border-border grid gap-2.5">
                    <div className="skeleton h-3.5 w-full rounded" />
                    <div className="skeleton h-3.5 w-full rounded" />
                    <div className="skeleton h-3.5 w-full rounded" />
                  </div>
                </div>
              )
            }
            if (error) {
              return (
                <div key={lenderCode} className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
                  <div className="h-[3px] bg-amber-300" />
                  <div className="px-6 pt-5 pb-3">
                    <span className="text-[0.92rem] font-semibold text-amber-900">{lenderName}</span>
                  </div>
                  <div className="px-6 py-3 text-xs text-amber-700 leading-relaxed">{error}</div>
                </div>
              )
            }
            if (result) {
              const pmt = roundUpToNearestHundred(result.monthlyPayment)
              const isBest = lowestPmt != null && pmt === lowestPmt && successfulEntries.length > 1
              return (
                <QuoteResultCard
                  key={lenderCode}
                  result={result}
                  lenderName={lenderName}
                  lenderCode={lenderCode}
                  isBest={isBest}
                />
              )
            }
            return null
          })}
        </div>
      )}

      {/* Comparison bar chart — below results when 2+ successful quotes */}
      {successfulEntries.length > 1 && lowestPmt != null && highestPmt != null && (
        <ComparisonBarCard
          entries={successfulEntries.map((e) => ({
            lenderName: e.lenderName,
            pmt: roundUpToNearestHundred(e.result!.monthlyPayment),
          }))}
          lowest={lowestPmt}
          highest={highestPmt}
          termMonths={leaseTermMonths}
        />
      )}

      {/* Empty state when no calculation yet */}
      {!multiQuote.hasAnyResult && !multiQuote.isAnyLoading && (
        <div className="mt-8 border border-dashed border-border rounded-2xl bg-white/50 flex flex-col items-center justify-center text-center gap-3 py-16 px-8">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">견적 준비 완료</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              차량과 조건을 선택한 뒤 <strong className="font-semibold text-foreground">값어림 계산</strong> 을 눌러주세요
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Comparison bar chart
───────────────────────────────────────────── */
function ComparisonBarCard({
  entries,
  lowest,
  highest,
  termMonths,
}: {
  entries: { lenderName: string; pmt: number }[]
  lowest: number
  highest: number
  termMonths: number
}) {
  const sorted = [...entries].sort((a, b) => a.pmt - b.pmt)
  const diff = highest - lowest
  const totalDiff = diff * termMonths
  const fillClass = (pmt: number) => {
    if (pmt === lowest) return 'bg-gradient-to-br from-primary to-accent'
    if (pmt === highest) return 'bg-gradient-to-br from-stone-400 to-stone-500'
    return 'bg-gradient-to-br from-slate-400 to-slate-500'
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-white shadow-[var(--shadow-elev-2)] overflow-hidden">
      <div className="px-7 py-4 border-b border-border flex items-center gap-2.5">
        <span className="w-5 h-5 rounded-md flex items-center justify-center bg-accent/10 text-accent">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        </span>
        <span className="text-[0.95rem] font-semibold text-foreground tracking-tight">월 납입금 비교</span>
        <span className="ml-auto text-[0.68rem] font-medium text-muted-foreground px-2.5 py-1 rounded-full bg-black/[0.04]">
          {termMonths}개월 기준
        </span>
      </div>

      <div className="px-7 py-6 flex flex-col gap-3.5">
        {sorted.map((e) => {
          const widthPct = (e.pmt / highest) * 100
          return (
            <div key={e.lenderName} className="grid items-center gap-4" style={{ gridTemplateColumns: '100px 1fr 100px' }}>
              <span className="text-[0.8rem] font-medium text-muted-foreground text-right truncate">{e.lenderName}</span>
              <div className="h-7 bg-[#f5f5f4] rounded-md overflow-hidden relative">
                <div
                  className={`h-full rounded-md ${fillClass(e.pmt)} transition-[width] duration-700 ease-out`}
                  style={{ width: `${widthPct}%` }}
                />
              </div>
              <span className="font-mono tabular-nums text-[0.8rem] font-medium text-foreground text-right">
                {e.pmt.toLocaleString('ko-KR')}
              </span>
            </div>
          )
        })}
      </div>

      {diff > 0 && (
        <div className="px-7 py-4 border-t border-border flex items-center justify-between flex-wrap gap-4 bg-[#fafaf9]">
          <div className="flex items-center gap-3">
            <span className="text-[0.76rem] text-muted-foreground">최저가 대비 최고가 차이</span>
            <span className="font-mono tabular-nums text-[0.95rem] font-semibold text-accent">
              +{formatKrw(diff)}
              <span className="font-normal text-muted-foreground text-[0.74rem] ml-1">/ 월</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[0.76rem] text-muted-foreground">{termMonths}개월 총 차이</span>
            <span className="font-mono tabular-nums text-[0.95rem] font-semibold text-accent">
              +{formatKrw(totalDiff)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

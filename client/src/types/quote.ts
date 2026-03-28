export type LeaseTerm = 12 | 24 | 36 | 48 | 60
export type AnnualMileage = 10000 | 20000 | 30000 | 35000
export type AffiliateType = '비제휴사' | 'KCC오토' | 'KCC면제'

export interface QuotePayload {
  lenderCode: 'mg-capital'
  productType: 'operating_lease'
  brand: string
  modelName: string
  affiliateType: AffiliateType
  directModelEntry: false
  ownershipType: 'company' | 'customer'
  leaseTermMonths: LeaseTerm
  annualMileageKm: AnnualMileage
  upfrontPayment: number
  depositAmount: number
  quotedVehiclePrice?: number
  discountAmount?: number
  includePublicBondCost?: boolean
  publicBondCost?: number
  includeMiscFeeAmount?: boolean
  miscFeeAmount?: number
  includeDeliveryFeeAmount?: boolean
  deliveryFeeAmount?: number
  annualIrrRateOverride?: number
  annualEffectiveRateOverride?: number
  paymentRateOverride?: number
  selectedResidualRateOverride?: number
  residualAmountOverride?: number
  acquisitionTaxRateOverride?: number
  stampDuty?: number
  agFeeRate?: number
  cmFeeRate?: number
  insuranceYearlyAmount?: number
  lossDamageAmount?: number
  manualVehicleClass?: string
  manualEngineDisplacementCc?: number
}

export interface QuoteResidual {
  matrixGroup: string | null
  rateDecimal: number
  amount: number
  maxRateDecimal?: number
}

export interface QuoteMajorInputs {
  leaseTermMonths: LeaseTerm
  ownershipType: 'company' | 'customer'
  vehiclePrice: number
  discountedVehiclePrice: number
  upfrontPayment: number
  depositAmount: number
  financedPrincipal: number
}

export interface QuoteRates {
  annualRateDecimal: number
  effectiveAnnualRateDecimal: number
  monthlyRateDecimal: number
}

export interface QuoteResult {
  monthlyPayment: number
  rates: QuoteRates
  residual: QuoteResidual
  majorInputs: QuoteMajorInputs
  warnings: string[]
}

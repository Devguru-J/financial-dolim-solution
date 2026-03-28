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
  rateDecimal: number
  maxRateDecimal: number | null
  amount: number
  matrixGroup?: string
}

export interface QuoteMajorInputs {
  leaseTermMonths: LeaseTerm
  ownershipType: 'company' | 'customer'
  financedPrincipal: number
}

export interface QuoteResult {
  monthlyPayment: number
  irrAnnualDecimal: number
  effectiveAnnualRateDecimal?: number
  residual: QuoteResidual
  majorInputs: QuoteMajorInputs
  warnings?: string[]
  acquisitionCost?: {
    acquisitionTax: number
    totalAcquisitionCost: number
  }
}

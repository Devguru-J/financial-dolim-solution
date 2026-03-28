export interface CatalogBrand {
  brand: string
  modelCount: number
}

export interface CatalogModel {
  modelName: string
  vehiclePrice: number
  vehicleClass: string | null
  engineDisplacementCc: number | null
  highResidualAllowed: boolean | null
  hybridAllowed: boolean | null
  residualPromotionCode: string | null
  snkResidualBand: string | null
  residuals?: Partial<Record<12 | 24 | 36 | 48 | 60, number>>
  snkResiduals?: Partial<Record<12 | 24 | 36 | 48 | 60, number>>
  apsResidualBand?: string | null
  apsResiduals?: Partial<Record<12 | 24 | 36 | 48 | 60, number>>
  chatbotResiduals?: Partial<Record<12 | 24 | 36 | 48 | 60, number>>
  apsPromotionRate?: number | null
  snkPromotionRate?: number | null
  maxResidualRates?: Partial<Record<12 | 24 | 36 | 48 | 60, number>>
}

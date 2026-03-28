import type { CatalogModel } from '@/types/catalog'

// Residual matrix lookup — will be populated from API response or static import
let residualMatrixLookup: Record<string, Record<number, Record<string, number>>> = {}

export function setResidualMatrixLookup(
  lookup: Record<string, Record<number, Record<string, number>>>
) {
  residualMatrixLookup = lookup
}

export function roundUpToNearestHundred(value: number): number {
  return Math.ceil(Number(value || 0) / 100) * 100
}

export function minimumResidualRateByTerm(termMonths: number): number | null {
  const lookup: Record<number, number> = {
    12: 0.5, 24: 0.4, 36: 0.3, 48: 0.2, 60: 0.15,
  }
  return lookup[termMonths] ?? null
}

export function previewMaximumResidualRate(
  model: CatalogModel,
  termMonths: number
): number | null {
  const term = Number(termMonths)
  const apiMaxRate = Number(model.maxResidualRates?.[term as 12 | 24 | 36 | 48 | 60])
  if (Number.isFinite(apiMaxRate) && apiMaxRate > 0) return apiMaxRate

  const band = model.snkResidualBand
  const fromMatrix =
    band && residualMatrixLookup[band] && residualMatrixLookup[band][term]
      ? Number(
          residualMatrixLookup[band][term]['에스앤케이모터스'] ??
            residualMatrixLookup[band][term]['APS'] ??
            Object.values(residualMatrixLookup[band][term])[0]
        )
      : null

  const directRate = Number(
    model.residuals?.[term as 12 | 24 | 36 | 48 | 60] ??
      model.snkResiduals?.[term as 12 | 24 | 36 | 48 | 60] ??
      model.apsResiduals?.[term as 12 | 24 | 36 | 48 | 60] ??
      model.chatbotResiduals?.[term as 12 | 24 | 36 | 48 | 60]
  )

  const baseRate =
    Number.isFinite(fromMatrix) && fromMatrix != null
      ? fromMatrix
      : Number.isFinite(directRate)
        ? directRate
        : null
  if (baseRate == null) return null
  return model.highResidualAllowed ? baseRate + 0.08 : baseRate
}

export function previewBaseResidualRate(
  model: CatalogModel,
  termMonths: number
): number | null {
  // NOTE: does NOT use maxResidualRates shortcut — returns raw matrix/direct rate
  // without highResidualAllowed +0.08 boost, so 일반잔가 < 최대잔가 when highResidualAllowed=true
  const term = Number(termMonths)
  const band = model.snkResidualBand
  const fromMatrix =
    band && residualMatrixLookup[band] && residualMatrixLookup[band][term]
      ? Number(
          residualMatrixLookup[band][term]['에스앤케이모터스'] ??
            residualMatrixLookup[band][term]['APS'] ??
            Object.values(residualMatrixLookup[band][term])[0]
        )
      : null
  const directRate = Number(
    model.residuals?.[term as 12 | 24 | 36 | 48 | 60] ??
      model.snkResiduals?.[term as 12 | 24 | 36 | 48 | 60] ??
      model.apsResiduals?.[term as 12 | 24 | 36 | 48 | 60] ??
      model.chatbotResiduals?.[term as 12 | 24 | 36 | 48 | 60]
  )
  const baseRate =
    Number.isFinite(fromMatrix) && fromMatrix != null
      ? fromMatrix
      : Number.isFinite(directRate)
        ? directRate
        : null
  return baseRate
}

export function formatKrw(amount: number): string {
  return `₩ ${Math.round(amount).toLocaleString('ko-KR')}`
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`
}

export function parsePercentInput(value: string | null | undefined): number | undefined {
  if (!value) return undefined
  const cleaned = String(value).replace('%', '').trim()
  const n = parseFloat(cleaned)
  if (!Number.isFinite(n) || n <= 0) return undefined
  return n / 100
}

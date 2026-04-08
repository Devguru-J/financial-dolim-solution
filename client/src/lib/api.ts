import type { CatalogBrand, CatalogModel } from '@/types/catalog'
import type { QuotePayload, QuoteResult } from '@/types/quote'
import type { ImportListResponse, PreviewResponse, ImportResponse } from '@/types/imports'

export type LenderInfo = {
  lenderCode: string
  lenderName: string
  status: string
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export async function fetchBrands(lenderCode?: string): Promise<CatalogBrand[]> {
  const qs = lenderCode ? `?lenderCode=${encodeURIComponent(lenderCode)}` : ''
  const data = await apiFetch<{ brands: CatalogBrand[] }>(`/api/catalog/brands${qs}`)
  return data.brands
}

export async function fetchModels(brand: string, lenderCode?: string): Promise<CatalogModel[]> {
  const lc = lenderCode ? `&lenderCode=${encodeURIComponent(lenderCode)}` : ''
  const data = await apiFetch<{ models: CatalogModel[] }>(
    `/api/catalog/models?brand=${encodeURIComponent(brand)}${lc}`
  )
  return data.models
}

export type BnkDealer = { dealerName: string; baseIrrRate: number }

export async function fetchBnkDealers(brand: string): Promise<BnkDealer[]> {
  const data = await apiFetch<{ dealers: BnkDealer[] }>(
    `/api/catalog/bnk-dealers?brand=${encodeURIComponent(brand)}`
  )
  return data.dealers ?? []
}

export async function calculateQuote(payload: QuotePayload): Promise<QuoteResult> {
  const data = await apiFetch<{ ok: boolean; quote: QuoteResult }>('/api/quotes/calculate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.quote
}

export async function fetchLenders(): Promise<LenderInfo[]> {
  const data = await apiFetch<{ lenders: LenderInfo[] }>('/api/lenders')
  return data.lenders
}

export async function fetchImports(lenderCode = 'mg-capital'): Promise<ImportListResponse> {
  return apiFetch<ImportListResponse>(`/api/imports?lenderCode=${encodeURIComponent(lenderCode)}`)
}

export async function previewWorkbook(file: File, lenderCode = 'mg-capital'): Promise<PreviewResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`/api/imports/preview?lenderCode=${encodeURIComponent(lenderCode)}`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<PreviewResponse>
}

export async function importWorkbook(file: File, lenderCode = 'mg-capital', activate = true): Promise<ImportResponse> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('activate', String(activate))
  const res = await fetch(`/api/imports?lenderCode=${encodeURIComponent(lenderCode)}`, {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<ImportResponse>
}

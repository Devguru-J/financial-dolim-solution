import type { CatalogBrand, CatalogModel } from '@/types/catalog'
import type { QuotePayload, QuoteResult } from '@/types/quote'

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

export async function fetchBrands(): Promise<CatalogBrand[]> {
  const data = await apiFetch<{ brands: CatalogBrand[] }>('/api/catalog/brands')
  return data.brands
}

export async function fetchModels(brand: string): Promise<CatalogModel[]> {
  const data = await apiFetch<{ models: CatalogModel[] }>(
    `/api/catalog/models?brand=${encodeURIComponent(brand)}&lenderCode=mg-capital`
  )
  return data.models
}

export async function calculateQuote(payload: QuotePayload): Promise<QuoteResult> {
  const data = await apiFetch<{ ok: boolean; quote: QuoteResult }>('/api/quotes/calculate', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return data.quote
}

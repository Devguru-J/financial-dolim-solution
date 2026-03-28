import { useState, useCallback } from 'react'
import { fetchBrands, fetchModels } from '@/lib/api'
import {
  previewBaseResidualRate,
  previewMaximumResidualRate,
} from '@/lib/residual'
import type { CatalogBrand, CatalogModel } from '@/types/catalog'
import type { LeaseTerm } from '@/types/quote'

export interface CatalogState {
  brands: CatalogBrand[]
  models: CatalogModel[]
  selectedBrand: string
  selectedModel: CatalogModel | null
  brandsLoading: boolean
  modelsLoading: boolean
  error: string | null
}

export interface CatalogActions {
  loadBrands: () => Promise<void>
  selectBrand: (brand: string) => Promise<void>
  selectModel: (modelName: string) => void
}

export function useCatalog(): CatalogState & CatalogActions {
  const [brands, setBrands] = useState<CatalogBrand[]>([])
  const [models, setModels] = useState<CatalogModel[]>([])
  const [selectedBrand, setSelectedBrand] = useState('')
  const [selectedModel, setSelectedModelState] = useState<CatalogModel | null>(null)
  const [brandsLoading, setBrandsLoading] = useState(false)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadBrands = useCallback(async () => {
    setBrandsLoading(true)
    setError(null)
    try {
      const data = await fetchBrands()
      setBrands(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setBrandsLoading(false)
    }
  }, [])

  const selectBrand = useCallback(async (brand: string) => {
    setSelectedBrand(brand)
    setSelectedModelState(null)
    setModels([])
    if (!brand) return
    setModelsLoading(true)
    setError(null)
    try {
      const data = await fetchModels(brand)
      setModels(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setModelsLoading(false)
    }
  }, [])

  const selectModel = useCallback(
    (modelName: string) => {
      const model = models.find((m) => m.modelName === modelName) ?? null
      setSelectedModelState(model)
    },
    [models]
  )

  return {
    brands,
    models,
    selectedBrand,
    selectedModel,
    brandsLoading,
    modelsLoading,
    error,
    loadBrands,
    selectBrand,
    selectModel,
  }
}

export function getResidualPreviews(
  model: CatalogModel | null,
  leaseTermMonths: LeaseTerm
): { base: number | null; max: number | null } {
  if (!model) return { base: null, max: null }
  return {
    base: previewBaseResidualRate(model, leaseTermMonths),
    max: previewMaximumResidualRate(model, leaseTermMonths),
  }
}

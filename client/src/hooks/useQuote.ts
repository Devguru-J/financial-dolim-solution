import { useState, useCallback } from 'react'
import { calculateQuote } from '@/lib/api'
import type { QuotePayload, QuoteResult } from '@/types/quote'

export interface QuoteState {
  result: QuoteResult | null
  loading: boolean
  error: string | null
}

export interface QuoteActions {
  calculate: (payload: QuotePayload) => Promise<void>
  reset: () => void
}

export function useQuote(): QuoteState & QuoteActions {
  const [result, setResult] = useState<QuoteResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calculate = useCallback(async (payload: QuotePayload) => {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const data = await calculateQuote(payload)
      setResult(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setResult(null)
    setError(null)
  }, [])

  return { result, loading, error, calculate, reset }
}

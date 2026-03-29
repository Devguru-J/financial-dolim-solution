import { useState, useCallback, useEffect } from 'react'
import { calculateQuote, fetchLenders } from '@/lib/api'
import type { LenderInfo } from '@/lib/api'
import type { QuotePayload, QuoteResult } from '@/types/quote'

export type LenderQuoteState = {
  lenderName: string
  result: QuoteResult | null
  loading: boolean
  error: string | null
}

export function useMultiQuote() {
  const [lenders, setLenders] = useState<LenderInfo[]>([
    { lenderCode: 'mg-capital', lenderName: 'MG캐피탈', status: 'active-development' },
  ])
  const [states, setStates] = useState<Record<string, LenderQuoteState>>({
    'mg-capital': { lenderName: 'MG캐피탈', result: null, loading: false, error: null },
  })

  useEffect(() => {
    fetchLenders()
      .then((list) => {
        if (list.length === 0) return
        setLenders(list)
        setStates(
          Object.fromEntries(
            list.map((l) => [
              l.lenderCode,
              { lenderName: l.lenderName, result: null, loading: false, error: null },
            ])
          )
        )
      })
      .catch(() => {})
  }, [])

  const calculateAll = useCallback(
    async (basePayload: Omit<QuotePayload, 'lenderCode'>) => {
      // Set all to loading
      setStates(
        Object.fromEntries(
          lenders.map((l) => [
            l.lenderCode,
            { lenderName: l.lenderName, result: null, loading: true, error: null },
          ])
        )
      )

      // Fire all in parallel
      await Promise.allSettled(
        lenders.map(async (l) => {
          try {
            const result = await calculateQuote({ ...basePayload, lenderCode: l.lenderCode })
            setStates((prev) => ({
              ...prev,
              [l.lenderCode]: { lenderName: l.lenderName, result, loading: false, error: null },
            }))
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e)
            setStates((prev) => ({
              ...prev,
              [l.lenderCode]: { lenderName: l.lenderName, result: null, loading: false, error: msg },
            }))
          }
        })
      )
    },
    [lenders]
  )

  const reset = useCallback(() => {
    setStates((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([code, s]) => [
          code,
          { ...s, result: null, error: null, loading: false },
        ])
      )
    )
  }, [])

  const entries = lenders.map((l) => ({
    lenderCode: l.lenderCode,
    ...(states[l.lenderCode] ?? { lenderName: l.lenderName, result: null, loading: false, error: null }),
  }))

  const isAnyLoading = entries.some((e) => e.loading)
  const hasAnyResult = entries.some((e) => e.result != null)

  return { entries, calculateAll, reset, isAnyLoading, hasAnyResult }
}

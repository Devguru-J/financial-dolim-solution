import { useCallback, useEffect, useRef, useState } from 'react'
import { Upload, FileSpreadsheet, X, CheckCircle, AlertTriangle, Clock, History } from 'lucide-react'
import { fetchLenders, fetchImports, previewWorkbook, importWorkbook } from '@/lib/api'
import type { LenderInfo } from '@/lib/api'
import type { WorkbookImport, WorkbookPreview } from '@/types/imports'

export function ImportPage() {
  const [lenders, setLenders] = useState<LenderInfo[]>([])
  const [selectedLender, setSelectedLender] = useState<string>('mg-capital')

  const [historyLoading, setHistoryLoading] = useState(true)
  const [imports, setImports] = useState<WorkbookImport[]>([])
  const [connected, setConnected] = useState<boolean | null>(null)

  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<WorkbookPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchLenders().then(setLenders).catch(() => {})
  }, [])

  const loadImports = useCallback(async () => {
    try {
      const data = await fetchImports(selectedLender)
      setConnected(data.connected)
      setImports(data.imports ?? [])
    } catch {
      setConnected(false)
    } finally {
      setHistoryLoading(false)
    }
  }, [selectedLender])

  useEffect(() => { loadImports() }, [loadImports])

  const handleLenderChange = (code: string) => {
    setSelectedLender(code)
    setSelectedFile(null)
    setPreview(null)
    setError(null)
    setSuccessMsg(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFileDrop = useCallback(async (file: File) => {
    setSelectedFile(file)
    setPreview(null)
    setError(null)
    setSuccessMsg(null)
    setPreviewLoading(true)
    try {
      const res = await previewWorkbook(file, selectedLender)
      setPreview(res.workbook)
    } catch (e) {
      setError(e instanceof Error ? e.message : '파싱 실패')
    } finally {
      setPreviewLoading(false)
    }
  }, [selectedLender])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFileDrop(file)
  }, [handleFileDrop])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFileDrop(file)
  }, [handleFileDrop])

  const handleImport = async () => {
    if (!selectedFile) return
    setImportLoading(true)
    setError(null)
    setSuccessMsg(null)
    try {
      const res = await importWorkbook(selectedFile, selectedLender, true)
      const wb = res.workbook
      setSuccessMsg(`${wb.detectedVersionLabel} — 차량 ${wb.vehiclePrograms.length}개, 잔가 ${wb.residualMatrixRows.length}행 활성화 완료`)
      setSelectedFile(null)
      setPreview(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadImports()
    } catch (e) {
      setError(e instanceof Error ? e.message : '임포트 실패')
    } finally {
      setImportLoading(false)
    }
  }

  const currentLender = lenders.find(l => l.lenderCode === selectedLender)

  const handleReset = () => {
    setSelectedFile(null)
    setPreview(null)
    setError(null)
    setSuccessMsg(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="px-10 pt-8 pb-16 max-w-5xl mx-auto">

      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-[1.65rem] font-bold tracking-[-0.03em] text-foreground">문건 들여오기</h1>
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-accent/[0.08] border border-accent/15 text-[0.76rem] font-medium text-accent">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-[pulse-dot_2s_ease-in-out_infinite]" />
          자동 정규화 파이프라인 가동
        </div>
      </div>

      <div className="flex flex-col gap-5">

      {/* ── Upload panel ── */}
      <div className="rounded-[2rem] border border-border bg-white shadow-[var(--shadow-elev-2)] overflow-hidden animate-fade-up" style={{ animationDelay: '0ms' }}>
        {/* Panel header */}
        <div className="px-7 py-4 border-b border-border flex items-center gap-2.5">
          <span className="w-5 h-5 rounded-md flex items-center justify-center bg-accent/10 text-accent">
            <Upload size={12} strokeWidth={2.2} />
          </span>
          <span className="text-[0.95rem] font-semibold text-foreground tracking-tight">문건 업로드</span>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {/* Lender segmented buttons */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.72rem] font-medium text-muted-foreground tracking-[0.01em]">금융사 선택</label>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.max(lenders.length, 1)}, minmax(0, 1fr))` }}>
              {(lenders.length > 0 ? lenders : [{ lenderCode: 'mg-capital', lenderName: 'MG캐피탈', status: 'active-development' as const }]).map((l) => {
                const isSelected = selectedLender === l.lenderCode
                return (
                  <button
                    key={l.lenderCode}
                    type="button"
                    onClick={() => handleLenderChange(l.lenderCode)}
                    className={`h-11 px-4 rounded-lg border text-[0.86rem] font-semibold tracking-tight transition-all duration-150 active:scale-[0.98] ${
                      isSelected
                        ? 'bg-accent/[0.08] border-accent/40 text-primary shadow-[inset_0_0_0_1px_rgba(59,125,216,0.12)]'
                        : 'bg-white border-input text-muted-foreground hover:border-input/80 hover:text-foreground'
                    }`}
                  >
                    {l.lenderName}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Drop zone (asymmetric: text left, icon right) ── */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xlsm,.xls"
            className="hidden"
            onChange={handleFileInput}
          />

          {selectedFile ? (
            /* File selected state */
            <div className="rounded-xl border border-primary/30 bg-primary/[0.025] px-5 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <FileSpreadsheet size={18} className="text-emerald-700" strokeWidth={1.5} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground truncate tracking-tight">{selectedFile.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <button
                onClick={handleReset}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 active:scale-95"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>
          ) : (
            /* Empty drop zone — asymmetric layout */
            <div
              className={`rounded-xl border-2 border-dashed cursor-pointer transition-all duration-200 ${
                isDragging
                  ? 'border-primary bg-primary/5 scale-[1.01]'
                  : 'border-border hover:border-primary/50 hover:bg-primary/[0.02]'
              }`}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="px-8 py-10 grid" style={{ gridTemplateColumns: '1fr auto' }}>
                {/* Left: text */}
                <div className="flex flex-col justify-center gap-2">
                  <div className="text-base font-semibold text-foreground tracking-tight leading-snug">
                    파일을 드래그하거나 클릭하여 선택
                  </div>
                  <div className="text-xs text-muted-foreground leading-relaxed">
                    {currentLender?.lenderName ?? selectedLender} 워크북<br />
                    .xlsx 또는 .xls 형식
                  </div>
                </div>
                {/* Right: icon */}
                <div className={`ml-10 w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${isDragging ? 'bg-primary/15' : 'bg-muted'}`}>
                  <Upload size={24} className={`transition-colors ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                </div>
              </div>
            </div>
          )}

          {/* ── Preview: skeleton while parsing ── */}
          {previewLoading && (
            <div className="rounded-xl border border-border p-5 flex flex-col gap-3">
              <div className="skeleton h-3.5 w-28 rounded" />
              <div className="grid gap-3" style={{ gridTemplateColumns: '2fr 1fr' }}>
                <div className="skeleton h-12 rounded-lg" />
                <div className="flex flex-col gap-2">
                  <div className="skeleton h-5 rounded" />
                  <div className="skeleton h-5 rounded" />
                </div>
              </div>
            </div>
          )}

          {/* ── Preview: parsed result — asymmetric layout ── */}
          {preview && !previewLoading && (
            <div className="rounded-xl border border-primary/20 bg-primary/[0.025] overflow-hidden animate-fade-up">
              <div className="px-4 py-2.5 border-b border-primary/15 flex items-center gap-2">
                <CheckCircle size={11} className="text-primary" strokeWidth={2.5} />
                <span className="text-[11px] font-semibold text-primary tracking-wider uppercase">파싱 완료</span>
              </div>
              <div className="grid divide-x divide-primary/10" style={{ gridTemplateColumns: '3fr 2fr' }}>
                {/* Left: version hero */}
                <div className="px-5 py-4">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 leading-none">버전</div>
                  <div className="text-lg font-bold font-mono text-primary tracking-tight leading-none">{preview.detectedVersionLabel}</div>
                </div>
                {/* Right: counts stacked */}
                <div className="divide-y divide-primary/10">
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">차량</span>
                    <span className="text-sm font-black font-mono tabular-nums text-foreground">{preview.vehiclePrograms.length}</span>
                  </div>
                  <div className="px-4 py-2.5 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">잔가</span>
                    <span className="text-sm font-black font-mono tabular-nums text-foreground">{preview.residualMatrixRows.length}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Feedback messages ── */}
          {error && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3 animate-fade-up">
              <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" strokeWidth={2} />
              <span className="text-xs text-amber-700 leading-relaxed">{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-3 animate-fade-up">
              <CheckCircle size={14} className="text-emerald-600 mt-0.5 shrink-0" strokeWidth={2} />
              <span className="text-xs text-emerald-700 leading-relaxed">{successMsg}</span>
            </div>
          )}

          {/* ── Action buttons ── */}
          {preview && (
            <div className="flex gap-2.5 justify-end animate-fade-up">
              <button
                onClick={handleReset}
                className="h-9 px-4 text-xs rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150 active:scale-[0.97]"
              >
                다시 선택
              </button>
              <button
                onClick={handleImport}
                disabled={importLoading}
                className="h-9 px-5 text-xs rounded-lg bg-primary text-white font-semibold tracking-tight hover:bg-primary/90 transition-all duration-150 active:scale-[0.97] active:translate-y-px disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_14px_rgba(26,58,92,0.22)]"
              >
                {importLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    임포트 중
                  </span>
                ) : '활성화하여 임포트'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Import history ── */}
      <div
        className="rounded-[2rem] border border-border bg-white shadow-[var(--shadow-elev-2)] overflow-hidden animate-fade-up"
        style={{ animationDelay: '60ms' }}
      >
        {/* Header */}
        <div className="px-7 py-4 border-b border-border flex items-center gap-2.5">
          <span className="w-5 h-5 rounded-md flex items-center justify-center bg-accent/10 text-accent">
            <History size={12} strokeWidth={2.2} />
          </span>
          <span className="text-[0.95rem] font-semibold text-foreground tracking-tight">들여온 문건 기록</span>
          {!historyLoading && connected !== null && (
            <div className="ml-auto flex items-center gap-2">
              {imports.length > 0 && (
                <span className="text-[11px] font-mono text-muted-foreground">{imports.length}개</span>
              )}
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border ${
                connected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                  : 'bg-amber-50 text-amber-700 border-amber-200/80'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                {connected ? 'DB 연결됨' : 'DB 미연결'}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div>
          {historyLoading ? (
            /* Skeleton matching the row layout */
            <div className="divide-y divide-border">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-4">
                  <div className="skeleton w-9 h-9 rounded-xl shrink-0" />
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="skeleton h-3.5 w-3/5 rounded" />
                    <div className="skeleton h-3 w-2/5 rounded" />
                  </div>
                  <div className="skeleton h-3 w-20 rounded" />
                </div>
              ))}
            </div>
          ) : imports.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-14 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                <Clock size={20} className="text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground mb-1">임포트 기록 없음</div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                  {connected === false
                    ? 'DB가 연결되지 않아 기록을 불러올 수 없습니다'
                    : '워크북을 업로드하면 기록이 여기 표시됩니다'}
                </div>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {imports.map((item, i) => (
                <ImportRow key={item.id} item={item} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>

      </div>
    </div>
  )
}

function ImportRow({ item, index }: { item: WorkbookImport; index: number }) {
  const date = new Date(item.importedAt)
  const dateLabel = date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  const timeLabel = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })

  return (
    <div
      className="px-6 py-4 flex items-center gap-4 hover:bg-muted/30 transition-colors animate-fade-up"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* File icon */}
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${item.isActive ? 'bg-primary/10' : 'bg-muted'}`}>
        <FileSpreadsheet size={15} className={item.isActive ? 'text-primary' : 'text-muted-foreground'} strokeWidth={1.5} />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground tracking-tight truncate">{item.versionLabel}</span>
          {item.isActive && (
            <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 tracking-wider">
              ON
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 truncate">{item.sourceFileName}</div>
      </div>

      {/* Date / time */}
      <div className="text-right shrink-0">
        <div className="text-xs text-foreground">{dateLabel}</div>
        <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{timeLabel}</div>
      </div>
    </div>
  )
}

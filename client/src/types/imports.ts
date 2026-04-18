export interface WorkbookImport {
  id: string
  lenderCode: string
  lenderName: string
  versionLabel: string
  sourceFileName: string
  importedAt: string
  isActive: boolean
  status: string
  meta: Record<string, unknown>
}

export interface WorkbookPreview {
  lenderCode: string
  detectedVersionLabel: string
  sourceFileName: string
  sheetNames: string[]
  vehiclePrograms: unknown[]
  residualMatrixRows: unknown[]
  brandRatePolicies: unknown[]
}

export interface ImportListResponse {
  ok: boolean
  connected: boolean
  imports: WorkbookImport[]
}

export interface PreviewResponse {
  ok: boolean
  workbook: WorkbookPreview
}

export interface ImportResponse {
  ok: boolean
  workbook: WorkbookPreview
  import: {
    id: string | null
    lenderCode: string
    versionLabel: string
  }
}

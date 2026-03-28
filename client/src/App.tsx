import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { QuotePage } from '@/pages/QuotePage'
import { ImportPage } from '@/pages/ImportPage'

export function App() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-border px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-sm text-foreground">돌림 솔루션</span>
          <span className="text-xs bg-muted border border-border rounded px-1.5 py-0.5 text-muted-foreground">
            MG캐피탈 · 운용리스
          </span>
        </div>
        <span className="text-xs text-muted-foreground">운용리스 견적 플랫폼</span>
      </header>

      {/* Tabs */}
      <Tabs defaultValue="quote" className="w-full">
        <div className="bg-white border-b border-border px-6">
          <TabsList className="h-auto p-0 bg-transparent gap-0 rounded-none">
            <TabsTrigger
              value="quote"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 py-3 text-sm"
            >
              견적 계산
            </TabsTrigger>
            <TabsTrigger
              value="import"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 py-3 text-sm"
            >
              워크북 임포트
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="quote" className="mt-0">
          <QuotePage />
        </TabsContent>
        <TabsContent value="import" className="mt-0">
          <ImportPage />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default App

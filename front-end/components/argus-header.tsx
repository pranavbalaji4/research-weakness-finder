import { Diamond, Eye } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function ArgusHeader() {
  return (
    <header className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Diamond className="h-10 w-10 text-primary" />
              <Eye className="h-5 w-5 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">ArgusAI</h1>
              <p className="text-xs text-muted-foreground">All-Seeing Thesis & Dissertation Auditor</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
              <span className="mr-1.5">🎓</span> Academic Mode
            </Badge>
            <Badge variant="outline" className="bg-secondary/10 text-secondary border-secondary/30">
              <span className="mr-1.5">⚡</span> System: Analysis Active
            </Badge>
          </div>
        </div>
      </div>
    </header>
  )
}

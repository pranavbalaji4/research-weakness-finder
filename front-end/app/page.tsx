import { ArgusHeader } from "@/components/argus-header"
import { PanoptesDropzone } from "@/components/panoptes-dropzone"
import { EconomicAudit } from "@/components/economic-audit"

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <ArgusHeader />
      <main className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="space-y-8">
          <PanoptesDropzone />
          <EconomicAudit />
        </div>
      </main>
    </div>
  )
}

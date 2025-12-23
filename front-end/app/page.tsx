"use client"

import { ArgusHeader } from "@/components/argus-header"
import { useState } from "react"
import { PanoptesDropzone } from "@/components/panoptes-dropzone"
import { EconomicAudit } from "@/components/economic-audit"
import { Card } from "@/components/ui/card"

export default function Home() {
  const [scores, setScores] = useState<any | null>(null)
  const [assumptions, setAssumptions] = useState<string[] | null>(null)
  const [citations, setCitations] = useState<any[] | null>(null)
  const [analysisText, setAnalysisText] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-background">
      <ArgusHeader />
      <main className="container mx-auto px-6 py-8 max-w-7xl">
        <div className="space-y-8">
          <PanoptesDropzone
            onUpload={(data: any) => {
              setScores(data.scores ?? null)
              setAssumptions(data.assumptions ?? null)
              setCitations(data.citations ?? null)
              setAnalysisText(data.analysis ?? null)
            }}
          />
          <EconomicAudit scores={scores} assumptions={assumptions} citations={citations} analysis={analysisText} />
          <Card className="backdrop-blur-sm bg-card/60 hover:bg-card/80 transition-all duration-300" style={{ borderWidth: "0.5px", borderColor: "oklch(0.35 0.015 260)" }}>
            <div className="p-6">
              <h3 className="text-lg font-serif font-semibold">AI Insights</h3>
              <div
                className={`mt-3 text-sm text-muted-foreground whitespace-pre-line transition-[max-height,opacity] duration-500 ${analysisText ? 'max-h-[1000px] opacity-100' : 'max-h-16 opacity-80 overflow-hidden'}`}
              >
                {analysisText ? analysisText : 'Upload a PDF for AI insights.'}
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}

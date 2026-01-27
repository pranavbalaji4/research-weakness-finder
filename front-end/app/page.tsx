"use client"

import { ArgusHeader } from "@/components/argus-header"
import { useState, useMemo } from "react"
import { PanoptesDropzone } from "@/components/panoptes-dropzone"
import { EconomicAudit } from "@/components/economic-audit"
import { Card } from "@/components/ui/card"

/**
 * Minimal, safe-ish markdown -> HTML converter for this analysis box.
 * - Escapes HTML
 * - Converts headings (#, ##, ###)
 * - Converts **bold** and *italic*
 * - Preserves line breaks and paragraphs
 */
function markdownToHtml(md?: string | null) {
  if (!md) return ""
  const escapeHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

  const lines = escapeHtml(md).split(/\r?\n/)
  const out: string[] = []
  let para: string[] = []
  let list: string[] | null = null

  const inlineFormat = (s: string) =>
    s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>")

  const flushPara = () => {
    if (!para.length) return
    const text = para.join("<br/>")
    out.push(`<p class="text-sm text-muted-foreground leading-relaxed mb-2">${inlineFormat(text)}</p>`)
    para = []
  }

  const flushList = () => {
    if (!list || !list.length) return
    const items = list
      .map((it) => `<li class="text-sm text-muted-foreground leading-relaxed mb-0">${inlineFormat(it)}</li>`)
      .join("")
    out.push(`<ul class="list-disc ml-5 mb-3">${items}</ul>`)
    list = null
  }

  for (let raw of lines) {
    const line = raw.trim()
    if (!line) {
      flushPara()
      flushList()
      continue
    }

    // Headings
    if (line.startsWith("### ")) {
      flushPara()
      flushList()
      out.push(`<h4 class="text-sm font-semibold mb-2">${line.slice(4)}</h4>`)
      continue
    }
    if (line.startsWith("## ")) {
      flushPara()
      flushList()
      out.push(`<h3 class="text-base font-semibold mb-2">${line.slice(3)}</h3>`)
      continue
    }
    if (line.startsWith("# ")) {
      flushPara()
      flushList()
      out.push(`<h2 class="text-lg font-semibold mb-2">${line.slice(2)}</h2>`)
      continue
    }

    // Bullet or numbered list
    const bulletMatch = line.match(/^([*\-+]|[0-9]+[.)])\s+(.*)$/)
    if (bulletMatch) {
      flushPara()
      const itemText = bulletMatch[2]
      if (!list) list = []
      list.push(itemText)
      continue
    }

    // regular paragraph line
    flushList()
    para.push(line)
  }
  flushPara()
  flushList()
  return out.join("")
}

function formatInline(s: any) {
  if (s === null || s === undefined) return ""
  const str = typeof s === "string" ? s : JSON.stringify(s)
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
}

function jsonToHtml(obj: any) {
  if (!obj) return ""
  const parts: string[] = []
  if (obj.mentor_note) {
    parts.push(`<p class=\"text-sm text-muted-foreground leading-relaxed mb-3\"><strong>Mentor note:</strong> ${formatInline(obj.mentor_note)}</p>`)
  }
  if (obj.brutal_truth && Array.isArray(obj.brutal_truth) && obj.brutal_truth.length) {
    const items = obj.brutal_truth
      .map((it: any) => {
        if (!it) return ''
        if (typeof it === 'string') return `<li class=\"text-sm text-muted-foreground leading-relaxed mb-2\">${formatInline(it)}</li>`
        // if object, try to render text + evidence
        const text = formatInline(it.text || JSON.stringify(it))
        const evidence = it.evidence ? `<div class=\"text-xs text-muted-foreground/80 italic mt-1\">Evidence: ${formatInline(it.evidence)}</div>` : ''
        return `<li class=\"text-sm text-muted-foreground leading-relaxed mb-2\">${text}${evidence}</li>`
      })
      .join('')
    parts.push(`<h4 class=\"text-sm font-semibold mb-2\">Brutal Truth</h4><ul class=\"list-disc ml-5 mb-3\">${items}</ul>`)
  }
  if (obj.roadmap && Array.isArray(obj.roadmap) && obj.roadmap.length) {
    const items = obj.roadmap.map((r: any) => `<li class=\"text-sm text-muted-foreground leading-relaxed mb-2\">${formatInline(r)}</li>`).join('')
    parts.push(`<h4 class=\"text-sm font-semibold mb-2\">Roadmap</h4><ol class=\"list-decimal ml-5 mb-3\">${items}</ol>`)
  }
  if (obj.assumptions && Array.isArray(obj.assumptions) && obj.assumptions.length) {
    const items = obj.assumptions.map((a: any) => `<li class=\"text-sm text-muted-foreground leading-relaxed mb-2\">${formatInline(a)}</li>`).join('')
    parts.push(`<h4 class=\"text-sm font-semibold mb-2\">Assumptions</h4><ul class=\"list-disc ml-5 mb-3\">${items}</ul>`)
  }
  return parts.join('')
}

export default function Home() {
  const [scores, setScores] = useState<any | null>(null)
  const [assumptions, setAssumptions] = useState<string[] | null>(null)
  const [citations, setCitations] = useState<any[] | null>(null)
  const [analysisText, setAnalysisText] = useState<string | null>(null)

  const analysisHtml = useMemo(() => markdownToHtml(analysisText), [analysisText])
  const parsedJson = useMemo(() => {
    if (!analysisText) return null
    try {
      return JSON.parse(analysisText)
    } catch (e) {
      return null
    }
  }, [analysisText])
  const jsonHtml = useMemo(() => (parsedJson ? jsonToHtml(parsedJson) : null), [parsedJson])

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
          <Card
            className="backdrop-blur-sm bg-card/60 hover:bg-card/80 transition-all duration-300"
            style={{ borderWidth: "0.5px", borderColor: "oklch(0.35 0.015 260)" }}
          >
            <div className="p-6">
              <h3 className="text-lg font-serif font-semibold">AI Insights</h3>

              {/* Scrollable analysis box
                  - fixed visual max height so the card doesn't grow endlessly
                  - overflow-auto to enable scrolling inside the box
                  - word-break to prevent overflow outside the box
              */}
              <div
                className={`mt-3 transition-[max-height,opacity] duration-500 ${
                  analysisText ? "opacity-100" : "opacity-80"
                }`}
              >
                {parsedJson ? (
                  <div
                    className="max-h-[36rem] overflow-auto pr-3 prose prose-sm prose-invert break-words"
                    style={{ whiteSpace: "normal" }}
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: jsonHtml ?? "" }}
                  />
                ) : (
                  <div
                    className="max-h-[36rem] overflow-auto pr-3 prose prose-sm prose-invert break-words"
                    style={{ whiteSpace: "normal" }}
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{
                      __html: analysisText
                        ? analysisHtml
                        : "<p class='text-sm text-muted-foreground'>Upload a PDF for AI insights.</p>",
                    }}
                  />
                )}
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}

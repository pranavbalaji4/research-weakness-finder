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
    parts.push(`<div class="mb-4 pb-4 border-b border-border/30"><p class="text-sm leading-relaxed text-muted-foreground">${formatInline(obj.mentor_note)}</p></div>`)
  }
  if (obj.brutal_truth && Array.isArray(obj.brutal_truth) && obj.brutal_truth.length) {
    const items = obj.brutal_truth
      .map((it: any, idx: number) => {
        if (!it) return ''
        // simple string case
        if (typeof it === 'string') {
          return `<li class="text-sm text-muted-foreground leading-relaxed mb-4">${formatInline(it)}</li>`
        }

        // object case: parse flaw + evidence
        const flaw = it.flaw || it.issue || it.point || it.text || it.message || JSON.stringify(it)
        const flawHtml = `<div class="text-sm text-muted-foreground leading-relaxed font-medium mb-2">${formatInline(flaw)}${it.focus ? `<span class="ml-2 text-xs font-medium text-foreground/70">— ${formatInline(it.focus)}</span>` : ''}</div>`

        // evidence array: show page + snippet for each
        let evHtml = ''
        if (it.evidence && Array.isArray(it.evidence) && it.evidence.length > 0) {
          const evItems = it.evidence
            .map((ev: any) => {
              const page = ev.page || ev.pages || ev.page_text || ''
              const snippet = ev.snippet || ev.snip || ''
              const pageStr = page ? `<span class="font-semibold text-xs">${formatInline(page)}</span>` : ''
              const snippetStr = snippet ? `<span class="text-xs italic text-muted-foreground/70 block mt-1">"${formatInline(snippet)}"</span>` : ''
              return `<div class="text-xs text-muted-foreground/80 mb-2">${pageStr}${snippetStr}</div>`
            })
            .join('')
          evHtml = `<div class="ml-3 pl-3 border-l border-border/20 mt-2 mb-3">${evItems}</div>`
        }

        return `<li class="mb-4">${flawHtml}${evHtml}</li>`
      })
      .join('')
    parts.push(`<div class="mb-6"><h4 class="text-base font-semibold mb-4 text-foreground">Brutal Truth</h4><ul class="list-none ml-0 space-y-0">${items}</ul></div>`)
  }
  if (obj.roadmap && Array.isArray(obj.roadmap) && obj.roadmap.length) {
    const items = obj.roadmap.map((r: any) => `<li class="text-sm text-muted-foreground leading-relaxed mb-3">${formatInline(r)}</li>`).join('')
    parts.push(`<div class="mb-6"><h4 class="text-base font-semibold mb-4 text-foreground">Roadmap</h4><ol class="list-decimal ml-5 space-y-2">${items}</ol></div>`)
  }
  if (obj.assumptions && Array.isArray(obj.assumptions) && obj.assumptions.length) {
    const items = obj.assumptions.map((a: any) => `<li class="text-sm text-muted-foreground leading-relaxed mb-2">${formatInline(a)}</li>`).join('')
    parts.push(`<div class="mb-6"><h4 class="text-base font-semibold mb-4 text-foreground">Assumptions</h4><ul class="list-disc ml-5 space-y-2">${items}</ul></div>`)
  }
  return parts.join('')
}

// --- Helpers: resilient JSON extraction and normalization ---
function extractJsonObjectsFromText(s: string) {
  if (!s) return []
  const objs: any[] = []
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '{') continue
    let brace = 0
    for (let j = i; j < s.length; j++) {
      const ch = s[j]
      if (ch === '{') brace++
      else if (ch === '}') brace--
      if (brace === 0) {
        const cand = s.slice(i, j + 1)
        try {
          const parsed = JSON.parse(cand)
          objs.push(parsed)
          i = j
          break
        } catch (e) {
          // not valid JSON here, continue scanning
        }
      }
    }
  }
  return objs
}

function tryParseSocratesOutput(s: string) {
  if (!s) return null
  const str = s.trim()

  // 1) direct parse (most common)
  try {
    const parsed = JSON.parse(str)
    if (Array.isArray(parsed)) {
      return { mentor_note: null, brutal_truth: parsed, roadmap: [], assumptions: [] }
    }
    return parsed
  } catch (e) {
    // continue
  }

  // 2) fenced code blocks - try those
  if (str.includes('```')) {
    const parts = str.split('```')
    for (const p of parts) {
      const t = p.trim()
      if (t.startsWith('{') || t.startsWith('[')) {
        try {
          const parsed = JSON.parse(t)
          if (Array.isArray(parsed)) return { mentor_note: null, brutal_truth: parsed, roadmap: [], assumptions: [] }
          return parsed
        } catch (e) {
          // continue
        }
      }
    }
  }

  // 3) extract multiple {} JSON objects and merge them
  const objs = extractJsonObjectsFromText(str)
  if (!objs.length) return null
  if (objs.length === 1) {
    const o = objs[0]
    if (Array.isArray(o)) return { mentor_note: null, brutal_truth: o, roadmap: [], assumptions: [] }
    return o
  }

  const combined: any = { mentor_note: null, brutal_truth: [], roadmap: [], assumptions: [] }
  for (const o of objs) {
    if (!o || typeof o !== 'object') continue
    if (!combined.mentor_note && o.mentor_note) combined.mentor_note = o.mentor_note
    if (o.brutal_truth) combined.brutal_truth = combined.brutal_truth.concat(o.brutal_truth)
    if (o.roadmap) combined.roadmap = combined.roadmap.concat(o.roadmap)
    if (o.assumptions) combined.assumptions = combined.assumptions.concat(o.assumptions)

    // If object appears to represent a single issue (common when model emits many small objects)
    if (o.issue || o.focus || o.text || o.flaw || o.message) {
      const item: any = {}
      item.flaw = o.issue || o.text || o.flaw || o.message || JSON.stringify(o)
      if (o.focus) item.focus = o.focus
      if (o.evidence) item.evidence = o.evidence
      combined.brutal_truth.push(item)
    } else {
      combined.brutal_truth.push(o)
    }
  }

  return combined
}

export default function Home() {
  const [scores, setScores] = useState<any | null>(null)
  const [assumptions, setAssumptions] = useState<string[] | null>(null)
  const [citations, setCitations] = useState<any[] | null>(null)
  const [analysisText, setAnalysisText] = useState<string | null>(null)

  const analysisHtml = useMemo(() => markdownToHtml(analysisText), [analysisText])
  const parsedJson = useMemo(() => tryParseSocratesOutput(analysisText), [analysisText])
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

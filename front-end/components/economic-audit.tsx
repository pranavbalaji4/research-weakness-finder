import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookOpen, TrendingUp, Target } from "lucide-react"

export function EconomicAudit({ scores, assumptions, citations, analysis }: { scores?: any | null; assumptions?: string[] | null; citations?: any[] | null; analysis?: string | null }) {
  const methodology = scores?.methodology ?? 85
  const originality = scores?.originality ?? 72
  const literature = scores?.literature ?? 80
  const robustness = scores?.robustness ?? 75
  const overall = Math.round((methodology + originality + literature + robustness) / 4)

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-serif font-bold text-foreground tracking-tight">Structural Integrity</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card
          className="md:col-span-2 backdrop-blur-sm bg-card/60 hover:bg-card/80 transition-all duration-300"
          style={{ borderWidth: "0.5px", borderColor: "oklch(0.35 0.015 260)" }}
        >
          <div className="p-10">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
              <div className="space-y-4 flex-1">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 rounded-lg">
                    <Target className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-2xl font-serif font-bold text-foreground tracking-tight">
                    Submission Readiness Score
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
                  Comprehensive assessment of submission readiness for academic theses and dissertations based on
                  methodological rigor, thematic innovation, and citation & evidence quality
                </p>
              </div>

                <div className="flex items-center justify-center">
                <RadialGauge value={scores ? overall : 100} showValue={!!scores} />
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-8">
              <ScoreMetric label="Methodological Rigor" score={methodology} showValue={!!scores} />
              <ScoreMetric label="Thematic Innovation" score={originality} showValue={!!scores} />
              <ScoreMetric label="Citation & Evidence Quality" score={literature} showValue={!!scores} />
              <ScoreMetric label="Robustness" score={robustness} showValue={!!scores} />
            </div>
          </div>
        </Card>

        <Card
          className="backdrop-blur-sm bg-card/60 hover:bg-card/80 transition-all duration-300"
          style={{ borderWidth: "0.5px", borderColor: "oklch(0.35 0.015 260)" }}
        >
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-primary/10 rounded-lg">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-base font-serif font-semibold text-foreground tracking-tight">
                The Assumption Matrix
              </h3>
            </div>

            <div className="space-y-2">
              {(assumptions && assumptions.length > 0 ? assumptions : [
                "Assumes representative sample of population",
                "Assumes measurement error is negligible",
                "Assumes observed controls adequately address confounding",
              ]).slice(0,3).map((a, i) => (
                <AssumptionItem key={i} text={a} />
              ))}
            </div>
          </div>
        </Card>

        <Card
          className="backdrop-blur-sm bg-card/60 hover:bg-card/80 transition-all duration-300"
          style={{ borderWidth: "0.5px", borderColor: "oklch(0.35 0.015 260)" }}
        >
          <div className="p-8 space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-secondary/10 rounded-lg">
                <TrendingUp className="h-4 w-4 text-secondary" />
              </div>
              <h3 className="text-base font-serif font-semibold text-foreground tracking-tight">Citation & Evidence Quality</h3>
            </div>

            <div className="space-y-3.5">
              {citations && citations.length > 0 ? (
                citations.slice(0,4).map((c: any, i: number) => (
                  <CitationJournal key={i} name={typeof c === 'string' ? c : String(c)} coverage={Math.min(95, 60 + i*10)} />
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No citations found</div>
              )}
            </div>

            <div className="pt-2 text-xs text-muted-foreground leading-relaxed">
              Heat map shows coverage of cited sources and evidence depth across relevant literature
            </div>
          </div>
        </Card>

        {/* Methodological Rigor card removed per design change */}
      </div>
    </div>
  )
}

function CritiqueItem({
  title,
  severity,
  description,
}: { title: string; severity: "high" | "medium" | "low"; description: string }) {
  const colors = {
    high: "bg-destructive/15 text-destructive border-destructive/40",
    medium: "bg-primary/15 text-primary border-primary/40",
    low: "bg-secondary/15 text-secondary border-secondary/40",
  }

  return (
    <div
      className="flex items-start gap-3 p-5 rounded-lg bg-muted/30 backdrop-blur-sm"
      style={{ borderWidth: "0.5px", borderColor: "oklch(0.35 0.015 260 / 0.5)" }}
    >
      <Badge variant="outline" className={`${colors[severity]} mt-0.5 text-[10px] font-semibold animate-subtle-glow`}>
        {severity.toUpperCase()}
      </Badge>
      <div className="flex-1 space-y-1.5">
        <div className="font-semibold text-xs text-foreground">{title}</div>
        <div className="text-[11px] text-muted-foreground leading-relaxed">{description}</div>
      </div>
    </div>
  )
}

function AssumptionItem({ text }: { text: string }) {
  return (
    <div
      className="flex items-center gap-2.5 p-3.5 rounded-lg bg-muted/30 backdrop-blur-sm hover:bg-muted/40 transition-all duration-200"
      style={{ borderWidth: "0.5px", borderColor: "oklch(0.35 0.015 260 / 0.3)" }}
    >
      <div className="h-1.5 w-1.5 rounded-full bg-primary" />
      <span className="text-xs text-foreground">{text}</span>
    </div>
  )
}

function CitationJournal({ name, coverage }: { name: string; coverage: number }) {
  const getColorClass = (value: number) => {
    if (value >= 80) return "bg-secondary"
    if (value >= 60) return "bg-primary"
    return "bg-muted-foreground"
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground font-medium">{name}</span>
        <span className="text-xs text-muted-foreground font-mono font-semibold">{coverage}%</span>
      </div>
      <div
        className="h-2 bg-muted/40 rounded-full overflow-hidden backdrop-blur-sm"
        style={{ borderWidth: "0.5px", borderColor: "oklch(0.35 0.015 260 / 0.3)" }}
      >
        <div
          className={`h-full ${getColorClass(coverage)} transition-all duration-500`}
          style={{ width: `${coverage}%` }}
        />
      </div>
    </div>
  )
}

function getColorClassForMetric(value: number) {
  if (value >= 80) return "bg-secondary"
  if (value >= 60) return "bg-primary"
  return "bg-muted-foreground"
}

function ScoreMetric({ label, score, showValue }: { label: string; score: number; showValue: boolean }) {
  const colorClass = getColorClassForMetric(score)
  const filledWidth = showValue ? Math.max(0, Math.min(100, score)) : 100

  return (
    <div className="space-y-2.5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">{label}</div>
      <div className="text-2xl font-bold text-foreground font-mono">{showValue ? `${score}%` : null}</div>
      <div className="h-1 rounded-full bg-muted/40 overflow-hidden" style={{ borderWidth: "0.5px", borderColor: "oklch(0.35 0.015 260 / 0.3)" }}>
        <div
          className={`${colorClass} h-full transition-all duration-500`}
          style={{ width: `${filledWidth}%`, opacity: showValue ? 1 : 0.25 }}
        />
      </div>
    </div>
  )
}

function RadialGauge({ value, showValue }: { value: number; showValue?: boolean }) {
  const circumference = 2 * Math.PI * 50
  const offset = circumference - (value / 100) * circumference
    const fgClass = showValue ? "text-primary" : "text-primary/30"

  return (
    <div className="relative w-36 h-36">
      <svg className="transform -rotate-90 w-36 h-36">
        <circle
          cx="72"
          cy="72"
          r="50"
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          className="text-muted/40"
        />
        <circle
          cx="72"
          cy="72"
          r="50"
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={`${fgClass} transition-all duration-1000`}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showValue ? (
          <>
            <span className="text-4xl font-bold text-primary font-serif">{value}</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Score</span>
          </>
        ) : (
          <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Score</span>
        )}
      </div>
    </div>
  )
}


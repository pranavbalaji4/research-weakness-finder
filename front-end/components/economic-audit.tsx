import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, BookOpen, TrendingUp, Target } from "lucide-react"

export function EconomicAudit() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-serif font-bold text-foreground tracking-tight">Economic Audit</h2>

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
                    Market Readiness Score
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
                  Comprehensive assessment of publication viability at top-tier Economics and Finance journals based on
                  methodological rigor, originality, and empirical robustness
                </p>
              </div>

              <div className="flex items-center justify-center">
                <RadialGauge value={78} />
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-8">
              <ScoreMetric label="Methodology" score={85} />
              <ScoreMetric label="Originality" score={72} />
              <ScoreMetric label="Literature" score={80} />
              <ScoreMetric label="Robustness" score={75} />
            </div>
          </div>
        </Card>

        <Card
          className="backdrop-blur-sm bg-card/60 hover:bg-card/80 transition-all duration-300"
          style={{ borderWidth: "0.5px", borderColor: "oklch(0.35 0.015 260)" }}
        >
          <div className="p-8 space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-primary/10 rounded-lg">
                <BookOpen className="h-4 w-4 text-primary" />
              </div>
              <h3 className="text-base font-serif font-semibold text-foreground tracking-tight">
                The Assumption Matrix
              </h3>
            </div>

            <div className="space-y-2">
              <AssumptionItem text="Assumes constant volatility" />
              <AssumptionItem text="Ignores liquidity constraints" />
              <AssumptionItem text="Perfect market efficiency implied" />
              <AssumptionItem text="No transaction costs considered" />
              <AssumptionItem text="Homogeneous investor expectations" />
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
              <h3 className="text-base font-serif font-semibold text-foreground tracking-tight">Citation Alpha</h3>
            </div>

            <div className="space-y-3.5">
              <CitationJournal name="Journal of Finance" coverage={85} />
              <CitationJournal name="Quarterly Journal of Economics" coverage={60} />
              <CitationJournal name="Review of Financial Studies" coverage={75} />
              <CitationJournal name="Journal of Financial Economics" coverage={70} />
            </div>

            <div className="pt-2 text-xs text-muted-foreground leading-relaxed">
              Heat map shows citation coverage of seminal works from top-tier journals
            </div>
          </div>
        </Card>

        <Card
          className="md:col-span-2 backdrop-blur-sm bg-card/60 hover:bg-card/80 transition-all duration-300"
          style={{ borderWidth: "0.5px", borderColor: "oklch(0.35 0.015 260)" }}
        >
          <div className="p-8 space-y-5">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-destructive/10 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-destructive" />
              </div>
              <h3 className="text-base font-serif font-semibold text-foreground tracking-tight">
                Methodological Rigor
              </h3>
            </div>

            <div className="space-y-3">
              <CritiqueItem
                title="Endogeneity Risk"
                severity="high"
                description="Potential reverse causality between firm performance and ESG scores"
              />
              <CritiqueItem
                title="Sample Selection Bias"
                severity="medium"
                description="Analysis limited to S&P 500 companies, may not generalize"
              />
              <CritiqueItem
                title="Overfitting Check"
                severity="low"
                description="Model complexity appropriate for sample size, cross-validation shows robustness"
              />
            </div>
          </div>
        </Card>
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

function RadialGauge({ value }: { value: number }) {
  const circumference = 2 * Math.PI * 50
  const offset = circumference - (value / 100) * circumference

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
          className="text-primary transition-all duration-1000"
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-primary font-serif">{value}</span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Score</span>
      </div>
    </div>
  )
}

function ScoreMetric({ label, score }: { label: string; score: number }) {
  return (
    <div className="space-y-2.5">
      <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">{label}</div>
      <div className="text-2xl font-bold text-foreground font-mono">{score}%</div>
      <Progress value={score} className="h-1" />
    </div>
  )
}

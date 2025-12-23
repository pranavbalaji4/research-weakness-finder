import type React from "react"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Calculator, Search, FileEdit } from "lucide-react"

export function ReviewerPersonas() {
  return (
    <Card className="bg-card border-border sticky top-4">
      <div className="p-6 space-y-6">
        <h3 className="text-lg font-semibold text-foreground">Reviewer Personas</h3>

        <div className="space-y-4">
          <PersonaCard
            name="The Quant"
            icon={<Calculator className="h-5 w-5" />}
            color="bg-primary"
            focus="Mathematical Rigor"
            status="Analyzing methodology..."
          />

          <PersonaCard
            name="The Skeptical Peer"
            icon={<Search className="h-5 w-5" />}
            color="bg-destructive"
            focus="Logical Consistency"
            status="Checking assumptions..."
          />

          <PersonaCard
            name="The Editor"
            icon={<FileEdit className="h-5 w-5" />}
            color="bg-secondary"
            focus="Flow & Clarity"
            status="Reviewing structure..."
          />
        </div>

        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground text-center">
            Three AI agents analyze your paper from different perspectives
          </p>
        </div>
      </div>
    </Card>
  )
}

function PersonaCard({
  name,
  icon,
  color,
  focus,
  status,
}: {
  name: string
  icon: React.ReactNode
  color: string
  focus: string
  status: string
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      <Avatar className={`${color} h-10 w-10`}>
        <AvatarFallback className={`${color} text-background`}>{icon}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm text-foreground">{name}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{focus}</div>
        <div className="text-xs text-primary/80 mt-1 italic">{status}</div>
      </div>
    </div>
  )
}

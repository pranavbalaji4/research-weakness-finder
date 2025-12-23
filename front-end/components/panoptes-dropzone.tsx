"use client"

import type React from "react"
import { useState, useCallback } from "react"
import { Upload, Eye, FileText, AlertCircle } from "lucide-react"
import { Card } from "@/components/ui/card"

export function PanoptesDropzone({ onUpload }: { onUpload?: (data: any) => void }) {
  const [isDragging, setIsDragging] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // --- NEW: THE AI CONNECTION LOGIC ---
  const sendToArgus = async (file: File) => {
    setIsScanning(true)
    setError(null)
    setFileName(file.name)

    const formData = new FormData()
    formData.append("file", file) // Must match 'file: UploadFile' in main.py

    try {
      const response = await fetch("http://localhost:8000/upload/", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) throw new Error("Argus Backend unreachable")

      const data = await response.json()
      console.log("ARGUS ANALYSIS:", data.analysis)
      // pass full backend response to parent
      onUpload?.(data)
      
      // For now, we'll just log it. 
      // Next, we'll pass this data to your Bento Grid!
    } catch (err) {
      console.error(err)
      setError("Failed to reach Argus server.")
    } finally {
      setIsScanning(false)
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files)
    const pdf = files.find((f) => f.type === "application/pdf")
    if (pdf) sendToArgus(pdf) // Call the real logic
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files[0]) {
      const f = files[0]
      if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
        setError("Only PDF files are allowed.")
        return
      }
      sendToArgus(f)
    }
  }, [])

  return (
    <Card
      className={`relative overflow-hidden transition-all duration-300 backdrop-blur-sm bg-card/60 ${
        isDragging ? "border-primary shadow-[0_0_20px_oklch(0.75_0.08_75_/_0.3)]" : "border-border/50"
      }`}
      style={{ borderWidth: "0.5px" }}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <div className="p-10">
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <div className="relative">
            <div className="p-4 rounded-full bg-muted/30">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center">
                {[...Array(8)].map((_, i) => (
                  <Eye
                    key={i}
                    className="absolute h-5 w-5 text-primary animate-pulse"
                    style={{
                      transform: `rotate(${i * 45}deg) translateY(-32px)`,
                      animationDelay: `${i * 0.2}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-serif font-bold text-foreground tracking-tight">The Panoptes Dropzone</h2>
            {isScanning ? (
              <p className="text-sm text-primary font-semibold animate-pulse">Auditing Thesis Logic...</p>
            ) : error ? (
              <p className="text-sm text-destructive flex items-center gap-1.5 justify-center">
                <AlertCircle className="h-4 w-4" /> {error}
              </p>
            ) : fileName ? (
              <p className="text-xs text-secondary font-medium">Analysis complete: {fileName}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Drop thesis PDF here</p>
            )}
          </div>

          <input
            type="file"
            accept=".pdf"
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </div>
    </Card>
  )
}
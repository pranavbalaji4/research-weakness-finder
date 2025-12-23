"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Upload, Eye, FileText } from "lucide-react"
import { Card } from "@/components/ui/card"

export function PanoptesDropzone() {
  const [isDragging, setIsDragging] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const pdfFiles = files.filter(
      (file) => file.type === "application/pdf" || file.name.endsWith(".tex") || file.name.endsWith(".latex"),
    )

    if (pdfFiles.length > 0) {
      setFileName(pdfFiles[0].name)
      setIsScanning(true)
      setTimeout(() => setIsScanning(false), 3000)
    }
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      setFileName(files[0].name)
      setIsScanning(true)
      setTimeout(() => setIsScanning(false), 3000)
    }
  }, [])

  return (
    <Card
      className={`relative overflow-hidden transition-all duration-300 backdrop-blur-sm bg-card/60 ${
        isDragging ? "border-primary shadow-[0_0_20px_oklch(0.75_0.08_75_/_0.3)]" : "border-border/50"
      }`}
      style={{ borderWidth: "0.5px" }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
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
                    className="absolute h-5 w-5 text-primary animate-pulse-eye"
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
              <div className="space-y-1">
                <p className="text-sm text-primary font-semibold animate-pulse">Scanning for Alpha...</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 justify-center">
                  <FileText className="h-3.5 w-3.5" />
                  {fileName}
                </p>
              </div>
            ) : fileName ? (
              <p className="text-xs text-secondary font-medium flex items-center gap-1.5 justify-center">
                <FileText className="h-3.5 w-3.5" />
                Analysis complete: {fileName}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Drop your research papers here or click to upload</p>
            )}
          </div>

          <div className="text-xs text-muted-foreground">Accepts PDF, LaTeX (.tex) files</div>

          <input
            type="file"
            accept=".pdf,.tex,.latex"
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
      </div>
    </Card>
  )
}

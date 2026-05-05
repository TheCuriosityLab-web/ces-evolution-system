import { useCallback, useState } from 'react'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { useEvolutionStore } from '@/store/evolutionStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

// ─── Types ────────────────────────────────────────────────────────────────────

type FileFormat = 'csv' | 'json' | 'xlsx' | 'tsv' | 'txt'

interface FormatMeta {
  label: string
  color: string
  accept: string
}

const FORMAT_META: Record<FileFormat, FormatMeta> = {
  csv:  { label: 'CSV',   color: '#00FF88', accept: '.csv'        },
  json: { label: 'JSON',  color: '#3B82F6', accept: '.json'       },
  xlsx: { label: 'XLSX',  color: '#22C55E', accept: '.xlsx,.xls'  },
  tsv:  { label: 'TSV',   color: '#F59E0B', accept: '.tsv'        },
  txt:  { label: 'TXT',   color: '#A7B0B7', accept: '.txt'        },
}

const ACCEPTED = Object.values(FORMAT_META).map(f => f.accept).join(',')

const MONO: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" }

// ─── Parsers ──────────────────────────────────────────────────────────────────

function detectFormat(filename: string): FileFormat | null {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext === 'csv')                     return 'csv'
  if (ext === 'json')                    return 'json'
  if (ext === 'xlsx' || ext === 'xls')   return 'xlsx'
  if (ext === 'tsv')                     return 'tsv'
  if (ext === 'txt')                     return 'txt'
  return null
}

function toStringRecord(row: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, v == null ? '' : String(v)])
  )
}

function parseFile(
  file: File,
  format: FileFormat,
  onSuccess: (data: Record<string, string>[]) => void,
  onError: (msg: string) => void,
) {
  // ── CSV ──
  if (format === 'csv') {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => {
        if (r.errors.length && r.data.length === 0) {
          onError(`CSV parse error: ${r.errors[0].message}`)
        } else {
          onSuccess(r.data)
        }
      },
      error: (e) => onError(`CSV parse error: ${e.message}`),
    })
    return
  }

  // ── TSV ──
  if (format === 'tsv') {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      delimiter: '\t',
      skipEmptyLines: true,
      complete: (r) => {
        if (r.errors.length && r.data.length === 0) {
          onError(`TSV parse error: ${r.errors[0].message}`)
        } else {
          onSuccess(r.data)
        }
      },
      error: (e) => onError(`TSV parse error: ${e.message}`),
    })
    return
  }

  // ── TXT (auto-detect delimiter) ──
  if (format === 'txt') {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (r) => {
        if (r.errors.length && r.data.length === 0) {
          onError(`TXT parse error: ${r.errors[0].message}`)
        } else {
          onSuccess(r.data)
        }
      },
      error: (e) => onError(`TXT parse error: ${e.message}`),
    })
    return
  }

  const reader = new FileReader()

  // ── JSON ──
  if (format === 'json') {
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string)
        if (!Array.isArray(parsed)) {
          onError('JSON must be an array of objects.')
          return
        }
        onSuccess(parsed.map(toStringRecord))
      } catch (err) {
        onError(`JSON parse error: ${(err as Error).message}`)
      }
    }
    reader.onerror = () => onError('Failed to read file.')
    reader.readAsText(file)
    return
  }

  // ── XLSX ──
  if (format === 'xlsx') {
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        if (!sheet) {
          onError('Excel file contains no sheets.')
          return
        }
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
        onSuccess(rows.map(toStringRecord))
      } catch (err) {
        onError(`Excel parse error: ${(err as Error).message}`)
      }
    }
    reader.onerror = () => onError('Failed to read file.')
    reader.readAsArrayBuffer(file)
    return
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DataUpload() {
  const csvData         = useEvolutionStore((s) => s.csvData)
  const targetColumn    = useEvolutionStore((s) => s.targetColumn)
  const featureColumns  = useEvolutionStore((s) => s.featureColumns)
  const setCSVData      = useEvolutionStore((s) => s.setCSVData)
  const setTargetColumn = useEvolutionStore((s) => s.setTargetColumn)
  const setFeatureColumns = useEvolutionStore((s) => s.setFeatureColumns)

  const [dragging,   setDragging]   = useState(false)
  const [filename,   setFilename]   = useState<string | null>(null)
  const [fileFormat, setFileFormat] = useState<FileFormat | null>(null)

  const handleFile = useCallback((file: File) => {
    const fmt = detectFormat(file.name)
    if (!fmt) {
      toast.error(`Unsupported format. Use CSV, JSON, XLSX, TSV, or TXT.`)
      return
    }
    setFilename(file.name)
    setFileFormat(fmt)

    parseFile(
      file, fmt,
      (data) => {
        if (data.length === 0) {
          toast.error('File parsed successfully but contains no rows.')
          setCSVData(null)
          return
        }
        setCSVData(data)
        setTargetColumn(null)
        setFeatureColumns([])
      },
      (msg) => {
        toast.error(msg)
        setCSVData(null)
        setFilename(null)
        setFileFormat(null)
      },
    )
  }, [setCSVData, setTargetColumn, setFeatureColumns])

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }, [handleFile])

  const toggleFeature = (col: string, checked: boolean) => {
    setFeatureColumns(
      checked ? [...featureColumns, col] : featureColumns.filter((c) => c !== col)
    )
  }

  const columns = csvData && csvData.length > 0 ? Object.keys(csvData[0]) : []
  const preview = csvData?.slice(0, 5) ?? []

  return (
    <div className="flex flex-col gap-5" style={MONO}>

      {/* Format legend */}
      <div className="flex items-center gap-3 flex-wrap">
        {(Object.entries(FORMAT_META) as [FileFormat, FormatMeta][]).map(([fmt, meta]) => (
          <span
            key={fmt}
            className="text-[9px] px-2 py-0.5 rounded"
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              color: meta.color,
              border: `1px solid ${meta.color}40`,
              background: `${meta.color}10`,
              letterSpacing: '0.08em',
            }}
          >
            {meta.label}
          </span>
        ))}
      </div>

      {/* Drop zone */}
      <div
        className="relative flex flex-col items-center justify-center gap-3 rounded-lg cursor-pointer transition-all duration-200 px-6 py-10"
        style={{
          background: '#0E1116',
          border:    `2px dashed ${dragging ? '#00F0FF' : 'rgba(0,240,255,0.2)'}`,
          boxShadow: dragging ? '0 0 24px rgba(0,240,255,0.15)' : 'none',
        }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById('data-file-input')?.click()}
      >
        <input
          id="data-file-input"
          type="file"
          accept={ACCEPTED}
          className="hidden"
          onChange={onInputChange}
        />

        <svg
          width="32" height="32" viewBox="0 0 24 24" fill="none"
          stroke={dragging ? '#00F0FF' : 'rgba(0,240,255,0.4)'}
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>

        {csvData && filename && fileFormat ? (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                className="text-[9px] px-2 py-0.5 rounded"
                style={{
                  color: FORMAT_META[fileFormat].color,
                  border: `1px solid ${FORMAT_META[fileFormat].color}50`,
                  background: `${FORMAT_META[fileFormat].color}15`,
                  letterSpacing: '0.08em',
                }}
              >
                {FORMAT_META[fileFormat].label}
              </span>
              <span className="text-[12px] text-[#00FF88]">{filename}</span>
            </div>
            <span className="text-[11px] text-[#A7B0B7]">
              {csvData.length.toLocaleString()} rows · {columns.length} columns
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[12px]" style={{ color: dragging ? '#00F0FF' : '#A7B0B7' }}>
              {dragging ? 'Drop to upload' : 'Drop CSV, JSON, Excel, TSV or TXT files here'}
            </span>
            <span className="text-[10px] text-[#A7B0B7]/50">or click to browse</span>
          </div>
        )}
      </div>

      {/* Column config — only shown after upload */}
      {csvData && columns.length > 0 && (
        <>
          {/* Target column */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-[#A7B0B7] tracking-widest uppercase">
              Target Column
            </span>
            <Select value={targetColumn ?? ''} onValueChange={setTargetColumn}>
              <SelectTrigger className="text-[11px]" style={MONO}>
                <SelectValue placeholder="Select column to optimise…" />
              </SelectTrigger>
              <SelectContent style={MONO}>
                {columns.map((col) => (
                  <SelectItem key={col} value={col} className="text-[11px]">{col}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Feature columns */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-[#A7B0B7] tracking-widest uppercase">
              Feature Columns
            </span>
            <ScrollArea className="max-h-40">
              <div className="flex flex-col gap-1.5 pr-3">
                {columns.map((col) => {
                  const checked  = featureColumns.includes(col)
                  const isTarget = col === targetColumn
                  return (
                    <label
                      key={col}
                      className={`flex items-center gap-2.5 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                        isTarget ? 'opacity-30 pointer-events-none' : 'hover:bg-white/5'
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={isTarget}
                        onCheckedChange={(v) => toggleFeature(col, v === true)}
                      />
                      <span className="text-[11px]" style={{ color: checked ? '#00F0FF' : '#A7B0B7' }}>
                        {col}
                      </span>
                    </label>
                  )
                })}
              </div>
            </ScrollArea>
            {featureColumns.length > 0 && (
              <span className="text-[10px] text-[#A7B0B7]/60">
                {featureColumns.length} feature{featureColumns.length !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>

          {/* Preview table */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-[#A7B0B7] tracking-widest uppercase">
              Preview — first 5 rows
            </span>
            <ScrollArea className="rounded-md border" style={{ borderColor: 'rgba(0,240,255,0.1)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-[10px] border-collapse">
                  <thead>
                    <tr style={{ background: 'rgba(0,240,255,0.06)' }}>
                      {columns.map((col) => (
                        <th
                          key={col}
                          className="px-3 py-2 text-left font-normal tracking-wider whitespace-nowrap border-b"
                          style={{
                            color: col === targetColumn
                              ? '#00FF88'
                              : featureColumns.includes(col)
                              ? '#00F0FF'
                              : '#A7B0B7',
                            borderColor: 'rgba(0,240,255,0.1)',
                          }}
                        >
                          {col}
                          {col === targetColumn && (
                            <span className="ml-1 text-[8px] text-[#00FF88]/60">TARGET</span>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr
                        key={i}
                        style={{ background: i % 2 === 0 ? 'rgba(0,240,255,0.02)' : 'transparent' }}
                      >
                        {columns.map((col) => (
                          <td
                            key={col}
                            className="px-3 py-1.5 whitespace-nowrap tabular-nums"
                            style={{
                              color: col === targetColumn ? '#00FF88'
                                : featureColumns.includes(col) ? '#F4F6F8'
                                : '#A7B0B7',
                            }}
                          >
                            {row[col]}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  )
}

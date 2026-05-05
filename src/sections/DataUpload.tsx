import { useCallback, useState } from 'react'
import Papa from 'papaparse'
import { useEvolutionStore } from '@/store/evolutionStore'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'

const MONO: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" }

export function DataUpload() {
  const csvData         = useEvolutionStore((s) => s.csvData)
  const targetColumn    = useEvolutionStore((s) => s.targetColumn)
  const featureColumns  = useEvolutionStore((s) => s.featureColumns)
  const setCSVData      = useEvolutionStore((s) => s.setCSVData)
  const setTargetColumn = useEvolutionStore((s) => s.setTargetColumn)
  const setFeatureColumns = useEvolutionStore((s) => s.setFeatureColumns)

  const [dragging, setDragging] = useState(false)
  const [filename, setFilename] = useState<string | null>(null)
  const [error,    setError]    = useState<string | null>(null)

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Only .csv files are supported.')
      return
    }
    setError(null)
    setFilename(file.name)
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setCSVData(result.data)
        setTargetColumn(null)
        setFeatureColumns([])
      },
      error: (err) => {
        setError(`Parse error: ${err.message}`)
        setCSVData(null)
      },
    })
  }, [setCSVData, setTargetColumn, setFeatureColumns])

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }, [processFile])

  const toggleFeature = (col: string, checked: boolean) => {
    setFeatureColumns(
      checked ? [...featureColumns, col] : featureColumns.filter((c) => c !== col)
    )
  }

  const columns = csvData && csvData.length > 0 ? Object.keys(csvData[0]) : []
  const preview = csvData?.slice(0, 5) ?? []

  return (
    <div className="flex flex-col gap-5" style={MONO}>

      {/* Drop zone */}
      <div
        className="relative flex flex-col items-center justify-center gap-3 rounded-lg cursor-pointer transition-all duration-200 px-6 py-10"
        style={{
          background: '#0E1116',
          border:     `2px dashed ${dragging ? '#00F0FF' : 'rgba(0,240,255,0.2)'}`,
          boxShadow:  dragging ? '0 0 24px rgba(0,240,255,0.15)' : 'none',
        }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById('csv-file-input')?.click()}
      >
        <input
          id="csv-file-input"
          type="file"
          accept=".csv"
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

        {csvData && filename ? (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[12px] text-[#00FF88]">{filename}</span>
            <span className="text-[11px] text-[#A7B0B7]">
              {csvData.length.toLocaleString()} rows · {columns.length} columns
            </span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[12px]" style={{ color: dragging ? '#00F0FF' : '#A7B0B7' }}>
              {dragging ? 'Drop to upload' : 'Drag & drop a .csv file'}
            </span>
            <span className="text-[10px] text-[#A7B0B7]/50">or click to browse</span>
          </div>
        )}

        {error && <span className="text-[10px] text-[#FF4560]">{error}</span>}
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
                  <SelectItem key={col} value={col} className="text-[11px]">
                    {col}
                  </SelectItem>
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
                  const checked = featureColumns.includes(col)
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
                      <span
                        className="text-[11px]"
                        style={{ color: checked ? '#00F0FF' : '#A7B0B7' }}
                      >
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
                              color: col === targetColumn
                                ? '#00FF88'
                                : featureColumns.includes(col)
                                ? '#F4F6F8'
                                : '#A7B0B7/80',
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

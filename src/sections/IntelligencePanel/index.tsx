import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LearningLog }     from './LearningLog'
import { MutationDNA }     from './MutationDNA'
import { DataConsumption } from './DataConsumption'

export function IntelligencePanel() {
  return (
    <div
      className="flex flex-col h-full"
      style={{
        background:   '#0E1116',
        border:       '1px solid rgba(0,240,255,0.08)',
        borderRadius: '8px',
        overflow:     'hidden',
      }}
    >
      {/* Header */}
      <div
        className="px-4 py-2.5 shrink-0 border-b"
        style={{ borderColor: 'rgba(0,240,255,0.08)' }}
      >
        <span
          style={{
            fontFamily:    "'IBM Plex Mono', monospace",
            fontSize:      '10px',
            color:         '#A7B0B7',
            letterSpacing: '0.12em',
            textTransform: 'uppercase' as const,
          }}
        >
          Intelligence Breakdown
        </span>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="learning" className="flex flex-col flex-1 min-h-0">
        <TabsList
          className="shrink-0 self-start mx-4 mt-3 mb-2"
          style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '10px' }}
        >
          <TabsTrigger value="learning">WHAT IT LEARNED</TabsTrigger>
          <TabsTrigger value="mutation">HOW IT MUTATED</TabsTrigger>
          <TabsTrigger value="data">DATA CONSUMED</TabsTrigger>
        </TabsList>

        <div className="flex-1 min-h-0 px-4 pb-4">
          <TabsContent value="learning" className="h-full m-0 overflow-hidden">
            <LearningLog />
          </TabsContent>
          <TabsContent value="mutation" className="h-full m-0 overflow-hidden">
            <MutationDNA />
          </TabsContent>
          <TabsContent value="data" className="h-full m-0 overflow-hidden">
            <DataConsumption />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

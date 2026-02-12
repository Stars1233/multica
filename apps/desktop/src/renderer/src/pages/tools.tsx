import { useToolsStore } from '../stores/tools'
import { ToolList } from '../components/tool-list'

export default function ToolsPage() {
  const { tools, loading, error, toggleTool, refresh } = useToolsStore()

  return (
    <div className="h-full overflow-auto">
    <div className="container flex flex-col p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-lg font-medium">Tools</h1>
        <p className="text-sm text-muted-foreground">
          Tools are actions your agent can perform, like reading files, searching the web, or running code. Toggle them to control what your agent can do.
        </p>
      </div>

      {/* Configuration Area */}
      <div className="flex-1 min-h-0">
        <ToolList
          tools={tools}
          loading={loading}
          error={error}
          onToggleTool={toggleTool}
          onRefresh={refresh}
        />
      </div>
    </div>
    </div>
  )
}

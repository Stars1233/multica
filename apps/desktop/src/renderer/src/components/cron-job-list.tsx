import { useState } from 'react'
import { Switch } from '@multica/ui/components/ui/switch'
import { Button } from '@multica/ui/components/ui/button'
import {
  RotateCw,
  Trash2,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import type { CronJobInfo } from '../stores/cron-jobs'

interface CronJobListProps {
  jobs: CronJobInfo[]
  loading: boolean
  error: string | null
  onToggleJob: (jobId: string) => Promise<void>
  onRemoveJob: (jobId: string) => Promise<void>
  onRefresh: () => Promise<void>
}

function StatusBadge({ status }: { status: CronJobInfo['lastStatus'] }) {
  if (!status) {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
        no runs
      </span>
    )
  }

  const config = {
    ok: { Icon: CheckCircle, className: 'text-emerald-600', label: 'ok' },
    error: { Icon: XCircle, className: 'text-destructive', label: 'error' },
    skipped: { Icon: AlertCircle, className: 'text-yellow-600', label: 'skipped' },
  }[status]

  return (
    <span className={`flex items-center gap-1 text-xs ${config.className}`}>
      <config.Icon className="size-3.5" />
      {config.label}
    </span>
  )
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = Date.now()
  const diffMs = date.getTime() - now

  if (Math.abs(diffMs) < 60_000) return 'just now'

  const absMs = Math.abs(diffMs)
  const minutes = Math.floor(absMs / 60_000)
  const hours = Math.floor(absMs / 3_600_000)
  const days = Math.floor(absMs / 86_400_000)

  const unit = days > 0 ? `${days}d` : hours > 0 ? `${hours}h` : `${minutes}m`
  return diffMs > 0 ? `in ${unit}` : `${unit} ago`
}

export function CronJobList({
  jobs,
  loading,
  error,
  onToggleJob,
  onRemoveJob,
  onRefresh,
}: CronJobListProps) {
  const [togglingJobs, setTogglingJobs] = useState<Set<string>>(new Set())
  const [removingJobs, setRemovingJobs] = useState<Set<string>>(new Set())

  const handleToggle = async (jobId: string) => {
    setTogglingJobs((prev) => new Set(prev).add(jobId))
    try {
      await onToggleJob(jobId)
    } finally {
      setTogglingJobs((prev) => {
        const next = new Set(prev)
        next.delete(jobId)
        return next
      })
    }
  }

  const handleRemove = async (jobId: string) => {
    setRemovingJobs((prev) => new Set(prev).add(jobId))
    try {
      await onRemoveJob(jobId)
    } finally {
      setRemovingJobs((prev) => {
        const next = new Set(prev)
        next.delete(jobId)
        return next
      })
    }
  }

  if (loading && jobs.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
        <span className="ml-2 text-muted-foreground">Loading cron jobs...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          {jobs.filter((j) => j.enabled).length} of {jobs.length} jobs enabled
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          className="gap-1.5"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RotateCw className="size-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Empty state */}
      {jobs.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="size-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">No scheduled tasks</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Use the cron tool in Chat to create one.
          </p>
        </div>
      )}

      {/* Job list */}
      {jobs.length > 0 && (
        <div className="border rounded-lg divide-y">
          {jobs.map((job) => {
            const isToggling = togglingJobs.has(job.id)
            const isRemoving = removingJobs.has(job.id)

            return (
              <div
                key={job.id}
                className="flex items-center gap-4 px-4 py-3 hover:bg-muted/20 transition-colors"
              >
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">{job.name}</span>
                    <StatusBadge status={job.lastStatus} />
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span className="font-mono">{job.schedule}</span>
                    {job.nextRunAt && job.enabled && (
                      <span>next: {formatRelativeTime(job.nextRunAt)}</span>
                    )}
                    {job.lastRunAt && (
                      <span>last: {formatRelativeTime(job.lastRunAt)}</span>
                    )}
                  </div>
                  {job.lastError && (
                    <p className="text-xs text-destructive mt-0.5 truncate">{job.lastError}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemove(job.id)}
                    disabled={isRemoving}
                  >
                    {isRemoving ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                  </Button>
                  {isToggling && (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  )}
                  <Switch
                    checked={job.enabled}
                    onCheckedChange={() => handleToggle(job.id)}
                    disabled={isToggling}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default CronJobList

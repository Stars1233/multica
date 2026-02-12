import { useCronJobsStore } from '../stores/cron-jobs'
import { CronJobList } from '../components/cron-job-list'

export default function CronsPage() {
  const { jobs, loading, error, toggleJob, removeJob, refresh } = useCronJobsStore()

  return (
    <div className="h-full overflow-auto">
    <div className="container flex flex-col p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-lg font-medium">Scheduled Tasks</h1>
        <p className="text-sm text-muted-foreground">
          Scheduled tasks run automatically at set times. Ask your agent to create one, like "remind me every morning" or "check my inbox daily."
        </p>
      </div>

      {/* Configuration Area */}
      <div className="flex-1 min-h-0">
        <CronJobList
          jobs={jobs}
          loading={loading}
          error={error}
          onToggleJob={toggleJob}
          onRemoveJob={removeJob}
          onRefresh={refresh}
        />
      </div>
    </div>
    </div>
  )
}

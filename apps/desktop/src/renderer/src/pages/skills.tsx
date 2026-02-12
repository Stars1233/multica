import { useSkillsStore } from '../stores/skills'
import { SkillList } from '../components/skill-list'

export default function SkillsPage() {
  const { skills, loading, error, toggleSkill, refresh } = useSkillsStore()

  return (
    <div className="h-full overflow-auto">
    <div className="container flex flex-col p-6">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-lg font-medium">Skills</h1>
        <p className="text-sm text-muted-foreground">
          Skills are modular capabilities that expand what your agent can do. You can also ask your agent to create new skills for you.
        </p>
      </div>

      {/* Configuration Area */}
      <div className="flex-1 min-h-0">
        <SkillList
          skills={skills}
          loading={loading}
          error={error}
          onToggleSkill={toggleSkill}
          onRefresh={refresh}
        />
      </div>
    </div>
    </div>
  )
}

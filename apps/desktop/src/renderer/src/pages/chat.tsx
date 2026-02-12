import { useSearchParams } from 'react-router-dom'
import { LocalChat } from '../components/local-chat'

export default function ChatPage() {
  const [searchParams] = useSearchParams()
  const initialPrompt = searchParams.get('prompt') ?? undefined

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <LocalChat initialPrompt={initialPrompt} />
    </div>
  )
}

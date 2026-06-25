import { VAForm } from '@/components/vas/VAForm'
import { signupVA } from '../actions'

export default function NewVAPage() {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h2 className="text-2xl font-semibold">Add Virtual Assistant</h2>
      <VAForm action={signupVA} />
    </div>
  )
}

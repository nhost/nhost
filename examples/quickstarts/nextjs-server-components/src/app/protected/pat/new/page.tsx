import PATForm from '@components/pat-form'

export default function NewPat() {
  return (
    <div className="flex flex-col max-w-3xl mx-auto space-y-4">
      <h2 className="text-xl">New Personal Access Token</h2>
      <PATForm />
    </div>
  )
}

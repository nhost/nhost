type SettingsBoxProps = {
  children: React.ReactNode
}

export function SettingsBox({ children }: SettingsBoxProps) {
  return <div className="max-w-xl mx-auto border border-gray-200 rounded p-6">{children}</div>
}

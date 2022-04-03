import { DatabaseIcon, ShieldCheckIcon } from '@heroicons/react/solid'

const features = [
  {
    title: 'Postgres',
    description: '',
    icon: DatabaseIcon,
    href: 'https://nhost.io'
  },
  {
    title: 'GraphQL',
    description: 'This is a description',
    icon: DatabaseIcon,
    href: 'https://nhost.io'
  },
  {
    title: 'Nhost Auth',
    description: 'User management is easy with Nhost Auth',
    icon: ShieldCheckIcon,
    href: 'https://nhost.io'
  },
  {
    title: 'Nhost Storage',
    description: 'File storage is easy with Nhost Storage',
    icon: DatabaseIcon,
    href: 'https://nhost.io'
  }
]

export function About() {
  return (
    <div className="my-12 max-w-5xl mx-auto grid grid-cols-3 gap-y-4 gap-x-8">
      {features.map((feature) => {
        return (
          <div className="flex gap-x-4">
            <div>
              <div className="bg-blue-500 p-2 rounded border border-blue-700">
                <feature.icon className="w-6 text-white" />
              </div>
            </div>
            <div>
              <div className="font-semibold">{feature.title}</div>
              <div className="text-sm text-gray-700">{feature.description}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export interface Meta {
  order: CategoryLink[]
}

export interface CategoryLink {
  id: string
  name: string
  description: string
  pages: Page[]
}

interface Page {
  route: string
  display: string
}

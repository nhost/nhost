export interface Author {
  name: string
  title: string
  avatarUrl: string
  url: string
}

export interface Article {
  title: string
  description: string
  image: string
  date: string
  authors: Author[]
  tags: string[]
  slug: string
}

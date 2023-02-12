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

export interface Customer {
  name: string
  website: {
    url: string
    display: string
  }
  description: string
  logo: {
    src: string
    width: number
    height: number
  }
  ogImage: {
    src: string
    width: number
    height: number
  }
  industry: string
  location: string
  timeToProduction: string
  problem: string
  solution: string
  slug: string
}

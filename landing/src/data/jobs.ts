export interface JobSection {
  heading: string
  items: string[]
}

export interface Job {
  slug: string
  title: string
  shortTitle: string
  department: string
  location: string
  type: string
  vacation: string
  summary: string
  about: string
  responsibilities: string[]
  requirements: string[]
  niceToHaves: string[]
  benefits: string[]
  closingNote: string
}

export const jobs: Job[] = [
  {
    slug: 'senior-software-engineer-backend-operations',
    title: 'Senior Software Engineer, Backend & Operations',
    shortTitle: 'Backend & Operations',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    vacation: '25-30 days',
    summary:
      'Design highly available, cloud-native systems and ship product features at the intersection of backend and infrastructure operations.',
    about:
      "Nhost is a remote-first company. While prior experience working remotely isn't required, we are looking for polyglot engineers who perform well given a high level of independence and autonomy. This role is at the intersection of product features, focusing on the backend, and infrastructure operations. This is an incredible opportunity to make a meaningful impact on the future of application development.",
    responsibilities: [
      'Design highly available, scalable, cloud-native systems that are easily observed and managed',
      'Provide ongoing maintenance and support of internal tools, improve system health and reliability',
      'Lay the groundwork for robust infrastructure monitoring and alerting',
      'Build new product features, focusing on the backend. For example, you might implement the backend of a new system for serving application logs and metrics',
      'Write code mostly in Go',
    ],
    requirements: [
      '4+ years of relevant experience developing, testing, and shipping well-engineered code (preferably with Go)',
      'Experience with testing, automating, operating, and troubleshooting production systems',
      'Experience deploying and operating containers and related technologies',
      'Experience designing and building REST APIs',
      'Excellent communication skills',
    ],
    niceToHaves: [
      'BSc or MSc in Computer Engineering, Computer Science or relevant field',
      'Experience building developer tools and open-source projects',
      'Experience with cloud providers, preferably AWS (EKS, RDS, Lambda, etc)',
      'Terraform or Pulumi as IaC',
      'Experience with PostgreSQL',
    ],
    benefits: [
      'A generous salary and equity package based on relevant experience',
      'The opportunity to disrupt the application development space',
      'Autonomy and ownership',
      'Remote',
      'Open and transparent company culture',
      'Equipment of choice, and yearly allowance for books and education',
    ],
    closingNote:
      "We believe that by equipping people with the best tools to solve their own problems, we can tackle the world's problems better, together.",
  },
  {
    slug: 'senior-software-engineer-frontend-product',
    title: 'Senior Software Engineer, Frontend & Product',
    shortTitle: 'Frontend & Product',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
    vacation: '25-30 days',
    summary:
      'Craft delightful user experiences across our React/TypeScript/GraphQL stack and shape the future of our product console.',
    about:
      "Nhost is a remote-first company. While prior experience working remotely isn't required, we are looking for polyglot engineers who perform well given a high level of independence and autonomy. This is an incredible opportunity to make a meaningful impact on the future of application development.",
    responsibilities: [
      'Build out our React/TypeScript/GraphQL stack',
      'Build an efficient and scalable front-end console (e.g., logs, metrics, DB view)',
      'Write clean, maintainable, and testable code',
      'Work with backend engineers to solve complex problems',
      'Collaborate closely with our designer to craft a product that delights our users',
      'Weigh in on our product roadmap',
      'Write code mostly in TypeScript/JavaScript',
    ],
    requirements: [
      '4+ years of relevant experience developing, testing, and shipping well-engineered code (preferably with TypeScript)',
      'Excellent understanding of JavaScript/TypeScript, CSS and HTML',
      'Experience with modern JavaScript application frameworks',
      'Previous experience working closely with designers, building flexible and composable libraries and components',
      'A customer-first mindset and an interest in talking with customers to make sure that we are building the right thing',
      'Excellent communication skills',
    ],
    niceToHaves: [
      'BSc or MSc in Computer Engineering, Computer Science or relevant field',
      'Experience building developer tools and open-source projects',
      'Experience with GraphQL with Hasura',
      'Experience with TypeScript, React and Tailwind CSS',
    ],
    benefits: [
      'A generous salary and equity package based on relevant experience',
      'The opportunity to disrupt the application development space',
      'Autonomy and ownership',
      'Remote',
      'Open and transparent company culture',
      'Equipment of choice, and yearly allowance for books and education',
    ],
    closingNote:
      "We believe that by equipping people with the best tools to solve their own problems, we can tackle the world's problems better, together.",
  },
]

export function getJobBySlug(slug: string): Job | undefined {
  return jobs.find((job) => job.slug === slug)
}

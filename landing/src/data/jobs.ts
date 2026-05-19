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
  {
    slug: 'developer-relations-engineer',
    title: 'Developer Relations Engineer',
    shortTitle: 'Developer Relations',
    department: 'Developer Relations',
    location: 'Remote',
    type: 'Full-time',
    vacation: '25-30 days',
    summary:
      'Help thousands of developers discover, learn, and ship with Nhost — through technical content, real-world demos, and a public voice the community trusts.',
    about:
      "Nhost is an early-stage, remote-first company building the developer platform that gives engineers and AI agents the fastest way to ship modern backends. We're looking for a Developer Relations Engineer who is equal parts builder and storyteller. You'll be one of the most visible voices in our community — producing technical content at a serious clip, shipping real apps on top of Nhost, and helping a global audience of developers go from curious to building in production. This isn't a plug-and-play role: you'll define what Nhost DevRel looks like, set the bar for technical content, and shape how we show up across YouTube, X, Discord, GitHub, and beyond.",
    responsibilities: [
      'Publish compelling technical content at a high cadence — videos, deep-dive posts, tutorials, and reference repos — that helps developers learn Nhost quickly',
      'Ship real-world apps on Nhost with Next.js, React, React Native, Flutter, GraphQL, and AI tooling. Write guides that others can follow and remix',
      'Represent Nhost publicly: conference talks, meetups, livestreams, podcasts, and Twitter Spaces',
      "Be active in our Discord and on GitHub — answer questions, celebrate community projects, and turn power users into advocates",
      "Close the loop with product and engineering: translate community signal — docs gaps, DX paper cuts, missing primitives — into roadmap input the team can act on",
      "Own the DevRel function end-to-end. You're the first dedicated DevRel hire: pick the channels that matter, set the strategy, build the muscle, and bring on teammates when the time is right",
      "Lead our developer story for AI agents and AI-native apps — build with our MCP server, ship agent-driven demos, and meet developers where AI dev tools are taking them",
      'Contribute back to our open-source repos. DevRel here ships code, not just decks — improve docs, examples, and SDKs alongside the engineering team',
    ],
    requirements: [
      '3+ years of relevant engineering experience (preferably with TypeScript/JavaScript)',
      'Strong frontend skills (React, Next.js) and comfort with PostgreSQL and GraphQL',
      'A track record of creating technical content — written, video, or both — that developers actually use',
      'Comfort representing a product publicly: on camera, on stage, on livestreams, and on social',
      "A strong bias toward shipping. You'd rather publish a working demo today than a perfect spec next month",
      'Excellent written and verbal communication',
    ],
    niceToHaves: [
      'An existing audience on YouTube, X, Twitch, or a well-read dev blog',
      'Prior DevRel, advocacy, or open-source maintainer experience',
      'Personal experience using Nhost, Supabase, Firebase, or similar backend platforms',
      'Familiarity with AI / agent dev tooling — LLMs, MCP, agentic frameworks',
    ],
    benefits: [
      'A generous salary and equity package based on relevant experience',
      'The opportunity to define what DevRel looks like at a fast-moving developer platform',
      'Autonomy and ownership — your fingerprints will be all over how Nhost shows up in the developer community',
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

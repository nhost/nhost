export interface Snippets {
  signUp?: string
  query?: string
  mutation?: string
  fileUpload?: string
}

export interface TechSnippets {
  javascript: Snippets
  vue: Snippets
  react: Snippets
  nextjs: Snippets
  flutter: Snippets
}

export const codeSnippets: TechSnippets = {
  javascript: {
    signUp: `await nhost.auth.signUp({
  email: 'joe@example.com',
  password: 'secret-password'
})`,
    query: `const CUSTOMERS = gql\`
  query {
    customers {
      id
      name
    }
  }
\`

const { data, error } = await nhost.graphql.request(CUSTOMERS)`,
    mutation: `const INSERT_CUSTOMER = gql\`
  mutation InsertCustomer($name: String!) {
    insertCustomer(object: { name: $name }) {
      id
      name
    }
  }
\`

const { data, error } = await nhost.graphql.request(INSERT_CUSTOMER, {
  variables: { name: "John Doe" }
})`,
    fileUpload: `await nhost.storage.upload({ file })`,
  },
  vue: {
    query: `import { useNhostClient } from '@nhost/vue'

const { nhost } = useNhostClient()

const CUSTOMERS = gql\`
  query {
    customers {
      id
      name
    }
  }
\`

const { data, error } = await nhost.graphql.request(CUSTOMERS)`,
    mutation: `import { useNhostClient } from '@nhost/vue'

const { nhost } = useNhostClient()

const INSERT_CUSTOMER = gql\`
  mutation InsertCustomer($name: String!) {
    insertCustomer(object: { name: $name }) {
      id
      name
    }
  }
\`

const { data, error } = await nhost.graphql.request(INSERT_CUSTOMER, {
  variables: { name: "John Doe" }
})`,
    signUp: `import { useSignUpEmailPassword } from '@nhost/vue'

const {
  signUpEmailPassword,
  needsEmailVerification,
  isLoading,
  isSuccess,
  isError,
  error
} = useSignUpEmailPassword()

async function handleSubmit(event) {
  event.preventDefault()

  await signUpEmailPassword(
    'joe@example.com',
    'secret-password'
  )
}`,
    fileUpload: `import { useFileUpload } from '@nhost/vue'

const {
  add,
  upload,
  cancel,
  isUploaded,
  isUploading,
  isError,
  progress,
  id,
  bucketId,
  name
} = useFileUpload()

async function handleSubmit(event) {
  event.preventDefault()

  await upload({ file })
}`,
  },
  react: {
    query: `import { useNhostClient } from '@nhost/react'

const nhost = useNhostClient()

const CUSTOMERS = gql\`
  query {
    customers {
      id
      name
    }
  }
\`

const { data, error } = await nhost.graphql.request(CUSTOMERS)`,
    mutation: `import { useNhostClient } from '@nhost/react'

const nhost = useNhostClient()

const INSERT_CUSTOMER = gql\`
  mutation InsertCustomer($name: String!) {
    insertCustomer(object: { name: $name }) {
      id
      name
    }
  }
\`

const { data, error } = await nhost.graphql.request(INSERT_CUSTOMER, {
  variables: { name: "John Doe" }
})`,
    signUp: `import { useSignUpEmailPassword } from '@nhost/react'

const {
  signUpEmailPassword,
  needsEmailVerification,
  isLoading,
  isSuccess,
  isError,
  error
} = useSignUpEmailPassword()

async function handleSubmit(event) {
  event.preventDefault()

  await signUpEmailPassword(
    'joe@example.com',
    'secret-password'
  )
}`,
    fileUpload: `import { useFileUpload } from '@nhost/react'

const {
  add,
  upload,
  cancel,
  isUploaded,
  isUploading,
  isError,
  progress,
  id,
  bucketId,
  name
} = useFileUpload()

async function handleSubmit(event) {
  event.preventDefault()

  await upload({ file })
}`,
  },
  nextjs: {
    query: `import { useNhostClient } from '@nhost/nextjs'

const nhost = useNhostClient()

const CUSTOMERS = gql\`
  query {
    customers {
      id
      name
    }
  }
\`

const { data, error } = await nhost.graphql.request(CUSTOMERS)`,
    mutation: `import { useNhostClient } from '@nhost/nextjs'

const nhost = useNhostClient()

const INSERT_CUSTOMER = gql\`
  mutation InsertCustomer($name: String!) {
    insertCustomer(object: { name: $name }) {
      id
      name
    }
  }
\`

const { data, error } = await nhost.graphql.request(INSERT_CUSTOMER, {
  variables: { name: "John Doe" }
})`,
    signUp: `import { useSignUpEmailPassword } from '@nhost/nextjs'

const {
  signUpEmailPassword,
  needsEmailVerification,
  isLoading,
  isSuccess,
  isError,
  error
} = useSignUpEmailPassword()

async function handleSubmit(event) {
  event.preventDefault()

  await signUpEmailPassword(
    'joe@example.com',
    'secret-password'
  )
}`,
    fileUpload: `import { useFileUpload } from '@nhost/nextjs'

const {
  add,
  upload,
  cancel,
  isUploaded,
  isUploading,
  isError,
  progress,
  id,
  bucketId,
  name
} = useFileUpload()

async function handleSubmit(event) {
  event.preventDefault()

  await upload({ file })
}`,
  },
  flutter: {},
}

import axios, { AxiosError } from 'axios'
export const hasuraClient = axios.create({
  baseURL: process.env.NHOST_BACKEND_URL,
  headers: { 'x-hasura-admin-secret': process.env.NHOST_ADMIN_SECRET! }
})

axios.interceptors.response.use(
  (response) => response,
  (err) => {
    const error = err as AxiosError
    if (error.response) {
      console.warn(error.response.data)
      console.warn(error.response.status)
      console.warn(error.response.headers)
    } else if (error.request) {
      console.warn(error.request)
    } else {
      console.warn(error.message)
    }
    throw new Error('Impossible to create scheduled event')
  }
)

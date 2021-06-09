import React from 'react'
import { Helmet } from 'react-helmet-async'

import AuthGate from '../components/auth-gate'
import Dashboard from '../components/app/dashboard'

export default function Home(props) {
  return (
    <AuthGate>
      <Dashboard />
    </AuthGate>
  )
}

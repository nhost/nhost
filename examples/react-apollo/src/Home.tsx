import React from 'react'
import { Panel } from 'rsuite'

const HomePage: React.FC = () => {
  return (
    <Panel header="Home page" bordered>
      You are authenticated. You have now access to the authorised part of the application.
    </Panel>
  )
}
export default HomePage

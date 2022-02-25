import { useAuthenticated } from '@nhost/react'
import { NavLink } from 'react-router-dom'
import { Button, FlexboxGrid, Panel } from 'rsuite'

const HomePage: React.FC = () => {
  const isAuthenticated = useAuthenticated()
  return (
    <Panel header="Home page" bordered>
      {!isAuthenticated && (
        <FlexboxGrid justify="center">
          <FlexboxGrid.Item colspan={12}>
            <Panel>
              <Button as={NavLink} to="/sign-in" block appearance="primary">
                Sign-in
              </Button>
              <Button as={NavLink} to="/sign-up" block appearance="primary">
                Sign-up
              </Button>
            </Panel>
          </FlexboxGrid.Item>
        </FlexboxGrid>
      )}
      <p>This application demonstrates the available features of the Nhost stack.</p>
      <p>
        Nhost cloud leverages the following services in the backend:
        <ul>
          <li>Hasura</li>
          <li>Hasura Auth</li>
          <li>Hasura Storage</li>
          <li>Custom functions</li>
        </ul>
      </p>
      <p>
        This frontend is built with the following technologies:
        <ul>
          <li>React</li>
          <li>React-router</li>
          <li>RSuite</li>
          <li>...and of course, the Nhost React client</li>
        </ul>
      </p>
    </Panel>
  )
}
export default HomePage

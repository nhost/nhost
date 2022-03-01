import decode from 'jwt-decode'
import ReactJson from 'react-json-view'
import { Col, Panel, Row } from 'rsuite'
import { useAccessToken, useUserData } from '@nhost/react'

import { ChangeEmail } from './change-email'
import { ChangePassword } from './change-password'

export const ProfilePage: React.FC = () => {
  const jwt = useAccessToken()
  const userData = useUserData()
  return (
    <Panel header="Profile page" bordered>
      <Row>
        <Col md={12} sm={24}>
          <ChangeEmail />
        </Col>
        <Col md={12} sm={24}>
          <ChangePassword />
        </Col>
        <Col md={12} sm={24}>
          <Panel header="User information" bordered>
            {userData && (
              <ReactJson
                src={userData}
                displayDataTypes={false}
                displayObjectSize={false}
                enableClipboard={false}
                name={false}
              />
            )}
          </Panel>
        </Col>
        <Col md={12} sm={24}>
          <Panel header="JWT" bordered>
            {jwt && (
              <ReactJson
                src={decode(jwt)}
                displayDataTypes={false}
                displayObjectSize={false}
                enableClipboard={false}
                name={false}
              />
            )}
          </Panel>
        </Col>
      </Row>
    </Panel>
  )
}

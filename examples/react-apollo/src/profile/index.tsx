import { useAccessToken } from '@nhost/react'
import { Col, Panel, Row } from 'rsuite'
import { ChangeEmail } from './change-email'
import { ChangePassword } from './change-password'

export const ProfilePage: React.FC = () => {
  const jwt = useAccessToken()

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
          <Panel header="TOTP" bordered></Panel>
        </Col>
        <Col md={12} sm={24}>
          <Panel header="JWT" bordered>
            <div style={{ overflowWrap: 'break-word' }}>{jwt}</div>
          </Panel>
        </Col>
      </Row>
    </Panel>
  )
}

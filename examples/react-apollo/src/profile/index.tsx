import { useChangeEmail, useChangePassword, useAccessToken } from '@nhost/react'
import { Col, Panel, Row } from 'rsuite'

export const ProfilePage: React.FC = () => {
  const { changeEmail, ...changeEmailResult } = useChangeEmail('bidon@bidon.com')
  const { changePassword } = useChangePassword('12345678')
  const jwt = useAccessToken()

  return (
    <Panel header="Profile page" bordered>
      <Row>
        <Col md={12} sm={24}>
          <Panel header="Change email" bordered></Panel>
        </Col>
        <Col md={12} sm={24}>
          <Panel header="Change password" bordered></Panel>
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

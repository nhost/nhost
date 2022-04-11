import decode from 'jwt-decode'
import React from 'react'
import ReactJson from 'react-json-view'
import { Button, Col, Panel, Row } from 'rsuite'

import { useAccessToken, useNhostClient, useUserData } from '@nhost/react'

import { ChangeEmail } from './change-email'
import { ChangePassword } from './change-password'
import { Mfa } from './mfa'

export const ProfilePage: React.FC = () => {
  const accessToken = useAccessToken()
  const userData = useUserData()
  const nhost = useNhostClient()
  return (
    <Panel header="Profile page" bordered>
      <Row>
        <Col md={12} sm={24}>
          <Mfa />
        </Col>
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
            <Button block appearance="primary" onClick={() => nhost.auth.refreshSession()}>
              Refresh session
            </Button>
            {accessToken && (
              <ReactJson
                src={decode(accessToken)}
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

import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Row,
  Section,
  Text,
} from '@react-email/components';
import * as React from 'react';

const logo = {
  borderRadius: 0,
  width: 20,
  height: 20,
};

const main = {
  backgroundColor: '#f5f5f5',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
};

const container = {
  margin: '20px auto 0 auto',
  padding: '20px',
  maxWidth: '560px',
  backgroundColor: '#ffffff',
  borderRadius: 8,
  border: '1px solid #ececec',
};

const heading = {
  fontSize: '24px',
  letterSpacing: '-0.5px',
  lineHeight: '1.3',
  fontWeight: '400',
  color: '#484848',
  marginTop: 0,
};

const paragraph = {
  margin: '0 0 10px',
  fontSize: '15px',
  lineHeight: '1.4',
  color: '#3c4149',
};

const buttonContainer = {
  padding: '10px 0 0px',
};

const button = {
  backgroundColor: '#0052CD',
  borderRadius: '3px',
  fontWeight: '600',
  color: '#fff',
  fontSize: '15px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '11px 23px',
};

const reportLink = {
  fontSize: '14px',
  color: '#b4becc',
};

const hr = {
  borderColor: '#dfe1e4',
  margin: '20px 0 20px',
};

const logoColumn = {
  width: '30px',
};

const linkColumn = {
  margin: 0,
};

export function EmailVerify() {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Verify Email</Heading>
          <Text style={paragraph}>Use this link to verify your email:</Text>
          <Section style={buttonContainer}>
            <Button style={button} href="${link}">
              Verify Email
            </Button>
          </Section>
          <Hr style={hr} />
          <Section>
            <Row>
              <Column style={logoColumn}>
                <Img
                  src="https://nhost.io/images/emails/icon.png"
                  width="20"
                  height="20"
                  alt="Nhost Logo"
                  style={logo}
                />
              </Column>
              <Column style={linkColumn}>
                <Link href="https://nhost.io" style={reportLink}>
                  Powered by Nhost
                </Link>
              </Column>
            </Row>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default EmailVerify;

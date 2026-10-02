import {
  Body,
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

const codeContainer = {
  padding: '10px 0 0px',
};

const code = {
  fontSize: '24px',
  lineHeight: '32px',
  margin: '16px 0',
  color: '#0052cd',
  fontWeight: '600',
};

const note = {
  ...paragraph,
  marginTop: '16px',
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

export function SignInOTP() {
  const ticket = '${ticket}';

  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Your verification code</Heading>
          <Text style={paragraph}>Use the following code to continue:</Text>
          <Section style={codeContainer}>
            <Text style={code}>{ticket}</Text>
          </Section>
          <Text style={note}>
            This code expires in 10 minutes. If you did not request it, you can
            ignore this email.
          </Text>
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

export default SignInOTP;

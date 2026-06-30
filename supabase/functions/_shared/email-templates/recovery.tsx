/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your {siteName} password</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandHeader}>
          <Text style={brandMark}>Rent &amp; Radiate</Text>
          <Text style={brandTag}>Rent it. Wear it. Radiate.</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Reset your password</Heading>
          <Text style={text}>
            We received a request to reset the password for your {siteName}{' '}
            account. Tap the button below to choose a new one.
          </Text>
          <Section style={{ textAlign: 'center' as const, margin: '28px 0' }}>
            <Button style={button} href={confirmationUrl}>
              Reset password
            </Button>
          </Section>
          <Text style={textMuted}>
            Or paste this link into your browser:
            <br />
            <Link href={confirmationUrl} style={linkSmall}>
              {confirmationUrl}
            </Link>
          </Text>
        </Section>
        <Hr style={hr} />
        <Text style={footer}>
          Didn't request a reset? Ignore this email — your password stays the same.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = {
  backgroundColor: '#ffffff',
  fontFamily: "'Karla', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  color: '#2e1a23',
}
const container = { padding: '24px 24px 40px', maxWidth: '560px' }
const brandHeader = { textAlign: 'center' as const, padding: '8px 0 24px' }
const brandMark = {
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: '28px',
  fontWeight: 600 as const,
  letterSpacing: '0.5px',
  color: '#d94677',
  margin: 0,
}
const brandTag = {
  fontSize: '12px',
  letterSpacing: '2px',
  textTransform: 'uppercase' as const,
  color: '#7a6970',
  margin: '4px 0 0',
}
const card = {
  background: 'linear-gradient(180deg, #fff7fa 0%, #ffffff 100%)',
  border: '1px solid #f6dde6',
  borderRadius: '12px',
  padding: '32px 28px',
}
const h1 = {
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: '26px',
  fontWeight: 600 as const,
  color: '#2e1a23',
  margin: '0 0 16px',
}
const text = { fontSize: '15px', color: '#3d2730', lineHeight: '1.6', margin: '0 0 16px' }
const textMuted = {
  fontSize: '12px',
  color: '#7a6970',
  lineHeight: '1.5',
  margin: '16px 0 0',
  wordBreak: 'break-all' as const,
}
const linkSmall = { color: '#d94677', textDecoration: 'underline', fontSize: '12px' }
const button = {
  backgroundColor: '#d94677',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600 as const,
  borderRadius: '12px',
  padding: '13px 28px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#f6dde6', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#7a6970', margin: 0, textAlign: 'center' as const }

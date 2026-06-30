/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Rent & Radiate verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={brandHeader}>
          <Text style={brandMark}>Rent &amp; Radiate</Text>
          <Text style={brandTag}>Rent it. Wear it. Radiate.</Text>
        </Section>
        <Section style={card}>
          <Heading style={h1}>Confirm it's you</Heading>
          <Text style={text}>
            Use the code below to confirm your identity. It expires shortly.
          </Text>
          <Text style={codeStyle}>{token}</Text>
        </Section>
        <Hr style={hr} />
        <Text style={footer}>
          Didn't request this code? You can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

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
  textAlign: 'center' as const,
}
const h1 = {
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: '26px',
  fontWeight: 600 as const,
  color: '#2e1a23',
  margin: '0 0 16px',
}
const text = { fontSize: '15px', color: '#3d2730', lineHeight: '1.6', margin: '0 0 16px' }
const codeStyle = {
  fontFamily: "'Courier New', Courier, monospace",
  fontSize: '32px',
  fontWeight: 700 as const,
  letterSpacing: '8px',
  color: '#d94677',
  background: '#fff0f5',
  border: '1px dashed #f6c4d4',
  borderRadius: '12px',
  padding: '16px 20px',
  margin: '8px 0 0',
}
const hr = { borderColor: '#f6dde6', margin: '24px 0' }
const footer = { fontSize: '12px', color: '#7a6970', margin: 0, textAlign: 'center' as const }

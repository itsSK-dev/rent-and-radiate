import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Rent & Radiate'

interface SecurityAlertProps {
  eventType?: string
  severity?: string
  summary?: string
  actorEmail?: string
  actorUserId?: string
  ip?: string
  userAgent?: string
  occurredAt?: string
  metadataJson?: string
  adminUrl?: string
}

const SecurityAlertEmail = ({
  eventType = 'security_event',
  severity = 'high',
  summary,
  actorEmail,
  actorUserId,
  ip,
  userAgent,
  occurredAt,
  metadataJson,
  adminUrl,
}: SecurityAlertProps) => {
  const sev = severity.toUpperCase()
  const isCritical = severity === 'critical'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>[{sev}] {eventType} — {summary || 'Security event detected'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={{ ...banner, backgroundColor: isCritical ? '#7f1d1d' : '#9d174d' }}>
            <Text style={bannerText}>⚠ {sev} SECURITY ALERT</Text>
          </Section>
          <Heading style={h1}>{eventType.replace(/_/g, ' ')}</Heading>
          {summary && <Text style={statusBox}>{summary}</Text>}
          <Section style={detailsBox}>
            {occurredAt && <Text style={detailLine}><strong>When:</strong> {occurredAt}</Text>}
            {actorEmail && <Text style={detailLine}><strong>Actor email:</strong> {actorEmail}</Text>}
            {actorUserId && <Text style={detailLine}><strong>Actor user ID:</strong> {actorUserId}</Text>}
            {ip && <Text style={detailLine}><strong>IP:</strong> {ip}</Text>}
            {userAgent && <Text style={detailLine}><strong>User agent:</strong> {userAgent}</Text>}
          </Section>
          {metadataJson && (
            <Section style={codeBox}>
              <Text style={codeText}>{metadataJson}</Text>
            </Section>
          )}
          {adminUrl && (
            <Text style={text}>
              Review in the admin dashboard: <a href={adminUrl} style={link}>{adminUrl}</a>
            </Text>
          )}
          <Hr style={hr} />
          <Text style={footer}>{SITE_NAME} — automated security monitoring</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: SecurityAlertEmail,
  subject: (d: Record<string, any>) =>
    `[${String(d.severity || 'high').toUpperCase()}] Security alert: ${d.eventType || 'event'}`,
  displayName: 'Security alert',
  previewData: {
    eventType: 'payment_invalid_signature',
    severity: 'high',
    summary: 'HMAC signature mismatch on payment verification',
    actorEmail: 'user@example.com',
    actorUserId: 'abc-123',
    ip: '203.0.113.4',
    userAgent: 'Mozilla/5.0',
    occurredAt: new Date().toISOString(),
    metadataJson: '{\n  "rental_id": "..."\n}',
    adminUrl: 'https://rent-and-radiate.lovable.app/admin',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '600px', margin: '0 auto' }
const banner = { padding: '12px 16px', borderRadius: '10px', margin: '0 0 18px' }
const bannerText = { color: '#ffffff', fontSize: '13px', fontWeight: '700', margin: 0, letterSpacing: '0.06em' }
const h1 = { fontSize: '20px', fontWeight: '700', color: '#1a1a1a', margin: '0 0 14px', textTransform: 'capitalize' as const }
const text = { fontSize: '14px', color: '#444', lineHeight: '1.6', margin: '10px 0' }
const statusBox = { fontSize: '14px', color: '#7f1d1d', backgroundColor: '#fef2f2', padding: '12px 14px', borderRadius: '10px', margin: '0 0 16px', border: '1px solid #fecaca' }
const detailsBox = { backgroundColor: '#fafafa', border: '1px solid #eee', borderRadius: '10px', padding: '14px', margin: '8px 0 12px' }
const detailLine = { fontSize: '13px', color: '#333', margin: '4px 0' }
const codeBox = { backgroundColor: '#0f172a', borderRadius: '10px', padding: '14px', margin: '10px 0' }
const codeText = { fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12px', color: '#e2e8f0', whiteSpace: 'pre-wrap' as const, margin: 0 }
const link = { color: '#9d174d', textDecoration: 'underline' }
const hr = { border: 'none', borderTop: '1px solid #eee', margin: '24px 0 14px' }
const footer = { fontSize: '12px', color: '#999', margin: '0' }

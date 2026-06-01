import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Rent & Radiate'

interface StatusUpdateProps {
  recipientName?: string
  headline?: string
  statusLine?: string
  message?: string
  productTitle?: string
  storeName?: string
  orderId?: string
  ctaUrl?: string
  ctaLabel?: string
}

const StatusUpdateEmail = ({
  recipientName,
  headline = 'Order update',
  statusLine,
  message,
  productTitle,
  storeName,
  orderId,
  ctaUrl,
  ctaLabel = 'View order',
}: StatusUpdateProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{statusLine || headline}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{headline}</Heading>
        {recipientName && <Text style={text}>Hi {recipientName},</Text>}
        {statusLine && <Text style={statusBox}>{statusLine}</Text>}
        {message && <Text style={text}>{message}</Text>}
        {(productTitle || storeName || orderId) && (
          <Section style={detailsBox}>
            {productTitle && <Text style={detailLine}><strong>Item:</strong> {productTitle}</Text>}
            {storeName && <Text style={detailLine}><strong>Store:</strong> {storeName}</Text>}
            {orderId && <Text style={detailLine}><strong>Order ID:</strong> {orderId}</Text>}
          </Section>
        )}
        {ctaUrl && (
          <Section style={{ textAlign: 'center', margin: '28px 0' }}>
            <Button href={ctaUrl} style={button}>{ctaLabel}</Button>
          </Section>
        )}
        <Hr style={hr} />
        <Text style={footer}>— The {SITE_NAME} team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: StatusUpdateEmail,
  subject: (d: Record<string, any>) => d.headline || 'Order update',
  displayName: 'Order status update',
  previewData: {
    recipientName: 'Jane',
    headline: 'Your rental is out for delivery',
    statusLine: 'Status: Out for delivery',
    message: 'Your order is on its way. Track it for live updates.',
    productTitle: 'Floral evening gown',
    storeName: 'Glamour Closet',
    orderId: 'abc-123',
    ctaUrl: 'https://example.com',
    ctaLabel: 'Track order',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '24px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: '700', color: '#1a1a1a', margin: '0 0 18px' }
const text = { fontSize: '14px', color: '#444', lineHeight: '1.6', margin: '0 0 14px' }
const statusBox = { fontSize: '15px', fontWeight: '600', color: '#9d174d', backgroundColor: '#fdf2f8', padding: '12px 14px', borderRadius: '10px', margin: '0 0 16px' }
const detailsBox = { backgroundColor: '#fafafa', border: '1px solid #eee', borderRadius: '10px', padding: '14px', margin: '8px 0 12px' }
const detailLine = { fontSize: '13px', color: '#333', margin: '4px 0' }
const button = { backgroundColor: '#9d174d', color: '#ffffff', padding: '12px 22px', borderRadius: '8px', textDecoration: 'none', fontSize: '14px', fontWeight: '600' }
const hr = { border: 'none', borderTop: '1px solid #eee', margin: '24px 0 14px' }
const footer = { fontSize: '12px', color: '#999', margin: '0' }

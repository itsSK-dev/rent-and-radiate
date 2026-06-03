import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

interface Recipient { email: string; name?: string }

// Allow-list of event keys. Keeps headlines/messages from being injected arbitrarily.
const ALLOWED_EVENT_PREFIXES = [
  'order-', 'rental-', 'delivery-', 'return-', 'extension-', 'refund-', 'dispute-', 'payment-',
]

function isAllowedEventKey(key: string) {
  return ALLOWED_EVENT_PREFIXES.some((p) => key.startsWith(p))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // --- Auth: identify the caller ---
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return json({ error: 'Unauthorized' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const admin = createClient(supabaseUrl, serviceKey)

  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token)
  if (claimsErr || !claimsData?.claims) return json({ error: 'Unauthorized' }, 401)

  const callerRole = (claimsData.claims as any).role as string | undefined
  const callerId = (claimsData.claims as any).sub as string | undefined
  const isServiceRole = callerRole === 'service_role'

  let body: any
  try { body = await req.json() } catch {
    return json({ error: 'Invalid JSON' }, 400)
  }

  const {
    rentalId,
    eventKey,
    headline,
    statusLine,
    message,
    audience = ['customer', 'store'],
  } = body ?? {}

  if (!rentalId || !eventKey || !headline) {
    return json({ error: 'rentalId, eventKey and headline are required' }, 400)
  }
  if (typeof eventKey !== 'string' || !isAllowedEventKey(eventKey)) {
    return json({ error: 'invalid eventKey' }, 400)
  }
  if (typeof headline !== 'string' || headline.length > 140) {
    return json({ error: 'invalid headline' }, 400)
  }
  if (statusLine && (typeof statusLine !== 'string' || statusLine.length > 200)) {
    return json({ error: 'invalid statusLine' }, 400)
  }
  if (message && (typeof message !== 'string' || message.length > 1000)) {
    return json({ error: 'invalid message' }, 400)
  }

  const { data: rental, error: rErr } = await admin
    .from('rentals')
    .select('id, customer_id, store_id, product:products(title), store:stores(name, owner_id)')
    .eq('id', rentalId)
    .maybeSingle()

  if (rErr || !rental) return json({ error: 'Rental not found' }, 404)

  // --- Authorization: only admins, store owner of the rental, or service-role calls ---
  if (!isServiceRole) {
    if (!callerId) return json({ error: 'Forbidden' }, 403)
    const { data: isAdminData } = await admin.rpc('has_role', {
      _user_id: callerId, _role: 'admin',
    })
    const isAdmin = isAdminData === true
    const isStoreOwner = (rental as any).store?.owner_id === callerId
    if (!isAdmin && !isStoreOwner) {
      return json({ error: 'Forbidden' }, 403)
    }
  }

  const recipients: { kind: string; rec: Recipient }[] = []

  async function emailFor(userId: string): Promise<Recipient | null> {
    if (!userId) return null
    const { data, error } = await (admin as any).auth.admin.getUserById(userId)
    if (error || !data?.user?.email) return null
    const { data: prof } = await admin.from('profiles').select('full_name').eq('id', userId).maybeSingle()
    return { email: data.user.email, name: (prof as any)?.full_name || undefined }
  }

  if (audience.includes('customer')) {
    const r = await emailFor(rental.customer_id)
    if (r) recipients.push({ kind: 'customer', rec: r })
  }
  if (audience.includes('store') && (rental as any).store?.owner_id) {
    const r = await emailFor((rental as any).store.owner_id)
    if (r) recipients.push({ kind: 'store', rec: r })
  }

  const sent: any[] = []

  for (const { kind, rec } of recipients) {
    const templateData = {
      recipientName: rec.name,
      headline,
      statusLine,
      message: kind === 'store'
        ? (message ? `Customer update: ${message}` : `Action update for order ${rental.id.slice(0,8)}.`)
        : message,
      productTitle: (rental as any).product?.title,
      storeName: (rental as any).store?.name,
      orderId: rental.id.slice(0, 8),
    }
    const idempotencyKey = `rental-${rental.id}-${eventKey}-${kind}`
    // Invoke send-transactional-email using the service-role client so it
    // passes the service-role JWT (required by that function's role check).
    const { data, error } = await admin.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'status-update',
        recipientEmail: rec.email,
        idempotencyKey,
        templateData,
      },
    })
    sent.push({ kind, email: rec.email, ok: !error, error: error?.message, data })
  }

  return json({ ok: true, sent })

  function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

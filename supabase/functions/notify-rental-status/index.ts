import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

interface Recipient { email: string; name?: string }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

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
    audience = ['customer', 'store'], // who to notify
  } = body ?? {}

  if (!rentalId || !eventKey || !headline) {
    return json({ error: 'rentalId, eventKey and headline are required' }, 400)
  }

  // Fetch rental + related info
  const { data: rental, error: rErr } = await supabase
    .from('rentals')
    .select('id, customer_id, store_id, product:products(title), store:stores(name, owner_id)')
    .eq('id', rentalId)
    .maybeSingle()

  if (rErr || !rental) return json({ error: 'Rental not found' }, 404)

  const recipients: { kind: string; rec: Recipient }[] = []

  async function emailFor(userId: string): Promise<Recipient | null> {
    if (!userId) return null
    const { data, error } = await (supabase as any).auth.admin.getUserById(userId)
    if (error || !data?.user?.email) return null
    const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle()
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

  const ctaUrl = `${new URL(req.url).origin.replace('/functions/v1', '')}` // not used; we let template be simple
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
    const { data, error } = await supabase.functions.invoke('send-transactional-email', {
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

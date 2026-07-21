import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Require caller to be either service_role or an authenticated admin.
    const authHeader = req.headers.get('Authorization') ?? ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) {
      return json({ error: 'Unauthorized' }, 401)
    }
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    let authorized = token === serviceRoleKey
    if (!authorized) {
      const { data: claimsData, error: claimsErr } = await admin.auth.getClaims(token)
      const uid = claimsData?.claims?.sub
      if (claimsErr || !uid) {
        return json({ error: 'Unauthorized' }, 401)
      }
      const { data: roleRow } = await admin
        .from('user_roles')
        .select('user_id')
        .eq('user_id', uid)
        .eq('role', 'admin')
        .maybeSingle()
      authorized = !!roleRow
    }
    if (!authorized) {
      return json({ error: 'Forbidden' }, 403)
    }

    const body = await req.json().catch(() => ({}))
    const { event_id } = body ?? {}
    if (!event_id) return json({ error: 'event_id required' }, 400)


    const { data: event, error: evErr } = await admin
      .from('security_events')
      .select('*')
      .eq('id', event_id)
      .maybeSingle()
    if (evErr || !event) return json({ error: 'event not found' }, 404)

    if (!['high', 'critical'].includes(event.severity)) {
      return json({ ok: true, skipped: 'severity below threshold' })
    }
    if (event.notified_at) {
      return json({ ok: true, skipped: 'already notified' })
    }

    // Look up admin recipients
    const { data: adminRoles } = await admin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'admin')
    const adminIds = (adminRoles ?? []).map((r: any) => r.user_id)

    if (adminIds.length === 0) {
      await admin.from('security_events').update({
        notified_at: new Date().toISOString(),
        notification_status: 'no_admins',
      }).eq('id', event_id)
      return json({ ok: true, skipped: 'no admins' })
    }

    // Fetch admin emails from auth.users via admin API
    const emails: string[] = []
    for (const uid of adminIds) {
      const { data } = await admin.auth.admin.getUserById(uid)
      const em = data?.user?.email
      if (em) emails.push(em)
    }
    const uniqueEmails = Array.from(new Set(emails))

    if (uniqueEmails.length === 0) {
      await admin.from('security_events').update({
        notified_at: new Date().toISOString(),
        notification_status: 'no_admin_emails',
      }).eq('id', event_id)
      return json({ ok: true, skipped: 'no admin emails' })
    }

    const metadataJson = event.metadata
      ? JSON.stringify(event.metadata, null, 2).slice(0, 4000)
      : undefined

    const results: Array<{ email: string; ok: boolean; error?: string }> = []
    for (const email of uniqueEmails) {
      const { error } = await admin.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'security-alert',
          recipientEmail: email,
          idempotencyKey: `security-alert-${event_id}-${email}`,
          templateData: {
            eventType: event.event_type,
            severity: event.severity,
            summary: event.summary,
            actorEmail: event.actor_email,
            actorUserId: event.actor_user_id,
            ip: event.ip,
            userAgent: event.user_agent,
            occurredAt: event.created_at,
            metadataJson,
            adminUrl: (Deno.env.get('APP_URL') ?? 'https://rent-and-radiate.lovable.app') + '/admin',
          },
        },
      })
      results.push({ email, ok: !error, error: error?.message })
    }

    const anySent = results.some((r) => r.ok)
    await admin.from('security_events').update({
      notified_at: new Date().toISOString(),
      notification_status: anySent ? 'sent' : 'failed',
      metadata: { ...(event.metadata ?? {}), _notify: results },
    }).eq('id', event_id)

    return json({ ok: true, results })
  } catch (e) {
    console.error('alert-security-event error:', e)
    return json({ error: (e as Error).message }, 500)
  }
})

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

import 'server-only'
import { supabaseService } from '@/lib/supabase/server'
import { renderTemplate, type TemplateKey } from './templates'

export interface SendResult {
  ok: boolean
  channel: 'in_app' | 'whatsapp'
  providerId?: string
  error?: string
}

export interface NotificationProvider {
  send(to: string, template: TemplateKey, payload: Record<string, unknown>): Promise<SendResult>
}

/**
 * Every notification row is written inside the database, by the same security-definer
 * function or trigger that caused the event — so the in-app thread is complete before
 * any provider is consulted, and stays complete if a provider fails. What a provider
 * does is deliver the row it is handed and record what happened to it.
 *
 * That is the invariant the spec asks for, stated the strongest way available: the row
 * is not written *by* the provider, it is written *before* the provider, by the
 * transaction that made it true.
 */

interface QueuedRow {
  id: string
  recipient_id: string
  template: string
  payload: Record<string, unknown>
}

async function markRow(
  id: string,
  status: 'sent' | 'failed',
  channel: 'in_app' | 'whatsapp',
  patch: Record<string, unknown> = {},
) {
  const supabase = supabaseService()
  const { data: existing } = await supabase
    .from('notifications').select('payload').eq('id', id).maybeSingle()
  await supabase
    .from('notifications')
    .update({
      status,
      channel,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
      payload: { ...((existing?.payload as Record<string, unknown>) ?? {}), ...patch },
    })
    .eq('id', id)
}

class InAppProvider implements NotificationProvider {
  async send(to: string, template: TemplateKey, payload: Record<string, unknown>) {
    const supabase = supabaseService()
    const { data, error } = await supabase
      .from('notifications')
      .insert({ recipient_id: to, channel: 'in_app', template, payload,
                status: 'sent', sent_at: new Date().toISOString() })
      .select('id').maybeSingle()
    if (error) return { ok: false, channel: 'in_app' as const, error: error.message }
    return { ok: true, channel: 'in_app' as const, providerId: data?.id }
  }

  async deliver(row: QueuedRow) {
    await markRow(row.id, 'sent', 'in_app')
    return { ok: true, channel: 'in_app' as const }
  }
}

/**
 * The sandbox rate-limits to one message every three seconds and silently drops
 * anything faster. Accepting an enquiry notifies parent and trainer, and approving a
 * category notifies a third party — naive code sends those in a loop and loses two of
 * them, so sends are serialised through a chain with a gap.
 */
class TwilioWhatsAppProvider implements NotificationProvider {
  private chain: Promise<unknown> = Promise.resolve()
  private static readonly GAP_MS = 3200

  private enqueue<T>(job: () => Promise<T>): Promise<T> {
    const run = this.chain.then(job, job)
    this.chain = run.then(
      () => new Promise((r) => setTimeout(r, TwilioWhatsAppProvider.GAP_MS)),
      () => new Promise((r) => setTimeout(r, TwilioWhatsAppProvider.GAP_MS)),
    )
    return run
  }

  async send(to: string, template: TemplateKey, payload: Record<string, unknown>) {
    const supabase = supabaseService()
    const { data } = await supabase
      .from('notifications')
      .insert({ recipient_id: to, channel: 'whatsapp', template, payload, status: 'queued' })
      .select('id').maybeSingle()
    if (!data?.id) return { ok: false, channel: 'whatsapp' as const, error: 'could not record row' }
    return this.deliver({ id: data.id, recipient_id: to, template, payload })
  }

  async deliver(row: QueuedRow): Promise<SendResult> {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886'

    const supabase = supabaseService()
    const { data: profile } = await supabase
      .from('profiles').select('phone').eq('id', row.recipient_id).maybeSingle()
    const phone = profile?.phone as string | undefined

    if (!sid || !token || !phone) {
      const error = !phone ? 'Recipient has no phone number' : 'Twilio credentials are not set'
      await markRow(row.id, 'failed', 'whatsapp', { error })
      return { ok: false, channel: 'whatsapp', error }
    }

    const { title, body } = renderTemplate(row.template, row.payload)
    const text = `*${title}*\n${body}`

    return this.enqueue(async () => {
      try {
        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: 'POST',
          headers: {
            Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({ From: from, To: `whatsapp:${phone}`, Body: text }),
        })
        const json = (await res.json()) as { sid?: string; status?: string; message?: string; code?: number }

        if (!res.ok) {
          // 63015 is "recipient has not joined the sandbox" — the join expires after
          // three days, which is the single most likely thing to break a demo. Record
          // it verbatim so the admin screen can say so instead of guessing.
          const error = json.code === 63015
            ? 'Recipient has not joined the WhatsApp sandbox (63015). Send "join <keyword>" to +1 415 523 8886 and try again.'
            : (json.message ?? `Twilio returned ${res.status}`)
          await markRow(row.id, 'failed', 'whatsapp', { twilio_code: json.code, error })
          return { ok: false, channel: 'whatsapp' as const, error }
        }

        await markRow(row.id, 'sent', 'whatsapp',
                      { message_sid: json.sid, twilio_status: json.status })
        return { ok: true, channel: 'whatsapp' as const, providerId: json.sid }
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        await markRow(row.id, 'failed', 'whatsapp', { error })
        return { ok: false, channel: 'whatsapp' as const, error }
      }
    })
  }
}

type Provider = (InAppProvider | TwilioWhatsAppProvider) & NotificationProvider

let provider: Provider | null = null

export function notifier(): Provider {
  if (!provider) {
    provider = (process.env.NOTIFY_PROVIDER === 'twilio'
      ? new TwilioWhatsAppProvider()
      : new InAppProvider()) as Provider
  }
  return provider
}

/**
 * Drains rows the database queued. Called after every action that can cause one.
 * Never throws — a notification must not be able to fail the thing that caused it.
 */
export async function flushNotifications(): Promise<number> {
  try {
    const supabase = supabaseService()
    const { data } = await supabase
      .from('notifications')
      .select('id, recipient_id, template, payload')
      .eq('status', 'queued')
      .order('created_at')
      .limit(20)

    const rows = (data ?? []) as QueuedRow[]
    const p = notifier()
    for (const row of rows) await p.deliver(row)
    return rows.length
  } catch (err) {
    console.error('[notify] flush failed', err)
    return 0
  }
}

/** Direct send, for notifications not raised inside a database transaction. */
export function notify(to: string, template: TemplateKey, payload: Record<string, unknown>) {
  return notifier().send(to, template, payload).catch((err) => {
    console.error('[notify] send failed', template, err)
    return { ok: false, channel: 'in_app' as const, error: String(err) }
  })
}

import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Vercel config: disable body parsing so we get raw body for signature verification
export const config = {
  api: { bodyParser: false },
}

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const rawBody = await getRawBody(req)
  const sig = req.headers['stripe-signature']

  let event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return res.status(400).json({ error: 'Invalid signature' })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const customerId = session.customer

    await supabase
      .from('profiles')
      .update({ subscription_status: 'active', updated_at: new Date().toISOString() })
      .eq('stripe_customer_id', customerId)
  }

  if (event.type === 'customer.subscription.deleted' || event.type === 'customer.subscription.updated') {
    const subscription = event.data.object
    const customerId = subscription.customer
    const status = subscription.status === 'active' ? 'active' : 'canceled'

    await supabase
      .from('profiles')
      .update({ subscription_status: status, updated_at: new Date().toISOString() })
      .eq('stripe_customer_id', customerId)
  }

  return res.status(200).json({ received: true })
}

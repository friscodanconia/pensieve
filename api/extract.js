const SOURCES_PROMPT = `You are the Sources processor in Pensieve. The writer has pasted material into their Sources tab. Your job: extract what the writer might include, reference, or respond to in their draft.

You can see:
- The newly pasted material
- Any previously extracted sources already in the tab
- The writer's current Draft (if any)

Read all three before producing output.

Detect the type of material and adapt:
- Article or essay: key claims or arguments. Use direct quotes when the original phrasing matters.
- Data or statistics: the specific numbers, what they measure, and the context that makes them meaningful.
- Personal message or correspondence: narrative moments, specific details, quotes worth preserving verbatim.
- Short-form content (tweet, post, single quote): do not summarize. Tag why it matters for the draft.
- Under 100 words total: do not extract. Add only the FOR YOUR DRAFT connection below.
- URLs or links: note what each link points to based on the URL structure. If the URL contains a recognizable domain or path, describe what the resource likely covers.

These categories are illustrative. If the material does not fit any of them, decide the right extraction format based on what it contains.

If the new material overlaps with sources already extracted, do not repeat the shared points. Instead, note where sources agree, where they disagree, and what the new material adds that previous sources did not cover.

Output format:

SOURCE: [title or first meaningful line]
TYPE: [what you detected]

[extraction, format matching the material type]

FOR YOUR DRAFT:
[1 to 2 bullets: what does this source give the draft that it does not have yet? A missing claim, a supporting detail, a contradiction, a quote worth using. If the Draft is empty, note what angle or tension this source opens up. If multiple sources are now in play, note where they converge or conflict.]

Rules:
- Compress, do not interpret. Extract raw material. The writer decides what it means.
- Length proportional to input. A 3000-word article becomes 200 to 300 words. A tweet stays as is.
- Preserve exact quotes when the original language is stronger than a paraphrase.
- Useful means: claims the writer could engage with, details specific enough to remember, tensions between sources, or language worth keeping verbatim. Background the writer already knows is not useful.

Language:
- Do not use em-dashes. Use commas, periods, or separate sentences.
- Do not use "not X, but Y" constructions.
- Write plainly.`

import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'No API key configured' })

  // Verify auth + credits or subscription
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL

  if (SUPABASE_SERVICE_ROLE_KEY && SUPABASE_URL) {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ error: 'Sign in required' })

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) return res.status(401).json({ error: 'Invalid token' })

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status, credits')
      .eq('id', user.id)
      .single()

    if (profile?.subscription_status === 'active') {
      // Subscriber: unlimited
    } else if (profile?.credits > 0) {
      const { data: remaining } = await supabase.rpc('use_credit', { user_id: user.id })
      res.setHeader('X-Credits-Remaining', String(remaining))
    } else {
      return res.status(403).json({ error: 'No credits remaining', credits: 0 })
    }
  }

  try {
    const { newContent, existingSources, draftContent } = req.body

    let context = ''
    if (draftContent && draftContent.trim()) {
      context += `[Current Draft]\n${draftContent}\n[END Draft]\n\n`
    }
    if (existingSources && existingSources.trim()) {
      context += `[Existing Sources]\n${existingSources}\n[END Existing Sources]\n\n`
    }
    context += `[New Material]\n${newContent}\n[END New Material]`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: SOURCES_PROMPT,
        messages: [{ role: 'user', content: context }],
      }),
    })

    if (!response.ok) {
      return res.status(response.status).json({ error: `API error: ${response.status}` })
    }

    const data = await response.json()
    const reply = data.content?.[0]?.text || 'Extraction failed.'

    return res.status(200).json({ reply })
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}

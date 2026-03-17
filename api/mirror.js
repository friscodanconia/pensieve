const MIRROR_PROMPT = `You are Mirror, a component of Pensieve. You produce a brief, structured reflection of the writer's work. You see their Draft and their Sources.

Before producing output, read everything. Understand what the writing is trying to do from the content itself. Do not assume it should be something other than what it is. A numbered list of memories is not a failed essay. A rough collection of data points is not a failed argument. Your observations must match the writing as it exists.

These instructions apply to any kind of writing. The examples below are illustrations, not boundaries.

Output these sections. Skip any section where you have nothing genuine to say. A skipped section is better than a padded one.

SHAPE
What pattern, if any, organizes this writing? Name it if you see one. If the writing is still finding its structure, say that. If two organizing principles compete, name both. 1 to 2 sentences.

GAPS
What has the writer started but not followed through on? Point to the specific moment where a thread opens and then is not pursued. 1 to 3 bullets. If the writing is early stage and gaps are expected, say so in one line.

UNUSED SOURCES
What specific material in Sources has not appeared in the Draft? Describe or quote the exact item. If Sources is empty or everything is accounted for, skip this section.

ENERGY
Where is the writer most present? Where does the writing carry specificity, conviction, or feeling? Where does it flatten into summary, hedging, or description without weight? Name the passages. This section is about the writer's presence, not grammar or style.

ESSENCE
One sentence. The single most important thing the writer should sit with. Not advice. Not a suggestion. An observation that captures what this piece is really about, or what it is reaching toward, or what it has not yet admitted to itself. This sentence should be thoughtful and precise. It should make the writer pause. Write it as a standalone line, not a header with a colon.

Rules:
- Observations only. Do not suggest what to write. Do not draft sentences. Do not use phrases like "consider adding" or "you might want to."
- Do not open with a compliment. Start with SHAPE.
- Always end with ESSENCE. This is the soul of the reflection.
- If the Draft is under 100 words, skip SHAPE/GAPS/ENERGY and output only ESSENCE.
- Match the register to the writing. A piece about loss requires precision and respect. A business analysis requires directness.

Language:
- Do not use em-dashes. Use commas, periods, or separate sentences.
- Do not use "not X, but Y" constructions.
- Write plainly. No performative language.`

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
    const { draftContent, sourcesContent, projectTitle } = req.body

    let context = `Project: ${projectTitle || 'Untitled'}\n\n`
    if (draftContent && draftContent.trim()) {
      context += `[Draft]\n${draftContent}\n[END Draft]\n\n`
    }
    if (sourcesContent && sourcesContent.trim()) {
      context += `[Sources]\n${sourcesContent}\n[END Sources]`
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: MIRROR_PROMPT,
        messages: [{ role: 'user', content: context }],
      }),
    })

    if (!response.ok) {
      return res.status(response.status).json({ error: `API error: ${response.status}` })
    }

    const data = await response.json()
    const reply = data.content?.[0]?.text || 'Analysis unavailable.'

    return res.status(200).json({ reply })
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}

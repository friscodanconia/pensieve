const THINK_PROMPT = `You are Think, a component of Pensieve. You produce a brief, structured reflection of the writer's material and writing. You see their Collect tab (gathered material) and their Write tab (draft).

Before producing output, read everything. Understand what the writing is trying to do from the content itself. Do not assume it should be something other than what it is. A numbered list of memories is not a failed essay. A rough collection of data points is not a failed argument. Your observations must match the work as it exists.

Adapt your analysis based on what exists:

IF ONLY COLLECT HAS CONTENT (no draft yet):
Focus on the material itself. Output these sections:
- PATTERNS: What themes connect the material? What keeps recurring?
- TENSIONS: Where does the material contradict itself? Where is there productive friction?
- GAPS: What is conspicuously absent? What kind of material would strengthen what exists?
- ENERGY: Which pieces feel charged? Which feel obligatory?
- ESSENCE: One sentence. The question the material is circling without naming.

IF BOTH COLLECT AND WRITE HAVE CONTENT:
Output these sections:
- SHAPE: What pattern organizes the writing? 1 to 2 sentences.
- GAPS: Threads opened but not followed. 1 to 3 bullets.
- UNUSED MATERIAL: Specific material from Collect not referenced in the draft. Name it directly.
- ENERGY: Where is the writer most present? Where does it flatten?
- ESSENCE: One sentence. The single most important observation.

IF ONLY WRITE HAS CONTENT (no material collected):
Focus on internal analysis. Output these sections:
- SHAPE: Structure of the draft.
- GAPS: Implied claims without support. Places where the draft assumes knowledge it has not established.
- ENERGY: Where the writing is alive, where it is going through the motions.
- ESSENCE: One sentence.

Skip any section where you have nothing genuine to say. A skipped section is better than a padded one.

Rules:
- Observations only. Do not suggest what to write. Do not draft sentences. Do not use phrases like "consider adding" or "you might want to."
- Do not open with a compliment.
- Always end with ESSENCE. This is the soul of the reflection.
- If total content is under 100 words, output only ESSENCE.
- Match the register to the writing.

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
    if (sourcesContent && sourcesContent.trim()) {
      context += `[Collect]\n${sourcesContent}\n[END Collect]\n\n`
    }
    if (draftContent && draftContent.trim()) {
      context += `[Write]\n${draftContent}\n[END Write]`
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
        system: THINK_PROMPT,
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

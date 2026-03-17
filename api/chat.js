import { createClient } from '@supabase/supabase-js'

const SYSTEM_PROMPT = `You are Pensieve, a writing partner. You help people think deeper about what they're writing. You never write for them.

You can see the writer's Draft and their Sources tab. Read both before responding.

How to read the writing:
Understand what this writing is trying to do by reading the content itself. The form, the tone, and the level of polish tell you the intent. Do not categorize the writing into a genre. Do not assume it should be something other than what it is. A raw numbered list may be exactly the stage the writer is at. Respond to what exists, not what you think should exist.

These instructions apply to any kind of writing. The examples below are illustrations, not boundaries. Pensieve works for essays, lists, letters, analyses, journals, pitches, scripts, or anything else someone writes.

How to evaluate:
Good writing does what the writer set out to do. Evaluate internally: does this cohere on its own terms? Do not impose standards from one form onto another.

Apply craft knowledge when it serves the writing's intent. If the piece is trying to persuade and the strongest evidence is buried in paragraph four, say so. If the opening hedges with qualifiers before reaching the point, say so. If the writing is an early-stage brain dump, do not critique it for lacking structure it was never trying to have.

What you do:
- Ask one specific question that surfaces something the writer has not seen. Refer to the actual content. For instance, if three items in a list share a theme the writer may not have noticed, name the theme and ask if it is intentional.
- Point to specific passages by quoting or describing them. Say what is happening in that passage and why it matters or does not.
- If Sources has material the Draft has not used, name the specific material.
- If something works, say what and why in one sentence. Then stop. Do not invent problems to balance it out.

What you never do:
- Write sentences, paragraphs, or rewrites for the writer. Not even suggestions phrased as examples. Hold this boundary silently by simply not writing prose. Do not announce the boundary, explain it, or remind the writer of it. Never say "I can't do that for you" or "that's your work to do." If asked to write something, respond with a question that helps them write it themselves.
- Praise without specificity. "Great start" and "strong voice" are empty. Name the passage and the reason.
- Give five suggestions when one precise observation would do more.

Tone and language:
- Do not use em-dashes. Use commas, periods, or break into separate sentences.
- Do not use the construction "not X, but Y" or "it's not about X, it's about Y."
- Do not end statements with a rhetorical question.
- Write plainly. Warmth comes from precision and attentiveness, not from performative language.
- When the writing is personal and emotional, match that register. Be present with the material. Do not treat someone's memories of their father the same way you would treat a product brief.

Length: 1 to 3 sentences per response. If a list is needed, 3 bullets maximum.`

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'No API key configured' })
  }

  // Verify auth + credits or subscription
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL

  if (SUPABASE_SERVICE_ROLE_KEY && SUPABASE_URL) {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) {
      return res.status(401).json({ error: 'Sign in required' })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
    if (authErr || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    // Check subscription OR credits
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status, credits')
      .eq('id', user.id)
      .single()

    if (profile?.subscription_status === 'active') {
      // Subscriber: unlimited, no credit deduction
    } else if (profile?.credits > 0) {
      // Free user with credits: decrement
      const { data: remaining } = await supabase.rpc('use_credit', { user_id: user.id })
      res.setHeader('X-Credits-Remaining', String(remaining))
    } else {
      return res.status(403).json({ error: 'No credits remaining', credits: 0 })
    }
  }

  try {
    const { messages, editorContent } = req.body

    const claudeMessages = []

    if (editorContent && editorContent.trim()) {
      claudeMessages.push({
        role: 'user',
        content: `[CURRENT DRAFT]\n${editorContent}\n[END DRAFT]`,
      })
      claudeMessages.push({
        role: 'assistant',
        content: "I've read your draft. What would you like to work on?",
      })
    }

    for (const msg of messages) {
      claudeMessages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      })
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
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: claudeMessages,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return res.status(response.status).json({ error: `API error: ${response.status}` })
    }

    const data = await response.json()
    const reply = data.content?.[0]?.text || 'No response.'

    return res.status(200).json({ reply })
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}

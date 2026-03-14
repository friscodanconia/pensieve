import { createClient } from '@supabase/supabase-js'

const SYSTEM_PROMPT = `You are Pensieve, a writing assistant that helps people think deeper — without doing the writing for them.

Your role:
- Ask probing questions that help the writer clarify their thinking
- Point out structural issues, unclear arguments, or underdeveloped ideas
- Give honest, specific feedback — not generic praise
- Suggest what to cut, expand, or restructure
- Never write prose for the user. The words must always be theirs.

Style:
- Be concise and direct. No filler.
- Speak like a sharp, caring editor — not a chatbot.
- Use 1-3 sentences per response when possible.
- If the writing is good, say so briefly and point out what's working.`

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

  // Verify Supabase auth + subscription
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

    // Check subscription status
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', user.id)
      .single()

    if (profile?.subscription_status !== 'active') {
      return res.status(403).json({ error: 'Pensieve Pro subscription required' })
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

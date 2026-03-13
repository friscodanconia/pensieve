import { createServer } from 'http'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { homedir } from 'os'
import { fileURLToPath } from 'url'
import { config } from 'dotenv'

// Load .env from project root
const __dirname = dirname(fileURLToPath(import.meta.url))
config({ path: join(__dirname, '.env') })

const PORT = 3001
const VAULT_PATH = join(homedir(), 'Documents', "Soumyo's awesome vault", 'Notes')
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

if (!ANTHROPIC_API_KEY) {
  console.warn('WARNING: ANTHROPIC_API_KEY not found in .env — assistant will not work')
}

// Ensure Notes folder exists
if (!existsSync(VAULT_PATH)) {
  mkdirSync(VAULT_PATH, { recursive: true })
  console.log(`Created vault folder: ${VAULT_PATH}`)
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => resolve(body))
  })
}

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

const server = createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // Save to Obsidian vault
  if (req.method === 'POST' && req.url === '/api/save') {
    const body = await readBody(req)
    try {
      const { filename, content } = JSON.parse(body)
      const safe = filename.replace(/[/\\?%*:|"<>]/g, '-')
      const filepath = join(VAULT_PATH, safe)
      writeFileSync(filepath, content, 'utf-8')
      console.log(`Saved: ${safe}`)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, path: filepath }))
    } catch (err) {
      console.error('Save error:', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: String(err) }))
    }
    return
  }

  // Chat with Claude
  if (req.method === 'POST' && req.url === '/api/chat') {
    const body = await readBody(req)
    try {
      const { messages, editorContent } = JSON.parse(body)

      if (!ANTHROPIC_API_KEY) {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'No API key configured' }))
        return
      }

      // Build messages array for Claude
      const claudeMessages = []

      // Add editor context as first user message if available
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

      // Add conversation history
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
        console.error('Claude API error:', response.status, errText)
        res.writeHead(response.status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `API error: ${response.status}` }))
        return
      }

      const data = await response.json()
      const reply = data.content?.[0]?.text || 'No response.'

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ reply }))
    } catch (err) {
      console.error('Chat error:', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: String(err) }))
    }
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

server.listen(PORT, () => {
  console.log(`Hermes server running on http://localhost:${PORT}`)
  console.log(`Obsidian vault: ${VAULT_PATH}`)
  console.log(`Claude API: ${ANTHROPIC_API_KEY ? 'configured' : 'NOT configured'}`)
})

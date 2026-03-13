const REPO_OWNER = 'friscodanconia'
const REPO_NAME = 'pensieve-notes'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const GITHUB_TOKEN = process.env.GITHUB_TOKEN
  if (!GITHUB_TOKEN) {
    return res.status(200).json({ ok: true, message: 'GitHub token not configured' })
  }

  try {
    const { filename, content } = req.body
    const safeName = filename.replace(/[/\\?%*:|"<>]/g, '-')
    const path = safeName

    // Check if file already exists (to get its SHA for update)
    let sha = null
    try {
      const existing = await fetch(
        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(path)}`,
        { headers: { Authorization: `token ${GITHUB_TOKEN}` } }
      )
      if (existing.ok) {
        const data = await existing.json()
        sha = data.sha
      }
    } catch {
      // File doesn't exist yet — that's fine
    }

    // Create or update the file
    const body = {
      message: `Update ${safeName}`,
      content: Buffer.from(content, 'utf-8').toString('base64'),
    }
    if (sha) body.sha = sha

    const response = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${encodeURIComponent(path)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      }
    )

    if (response.ok) {
      return res.status(200).json({ ok: true, path })
    } else {
      const err = await response.text()
      console.error('GitHub API error:', response.status, err)
      return res.status(response.status).json({ ok: false, error: `GitHub: ${response.status}` })
    }
  } catch (err) {
    console.error('Save error:', err)
    return res.status(500).json({ ok: false, error: String(err) })
  }
}

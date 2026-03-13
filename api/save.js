export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  // Obsidian save only works locally — return gracefully in production
  return res.status(200).json({
    ok: true,
    message: 'Obsidian sync is only available when running locally',
  })
}

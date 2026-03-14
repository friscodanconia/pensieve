import type { Project } from './types'
import { TAB_COLORS } from './types'
import { upsertProject, deleteProjectFromDb } from './lib/db'

const STORAGE_KEY = 'pensieve-projects'
const ACTIVE_PROJECT_KEY = 'pensieve-active-project'

const DEFAULT_CONTENT = `<h1>Welcome to Pensieve</h1>
<p>A place to pour your thoughts — and an AI that helps you think deeper, without doing the writing for you.</p>
<p>You're looking at a <strong>rich markdown editor</strong>. Everything you type is saved automatically. Try a few things:</p>
<ul>
<li><p><strong>Bold</strong> with <code>Cmd+B</code>, <em>italic</em> with <code>Cmd+I</code></p></li>
<li><p>Insert a <a href="https://example.com">link</a> with <code>Cmd+K</code></p></li>
<li><p>Type <code>#</code> at the start of a line for a heading</p></li>
<li><p>Use <code>&gt;</code> for blockquotes, <code>-</code> for bullet lists</p></li>
</ul>
<h2>Five tabs, five purposes</h2>
<p>Each colored tab above has a role. Hover to see what it's for:</p>
<ul>
<li><p><strong>Draft</strong> (coral) — your main writing lives here</p></li>
<li><p><strong>Research</strong> (amber) — quotes, links, raw material</p></li>
<li><p><strong>Outline</strong> (sage) — map your argument before you write</p></li>
<li><p><strong>Scratchpad</strong> (sky) — freewrite with no stakes</p></li>
<li><p><strong>Feedback</strong> (lavender) — revision notes and editor comments</p></li>
</ul>
<h2>The AI assistant</h2>
<p>Click the icon in the bottom-left to open Pensieve's assistant. It reads your draft and helps you think — asks probing questions, flags weak spots, suggests structure. It never writes for you. <em>The words are always yours.</em></p>`

function createDefaultProject(): Project {
  return {
    id: crypto.randomUUID(),
    title: 'Welcome to Pensieve',
    tabs: TAB_COLORS.map((color, i) => ({
      color,
      content: i === 0 ? DEFAULT_CONTENT : '',
      hasContent: i === 0,
    })),
    activeTab: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function createNewProject(): Project {
  return {
    id: crypto.randomUUID(),
    title: 'Untitled',
    tabs: TAB_COLORS.map((color) => ({
      color,
      content: '',
      hasContent: false,
    })),
    activeTab: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

export function loadProjects(): Project[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) {
      const projects = JSON.parse(data) as Project[]
      if (projects.length > 0) return projects
    }
  } catch { /* ignore */ }
  const defaultProject = createDefaultProject()
  saveProjects([defaultProject])
  return [defaultProject]
}

export function saveProjects(projects: Project[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
}

export function loadActiveProjectId(): string | null {
  return localStorage.getItem(ACTIVE_PROJECT_KEY)
}

export function saveActiveProjectId(id: string) {
  localStorage.setItem(ACTIVE_PROJECT_KEY, id)
}

// Debounced Supabase sync
let syncTimer: ReturnType<typeof setTimeout> | null = null

export function syncProjectToSupabase(userId: string | undefined, project: Project) {
  if (!userId) return

  if (syncTimer) clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    upsertProject(userId, project).catch(() => {
      // Silent fail — localStorage is the fallback
    })
  }, 2000)
}

export function deleteProjectEverywhere(projectId: string, userId: string | undefined) {
  if (userId) {
    deleteProjectFromDb(projectId).catch(() => {})
  }
}

export function countWords(html: string): number {
  const div = document.createElement('div')
  div.innerHTML = html
  const text = div.textContent || div.innerText || ''
  const words = text.trim().split(/\s+/).filter(w => w.length > 0)
  return words.length
}

export function htmlToMarkdown(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html

  function processNode(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || ''
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return ''

    const el = node as HTMLElement
    const tag = el.tagName.toLowerCase()
    const children = Array.from(el.childNodes).map(processNode).join('')

    switch (tag) {
      case 'h1': return `# ${children}\n\n`
      case 'h2': return `## ${children}\n\n`
      case 'h3': return `### ${children}\n\n`
      case 'p': return `${children}\n\n`
      case 'strong': return `**${children}**`
      case 'em': return `*${children}*`
      case 'code':
        if (el.parentElement?.tagName.toLowerCase() === 'pre') return children
        return `\`${children}\``
      case 'pre': return `\`\`\`\n${children}\n\`\`\`\n\n`
      case 'blockquote': return children.split('\n').filter(l => l.trim()).map(l => `> ${l}`).join('\n') + '\n\n'
      case 'ul': return children + '\n'
      case 'ol': {
        let idx = 0
        return Array.from(el.children).map(li => {
          idx++
          return `${idx}. ${processNode(li).replace(/^- /, '').trim()}`
        }).join('\n') + '\n\n'
      }
      case 'li': return `- ${children.trim()}\n`
      case 'a': {
        const href = el.getAttribute('href') || ''
        return `[${children}](${href})`
      }
      case 'hr': return '---\n\n'
      case 's': return `~~${children}~~`
      case 'br': return '\n'
      default: return children
    }
  }

  return Array.from(div.childNodes).map(processNode).join('').trim()
}

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
<h2>Three tabs, three purposes</h2>
<ul>
<li><p><strong>Draft</strong> — your main writing lives here</p></li>
<li><p><strong>Sources</strong> — paste articles, quotes, data. Pensieve extracts what matters.</p></li>
<li><p><strong>Mirror</strong> — a living analysis of your writing. You never type here — you glance at it.</p></li>
</ul>
<h2>The AI assistant</h2>
<p>Click the Assistant button in the bottom-right to open Pensieve's writing partner. It reads your draft, your sources, and Mirror's analysis — then helps you think. It never writes for you. <em>The words are always yours.</em></p>`

// Migrate a project from 5-tab to 3-tab structure
function migrateProject(p: Project): Project {
  if (p.tabs.length <= 3) return p

  // Tab 0 (Draft) → Draft
  // Tabs 1-3 (Research/Outline/Scratchpad) → merge into Sources
  // Tab 4 (Feedback) → drop
  const draftContent = p.tabs[0]?.content || ''
  const sourceParts = [1, 2, 3]
    .map(i => p.tabs[i]?.content || '')
    .filter(c => c.replace(/<[^>]*>/g, '').trim().length > 0)
  const sourcesContent = sourceParts.join('<hr>')

  return {
    ...p,
    tabs: TAB_COLORS.map((color, i) => {
      if (i === 0) return { color, content: draftContent, hasContent: draftContent.replace(/<[^>]*>/g, '').trim().length > 0 }
      if (i === 1) return { color, content: sourcesContent, hasContent: sourcesContent.replace(/<[^>]*>/g, '').trim().length > 0 }
      return { color, content: '', hasContent: false } // Mirror starts empty
    }),
    activeTab: Math.min(p.activeTab, 2),
  }
}

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
      if (projects.length > 0) {
        // Migrate any old 5-tab projects
        const migrated = projects.map(migrateProject)
        // Save if migration happened
        if (JSON.stringify(migrated) !== data) {
          saveProjects(migrated)
        }
        return migrated
      }
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

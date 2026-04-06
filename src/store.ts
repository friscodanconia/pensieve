import type { Project } from './types'
import { TAB_COLORS } from './types'
import { upsertProject, deleteProjectFromDb } from './lib/db'

const STORAGE_KEY = 'pensieve-projects'
const ACTIVE_PROJECT_KEY = 'pensieve-active-project'


// Migrate a project from 5-tab to 3-tab structure
function migrate5TabProject(p: Project): Project {
  if (p.tabs.length <= 3) return p

  const draftContent = p.tabs[0]?.content || ''
  const sourceParts = [1, 2, 3]
    .map(i => p.tabs[i]?.content || '')
    .filter(c => c.replace(/<[^>]*>/g, '').trim().length > 0)
  const sourcesContent = sourceParts.join('<hr>')

  return {
    ...p,
    tabs: TAB_COLORS.map((color, i) => {
      if (i === 0) return { color, content: sourcesContent, hasContent: sourcesContent.replace(/<[^>]*>/g, '').trim().length > 0 }
      if (i === 1) return { color, content: '', hasContent: false }
      if (i === 2) return { color, content: draftContent, hasContent: draftContent.replace(/<[^>]*>/g, '').trim().length > 0 }
      return { color, content: '', hasContent: false }
    }),
    activeTab: 0,
  }
}

// Migrate from old 3-tab (Draft/Sources/Mirror: coral/amber/sage)
// to new 3-tab (Collect/Think/Write: amber/sage/coral)
function migrateToCollectThinkWrite(p: Project): Project {
  // Detect old layout: tabs[0].color === 'coral' means old Draft-first order
  if (p.tabs.length !== 3 || p.tabs[0].color !== 'coral') return p

  const oldDraft = p.tabs[0]   // coral — was Draft
  const oldSources = p.tabs[1] // amber — was Sources
  // old Mirror (sage) content is discarded — Think generates fresh

  // Map active tab: old 0 (Draft) → new 2 (Write), old 1 (Sources) → new 0 (Collect), old 2 (Mirror) → new 1 (Think)
  const tabMap: Record<number, number> = { 0: 2, 1: 0, 2: 1 }
  const newActiveTab = tabMap[p.activeTab] ?? 0

  // Add "Imported from Sources" label if sources had content
  const sourcesHasContent = oldSources.content.replace(/<[^>]*>/g, '').trim().length > 0
  const collectContent = sourcesHasContent
    ? `<p><em>Imported from Sources</em></p><hr>${oldSources.content}`
    : oldSources.content

  return {
    ...p,
    tabs: [
      { color: 'amber', content: collectContent, hasContent: sourcesHasContent },
      { color: 'sage', content: '', hasContent: false },
      { color: 'coral', content: oldDraft.content, hasContent: oldDraft.content.replace(/<[^>]*>/g, '').trim().length > 0 },
    ],
    activeTab: newActiveTab,
  }
}

function migrateProject(p: Project): Project {
  let result = p
  if (result.tabs.length > 3) result = migrate5TabProject(result)
  if (result.tabs[0].color === 'coral') result = migrateToCollectThinkWrite(result)
  return result
}

function createDefaultProject(): Project {
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

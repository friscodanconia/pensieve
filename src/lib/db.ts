import { supabase } from './supabase'
import type { Project } from '../types'
import { TAB_COLORS } from '../types'

interface DbProject {
  id: string
  user_id: string
  title: string
  active_tab: number
  created_at: string
  updated_at: string
}

interface DbTab {
  id: string
  project_id: string
  tab_index: number
  color: string
  content: string
  has_content: boolean
}

function toProject(dbProject: DbProject, dbTabs: DbTab[]): Project {
  const tabs = TAB_COLORS.map((color, i) => {
    const tab = dbTabs.find(t => t.tab_index === i)
    return {
      color,
      content: tab?.content || '',
      hasContent: tab?.has_content || false,
    }
  })

  return {
    id: dbProject.id,
    title: dbProject.title,
    tabs,
    activeTab: dbProject.active_tab,
    createdAt: new Date(dbProject.created_at).getTime(),
    updatedAt: new Date(dbProject.updated_at).getTime(),
  }
}

export async function fetchProjects(userId: string): Promise<Project[]> {
  const { data: projects, error: projErr } = await supabase
    .from('projects')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })

  if (projErr || !projects?.length) return []

  const projectIds = projects.map(p => p.id)
  const { data: tabs } = await supabase
    .from('tabs')
    .select('*')
    .in('project_id', projectIds)

  return projects.map(p =>
    toProject(p, (tabs || []).filter(t => t.project_id === p.id))
  )
}

export async function upsertProject(userId: string, project: Project): Promise<void> {
  // Upsert the project row
  await supabase.from('projects').upsert({
    id: project.id,
    user_id: userId,
    title: project.title,
    active_tab: project.activeTab,
    created_at: new Date(project.createdAt).toISOString(),
    updated_at: new Date(project.updatedAt).toISOString(),
  })

  // Upsert all tabs
  const tabRows = project.tabs.map((tab, i) => ({
    project_id: project.id,
    tab_index: i,
    color: tab.color,
    content: tab.content,
    has_content: tab.hasContent,
  }))

  await supabase.from('tabs').upsert(tabRows, {
    onConflict: 'project_id,tab_index',
  })
}

export async function deleteProjectFromDb(projectId: string): Promise<void> {
  // Tabs cascade-delete via FK
  await supabase.from('projects').delete().eq('id', projectId)
}

export async function migrateLocalProjects(userId: string, localProjects: Project[]): Promise<void> {
  // Check if user already has projects in the DB
  const { count } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  // Only migrate if user has no existing projects
  if (count && count > 0) return

  // Filter out the default "Welcome to Pensieve" project if it has no real edits
  const realProjects = localProjects.filter(p => {
    if (p.title === 'Welcome to Pensieve' && p.tabs.filter(t => t.hasContent).length <= 1) {
      return false
    }
    return true
  })

  for (const project of realProjects) {
    await upsertProject(userId, project)
  }
}

import { useState, useCallback, useEffect } from 'react'
import Editor from './components/Editor'
import TabBar from './components/TabBar'
import SettingsBar from './components/SettingsBar'
import AssistantPanel from './components/AssistantPanel'
import ObsidianSync from './components/ObsidianSync'
import AuthModal from './components/AuthModal'
import { useAuth } from './hooks/useAuth'
import { useSubscription } from './hooks/useSubscription'
import { fetchProjects, migrateLocalProjects } from './lib/db'
import { loadProjects, saveProjects, loadActiveProjectId, saveActiveProjectId, countWords, htmlToMarkdown, createNewProject, syncProjectToSupabase, deleteProjectEverywhere } from './store'
import type { Project } from './types'
import { TAB_ROLES } from './types'

export default function App() {
  const auth = useAuth()
  const subscriptionStatus = useSubscription(auth.user)

  const [projects, setProjects] = useState<Project[]>(() => loadProjects())
  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    const saved = loadActiveProjectId()
    const loaded = loadProjects()
    if (saved && loaded.find(p => p.id === saved)) return saved
    return loaded[0]?.id || ''
  })
  const [focusMode, setFocusMode] = useState(false)
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [assistantVisible, setAssistantVisible] = useState(false)
  const [titleEditing, setTitleEditing] = useState(false)
  const [projectListOpen, setProjectListOpen] = useState(false)
  const [showAuth, setShowAuth] = useState(false)

  const projectIndex = projects.findIndex(p => p.id === activeProjectId)
  const project = projects[projectIndex] || projects[0]
  const activeTab = project?.activeTab || 0
  const currentContent = project?.tabs[activeTab]?.content || ''
  const wordCount = countWords(currentContent)
  const currentMarkdown = htmlToMarkdown(currentContent)

  // Save to localStorage on change
  useEffect(() => {
    saveProjects(projects)
  }, [projects])

  useEffect(() => {
    saveActiveProjectId(activeProjectId)
  }, [activeProjectId])

  // Sync current project to Supabase on change (debounced in store)
  useEffect(() => {
    if (auth.user && project) {
      syncProjectToSupabase(auth.user.id, project)
    }
  }, [auth.user, project])

  // On sign-in: migrate local projects, then load from Supabase
  useEffect(() => {
    if (!auth.user || auth.loading) return

    async function syncOnLogin() {
      const localProjects = loadProjects()
      await migrateLocalProjects(auth.user!.id, localProjects)

      const cloudProjects = await fetchProjects(auth.user!.id)
      if (cloudProjects.length > 0) {
        setProjects(cloudProjects)
        saveProjects(cloudProjects)
        // Keep current active project if it exists in cloud, else pick first
        if (!cloudProjects.find(p => p.id === activeProjectId)) {
          setActiveProjectId(cloudProjects[0].id)
        }
      }
    }

    syncOnLogin()
  }, [auth.user, auth.loading]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleContentChange = useCallback((html: string) => {
    setProjects(prev => {
      const idx = prev.findIndex(p => p.id === activeProjectId)
      if (idx === -1) return prev
      const next = [...prev]
      const p = { ...next[idx] }
      const tabs = [...p.tabs]
      tabs[activeTab] = {
        ...tabs[activeTab],
        content: html,
        hasContent: html.replace(/<[^>]*>/g, '').trim().length > 0,
      }
      p.tabs = tabs
      p.updatedAt = Date.now()
      next[idx] = p
      return next
    })
  }, [activeProjectId, activeTab])

  const handleTabChange = useCallback((index: number) => {
    setProjects(prev => {
      const idx = prev.findIndex(p => p.id === activeProjectId)
      if (idx === -1) return prev
      const next = [...prev]
      const p = { ...next[idx] }
      p.activeTab = index
      next[idx] = p
      return next
    })
  }, [activeProjectId])

  const handleTitleChange = useCallback((newTitle: string) => {
    setProjects(prev => {
      const idx = prev.findIndex(p => p.id === activeProjectId)
      if (idx === -1) return prev
      const next = [...prev]
      const p = { ...next[idx] }
      p.title = newTitle || 'Untitled'
      next[idx] = p
      return next
    })
  }, [activeProjectId])

  const handleNewProject = useCallback(() => {
    const newProj = createNewProject()
    setProjects(prev => [newProj, ...prev])
    setActiveProjectId(newProj.id)
    setProjectListOpen(false)
    setTitleEditing(true)
  }, [])

  const handleSwitchProject = useCallback((id: string) => {
    setActiveProjectId(id)
    setProjectListOpen(false)
  }, [])

  const handleDeleteProject = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (projects.length <= 1) return
    const idx = projects.findIndex(p => p.id === id)
    setProjects(prev => prev.filter(p => p.id !== id))
    deleteProjectEverywhere(id, auth.user?.id)
    if (id === activeProjectId) {
      const nextProject = projects[idx === 0 ? 1 : idx - 1]
      setActiveProjectId(nextProject.id)
    }
  }, [projects, activeProjectId, auth.user])

  // Format relative time
  function timeAgo(ts: number): string {
    const diff = Date.now() - ts
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  if (!project) return null

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Settings Bar */}
      <SettingsBar
        projectTitle={project.title}
        wordCount={wordCount}
        focusMode={focusMode}
        onFocusToggle={() => setFocusMode(!focusMode)}
        visible={settingsVisible}
        onToggleVisible={() => setSettingsVisible(!settingsVisible)}
        user={auth.user}
        onSignIn={() => setShowAuth(true)}
        onSignOut={() => auth.signOut()}
      />

      {/* Main Editor Area */}
      <div
        style={{
          flex: 1,
          maxWidth: '680px',
          width: '100%',
          margin: '0 auto',
          padding: settingsVisible ? '72px 24px 120px' : '48px 24px 120px',
          transition: 'padding 0.3s ease',
        }}
      >
        {/* Project Title + Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          {titleEditing ? (
            <input
              type="text"
              value={project.title}
              onChange={e => handleTitleChange(e.target.value)}
              onBlur={() => setTitleEditing(false)}
              onKeyDown={e => { if (e.key === 'Enter') setTitleEditing(false) }}
              autoFocus
              style={{
                flex: 1,
                border: 'none',
                background: 'transparent',
                fontFamily: "'Inter', sans-serif",
                fontSize: '16px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                outline: 'none',
                padding: '0',
              }}
            />
          ) : (
            <div
              onClick={() => setTitleEditing(true)}
              style={{
                flex: 1,
                fontFamily: "'Inter', sans-serif",
                fontSize: '16px',
                fontWeight: 500,
                color: 'var(--text-primary)',
                cursor: 'text',
              }}
            >
              {project.title}
            </div>
          )}

          {/* Project switcher button */}
          <button
            onClick={() => setProjectListOpen(!projectListOpen)}
            style={{
              background: projectListOpen ? 'rgba(0,0,0,0.06)' : 'none',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              padding: '4px 10px',
              cursor: 'pointer',
              fontFamily: "'Inter', sans-serif",
              fontSize: '12px',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: '10px' }}>▼</span>
            {projects.length} {projects.length === 1 ? 'note' : 'notes'}
          </button>
        </div>

        {/* Project List Dropdown */}
        {projectListOpen && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setProjectListOpen(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 19 }}
            />
            <div
              style={{
                position: 'relative',
                zIndex: 20,
                background: 'var(--panel-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
                padding: '6px',
                marginBottom: '16px',
                maxHeight: '320px',
                overflowY: 'auto',
              }}
            >
              {/* New Note button */}
              <button
                onClick={handleNewProject}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: 'none',
                  borderRadius: '7px',
                  background: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '13px',
                  fontWeight: 500,
                  color: 'var(--tab-sage)',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
                New note
              </button>

              <div style={{ height: '1px', background: 'var(--border-color)', margin: '4px 8px' }} />

              {/* Project list */}
              {projects.map(p => {
                const isActive = p.id === activeProjectId
                const tabsWithContent = p.tabs.filter(t => t.hasContent).length
                const tabLabels = p.tabs
                  .map((t, i) => t.hasContent ? TAB_ROLES[i].label : null)
                  .filter(Boolean)

                return (
                  <button
                    key={p.id}
                    onClick={() => handleSwitchProject(p.id)}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: 'none',
                      borderRadius: '7px',
                      background: isActive ? 'rgba(0,0,0,0.04)' : 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      textAlign: 'left',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.03)' }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'none' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: '13px',
                        fontWeight: isActive ? 600 : 400,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {p.title}
                      </div>
                      <div style={{
                        fontFamily: "'Inter', sans-serif",
                        fontSize: '11px',
                        color: 'var(--text-muted)',
                        marginTop: '2px',
                      }}>
                        {timeAgo(p.updatedAt)}
                        {tabsWithContent > 1 && (
                          <span> · {tabLabels.join(', ')}</span>
                        )}
                      </div>
                    </div>

                    {/* Delete button — only show if more than 1 project */}
                    {projects.length > 1 && (
                      <span
                        onClick={(e) => handleDeleteProject(p.id, e)}
                        style={{
                          color: 'var(--text-muted)',
                          fontSize: '14px',
                          lineHeight: 1,
                          padding: '2px 4px',
                          borderRadius: '4px',
                          opacity: 0.4,
                          cursor: 'pointer',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.opacity = '1'
                          e.currentTarget.style.color = 'var(--tab-coral)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.opacity = '0.4'
                          e.currentTarget.style.color = 'var(--text-muted)'
                        }}
                        title="Delete note"
                      >
                        x
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {/* Tab Bar */}
        <div style={{ marginBottom: '40px' }}>
          <TabBar
            tabs={project.tabs}
            activeTab={activeTab}
            onTabChange={handleTabChange}
          />
        </div>

        {/* Editor */}
        <Editor
          content={currentContent}
          onChange={handleContentChange}
        />

        {/* Obsidian Sync Status */}
        <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'flex-end' }}>
          <ObsidianSync
            projectTitle={project.title}
            markdown={currentMarkdown}
            tabIndex={activeTab}
            tabColor={project.tabs[activeTab].color}
            userEmail={auth.user?.email || null}
          />
        </div>
      </div>

      {/* Focus Mode Overlay */}
      {focusMode && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'none',
            background: 'radial-gradient(ellipse at center, transparent 30%, rgba(245,245,240,0.85) 80%)',
            zIndex: 10,
          }}
        />
      )}

      {/* Assistant Panel */}
      <AssistantPanel
        visible={assistantVisible}
        onToggle={() => setAssistantVisible(!assistantVisible)}
        editorContent={currentMarkdown}
        user={auth.user}
        subscriptionStatus={subscriptionStatus}
        onSignIn={() => setShowAuth(true)}
      />

      {/* Auth Modal */}
      {showAuth && (
        <AuthModal
          auth={auth}
          onClose={() => setShowAuth(false)}
        />
      )}
    </div>
  )
}

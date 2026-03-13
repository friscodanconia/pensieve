import { useState, useCallback, useEffect } from 'react'
import Editor from './components/Editor'
import TabBar from './components/TabBar'
import SettingsBar from './components/SettingsBar'
import AssistantPanel from './components/AssistantPanel'
import ObsidianSync from './components/ObsidianSync'
import { loadProjects, saveProjects, countWords, htmlToMarkdown } from './store'
import type { Project } from './types'

export default function App() {
  const [projects, setProjects] = useState<Project[]>(() => loadProjects())
  const [activeProjectIndex] = useState(0)
  const [focusMode, setFocusMode] = useState(false)
  const [settingsVisible, setSettingsVisible] = useState(false)
  const [assistantVisible, setAssistantVisible] = useState(false)
  const [titleEditing, setTitleEditing] = useState(false)

  const project = projects[activeProjectIndex]
  const activeTab = project.activeTab
  const currentContent = project.tabs[activeTab].content
  const wordCount = countWords(currentContent)
  const currentMarkdown = htmlToMarkdown(currentContent)

  // Save to localStorage on change
  useEffect(() => {
    saveProjects(projects)
  }, [projects])

  const handleContentChange = useCallback((html: string) => {
    setProjects(prev => {
      const next = [...prev]
      const p = { ...next[activeProjectIndex] }
      const tabs = [...p.tabs]
      tabs[activeTab] = {
        ...tabs[activeTab],
        content: html,
        hasContent: html.replace(/<[^>]*>/g, '').trim().length > 0,
      }
      p.tabs = tabs
      p.updatedAt = Date.now()
      next[activeProjectIndex] = p
      return next
    })
  }, [activeProjectIndex, activeTab])

  const handleTabChange = useCallback((index: number) => {
    setProjects(prev => {
      const next = [...prev]
      const p = { ...next[activeProjectIndex] }
      p.activeTab = index
      next[activeProjectIndex] = p
      return next
    })
  }, [activeProjectIndex])

  const handleTitleChange = useCallback((newTitle: string) => {
    setProjects(prev => {
      const next = [...prev]
      const p = { ...next[activeProjectIndex] }
      p.title = newTitle || 'Untitled'
      next[activeProjectIndex] = p
      return next
    })
  }, [activeProjectIndex])

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
        {/* Project Title */}
        {titleEditing ? (
          <input
            type="text"
            value={project.title}
            onChange={e => handleTitleChange(e.target.value)}
            onBlur={() => setTitleEditing(false)}
            onKeyDown={e => { if (e.key === 'Enter') setTitleEditing(false) }}
            autoFocus
            style={{
              width: '100%',
              border: 'none',
              background: 'transparent',
              fontFamily: "'Inter', sans-serif",
              fontSize: '16px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              outline: 'none',
              marginBottom: '12px',
              padding: '0',
            }}
          />
        ) : (
          <div
            onClick={() => setTitleEditing(true)}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '16px',
              fontWeight: 500,
              color: 'var(--text-primary)',
              cursor: 'text',
              marginBottom: '12px',
            }}
          >
            {project.title}
          </div>
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
      />
    </div>
  )
}

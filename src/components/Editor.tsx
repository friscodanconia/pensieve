import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useCallback, useState } from 'react'

interface EditorProps {
  content: string
  onChange: (html: string) => void
}

export default function Editor({ content, onChange }: EditorProps) {
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: 'code-block' } },
        horizontalRule: {},
      }),
      Link.configure({
        openOnClick: true,
        HTMLAttributes: { target: '_blank', rel: 'noopener noreferrer' },
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    editorProps: {
      attributes: {
        class: 'tiptap',
      },
    },
  })

  // Sync content when tab changes
  useEffect(() => {
    if (editor && editor.getHTML() !== content) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
  }, [content, editor])

  // Cmd+K for links
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      if (editor) {
        const previousUrl = editor.getAttributes('link').href
        setLinkUrl(previousUrl || '')
        setShowLinkInput(true)
      }
    }
  }, [editor])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const applyLink = () => {
    if (!editor) return
    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run()
    }
    setShowLinkInput(false)
    setLinkUrl('')
  }

  return (
    <div style={{ position: 'relative' }}>
      <EditorContent editor={editor} />

      {showLinkInput && (
        <div className="link-input-overlay" onClick={() => setShowLinkInput(false)}>
          <div className="link-input-modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Insert Link
            </div>
            <input
              type="url"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') applyLink()
                if (e.key === 'Escape') setShowLinkInput(false)
              }}
            />
            <div className="actions">
              <button onClick={() => setShowLinkInput(false)}>Cancel</button>
              <button className="primary" onClick={applyLink}>Apply</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

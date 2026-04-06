import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Node as TiptapNode, mergeAttributes } from '@tiptap/core'

const ImageExtension = TiptapNode.create({
  name: 'image',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
    }
  },
  parseHTML() {
    return [{ tag: 'img[src]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)]
  },
})
import { useEffect, useCallback, useState, useRef } from 'react'

const TAB_PLACEHOLDERS = [
  'Drop in articles, notes, quotes, images, or fragments. Everything saves automatically.',
  '',
  'Start writing. Your material is in Collect. Your analysis is in Think.',
]

interface EditorProps {
  content: string
  onChange: (html: string) => void
  tabIndex?: number
}

function ToolbarButton({ active, onClick, title, children }: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onMouseDown={e => {
        e.preventDefault() // Prevent losing editor selection
        onClick()
      }}
      title={title}
      style={{
        background: active ? 'rgba(255,255,255,0.15)' : 'none',
        border: 'none',
        color: active ? '#fff' : '#ccc',
        cursor: 'pointer',
        padding: '4px 8px',
        borderRadius: '4px',
        fontSize: '13px',
        fontFamily: "'Inter', sans-serif",
        fontWeight: active ? 600 : 400,
        lineHeight: 1,
      }}
    >
      {children}
    </button>
  )
}

export default function Editor({ content, onChange, tabIndex = 0 }: EditorProps) {
  const [showLinkInput, setShowLinkInput] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [toolbarPos, setToolbarPos] = useState<{ top: number; left: number } | null>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)

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
      ImageExtension,
      Placeholder.configure({
        placeholder: TAB_PLACEHOLDERS[tabIndex] || 'Start writing...',
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML())
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to } = editor.state.selection
      if (from === to) {
        setToolbarPos(null)
        return
      }
      // Get selection coordinates
      const coords = editor.view.coordsAtPos(from)
      const editorRect = editor.view.dom.getBoundingClientRect()
      setToolbarPos({
        top: coords.top - editorRect.top - 44,
        left: Math.max(0, coords.left - editorRect.left),
      })
    },
    editorProps: {
      attributes: {
        class: 'tiptap',
        spellcheck: 'true',
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            event.preventDefault()
            const file = item.getAsFile()
            if (!file) return false
            const reader = new FileReader()
            reader.onload = () => {
              const src = reader.result as string
              view.dispatch(view.state.tr.replaceSelectionWith(
                view.state.schema.nodes.image.create({ src })
              ))
            }
            reader.readAsDataURL(file)
            return true
          }
        }
        return false
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files
        if (!files || files.length === 0) return false
        for (const file of files) {
          if (file.type.startsWith('image/')) {
            event.preventDefault()
            const reader = new FileReader()
            reader.onload = () => {
              const src = reader.result as string
              const pos = view.posAtCoords({ left: event.clientX, top: event.clientY })
              if (pos) {
                view.dispatch(view.state.tr.insert(
                  pos.pos,
                  view.state.schema.nodes.image.create({ src })
                ))
              }
            }
            reader.readAsDataURL(file)
            return true
          }
        }
        return false
      },
    },
  })

  // Hide toolbar when clicking outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as globalThis.Node)) {
        // Don't hide if clicking in the editor (selection update will handle it)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  // Sync content when tab changes
  useEffect(() => {
    if (editor && editor.getHTML() !== content) {
      editor.commands.setContent(content, { emitUpdate: false })
    }
  }, [content, editor])

  // Update placeholder when tab changes
  useEffect(() => {
    if (editor) {
      const placeholder = TAB_PLACEHOLDERS[tabIndex] || 'Start writing...'
      editor.extensionManager.extensions
        .filter(ext => ext.name === 'placeholder')
        .forEach(ext => {
          (ext.options as { placeholder: string }).placeholder = placeholder
          editor.view.dispatch(editor.view.state.tr)
        })
    }
  }, [tabIndex, editor])

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
      {/* Floating format toolbar */}
      {editor && toolbarPos && !editor.state.selection.empty && (
        <div
          ref={toolbarRef}
          style={{
            position: 'absolute',
            top: `${toolbarPos.top}px`,
            left: `${toolbarPos.left}px`,
            display: 'flex',
            gap: '2px',
            padding: '4px 6px',
            background: '#2a2520',
            borderRadius: '8px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            zIndex: 30,
            animation: 'fadeIn 0.15s ease',
          }}
        >
          <ToolbarButton
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold (Cmd+B)"
          >
            B
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic (Cmd+I)"
          >
            I
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            title="Strikethrough"
          >
            S
          </ToolbarButton>
          <div style={{ width: '1px', background: '#444', margin: '2px 4px' }} />
          <ToolbarButton
            active={editor.isActive('heading', { level: 1 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            title="Heading 1"
          >
            H1
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('heading', { level: 2 })}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            title="Heading 2"
          >
            H2
          </ToolbarButton>
          <div style={{ width: '1px', background: '#444', margin: '2px 4px' }} />
          <ToolbarButton
            active={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            title="Quote"
          >
            &ldquo;
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('code')}
            onClick={() => editor.chain().focus().toggleCode().run()}
            title="Code"
          >
            {'<>'}
          </ToolbarButton>
          <ToolbarButton
            active={editor.isActive('link')}
            onClick={() => {
              const previousUrl = editor.getAttributes('link').href
              setLinkUrl(previousUrl || '')
              setShowLinkInput(true)
            }}
            title="Link (Cmd+K)"
          >
            &#9741;
          </ToolbarButton>
        </div>
      )}

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

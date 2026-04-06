export type TabColor = 'coral' | 'amber' | 'sage'

export interface TabRole {
  color: TabColor
  label: string
  icon: string
  tooltip: string
  editable: boolean
}

export const TAB_ROLES: TabRole[] = [
  {
    color: 'amber',
    label: 'Collect',
    icon: '◈',
    tooltip: 'Gather your material — articles, notes, quotes, images, voice, fragments.',
    editable: true,
  },
  {
    color: 'sage',
    label: 'Think',
    icon: '◇',
    tooltip: 'AI analysis of your material and writing.',
    editable: false,
  },
  {
    color: 'coral',
    label: 'Write',
    icon: '✎',
    tooltip: 'Your writing space.',
    editable: true,
  },
]

export interface TabData {
  color: TabColor
  content: string
  hasContent: boolean
}

export interface Project {
  id: string
  title: string
  tabs: TabData[]
  activeTab: number
  createdAt: number
  updatedAt: number
  mirrorContent?: string
}

export const TAB_COLORS: TabColor[] = ['amber', 'sage', 'coral']

export const TAB_CSS_COLORS: Record<TabColor, { solid: string; light: string }> = {
  coral: { solid: '#e8705a', light: '#e8705a40' },
  amber: { solid: '#d4955a', light: '#d4955a40' },
  sage: { solid: '#7aac7a', light: '#7aac7a40' },
}

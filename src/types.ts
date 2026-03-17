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
    color: 'coral',
    label: 'Draft',
    icon: '✎',
    tooltip: 'Your writing. This is where the words live.',
    editable: true,
  },
  {
    color: 'amber',
    label: 'Sources',
    icon: '◈',
    tooltip: 'Raw material — paste articles, quotes, links, data. Pensieve extracts what matters.',
    editable: true,
  },
  {
    color: 'sage',
    label: 'Mirror',
    icon: '◇',
    tooltip: 'A living analysis of your writing — structure, gaps, voice, unused sources. Updated automatically.',
    editable: false,
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

export const TAB_COLORS: TabColor[] = ['coral', 'amber', 'sage']

export const TAB_CSS_COLORS: Record<TabColor, { solid: string; light: string }> = {
  coral: { solid: '#e8705a', light: '#e8705a40' },
  amber: { solid: '#d4955a', light: '#d4955a40' },
  sage: { solid: '#7aac7a', light: '#7aac7a40' },
}

export type TabColor = 'coral' | 'amber' | 'sage' | 'sky' | 'lavender'

export interface TabRole {
  color: TabColor
  label: string
  icon: string
  tooltip: string
}

export const TAB_ROLES: TabRole[] = [
  {
    color: 'coral',
    label: 'Draft',
    icon: '✎',
    tooltip: 'Your main writing. This is where the words live.',
  },
  {
    color: 'amber',
    label: 'Research',
    icon: '◈',
    tooltip: 'Raw material — quotes, links, references, data points.',
  },
  {
    color: 'sage',
    label: 'Outline',
    icon: '≡',
    tooltip: 'Structure your argument. Map the flow before you write.',
  },
  {
    color: 'sky',
    label: 'Scratchpad',
    icon: '~',
    tooltip: 'Freewrite here. No stakes, no structure, just think.',
  },
  {
    color: 'lavender',
    label: 'Feedback',
    icon: '◇',
    tooltip: 'Revision notes, editor comments, things to fix.',
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
}

export const TAB_COLORS: TabColor[] = ['coral', 'amber', 'sage', 'sky', 'lavender']

export const TAB_CSS_COLORS: Record<TabColor, { solid: string; light: string }> = {
  coral: { solid: '#e8705a', light: '#e8705a40' },
  amber: { solid: '#d4955a', light: '#d4955a40' },
  sage: { solid: '#7aac7a', light: '#7aac7a40' },
  sky: { solid: '#7a9ec0', light: '#7a9ec040' },
  lavender: { solid: '#a88bc0', light: '#a88bc040' },
}

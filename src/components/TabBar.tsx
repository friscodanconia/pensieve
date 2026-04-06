import { useState } from 'react'
import type { TabData } from '../types'
import { TAB_CSS_COLORS, TAB_ROLES } from '../types'

interface TabBarProps {
  tabs: TabData[]
  activeTab: number
  onTabChange: (index: number) => void
}

export default function TabBar({ tabs, activeTab, onTabChange }: TabBarProps) {
  const [hoveredTab, setHoveredTab] = useState<number | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
      {/* Pill tabs */}
      <div
        style={{
          display: 'flex',
          gap: '6px',
          padding: '4px',
          background: 'rgba(0,0,0,0.03)',
          borderRadius: '10px',
          flexWrap: 'nowrap',
        }}
      >
        {tabs.map((tab, i) => {
          const colors = TAB_CSS_COLORS[tab.color]
          const role = TAB_ROLES[i]
          const isActive = i === activeTab
          const isHovered = hoveredTab === i

          return (
            <button
              key={tab.color}
              onClick={() => onTabChange(i)}
              onMouseEnter={() => setHoveredTab(i)}
              onMouseLeave={() => setHoveredTab(null)}
              title={role.tooltip}
              aria-selected={isActive}
              role="tab"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '10px 6px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontFamily: "'Inter', sans-serif",
                fontSize: '15px',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                background: isActive
                  ? '#fff'
                  : isHovered
                    ? 'rgba(255,255,255,0.5)'
                    : 'transparent',
                color: isActive
                  ? colors.solid
                  : isHovered
                    ? 'var(--text-secondary)'
                    : 'var(--text-secondary)',
                boxShadow: isActive
                  ? '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)'
                  : 'none',
                // Color indicator dot for active tab
                position: 'relative',
              }}
            >
              {/* Color dot */}
              <span
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: isActive
                    ? colors.solid
                    : tab.hasContent
                      ? colors.light
                      : `${colors.solid}30`,
                  flexShrink: 0,
                  transition: 'all 0.2s ease',
                }}
              />
              <span className="tab-label">{role.label}</span>
            </button>
          )
        })}
      </div>

      {/* Tooltip for hovered tab */}
      {hoveredTab !== null && (
        <div
          style={{
            marginTop: '8px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            fontFamily: "'Inter', sans-serif",
            textAlign: 'center',
            transition: 'opacity 0.2s',
            lineHeight: 1.4,
          }}
        >
          {TAB_ROLES[hoveredTab].tooltip}
        </div>
      )}
    </div>
  )
}

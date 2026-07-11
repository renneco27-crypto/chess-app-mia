import type { Page } from '../App'

interface NavProps {
  current: Page
  onNav: (p: Page) => void
}

const LINKS: { id: Page; label: string }[] = [
  { id: 'learn',  label: 'Learn' },
  { id: 'play',   label: 'Play' },
  { id: 'review', label: 'Review' },
  { id: 'drill',  label: 'Drill' },
]

export function Nav({ current, onNav }: NavProps) {
  return (
    <nav className="nav">
      <div className="nav-logo">
        chess<span>coach</span>
      </div>
      {LINKS.map(({ id, label }) => (
        <button
          key={id}
          className={`nav-link ${current === id ? 'active' : ''}`}
          onClick={() => onNav(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  )
}

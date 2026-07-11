import { useState } from 'react'
import { Nav } from './components/Nav'
import { PlayPage } from './pages/PlayPage'
import { ReviewPage } from './pages/ReviewPage'
import { DrillPage } from './pages/DrillPage'
import { LearnPage } from './pages/LearnPage'

export type Page = 'learn' | 'play' | 'review' | 'drill'

export function App() {
  const [page, setPage] = useState<Page>('learn')

  return (
    <div className="app-shell">
      <Nav current={page} onNav={setPage} />
      <main style={{ overflow: 'hidden', height: '100%' }}>
        {page === 'learn'  && <LearnPage />}
        {page === 'play'   && <PlayPage />}
        {page === 'review' && <ReviewPage />}
        {page === 'drill'  && <DrillPage />}
      </main>
    </div>
  )
}

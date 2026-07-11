// ---------------------------------------------------------------------------
// CSS IMPORT ORDER MATTERS for Chessground:
//   1. chessground base layout/interaction styles
//   2. piece set stylesheet (choose one — CBurnett is Lichess's default open set)
//   3. your global overrides on top
//
// Piece set CSS files live in node_modules/@lichess-org/chessground/assets/
// after `npm install @lichess-org/chessground`. Copy or reference directly:
//   - chessground.base.css   → board geometry, squares, pieces container
//   - piece sets are separate; CBurnett SVGs ship with the package
// ---------------------------------------------------------------------------

// 1. Chessground base — must come before your overrides
import '@lichess-org/chessground/assets/chessground.base.css'

// 2. Piece set — CBurnett is free/open, bundled with chessground examples.
//    If the path below 404s, copy the CSS from:
//    node_modules/@lichess-org/chessground/assets/ into public/pieces/
//    and update this import path.
import '@lichess-org/chessground/assets/chessground.cburnett.css'

// 3. Your design overrides
import './styles/global.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)

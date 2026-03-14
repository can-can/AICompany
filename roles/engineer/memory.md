# Engineer Memory

## Completed Tasks

### 002 - Build the landing page (from PM spec via task 001)
- Created `public/index.html` — landing page with nav, hero, features (3 cards), how-it-works (3 steps), roles, footer
- Created `public/styles.css` — dark theme, fully responsive (mobile/tablet/desktop)
- Updated `bin/lib/web-server.js` — homepage served at `/`, dashboard moved to `/dashboard/`
- All 18 existing tests pass after changes
- Mobile nav toggle and smooth scroll via inline script
- PM acceptance criteria met:
  - [x] Hero with headline, subtitle, CTA
  - [x] 3 feature cards: AI-Powered, Coordinated Roles, Task Automation
  - [x] 3-step How It Works: Human -> PM -> Engineer/QA
  - [x] Footer with copyright
  - [x] Responsive layout
  - [x] Clean, valid HTML and CSS

## Architecture Notes
- Public-facing homepage lives in `public/`
- Internal dashboard lives in `bin/dashboard/`
- Express serves `public/` at root, `bin/dashboard/` at `/dashboard/`
- API endpoints unchanged: `/api/status`, `/api/tasks`, `/api/logs`

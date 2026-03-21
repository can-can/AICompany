# Engineer Memory

## Completed Tasks

### 006 - Build the landing page (from PM task 001)
- Created `public/index.html` — semantic HTML5 landing page (header, section, footer)
- Created `public/styles.css` — dark theme, responsive (mobile < 480px, tablet < 768px, desktop)
- Sections: Hero (headline + CTA), Features (3 cards), How It Works (3 steps), Footer (copyright + links)
- Mobile nav toggle with aria-expanded, smooth scroll for anchor links
- All 43 tests pass
- Acceptance criteria met:
  - [x] All 4 sections render correctly
  - [x] Responsive across mobile, tablet, desktop
  - [x] Semantic HTML5 elements throughout
  - [x] No broken links or missing assets

## Architecture Notes
- Landing page lives in `public/` (index.html + styles.css)
- Internal dashboard lives in `bin/dashboard/`
- Web server currently redirects `/` to `/dashboard` — landing page is servable as static files
- API endpoints: `/api/projects`, `/api/status`, `/api/tasks`, `/api/logs`, `/api/next-id`

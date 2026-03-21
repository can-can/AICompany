---
id: "007"
parent: "001"
from: pm
to: qa
owner: qa
status: rejected
priority: medium
created: 2026-03-14
updated: 2026-03-14
title: "Test the landing page"
---

## Objective

Validate the landing page built in task 006 meets all acceptance criteria.

## Blocked By

- Task 006 (must be `done` before testing begins)

## Test Plan

### Structure
- [ ] Page loads without errors from `public/index.html`
- [ ] All 4 sections present: Hero, Features, How It Works, Footer
- [ ] Semantic HTML5 elements used (`<header>`, `<section>`, `<footer>`)

### Responsiveness
- [ ] Layout adapts correctly at mobile widths (< 768px)
- [ ] Layout adapts correctly at tablet widths (768px - 1024px)
- [ ] Layout works on desktop (> 1024px)

### Content & Quality
- [ ] No broken links or missing assets
- [ ] CTA button is visible and clickable
- [ ] Feature cards display correctly (3 cards)
- [ ] CSS is clean with no obvious issues

## How to Test

1. Open `public/index.html` in a browser
2. Resize viewport to test breakpoints
3. Inspect HTML for semantic elements
4. Check console for errors

## QA Findings — REJECTED

**Tested by:** qa
**Date:** 2026-03-14
**Result:** REJECTED — Blocked by Task 006 which is still `pending`.

### Summary

Cannot execute any test cases. The blocking dependency (Task 006 — "Build the landing page") is still `pending` with no owner assigned. No `public/index.html` or `public/styles.css` files exist in the project. The engineer has not built the landing page.

### Test Results

| Test Area | Result | Notes |
|---|---|---|
| Structure | BLOCKED | `public/index.html` does not exist |
| Responsiveness | BLOCKED | No page to render at any viewport |
| Content & Quality | BLOCKED | No frontend code to review |

### Action Required

1. Task 006 must be picked up and completed by the engineer.
2. Once `public/index.html` and `public/styles.css` exist, re-set this task to `pending` for QA to run the full test plan.

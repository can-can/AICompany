# BDD E2E Test Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Cucumber.js + Playwright BDD E2E tests for the AI Company dashboard alongside existing unit tests.

**Architecture:** Cucumber.js reads `.feature` files and maps Gherkin steps to JS functions that use Playwright to automate a real browser against the running dashboard. The existing `node:test` (backend) and Vitest (frontend) tests are untouched.

**Tech Stack:** Cucumber.js, Playwright, Gherkin, Node.js ESM

**Spec:** `docs/superpowers/specs/2026-03-20-bdd-e2e-test-framework-design.md`

---

### Task 1: Install dependencies and configure project

**Files:**
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `test/e2e/cucumber.js`

- [ ] **Step 1: Install devDependencies**

Run:
```bash
npm install --save-dev @cucumber/cucumber @playwright/test
```

- [ ] **Step 2: Install Chromium browser binary**

Run:
```bash
npx playwright install chromium
```

- [ ] **Step 3: Add test scripts to package.json**

Add these three scripts to the existing `"scripts"` block in `package.json`:

```json
"test:e2e": "cucumber-js --config test/e2e/cucumber.js",
"test:all": "npm test && npm run test:e2e",
"test:e2e:headed": "HEADED=true cucumber-js --config test/e2e/cucumber.js"
```

- [ ] **Step 4: Add reports directory to .gitignore**

Append to `.gitignore`:

```
test/e2e/reports/
```

- [ ] **Step 5: Create Cucumber config**

Create `test/e2e/cucumber.js`:

```js
// Note: this project uses "type": "module" in package.json (ESM).
// Cucumber.js requires `import` (not `require`) for ESM step definitions.
export default {
  paths: ['test/e2e/features/**/*.feature'],
  import: ['test/e2e/step-definitions/**/*.js', 'test/e2e/support/**/*.js'],
  format: ['progress', 'html:test/e2e/reports/report.html'],
}
```

- [ ] **Step 6: Verify existing tests still pass**

Run:
```bash
npm test
```
Expected: All existing backend tests pass (15 tests).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore test/e2e/cucumber.js
git commit -m "chore: add Cucumber.js + Playwright devDependencies and config"
```

---

### Task 2: Create Cucumber World and hooks

**Files:**
- Create: `test/e2e/support/world.js`
- Create: `test/e2e/support/hooks.js`

- [ ] **Step 1: Create the World class**

Create `test/e2e/support/world.js`:

```js
import { World, setWorldConstructor } from '@cucumber/cucumber'

class AppWorld extends World {
  browser = null
  page = null
  baseUrl = process.env.UI_URL || 'http://127.0.0.1:4000'
}

setWorldConstructor(AppWorld)
```

- [ ] **Step 2: Create hooks**

Create `test/e2e/support/hooks.js`:

```js
import { Before, After, AfterAll } from '@cucumber/cucumber'
import { chromium } from '@playwright/test'

let browser = null

Before(async function () {
  if (!browser) {
    browser = await chromium.launch({
      headless: process.env.HEADED !== 'true'
    })
  }
  this.browser = browser
  this.page = await browser.newPage()
})

After(async function (scenario) {
  if (scenario.result?.status === 'FAILED') {
    const screenshot = await this.page.screenshot()
    this.attach(screenshot, 'image/png')
  }
  await this.page?.close()
})

AfterAll(async function () {
  await browser?.close()
})
```

- [ ] **Step 3: Commit**

```bash
git add test/e2e/support/world.js test/e2e/support/hooks.js
git commit -m "feat(e2e): add Cucumber World and lifecycle hooks"
```

---

### Task 3: Create common step definitions and navigation feature

**Files:**
- Create: `test/e2e/step-definitions/common-steps.js`
- Create: `test/e2e/step-definitions/navigation-steps.js`
- Create: `test/e2e/features/navigation.feature`

- [ ] **Step 1: Create common step definitions**

Create `test/e2e/step-definitions/common-steps.js`:

```js
import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

Given('the dashboard is open', async function () {
  await this.page.goto(this.baseUrl)
  await this.page.waitForLoadState('networkidle')
})

Given('I navigate to the {string} project', async function (project) {
  await this.page.getByRole('link', { name: project }).first().click()
  await this.page.waitForLoadState('networkidle')
})

When('I refresh the page', async function () {
  await this.page.reload()
  await this.page.waitForLoadState('networkidle')
})

When('I wait for an agent response', async function () {
  const before = await this.page.locator('[class*="justify-start"]').count()
  await expect(this.page.locator('[class*="justify-start"]'))
    .toHaveCount(before + 1, { timeout: 60000 })
})

// Shared step used by both navigation and chat features
Then('the composer input is visible', async function () {
  await expect(this.page.getByPlaceholder('Type a message...')).toBeVisible()
})
```

- [ ] **Step 2: Create navigation step definitions**

Create `test/e2e/step-definitions/navigation-steps.js`:

```js
import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

When('I click on the {string} project card', async function (project) {
  await this.page.getByRole('link', { name: project }).first().click()
  await this.page.waitForLoadState('networkidle')
})

When('I click on the {string} sidebar role', async function (role) {
  // Sidebar shows 3-letter abbreviations but has title attribute with full name
  await this.page.getByTitle(new RegExp(role, 'i')).click()
  await this.page.waitForLoadState('networkidle')
})

Then('the project heading {string} is visible', async function (heading) {
  await expect(this.page.getByRole('heading', { name: heading })).toBeVisible()
})

Then('the roles list is visible', async function () {
  // DOM text is "Roles" (CSS uppercase makes it visual "ROLES")
  await expect(this.page.getByRole('heading', { name: /roles/i })).toBeVisible()
})

Then('the role name {string} is visible', async function (name) {
  // Role name is a <span>, not a heading
  await expect(this.page.getByText(name, { exact: true })).toBeVisible()
})

Then('the projects list is visible', async function () {
  // DOM text is "Projects" (CSS uppercase makes it visual "PROJECTS")
  await expect(this.page.getByRole('heading', { name: /projects/i })).toBeVisible()
})
```

- [ ] **Step 3: Create navigation feature file**

Create `test/e2e/features/navigation.feature`:

```gherkin
Feature: Dashboard navigation

  Scenario: Click project card navigates to project view
    Given the dashboard is open
    When I click on the "RabT" project card
    Then the project heading "RabT" is visible
    And the roles list is visible

  Scenario: Click role in sidebar navigates to that role's chat
    Given the dashboard is open
    And I navigate to the "RabT" project
    And I click on the "engineer" role
    When I click on the "PM" sidebar role
    Then the role name "PM" is visible
    And the composer input is visible

  Scenario: Click All Projects breadcrumb navigates back
    Given the dashboard is open
    And I navigate to the "RabT" project
    When I click "All Projects"
    Then the projects list is visible
```

- [ ] **Step 4: Run navigation E2E tests**

Prerequisite: AI Company server must be running (`node bin/ai-company.js start` with a project "RabT").

Run:
```bash
npm run test:e2e -- --name "Dashboard navigation"
```
Expected: 3 scenarios pass.

- [ ] **Step 5: Commit**

```bash
git add test/e2e/step-definitions/common-steps.js test/e2e/step-definitions/navigation-steps.js test/e2e/features/navigation.feature
git commit -m "feat(e2e): add navigation feature with common and navigation step definitions"
```

---

### Task 4: Create chat step definitions and chat-messaging feature

**Files:**
- Create: `test/e2e/step-definitions/chat-steps.js`
- Create: `test/e2e/features/chat-messaging.feature`

- [ ] **Step 1: Create chat step definitions**

Create `test/e2e/step-definitions/chat-steps.js`:

```js
import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

When('I click on the {string} role', async function (role) {
  await this.page.getByRole('link', { name: new RegExp(role, 'i') }).first().click()
  await this.page.waitForLoadState('networkidle')
})

When('I type {string} in the composer', async function (text) {
  await this.page.getByPlaceholder('Type a message...').fill(text)
})

When('I click Send', async function () {
  await this.page.getByRole('button', { name: 'Send' }).click()
})

When('I press Enter in the composer', async function () {
  await this.page.getByPlaceholder('Type a message...').press('Enter')
})

// Note: 'the composer input is visible' step is in common-steps.js (shared with navigation)

Then('the composer input placeholder is {string}', async function (placeholder) {
  await expect(this.page.getByPlaceholder(placeholder)).toBeVisible()
})

Then('the composer input is empty', async function () {
  await expect(this.page.getByPlaceholder('Type a message...')).toHaveValue('')
})

Then('the Send button is disabled', async function () {
  await expect(this.page.getByRole('button', { name: 'Send' })).toBeDisabled()
})

Then('the Send button is enabled', async function () {
  await expect(this.page.getByRole('button', { name: 'Send' })).toBeEnabled()
})

Then('the user message {string} appears in the chat', async function (text) {
  await expect(this.page.locator('[class*="justify-end"]', { hasText: text }))
    .toBeVisible({ timeout: 10000 })
})

Then('an assistant message is visible', async function () {
  await expect(this.page.locator('[class*="justify-start"]').last())
    .toBeVisible({ timeout: 60000 })
})

Then('no status bar is visible', async function () {
  await expect(this.page.getByText('Agent is working...')).not.toBeVisible()
  await expect(this.page.getByText('Agent is finishing up...')).not.toBeVisible()
})

Then('the status bar shows {string}', async function (text) {
  await expect(this.page.getByText(text)).toBeVisible({ timeout: 10000 })
})

When('I note the message count', async function () {
  this.previousMessageCount = await this.page
    .locator('[class*="justify-start"], [class*="justify-end"]').count()
})

Then('the message count has increased', async function () {
  const current = await this.page
    .locator('[class*="justify-start"], [class*="justify-end"]').count()
  expect(current).toBeGreaterThan(this.previousMessageCount)
})

When('{string} is visible', async function (text) {
  await expect(this.page.getByText(text)).toBeVisible()
})

When('I click {string}', async function (text) {
  await this.page.getByText(text, { exact: false }).click()
})
```

- [ ] **Step 2: Create chat-messaging feature file**

Create `test/e2e/features/chat-messaging.feature`:

```gherkin
Feature: Send messages to any role at any time

  Background:
    Given the dashboard is open
    And I navigate to the "RabT" project

  Scenario: Composer is enabled for a free role
    When I click on the "engineer" role
    Then the composer input is visible
    And the composer input placeholder is "Type a message..."
    And the Send button is disabled

  Scenario: Composer is enabled for a waiting_human role
    When I click on the "qa" role
    Then the composer input is visible
    And the composer input placeholder is "Type a message..."

  Scenario: Send button enables when text is typed
    When I click on the "engineer" role
    And I type "hello" in the composer
    Then the Send button is enabled

  Scenario: Click Send submits message
    When I click on the "engineer" role
    And I type "hello engineer" in the composer
    And I click Send
    Then the user message "hello engineer" appears in the chat
    And the composer input is empty

  Scenario: Press Enter submits message
    When I click on the "engineer" role
    And I type "hello via enter" in the composer
    And I press Enter in the composer
    Then the user message "hello via enter" appears in the chat
    And the composer input is empty

  Scenario: Send message to free role and receive agent response then persist after refresh
    When I click on the "engineer" role
    And I type "what is 2+2" in the composer
    And I click Send
    Then the user message "what is 2+2" appears in the chat
    When I wait for an agent response
    Then an assistant message is visible
    When I refresh the page
    And I navigate to the "RabT" project
    And I click on the "engineer" role
    Then the user message "what is 2+2" appears in the chat
    And an assistant message is visible

  @flaky
  Scenario: Status bar shows only for working and ready states
    When I click on the "engineer" role
    Then no status bar is visible
    When I type "trigger work" in the composer
    And I click Send
    Then the status bar shows "Agent is working..."

  Scenario: Load older messages button loads paginated history
    When I click on the "qa" role
    And I note the message count
    And "Load older messages" is visible
    And I click "Load older messages"
    Then the message count has increased
```

- [ ] **Step 3: Run all E2E tests**

Run:
```bash
npm run test:e2e
```
Expected: 11 scenarios (3 navigation + 8 chat-messaging) pass. The `@flaky` scenario may need retry.

- [ ] **Step 4: Commit**

```bash
git add test/e2e/step-definitions/chat-steps.js test/e2e/features/chat-messaging.feature
git commit -m "feat(e2e): add chat-messaging feature with composer and send step definitions"
```

---

### Task 5: Full verification

- [ ] **Step 1: Run existing unit tests**

Run:
```bash
npm test
```
Expected: 15 backend tests pass.

- [ ] **Step 2: Run dashboard unit tests**

Run:
```bash
cd dashboard && npx vitest run
```
Expected: 14 frontend tests pass.

- [ ] **Step 3: Run full E2E suite**

Run:
```bash
npm run test:e2e
```
Expected: 11 scenarios pass (or 10 + 1 flaky).

- [ ] **Step 4: Run headed mode to visually verify**

Run:
```bash
npm run test:e2e:headed
```
Expected: Browser window opens, scenarios execute visibly, all pass.

- [ ] **Step 5: Run everything together**

Run:
```bash
npm run test:all
```
Expected: Unit tests + E2E tests all pass.

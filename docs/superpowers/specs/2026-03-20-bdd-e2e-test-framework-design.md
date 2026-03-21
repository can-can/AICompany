# BDD E2E Test Framework Design

## Context

The AI Company dashboard lacks structured browser-level tests. UI verification was done via ad-hoc `agent-browser` CLI scripts with no assertions framework, no reusable test cases, and no pass/fail tracking. The "send messages to any role" feature needs proper E2E coverage.

## Decision

Introduce Cucumber.js + Playwright as an E2E BDD test layer alongside the existing unit tests (node:test for backend, Vitest for frontend). The existing unit tests remain untouched.

## Architecture

### Stack

- **Gherkin** — plain-English `.feature` files defining scenarios
- **Cucumber.js** — reads feature files, maps each step to a JavaScript function
- **Playwright** — browser automation and assertions inside step definitions
- **Existing unit tests** — unchanged (`node:test` backend, Vitest frontend)

### Directory Structure

```
test/
  e2e/
    features/
      chat-messaging.feature
      navigation.feature
    step-definitions/
      chat-steps.js
      navigation-steps.js
      common-steps.js
    support/
      world.js
      hooks.js
    cucumber.js
  role-manager.test.js          # Existing, untouched
  logger.test.js                # Existing, untouched
  ...
dashboard/__tests__/            # Existing, untouched
```

### Dependencies

devDependencies (must be added to `package.json` — it currently has no `devDependencies` section):
- `@cucumber/cucumber`
- `@playwright/test` (used for `chromium` launcher + `expect` assertions, not its test runner)

Setup after install:
- `npx playwright install chromium` — downloads the Chromium browser binary

Generated artifacts to gitignore:
- `test/e2e/reports/` — add to `.gitignore`

## World & Hooks

### World (test/e2e/support/world.js)

Custom Cucumber World holds Playwright `browser`, `page`, and `baseUrl` per scenario.

```js
import { World, setWorldConstructor } from '@cucumber/cucumber'

class AppWorld extends World {
  browser = null
  page = null
  baseUrl = process.env.UI_URL || 'http://127.0.0.1:4000'
}

setWorldConstructor(AppWorld)
```

### Hooks (test/e2e/support/hooks.js)

- **Before**: Reuse single browser instance, create fresh page per scenario.
- **After**: Screenshot on failure (attached to Cucumber report), close page.
- **AfterAll**: Close browser.
- **Headed mode**: `HEADED=true` env var launches visible browser for debugging.

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

## Feature Files

### chat-messaging.feature

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
    # Note: This scenario is inherently flaky because the "working" state
    # is transient — the agent may process too quickly for the assertion to
    # catch it. Consider adding a test-only API to force role state if this
    # becomes unreliable.

  Scenario: Load older messages button loads paginated history
    When I click on the "qa" role
    And I note the message count
    And "Load older messages" is visible
    And I click "Load older messages"
    Then the message count has increased
```

### navigation.feature

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

## Step Definitions

### common-steps.js

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
  // Count existing assistant messages first, then wait for a new one to appear
  const before = await this.page.locator('[class*="justify-start"]').count()
  await expect(this.page.locator('[class*="justify-start"]'))
    .toHaveCount(before + 1, { timeout: 60000 })
})

// Shared step used by both navigation and chat features
Then('the composer input is visible', async function () {
  await expect(this.page.getByPlaceholder('Type a message...')).toBeVisible()
})
```

### chat-steps.js

```js
import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

// Note: 'the composer input is visible' step is in common-steps.js (shared with navigation)

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

### navigation-steps.js

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

## Configuration

### Cucumber config (test/e2e/cucumber.js)

```js
// Note: this project uses "type": "module" in package.json (ESM).
// Cucumber.js requires `import` (not `require`) for ESM step definitions.
export default {
  paths: ['test/e2e/features/**/*.feature'],
  import: ['test/e2e/step-definitions/**/*.js', 'test/e2e/support/**/*.js'],
  format: ['progress', 'html:test/e2e/reports/report.html'],
}
```

### package.json scripts (additions)

Add these new scripts alongside the existing `test`, `build:dashboard`, `dev:dashboard`:

```json
{
  "test:e2e": "cucumber-js --config test/e2e/cucumber.js",
  "test:all": "npm test && npm run test:e2e",
  "test:e2e:headed": "HEADED=true cucumber-js --config test/e2e/cucumber.js"
}
```

## Locator Strategy

Step definitions use Playwright's recommended locators for resilience:
- `getByRole` — buttons, links, headings
- `getByPlaceholder` — input fields
- `getByText` — text content
- `locator('[class*="justify-end"]')` — user messages (structural layout class)
- `locator('[class*="justify-start"]')` — assistant messages (structural layout class)

## Assumptions

- Server must be running before E2E tests (`node bin/ai-company.js start`)
- The "RabT" project exists and has roles with sessions initialized
- Agent response timeout is 60s (SDK/LLM calls can be slow)
- Tests run sequentially (no parallel) to avoid state conflicts between scenarios that send messages
- QA role must have enough conversation history to trigger the "Load older messages" button (pagination threshold)
- `AfterAll` hook does not receive a Cucumber World context — it uses the module-level `browser` variable, not `this.browser`
- Avoid writing `I click "Send"` (quoted) in feature files — it would create an ambiguous match with the literal `I click Send` step. Use unquoted `I click Send` for the composer button

## Test Commands

| Command | What it runs |
|---------|-------------|
| `npm test` | Backend unit tests (node:test) |
| `cd dashboard && npm test` | Frontend unit tests (Vitest) |
| `npm run test:e2e` | BDD E2E tests (Cucumber + Playwright, headless) |
| `npm run test:e2e:headed` | BDD E2E tests (visible browser) |
| `npm run test:all` | Unit + E2E |

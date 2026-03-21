import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

// Note: 'the composer input is visible' step is in common-steps.js (shared with navigation)

When('I click on the {string} role', async function (role) {
  await this.page.getByRole('link', { name: new RegExp(role, 'i') }).first().click()
  await this.page.waitForLoadState('domcontentloaded')
})

When('I type {string} in the composer', async function (text) {
  await this.page.getByPlaceholder('Type a message...').fill(text)
})

When('I type a unique test message in the composer', async function () {
  this.uniqueTestMessage = `e2e-test-${Date.now()}`
  await this.page.getByPlaceholder('Type a message...').fill(this.uniqueTestMessage)
})

Then('the unique test message appears in the chat', async function () {
  await expect(this.page.locator('[class*="justify-end"]', { hasText: this.uniqueTestMessage }).first())
    .toBeVisible({ timeout: 10000 })
})

When('I click Send', async function () {
  await this.page.getByRole('button', { name: 'Send' }).click()
})

When('I press Enter in the composer', async function () {
  const input = this.page.getByPlaceholder('Type a message...')
  // In headless Chromium, pressing Enter in a textarea inserts a newline.
  // Prevent it via beforeinput (doesn't interfere with keydown/keypress handlers).
  await input.evaluate(el => {
    el.addEventListener('beforeinput', e => {
      if (e.inputType === 'insertLineBreak') e.preventDefault()
    }, { once: true })
  })
  await input.press('Enter')
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
  await expect(this.page.locator('[class*="justify-end"]', { hasText: text }).first())
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

Then('the last assistant message contains a {string} element', async function (tag) {
  const lastAssistant = this.page.locator('[class*="justify-start"]').last()
  await expect(lastAssistant).toBeVisible({ timeout: 10000 })
  await expect(lastAssistant.locator(tag).first()).toBeVisible({ timeout: 5000 })
})

Then('an assistant message contains a {string} element', async function (tag) {
  // Wait for chat to load (composer visible means messages are rendered)
  await expect(this.page.getByPlaceholder('Type a message...')).toBeVisible({ timeout: 10000 })
  // Wait for at least one assistant message
  await expect(this.page.locator('[class*="justify-start"]').first()).toBeVisible({ timeout: 10000 })
  // Check if any assistant message contains the given HTML element
  await expect(this.page.locator(`[class*="justify-start"] ${tag}`).first()).toBeVisible({ timeout: 5000 })
})

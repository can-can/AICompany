import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

Then('the roles section is visible', async function () {
  await expect(this.page.getByRole('heading', { name: /roles/i })).toBeVisible()
})

Then('I see a role card for {string}', async function (role) {
  await expect(this.page.locator('a', { hasText: new RegExp(role, 'i') }).first()).toBeVisible()
})

Then('the role card for {string} shows a state label', async function (role) {
  const card = this.page.locator('a', { hasText: new RegExp(role, 'i') }).first()
  // State labels: free, working, waiting, ready
  await expect(card.locator('text=/free|working|waiting|ready/i')).toBeVisible()
})

Then('the role card for {string} shows queue depth', async function (role) {
  const card = this.page.locator('a', { hasText: new RegExp(role, 'i') }).first()
  await expect(card.locator('text=/queue:/i')).toBeVisible()
})

When('I click the role card for {string}', async function (role) {
  await this.page.locator('a', { hasText: new RegExp(role, 'i') }).first().click()
  await this.page.waitForLoadState('domcontentloaded')
})

Then('the breadcrumb shows {string}', async function (text) {
  await expect(this.page.locator('header').getByText(text)).toBeVisible()
})

Then('the role heading shows {string}', async function (role) {
  await expect(this.page.locator('header span.uppercase', { hasText: new RegExp(role, 'i') })).toBeVisible()
})

Then('the tasks section is visible', async function () {
  await expect(this.page.getByRole('heading', { name: /tasks/i })).toBeVisible()
})

Then('the log section is visible', async function () {
  await expect(this.page.getByRole('heading', { name: /log/i })).toBeVisible()
})

When('I click the breadcrumb {string}', async function (text) {
  await this.page.locator('header').getByRole('link', { name: text }).click()
  await this.page.waitForLoadState('domcontentloaded')
})

Then('the user message {string} is not in the chat', async function (text) {
  await expect(this.page.locator('[class*="justify-end"]', { hasText: text })).toHaveCount(0)
})

Given('I navigate directly to {string}', async function (path) {
  await this.page.goto(`${this.baseUrl}${path}`)
  await this.page.waitForLoadState('domcontentloaded')
})

Then('the role card for {string} shows {string}', async function (role, text) {
  const card = this.page.locator('a', { hasText: new RegExp(role, 'i') }).first()
  await expect(card.getByText(text)).toBeVisible()
})

Then('the log section contains entries', async function () {
  // Log feed is a monospace div; entries have timestamp spans
  const logContainer = this.page.locator('.font-mono.text-xs')
  await expect(logContainer.locator('div').first()).toBeVisible({ timeout: 10000 })
})

Then('the task table headers are visible', async function () {
  await expect(this.page.locator('th', { hasText: 'ID' })).toBeVisible()
  await expect(this.page.locator('th', { hasText: 'Title' })).toBeVisible()
  await expect(this.page.locator('th', { hasText: 'Status' })).toBeVisible()
})

Then('I see a project card for {string}', async function (project) {
  await expect(this.page.getByRole('link', { name: project })).toBeVisible()
})

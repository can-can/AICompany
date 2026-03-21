import { Given, When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

Given('the dashboard is open', async function () {
  await this.page.goto(this.baseUrl)
  await this.page.waitForLoadState('domcontentloaded')
})

Given('I navigate to the {string} project', async function (project) {
  await this.page.getByRole('link', { name: project }).first().click()
  await this.page.waitForLoadState('domcontentloaded')
})

When('I refresh the page', async function () {
  await this.page.reload()
  await this.page.waitForLoadState('domcontentloaded')
})

When('I wait for an agent response', async function () {
  const before = await this.page.locator('[class*="justify-start"]').count()
  await expect(this.page.locator('[class*="justify-start"]'))
    .toHaveCount(before + 1, { timeout: 90000 })
})

// Shared step used by both navigation and chat features
Then('the composer input is visible', async function () {
  await expect(this.page.getByPlaceholder('Type a message...')).toBeVisible()
})

import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

Then('no task row shows status {string}', async function (status) {
  const section = this.page.locator('section', { hasText: /tasks/i })
  await expect(section).toBeVisible({ timeout: 5000 })
  const badges = section.locator('span.rounded-full', { hasText: status })
  await expect(badges).toHaveCount(0)
})

Then('a task row with status {string} is visible', async function (status) {
  const section = this.page.locator('section', { hasText: /tasks/i })
  await expect(section.locator('span.rounded-full', { hasText: status }).first()).toBeVisible({ timeout: 5000 })
})

Then('a {string} button is visible in the tasks section', async function (text) {
  const section = this.page.locator('section', { hasText: /tasks/i })
  await expect(section.getByRole('button', { name: text })).toBeVisible({ timeout: 5000 })
})

When('I click the {string} button in the tasks section', async function (text) {
  const section = this.page.locator('section', { hasText: /tasks/i })
  await section.getByRole('button', { name: text }).click()
})

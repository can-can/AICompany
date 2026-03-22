import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

Then('the slash command menu is visible', async function () {
  await expect(this.page.locator('[cmdk-root]')).toBeVisible({ timeout: 3000 })
})

Then('the slash command menu is not visible', async function () {
  await expect(this.page.locator('[cmdk-root]')).not.toBeVisible({ timeout: 3000 })
})

Then('the slash command menu contains {string}', async function (text) {
  const menu = this.page.locator('[cmdk-root]')
  await expect(menu.getByText(text)).toBeVisible({ timeout: 3000 })
})

Then('the slash command menu does not contain {string}', async function (text) {
  const menu = this.page.locator('[cmdk-root]')
  await expect(menu.getByText(text)).not.toBeVisible({ timeout: 3000 })
})

When('I press Escape in the composer', async function () {
  const input = this.page.getByPlaceholder('Type a message...')
  await input.press('Escape')
})

When('I press Enter in the slash command menu', async function () {
  const input = this.page.getByPlaceholder('Type a message...')
  await input.press('Enter')
})

When('I click the {string} command in the menu', async function (text) {
  const menu = this.page.locator('[cmdk-root]')
  await menu.getByText(text).click()
})

Then('the chat messages are cleared', async function () {
  const messages = this.page.locator('[class*="justify-start"], [class*="justify-end"]')
  await expect(messages).toHaveCount(0, { timeout: 5000 })
})

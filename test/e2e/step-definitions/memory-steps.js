import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

Then('a {string} link is visible in the header', async function (text) {
  await expect(this.page.locator('header').getByRole('link', { name: text })).toBeVisible({ timeout: 5000 })
})

When('I click the {string} link', async function (text) {
  await this.page.locator('header').getByRole('link', { name: text }).click()
  await this.page.waitForURL(/\/memory/, { timeout: 5000 })
})

Then('the memory file list contains {string}', async function (text) {
  await expect(this.page.locator('nav').getByText(text).first()).toBeVisible({ timeout: 5000 })
})

When('I click {string} in the memory file list', async function (text) {
  await this.page.locator('nav').getByText(text, { exact: true }).first().click()
})

Then('the memory preview contains a heading', async function () {
  await expect(this.page.locator('main .prose h1, main .prose h2').first()).toBeVisible({ timeout: 5000 })
})

When('I click the {string} button in the memory editor', async function (text) {
  await this.page.locator('main').getByRole('button', { name: text }).click()
})

Then('the memory editor textarea is visible', async function () {
  await expect(this.page.locator('main textarea')).toBeVisible({ timeout: 5000 })
})

Then('the memory editor textarea contains {string}', async function (text) {
  const textarea = this.page.locator('main textarea')
  await expect(textarea).toBeVisible({ timeout: 5000 })
  const value = await textarea.inputValue()
  expect(value).toContain(text)
})

When('I append {string} to the memory editor', async function (text) {
  const textarea = this.page.locator('main textarea')
  await expect(textarea).toBeVisible()
  const current = await textarea.inputValue()
  await textarea.fill(current + text)
})

When('I remove {string} from the memory editor', async function (text) {
  const textarea = this.page.locator('main textarea')
  await expect(textarea).toBeVisible()
  const current = await textarea.inputValue()
  await textarea.fill(current.replace(text, ''))
})

Then('the {string} confirmation is visible', async function (text) {
  await expect(this.page.getByText(text)).toBeVisible({ timeout: 5000 })
})

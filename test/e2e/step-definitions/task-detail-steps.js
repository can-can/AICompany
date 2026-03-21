import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

When('I click on task {string} in the task table', async function (taskId) {
  const row = this.page.locator('tr', { hasText: taskId }).first()
  await expect(row).toBeVisible({ timeout: 10000 })
  await row.click()
  await this.page.waitForURL(/\/task\//, { timeout: 5000 })
})

Then('the URL contains {string}', async function (path) {
  expect(this.page.url()).toContain(path)
})

Then('the URL does not contain {string}', async function (path) {
  expect(this.page.url()).not.toContain(path)
})

Then('the task title is visible', async function () {
  await expect(this.page.locator('h1').first()).toBeVisible({ timeout: 5000 })
})

Then('the task status dropdown is visible', async function () {
  await expect(this.page.locator('select').first()).toBeVisible({ timeout: 5000 })
})

Then('the task body contains a heading', async function () {
  await expect(this.page.locator('.prose h2, .prose h3').first()).toBeVisible({ timeout: 5000 })
})

Then('the task body contains a list item', async function () {
  await expect(this.page.locator('.prose li').first()).toBeVisible({ timeout: 5000 })
})

When('I note the current task status', async function () {
  const select = this.page.locator('select').first()
  await expect(select).toBeVisible({ timeout: 5000 })
  this.originalTaskStatus = await select.inputValue()
})

When('I change the task status to {string}', async function (status) {
  await this.page.locator('select').first().selectOption(status)
  await this.page.waitForTimeout(500)
})

When('I change the task status to the original status', async function () {
  if (this.originalTaskStatus) {
    await this.page.locator('select').first().selectOption(this.originalTaskStatus)
    await this.page.waitForTimeout(500)
  }
})

Then('the task status dropdown shows {string}', async function (status) {
  await expect(this.page.locator('select').first()).toHaveValue(status)
})

When('I click the project breadcrumb', async function () {
  // The breadcrumb has: All Projects / {project} / Task #xxx
  // Click the project name link (second link in header)
  await this.page.locator('header a', { hasText: /test-company/ }).click()
  await this.page.waitForURL(/\/[^/]+$/, { timeout: 5000 })
})

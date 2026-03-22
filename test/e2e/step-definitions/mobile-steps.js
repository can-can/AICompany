import { Given, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

Given('the viewport is {int} by {int}', async function (width, height) {
  await this.page.setViewportSize({ width, height })
})

Then('the page has no horizontal overflow', async function () {
  const hasOverflow = await this.page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth
  })
  expect(hasOverflow).toBe(false)
})

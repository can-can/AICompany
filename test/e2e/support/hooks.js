import { Before, After, AfterAll, setDefaultTimeout } from '@cucumber/cucumber'
import { chromium } from '@playwright/test'

setDefaultTimeout(60000)

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

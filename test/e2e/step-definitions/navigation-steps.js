import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

When('I click on the {string} project card', async function (project) {
  await this.page.getByRole('link', { name: project }).first().click()
  await this.page.waitForLoadState('domcontentloaded')
})

When('I click on the {string} sidebar role', async function (role) {
  // Sidebar shows 3-letter abbreviations but has title attribute with full name
  await this.page.getByTitle(new RegExp(role, 'i')).click()
  // Wait for client-side navigation and initial data load to complete
  await this.page.waitForURL(new RegExp(`/chat/${role}`, 'i'))
  // Wait for the composer to appear (initial messages loaded, runtime ready)
  const { expect } = await import('@playwright/test')
  await expect(this.page.getByPlaceholder('Type a message...')).toBeVisible()
  // Allow runtime to stabilize after initial load
  await this.page.waitForTimeout(300)
})

Then('the project heading {string} is visible', async function (heading) {
  await expect(this.page.getByRole('heading', { name: heading })).toBeVisible()
})

Then('the roles list is visible', async function () {
  // DOM text is "Roles" (CSS uppercase makes it visual "ROLES")
  await expect(this.page.getByRole('heading', { name: /roles/i })).toBeVisible()
})

Then('the role name {string} is visible', async function (name) {
  // Role name is a <span> in the header with CSS uppercase
  await expect(this.page.locator('header span.uppercase', { hasText: new RegExp(name, 'i') })).toBeVisible()
})

Then('the projects list is visible', async function () {
  // DOM text is "Projects" (CSS uppercase makes it visual "PROJECTS")
  await expect(this.page.getByRole('heading', { name: /projects/i })).toBeVisible()
})

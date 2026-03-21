import { When, Then } from '@cucumber/cucumber'
import { expect } from '@playwright/test'

When('I click on the {string} project card', async function (project) {
  await this.page.getByRole('link', { name: project }).first().click()
  await this.page.waitForLoadState('domcontentloaded')
})

When('I click on the {string} sidebar role', async function (role) {
  // Sidebar shows 3-letter abbreviations but has title attribute with full name
  await this.page.getByTitle(new RegExp(role, 'i')).click()
  await this.page.waitForLoadState('domcontentloaded')
})

Then('the project heading {string} is visible', async function (heading) {
  await expect(this.page.getByRole('heading', { name: heading })).toBeVisible()
})

Then('the roles list is visible', async function () {
  // DOM text is "Roles" (CSS uppercase makes it visual "ROLES")
  await expect(this.page.getByRole('heading', { name: /roles/i })).toBeVisible()
})

Then('the role name {string} is visible', async function (name) {
  // Role name is a <span> with CSS uppercase — DOM text is lowercase
  await expect(this.page.getByText(new RegExp(`^${name}$`, 'i'))).toBeVisible()
})

Then('the projects list is visible', async function () {
  // DOM text is "Projects" (CSS uppercase makes it visual "PROJECTS")
  await expect(this.page.getByRole('heading', { name: /projects/i })).toBeVisible()
})

// Note: this project uses "type": "module" in package.json (ESM).
// Cucumber.js requires `import` (not `require`) for ESM step definitions.
export default {
  paths: ['test/e2e/features/**/*.feature'],
  import: ['test/e2e/step-definitions/**/*.js', 'test/e2e/support/**/*.js'],
  format: ['progress', 'html:test/e2e/reports/report.html'],
  tags: 'not @requires-history',
}

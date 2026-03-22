Feature: Memory management page

  Background:
    Given the dashboard is open
    And I navigate to the "test-company" project

  Scenario: Memory link is visible on project dashboard
    Then a "Memory" link is visible in the header

  Scenario: Memory page shows file list
    When I click the "Memory" link
    Then the URL contains "/memory"
    And the memory file list contains "company.md"
    And the memory file list contains "CLAUDE.md"
    And the memory file list contains "memory.md"

  Scenario: Clicking a file shows rendered markdown preview
    When I click the "Memory" link
    And I click "company.md" in the memory file list
    Then the memory preview contains a heading

  Scenario: Switching to edit mode shows raw markdown
    When I click the "Memory" link
    And I click "company.md" in the memory file list
    And I click the "Edit" button in the memory editor
    Then the memory editor textarea is visible
    And the memory editor textarea contains "# Company Memory"

  Scenario: Editing and saving a file persists after refresh
    When I click the "Memory" link
    And I click "company.md" in the memory file list
    And I click the "Edit" button in the memory editor
    And I append " — e2e-test-edit" to the memory editor
    And I click the "Save" button in the memory editor
    Then the "Saved" confirmation is visible
    When I refresh the page
    And I navigate to the "test-company" project
    And I click the "Memory" link
    And I click "company.md" in the memory file list
    And I click the "Edit" button in the memory editor
    Then the memory editor textarea contains "e2e-test-edit"
    # Clean up: remove the test edit
    And I remove " — e2e-test-edit" from the memory editor
    And I click the "Save" button in the memory editor

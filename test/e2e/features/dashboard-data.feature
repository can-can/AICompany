Feature: Dashboard displays live data for roles, tasks, and logs

  Background:
    Given the dashboard is open
    And I navigate to the "test-company" project

  Scenario: Role cards show "No active task" when idle
    Then the role card for "engineer" shows "No active task"
    And the role card for "pm" shows "No active task"

  Scenario: Log feed shows entries after activity
    Then the log section contains entries

  Scenario: Task table renders headers even when empty
    Then the task table headers are visible

  Scenario: Project list shows registered projects
    When I click "All Projects"
    Then I see a project card for "test-company"

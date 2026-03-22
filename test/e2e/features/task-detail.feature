Feature: View task details and change status

  Background:
    Given the dashboard is open
    And I navigate to the "test-company" project
    And I click the "Show done" button in the tasks section

  Scenario: Click task row navigates to detail view
    When I click on task "001" in the task table
    Then the URL contains "/task/001"
    And the task title is visible
    And the task status dropdown is visible

  Scenario: Task detail shows rendered markdown content
    When I click on task "001" in the task table
    Then the task body contains a heading
    And the task body contains a list item

  Scenario: Status dropdown changes task status
    When I click on task "001" in the task table
    And I note the current task status
    And I change the task status to "in_progress"
    Then the task status dropdown shows "in_progress"
    And I change the task status to the original status

  Scenario: Breadcrumb navigates back to dashboard
    When I click on task "001" in the task table
    And I click the project breadcrumb
    Then the URL does not contain "/task/"
    And the tasks section is visible

Feature: Task list filtering and sorting

  Background:
    Given the dashboard is open
    And I navigate to the "test-company" project

  Scenario: Done tasks are hidden by default
    Then the tasks section is visible
    And no task row shows status "done"
    And a "Show done" button is visible in the tasks section

  Scenario: Show done button reveals completed tasks
    When I click the "Show done" button in the tasks section
    Then a task row with status "done" is visible
    And a "Hide done" button is visible in the tasks section

  Scenario: Hide done button hides completed tasks again
    When I click the "Show done" button in the tasks section
    Then a task row with status "done" is visible
    When I click the "Hide done" button in the tasks section
    Then no task row shows status "done"

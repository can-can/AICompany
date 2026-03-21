Feature: Project dashboard displays roles, tasks, and logs

  Background:
    Given the dashboard is open
    And I navigate to the "test-company" project

  Scenario: Dashboard shows role cards for all project roles
    Then the roles section is visible
    And I see a role card for "pm"
    And I see a role card for "engineer"

  Scenario: Role cards show state and queue info
    Then the role card for "pm" shows a state label
    And the role card for "pm" shows queue depth

  Scenario: Clicking a role card navigates to that role's chat
    When I click the role card for "engineer"
    Then the composer input is visible
    And the breadcrumb shows "test-company"
    And the role heading shows "engineer"

  Scenario: Tasks section is visible on dashboard
    Then the tasks section is visible

  Scenario: Log section is visible on dashboard
    Then the log section is visible

Feature: Dashboard navigation

  Scenario: Click project card navigates to project view
    Given the dashboard is open
    When I click on the "test-company" project card
    Then the project heading "test-company" is visible
    And the roles list is visible

  Scenario: Click role in sidebar navigates to that role's chat
    Given the dashboard is open
    And I navigate to the "test-company" project
    And I click on the "engineer" role
    When I click on the "pm" sidebar role
    Then the role name "pm" is visible
    And the composer input is visible

  Scenario: Click All Projects breadcrumb navigates back
    Given the dashboard is open
    And I navigate to the "test-company" project
    When I click "All Projects"
    Then the projects list is visible

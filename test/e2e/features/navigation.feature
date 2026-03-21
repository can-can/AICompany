Feature: Dashboard navigation

  Scenario: Click project card navigates to project view
    Given the dashboard is open
    When I click on the "RabT" project card
    Then the project heading "RabT" is visible
    And the roles list is visible

  Scenario: Click role in sidebar navigates to that role's chat
    Given the dashboard is open
    And I navigate to the "RabT" project
    And I click on the "engineer" role
    When I click on the "PM" sidebar role
    Then the role name "PM" is visible
    And the composer input is visible

  Scenario: Click All Projects breadcrumb navigates back
    Given the dashboard is open
    And I navigate to the "RabT" project
    When I click "All Projects"
    Then the projects list is visible

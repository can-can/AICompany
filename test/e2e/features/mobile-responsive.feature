Feature: Mobile responsive layout

  Scenario: Task table fits on mobile without horizontal scroll
    Given the viewport is 375 by 667
    And the dashboard is open
    And I navigate to the "test-company" project
    Then the tasks section is visible
    And the page has no horizontal overflow

  Scenario: Chat view fits on mobile without horizontal scroll
    Given the viewport is 375 by 667
    And the dashboard is open
    And I navigate to the "test-company" project
    When I click on the "pm" role
    Then the composer input is visible
    And the page has no horizontal overflow

  Scenario: Memory page is usable on mobile
    Given the viewport is 375 by 667
    And the dashboard is open
    And I navigate to the "test-company" project
    When I click the "Memory" link
    Then the memory file list contains "company.md"
    And the page has no horizontal overflow

  Scenario: Task detail fits on mobile
    Given the viewport is 375 by 667
    And the dashboard is open
    And I navigate to the "test-company" project
    And I click the "Show done" button in the tasks section
    When I click on task "001" in the task table
    Then the task title is visible
    And the page has no horizontal overflow

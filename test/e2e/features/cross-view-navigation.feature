Feature: Cross-view navigation combinations

  Scenario: Navigate from chat back to project dashboard via breadcrumb
    Given the dashboard is open
    And I navigate to the "test-company" project
    And I click the role card for "engineer"
    When I click the breadcrumb "test-company"
    Then the roles section is visible
    And the tasks section is visible

  Scenario: Switch between roles preserves separate chat contexts
    Given the dashboard is open
    And I navigate to the "test-company" project
    And I click the role card for "engineer"
    And I type "msg-for-engineer" in the composer
    And I click Send
    Then the user message "msg-for-engineer" appears in the chat
    When I click on the "pm" sidebar role
    Then the user message "msg-for-engineer" is not in the chat

  Scenario: Direct URL navigation to chat view works
    Given I navigate directly to "/test-company/chat/engineer"
    Then the composer input is visible
    And the breadcrumb shows "test-company"
    And the role heading shows "engineer"

  Scenario: Navigate home then back into same role retains messages
    Given the dashboard is open
    And I navigate to the "test-company" project
    And I click the role card for "pm"
    And I type "remember-me" in the composer
    And I click Send
    Then the user message "remember-me" appears in the chat
    When I wait for an agent response
    And I click "All Projects"
    And I navigate to the "test-company" project
    And I click the role card for "pm"
    Then the user message "remember-me" appears in the chat

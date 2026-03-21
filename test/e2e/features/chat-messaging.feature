Feature: Send messages to any role at any time

  Background:
    Given the dashboard is open
    And I navigate to the "RabT" project

  Scenario: Composer is enabled for a free role
    When I click on the "engineer" role
    Then the composer input is visible
    And the composer input placeholder is "Type a message..."
    And the Send button is disabled

  Scenario: Composer is enabled for a waiting_human role
    When I click on the "qa" role
    Then the composer input is visible
    And the composer input placeholder is "Type a message..."

  Scenario: Send button enables when text is typed
    When I click on the "engineer" role
    And I type "hello" in the composer
    Then the Send button is enabled

  Scenario: Click Send submits message
    When I click on the "engineer" role
    And I type "hello engineer" in the composer
    And I click Send
    Then the user message "hello engineer" appears in the chat
    And the composer input is empty

  Scenario: Press Enter submits message
    When I click on the "engineer" role
    And I type "hello via enter" in the composer
    And I press Enter in the composer
    Then the user message "hello via enter" appears in the chat
    And the composer input is empty

  Scenario: Send message to free role and receive agent response then persist after refresh
    When I click on the "engineer" role
    And I type "what is 2+2" in the composer
    And I click Send
    Then the user message "what is 2+2" appears in the chat
    When I wait for an agent response
    Then an assistant message is visible
    When I refresh the page
    And I navigate to the "RabT" project
    And I click on the "engineer" role
    Then the user message "what is 2+2" appears in the chat
    And an assistant message is visible

  @flaky
  Scenario: Status bar shows only for working and ready states
    When I click on the "engineer" role
    Then no status bar is visible
    When I type "trigger work" in the composer
    And I click Send
    Then the status bar shows "Agent is working..."

  Scenario: Load older messages button loads paginated history
    When I click on the "qa" role
    And I note the message count
    And "Load older messages" is visible
    And I click "Load older messages"
    Then the message count has increased

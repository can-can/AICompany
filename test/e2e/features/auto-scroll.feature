Feature: Auto-scroll to bottom for new messages

  Background:
    Given the dashboard is open
    And I navigate to the "test-company" project

  Scenario: Chat starts scrolled to the bottom
    When I click on the "engineer" role
    Then the chat is scrolled to the bottom

  Scenario: Sending a message keeps the view at the bottom
    When I click on the "engineer" role
    And I type "auto-scroll test" in the composer
    And I click Send
    Then the user message "auto-scroll test" appears in the chat
    And the chat is scrolled to the bottom

  @flaky
  Scenario: New agent message auto-scrolls when at bottom
    When I click on the "engineer" role
    And I type "reply with ok" in the composer
    And I click Send
    When I wait for an agent response
    Then the chat is scrolled to the bottom

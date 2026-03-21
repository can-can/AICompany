Feature: Sending messages to multiple roles in sequence

  Background:
    Given the dashboard is open
    And I navigate to the "test-company" project

  Scenario: Messages sent to different roles stay isolated
    When I click the role card for "engineer"
    And I type "eng-only-msg" in the composer
    And I click Send
    Then the user message "eng-only-msg" appears in the chat
    When I click on the "pm" sidebar role
    And I type "pm-only-msg" in the composer
    And I click Send
    Then the user message "pm-only-msg" appears in the chat
    And the user message "eng-only-msg" is not in the chat
    When I click on the "engineer" sidebar role
    Then the user message "eng-only-msg" appears in the chat
    And the user message "pm-only-msg" is not in the chat

  Scenario: Rapid messages all appear in order
    When I click the role card for "engineer"
    And I type "rapid-1" in the composer
    And I click Send
    And I type "rapid-2" in the composer
    And I click Send
    And I type "rapid-3" in the composer
    And I click Send
    Then the user message "rapid-1" appears in the chat
    And the user message "rapid-2" appears in the chat
    And the user message "rapid-3" appears in the chat

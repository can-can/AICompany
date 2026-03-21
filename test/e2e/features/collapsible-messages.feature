Feature: Collapse long messages with show more/less toggle

  Background:
    Given the dashboard is open
    And I navigate to the "test-company" project

  Scenario: Short messages do not show a Show more button
    When I click on the "engineer" role
    And I type "say hi" in the composer
    And I click Send
    Then the user message "say hi" appears in the chat
    And no "Show more" button is visible

  Scenario: Long user message is collapsed with Show more button
    When I click on the "engineer" role
    And I type a very long message in the composer
    And I click Send
    Then a "Show more" button is visible in a chat message
    And the long message is visually collapsed

  Scenario: Clicking Show more expands and Show less collapses a long message
    When I click on the "engineer" role
    And I type a very long message in the composer
    And I click Send
    Then a "Show more" button is visible in a chat message
    When I click the "Show more" button in the message
    Then a "Show less" button is visible in a chat message
    And the long message is visually expanded
    When I click the "Show less" button in the message
    Then a "Show more" button is visible in a chat message
    And the long message is visually collapsed

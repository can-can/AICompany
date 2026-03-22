Feature: Slash command menu in chat composer

  Background:
    Given the dashboard is open
    And I navigate to the "test-company" project
    And I click on the "pm" role

  Scenario: Typing / shows the command menu
    When I type "/" in the composer
    Then the slash command menu is visible
    And the slash command menu contains "/stop"
    And the slash command menu contains "/clear"
    And the slash command menu contains "/help"

  Scenario: Typing filters the command list
    When I type "/st" in the composer
    Then the slash command menu is visible
    And the slash command menu contains "/stop"
    And the slash command menu does not contain "/clear"
    And the slash command menu does not contain "/help"

  Scenario: Pressing Escape closes the menu
    When I type "/" in the composer
    Then the slash command menu is visible
    When I press Escape in the composer
    Then the slash command menu is not visible

  Scenario: Selecting /clear with Enter clears messages
    When I note the message count
    And I type "/clear" in the composer
    Then the slash command menu is visible
    When I press Enter in the slash command menu
    Then the slash command menu is not visible
    And the chat messages are cleared

  Scenario: Clicking a command executes it
    When I type "/" in the composer
    Then the slash command menu is visible
    When I click the "/clear" command in the menu
    Then the slash command menu is not visible

  Scenario: No menu appears for normal text
    When I type "hello" in the composer
    Then the slash command menu is not visible

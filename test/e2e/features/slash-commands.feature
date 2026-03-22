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

  Scenario: No menu appears for normal text
    When I type "hello" in the composer
    Then the slash command menu is not visible

  Scenario: Clicking a command in the menu closes it and clears composer
    When I type "/help" in the composer
    Then the slash command menu is visible
    When I click the "/help" command in the menu
    Then the slash command menu is not visible
    And the composer input is empty

  Scenario: /clear removes messages and persists after refresh
    When I type "e2e-clear-test" in the composer
    And I click Send
    Then the user message "e2e-clear-test" appears in the chat
    And I wait for an agent response
    When I type "/clear" in the composer
    And I press Enter in the slash command menu
    Then the chat messages are cleared
    And the composer input is empty
    When I refresh the page
    And I navigate to the "test-company" project
    And I click on the "pm" role
    Then the chat messages are cleared

  @flaky
  Scenario: /stop via slash command stops a running agent
    When I type "write a very long detailed essay about artificial intelligence" in the composer
    And I click Send
    Then the status bar shows "Agent is working..."
    When I type "/stop" in the composer
    And I press Enter in the slash command menu
    Then the agent returns to idle

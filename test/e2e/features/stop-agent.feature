Feature: Stop a running agent from the chat UI

  Background:
    Given the dashboard is open
    And I navigate to the "test-company" project

  Scenario: Stop button is not visible when agent is idle
    When I click on the "engineer" role
    Then the Stop button is not visible

  @flaky
  Scenario: Stop button appears while agent is working
    When I click on the "engineer" role
    And I type "explain what 2+2 is in great detail" in the composer
    And I click Send
    Then the status bar shows "Agent is working..."
    And the Stop button is visible

  @flaky
  Scenario: Clicking Stop cancels the running agent
    When I click on the "engineer" role
    And I type "write a very long essay about the history of computing" in the composer
    And I click Send
    Then the Stop button is visible
    When I click the Stop button
    Then the Stop button is not visible
    And the agent returns to idle

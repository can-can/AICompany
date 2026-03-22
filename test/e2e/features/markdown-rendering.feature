Feature: Markdown rendering in chat messages
  Historical and real-time messages should render markdown formatting
  including bold text, inline code, and tables.

  Background:
    Given the dashboard is open
    And I navigate to the "test-company" project
    And I click on the "pm" role

  @requires-history
  Scenario: Historical assistant messages render markdown bold as HTML
    Then an assistant message contains a "strong" element

  @requires-history
  Scenario: Historical assistant messages render markdown tables as HTML
    Then an assistant message contains a "table" element

  @flaky
  Scenario: Markdown rendering persists for new messages after refresh
    When I type "Reply with exactly: **e2e-bold-check**" in the composer
    And I click Send
    And I wait for an agent response
    Then the last assistant message contains a "strong" element
    When I refresh the page
    And I navigate to the "test-company" project
    And I click on the "pm" role
    Then an assistant message contains a "strong" element

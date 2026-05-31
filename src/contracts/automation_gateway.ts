/**
 * automation_gateway.ts — NOT YET IMPLEMENTED FOR ARC
 *
 * The AutomationGateway (Soroban) has no ARC/EVM counterpart yet.
 * On ARC, automation can be achieved via Chainlink Automation or a keeper bot.
 */

export const AUTOMATION_GATEWAY_CONTRACT_ID = "" as const;

export async function getAutomationStatus(): Promise<{ active: boolean }> {
  return { active: false };
}

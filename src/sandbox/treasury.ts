/**
 * One treasury, whoever is spending.
 *
 * Phase 2-4 plans execute through paths that predate the sandbox (the plan
 * cards, AUTO mode, the natural-language optimiser, the demo). They must still
 * draw on the city's money, or the budget would only be real for work the
 * player placed by hand.
 *
 * The sandbox registers the debit here at start-up, so the execution system
 * can charge the city without importing the store that owns it.
 */
let debit: ((capex: number, planName: string) => void) | null = null

export function registerTreasuryDebit(fn: (capex: number, planName: string) => void) {
  debit = fn
}

/** Charge the city for work that has genuinely completed. */
export function chargeTreasury(capex: number, planName: string) {
  debit?.(capex, planName)
}

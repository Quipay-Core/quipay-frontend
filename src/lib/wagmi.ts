/**
 * Stellar wallet configuration — replaces the old wagmi/AppKit setup.
 * Re-exports the kit singleton from util/wallet so the old import path still works.
 */
export { wallet as kit } from "../util/wallet";

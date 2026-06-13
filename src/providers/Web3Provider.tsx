/**
 * Web3Provider — passthrough on Stellar (no wagmi/AppKit needed).
 * Kept so main.tsx import tree is unchanged.
 */
export function Web3Provider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

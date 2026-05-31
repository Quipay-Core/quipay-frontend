/** Soroban Debugger — not applicable on ARC (EVM). Replaced by DebuggerStub. */
export default function Debugger() {
  return (
    <div style={{ padding: "2rem", color: "#fff", textAlign: "center" }}>
      <h2>Contract Debugger</h2>
      <p style={{ color: "#888", marginTop: "1rem" }}>Use Foundry/Hardhat for ARC contract debugging.</p>
    </div>
  );
}

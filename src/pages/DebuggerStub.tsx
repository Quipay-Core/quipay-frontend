/**
 * DebuggerStub — placeholder for the Soroban contract debugger.
 * The Soroban debugger is not applicable on ARC (EVM chain).
 * A Foundry/Hardhat-based debug interface will replace this in a future sprint.
 */
export default function DebuggerStub() {
  return (
    <div style={{ padding: "2rem", color: "#fff", textAlign: "center" }}>
      <h2 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Contract Debugger</h2>
      <p style={{ marginTop: "1rem", color: "#888" }}>
        The Soroban debugger is not available on ARC (EVM). Use Foundry or Hardhat for contract debugging.
      </p>
    </div>
  );
}

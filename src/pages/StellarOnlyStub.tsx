/** Stub for pages not yet migrated to ARC. */
export default function StellarOnlyStub({ pageName = "This page" }: { pageName?: string }) {
  return (
    <div style={{ padding: "2rem", color: "#fff", textAlign: "center", opacity: 0.6 }}>
      <h2 style={{ fontSize: "1.25rem", fontWeight: "bold" }}>{pageName}</h2>
      <p style={{ marginTop: "0.5rem", color: "#888", fontSize: "0.875rem" }}>
        Not yet migrated to ARC. Coming in a future sprint.
      </p>
    </div>
  );
}

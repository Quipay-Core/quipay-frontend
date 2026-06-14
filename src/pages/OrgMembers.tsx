/**
 * OrgMembers page
 * ────────────────
 * Team member management for the current organization.
 * Shows members with roles, allows adding/removing members (owner/admin).
 */

import React, { useState } from "react";
import { useOrg } from "../context/OrgContext";
import { useOrgMembers, type OrgMemberRecord } from "../hooks/useOrgMembers";
import { useWallet } from "../hooks/useWallet";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortAddr(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    owner:
      "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",
    admin:
      "bg-blue-500/10 text-blue-400 border-blue-500/20",
    viewer:
      "bg-white/[0.06] text-neutral-400 border-white/[0.08]",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
        styles[role] ?? styles.viewer
      }`}
    >
      {role}
    </span>
  );
}

// ─── Add Member Modal ─────────────────────────────────────────────────────────

function AddMemberModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (userId: string, role: "admin" | "viewer") => Promise<boolean>;
}) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"admin" | "viewer">("viewer");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    if (!userId.trim()) {
      setError("User ID is required");
      return;
    }

    setSubmitting(true);
    setError(null);

    const success = await onAdd(userId.trim(), role);
    if (success) {
      onClose();
      setUserId("");
      setRole("viewer");
    } else {
      setError("Failed to add member");
    }

    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#0a0a0a] p-6">
        <h3 className="text-[18px] font-bold text-white mb-1">Add team member</h3>
        <p className="text-[13px] text-neutral-500 mb-5">
          Add a user to your organization by their user ID.
        </p>

        <div className="flex flex-col gap-3 mb-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1.5">
              User ID
            </label>
            <input
              type="text"
              placeholder="e.g. user-123 or wallet address"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[14px] text-white placeholder-neutral-700 focus:border-yellow-400/50 focus:outline-none transition-colors"
            />
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1.5">
              Role
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "viewer")}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[14px] text-white focus:border-yellow-400/50 focus:outline-none transition-colors"
            >
              <option value="viewer">Viewer — can view data only</option>
              <option value="admin">Admin — can manage streams and employees</option>
            </select>
          </div>
        </div>

        {error && (
          <p className="mb-3 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-[12px] text-red-400">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] py-3 text-[13px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="flex-1 rounded-xl py-3 text-[13px] font-bold text-black transition-all hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: "#facc15" }}
          >
            {submitting ? "Adding…" : "Add member"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Member Card ──────────────────────────────────────────────────────────────

function MemberCard({
  member,
  myRole,
  onUpdateRole,
  onRemove,
}: {
  member: OrgMemberRecord;
  myRole: string | null;
  onUpdateRole: (userId: string, role: string) => Promise<boolean>;
  onRemove: (userId: string) => Promise<boolean>;
}) {
  const [changing, setChanging] = useState(false);

  const canEdit =
    myRole === "owner" && member.role !== "owner";
  const canRemove =
    (myRole === "owner" && member.role !== "owner") ||
    (myRole === "admin" && member.role === "viewer");

  const handleRoleChange = async (newRole: string) => {
    setChanging(true);
    await onUpdateRole(member.user_id, newRole);
    setChanging(false);
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-yellow-400/10 flex items-center justify-center text-[13px] font-black text-yellow-400">
            {member.user_id.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-[14px] font-semibold text-white">
              {shortAddr(member.user_id)}
            </p>
            <p className="text-[11px] text-neutral-600">
              Joined{" "}
              {new Date(member.joined_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
        <RoleBadge role={member.role} />
      </div>

      {canEdit && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-white/[0.05]">
          <select
            value={member.role}
            onChange={(e) => void handleRoleChange(e.target.value)}
            disabled={changing}
            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[12px] text-white focus:border-yellow-400/50 focus:outline-none transition-colors disabled:opacity-40"
          >
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
            <option value="owner">Owner</option>
          </select>
          {canRemove && (
            <button
              onClick={() => void onRemove(member.user_id)}
              className="rounded-xl border border-red-500/20 bg-red-500/[0.04] px-3 py-2 text-[12px] font-semibold text-red-400 hover:bg-red-500/[0.08] transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const OrgMembers: React.FC = () => {
  const { address } = useWallet();
  const { activeOrg } = useOrg();
  const {
    members,
    myRole,
    isLoading,
    error,
    addMember,
    updateRole,
    removeMember,
  } = useOrgMembers(activeOrg?.orgId);

  const [showAddModal, setShowAddModal] = useState(false);

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <p className="text-[14px] text-neutral-500">
          Connect your wallet to manage team members.
        </p>
      </div>
    );
  }

  if (!activeOrg) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <p className="text-[14px] text-neutral-500">
          No organization selected. Complete employer onboarding first.
        </p>
      </div>
    );
  }

  const owners = members.filter((m) => m.role === "owner");
  const admins = members.filter((m) => m.role === "admin");
  const viewers = members.filter((m) => m.role === "viewer");

  return (
    <div className="px-6 py-8 sm:px-8 sm:py-10">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold text-white tracking-tight">
            Team members
          </h1>
          <p className="mt-1 text-[14px] text-neutral-500">
            {activeOrg.businessName} · {members.length} member
            {members.length !== 1 ? "s" : ""}
          </p>
        </div>
        {(myRole === "owner" || myRole === "admin") && (
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold text-black transition-all hover:opacity-90"
            style={{ backgroundColor: "#facc15" }}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Add member
          </button>
        )}
      </div>

      {/* Role summary */}
      <div className="mb-8 grid grid-cols-3 gap-3">
        {[
          { label: "Owners", count: owners.length, accent: true },
          { label: "Admins", count: admins.length },
          { label: "Viewers", count: viewers.length },
        ].map(({ label, count, accent }) => (
          <div
            key={label}
            className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-4"
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
              {label}
            </p>
            <p
              className="text-[26px] font-black"
              style={accent ? { color: "#facc15" } : { color: "#fff" }}
            >
              {count}
            </p>
          </div>
        ))}
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-[12px] text-red-400">
          {error}
        </p>
      )}

      {/* Members list */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl border border-white/[0.06] bg-[#0a0a0a]"
            />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0a0a0a] p-16 text-center">
          <p className="text-[16px] font-bold text-white mb-2">
            No team members yet
          </p>
          <p className="text-[13px] text-neutral-600 mb-5">
            Add members to your organization to collaborate on payroll management.
          </p>
          {(myRole === "owner" || myRole === "admin") && (
            <button
              onClick={() => setShowAddModal(true)}
              className="rounded-xl px-5 py-2.5 text-[13px] font-bold text-black transition-all hover:opacity-90"
              style={{ backgroundColor: "#facc15" }}
            >
              Add your first team member
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              myRole={myRole}
              onUpdateRole={updateRole}
              onRemove={removeMember}
            />
          ))}
        </div>
      )}

      {/* Add Member Modal */}
      <AddMemberModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={addMember}
      />
    </div>
  );
};

export default OrgMembers;

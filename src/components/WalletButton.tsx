import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { kit } from "../util/wallet";
import { useWallet } from "../hooks/useWallet";

const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const formatUsdc = (raw?: string) => {
  if (!raw) return "--";
  const n = Number(raw);
  return Number.isFinite(n)
    ? n.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : raw;
};

export const WalletButton = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const {
    address,
    isPending,
    balances,
    connectionError,
    clearError,
    disconnect,
  } = useWallet();

  const usdc = useMemo(
    () => formatUsdc(balances?.USDC?.balance),
    [balances?.USDC?.balance],
  );

  useEffect(() => {
    if (!showModal) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowModal(false);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [showModal]);

  // ── Disconnected ──────────────────────────────────────────────────────────
  if (!address) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <button
          type="button"
          aria-label={t("wallet.connect")}
          onClick={() => {
            clearError();
            void kit.fetchAddress().catch((err: unknown) => {
              if (err instanceof Error) clearError();
            });
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-transparent px-4 py-[7px] text-[13px] font-medium text-white/80 transition-all duration-150 hover:border-white/30 hover:bg-white/[0.05] hover:text-white"
        >
          <span className="h-2 w-2 rounded-full bg-yellow-400" />
          {t("wallet.connect")}
        </button>
        {connectionError && (
          <p className="text-right text-[11px] text-red-400">
            {t("wallet.connection_failed")}
          </p>
        )}
      </div>
    );
  }

  // ── Connected ────────────────────────────────────────────────────────────
  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        aria-expanded={showModal}
        aria-haspopup="dialog"
        className="group inline-flex items-center gap-2.5 rounded-lg border border-white/10 bg-neutral-900 px-3 py-[7px] transition-all duration-150 hover:border-white/20 hover:bg-neutral-800"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-yellow-400 text-[10px] font-black text-black shrink-0">
          {address.slice(1, 3).toUpperCase()}
        </div>
        <div className="flex flex-col items-start leading-none">
          <span className="text-[13px] font-medium text-white">
            {truncate(address)}
          </span>
          <span className="text-[11px] text-neutral-500 mt-[2px]">
            {usdc} USDC
          </span>
        </div>
        <div className="flex items-center justify-center ml-0.5">
          {isPending ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-600 border-t-white/60" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-green-400" />
          )}
        </div>
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="wallet-modal-title"
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-950 p-5 shadow-[0_24px_64px_rgba(0,0,0,0.7)]"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="wallet-modal-title"
              className="text-sm font-semibold text-white mb-4"
            >
              Connected Wallet
            </h3>

            <div className="mb-4 rounded-xl border border-yellow-400/30 bg-yellow-400/[0.06] px-3 py-2.5 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400 text-xs font-black text-black shrink-0">
                {address.slice(1, 3).toUpperCase()}
              </div>
              <div className="flex flex-col flex-1 overflow-hidden">
                <span className="font-mono text-[13px] font-medium text-white truncate">
                  {truncate(address)}
                </span>
                <span className="text-[11px] text-yellow-400">Active</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 rounded-xl border border-white/10 bg-neutral-900 px-3 py-2 text-[13px] font-medium text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={disconnecting}
                onClick={() => {
                  setDisconnecting(true);
                  disconnect()
                    .finally(() => {
                      setDisconnecting(false);
                      setShowModal(false);
                      void navigate("/");
                    })
                    .catch(() => void navigate("/"));
                }}
                className="flex-1 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[13px] font-semibold text-red-400 transition-colors hover:bg-red-500/20 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {disconnecting
                  ? t("wallet.disconnecting")
                  : t("wallet.disconnect")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getWalletOptions, connectWithWallet } from "../util/wallet";
import type { WalletOption } from "../util/wallet";
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
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [wallets, setWallets] = useState<WalletOption[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | undefined>();

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
    if (!showPicker && !showAccountModal) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowPicker(false);
        setShowAccountModal(false);
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [showPicker, showAccountModal]);

  async function openPicker() {
    clearError();
    setConnectError(undefined);
    setShowPicker(true);
    const options = await getWalletOptions();
    setWallets(options);
  }

  async function handleSelectWallet(w: WalletOption) {
    if (!w.isAvailable) {
      window.open(w.url, "_blank");
      return;
    }
    setConnecting(true);
    setConnectError(undefined);
    try {
      await connectWithWallet(w.id);
      setShowPicker(false);
    } catch (e) {
      setConnectError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setConnecting(false);
    }
  }

  // ── Disconnected ──────────────────────────────────────────────────────────
  if (!address) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <button
          type="button"
          aria-label={t("wallet.connect")}
          onClick={() => void openPicker()}
          className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-transparent px-4 py-[7px] text-[13px] font-medium text-white/80 transition-all duration-150 hover:border-white/30 hover:bg-white/[0.05] hover:text-white"
        >
          <span className="h-2 w-2 rounded-full bg-yellow-400" />
          {t("wallet.connect")}
        </button>
        {(connectionError || connectError) && (
          <p className="text-right text-[11px] text-red-400">
            {connectError ?? t("wallet.connection_failed")}
          </p>
        )}

        {showPicker && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
            onClick={() => setShowPicker(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="wallet-picker-title"
              className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-950 p-5 shadow-[0_24px_64px_rgba(0,0,0,0.7)]"
              onClick={(e) => e.stopPropagation()}
            >
              <h3
                id="wallet-picker-title"
                className="text-sm font-semibold text-white mb-1"
              >
                Connect a Wallet
              </h3>
              <p className="text-[11px] text-neutral-500 mb-4">
                Powered by Stellar Wallets Kit
              </p>

              {wallets.length === 0 ? (
                <p className="text-center text-[13px] text-neutral-400 py-6">
                  Loading wallets…
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {wallets.map((w) => (
                    <li key={w.id}>
                      <button
                        type="button"
                        disabled={connecting}
                        onClick={() => void handleSelectWallet(w)}
                        className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                          w.isAvailable
                            ? "border-white/10 bg-neutral-900 hover:border-white/20 hover:bg-neutral-800 cursor-pointer"
                            : "border-white/5 bg-neutral-900/50 cursor-pointer opacity-60"
                        }`}
                      >
                        <img
                          src={w.icon}
                          alt={w.name}
                          className="h-8 w-8 rounded-lg shrink-0"
                        />
                        <div className="flex flex-col">
                          <span className="text-[13px] font-medium text-white">
                            {w.name}
                          </span>
                          {!w.isAvailable && (
                            <span className="text-[11px] text-neutral-500">
                              Not installed — click to install
                            </span>
                          )}
                        </div>
                        {connecting && w.isAvailable && (
                          <span className="ml-auto h-3.5 w-3.5 animate-spin rounded-full border-2 border-neutral-600 border-t-white/60" />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {connectError && (
                <p className="mt-3 text-[11px] text-red-400">{connectError}</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Connected ────────────────────────────────────────────────────────────
  return (
    <>
      <button
        type="button"
        onClick={() => setShowAccountModal(true)}
        aria-expanded={showAccountModal}
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

      {showAccountModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={() => setShowAccountModal(false)}
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
                onClick={() => setShowAccountModal(false)}
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
                      setShowAccountModal(false);
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

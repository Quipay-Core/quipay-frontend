/**
 * Quipay — Centralized Error Handling Utility
 * Translates technical error codes and exceptions into user-friendly messages.
 */

export enum ErrorType {
  NETWORK = "NETWORK",
  CONTRACT = "CONTRACT",
  VALIDATION = "VALIDATION",
  UNKNOWN = "UNKNOWN",
  WALLET = "WALLET",
}

export interface AppError {
  message: string;
  type: ErrorType;
  severity: "error" | "warning" | "info";
  actionableStep?: string;
  technicalDetails?: string;
}

/**
 * EVM / Arc revert reason patterns and their user-friendly equivalents.
 */
const EVM_ERROR_MAP: Record<string, { message: string; action?: string }> = {
  user_rejected: {
    message: "Transaction rejected.",
    action: "You declined the transaction in your wallet.",
  },
  insufficient_funds: {
    message: "Insufficient USDC to complete this operation.",
    action: "Top up your USDC balance and try again.",
  },
  execution_reverted: {
    message: "Transaction reverted by the contract.",
    action: "Check your inputs and try again.",
  },
  nonce_too_low: {
    message: "Transaction nonce out of sync.",
    action: "Refresh the page and try again.",
  },
  replacement_fee: {
    message: "Replacement transaction fee too low.",
    action: "Wait for the pending transaction to settle, then retry.",
  },
  invalid_worker: {
    message: "Invalid worker address.",
    action: "Enter a valid EVM address for the worker.",
  },
  self_stream: {
    message: "Cannot stream tokens to yourself.",
    action: "Enter a different worker address.",
  },
};

/**
 * Translates any error into a standardized AppError object.
 */
export function translateError(err: unknown): AppError {
  // 1. Handle string errors
  if (typeof err === "string") {
    const matched = Object.entries(EVM_ERROR_MAP).find(([code]) =>
      err.toLowerCase().includes(code.toLowerCase()),
    );
    if (matched) {
      return {
        message: matched[1].message,
        type: ErrorType.CONTRACT,
        severity: "error",
        actionableStep: matched[1].action,
        technicalDetails: err,
      };
    }
    return {
      message: err,
      type: ErrorType.UNKNOWN,
      severity: "error",
    };
  }

  // 2. Handle Error objects
  if (err instanceof Error) {
    const message = err.message.toLowerCase();

    // Network issues
    if (
      message.includes("fetch") ||
      message.includes("network") ||
      message.includes("failed to fetch") ||
      message.includes("cors")
    ) {
      return {
        message: "Network connection error.",
        type: ErrorType.NETWORK,
        severity: "error",
        actionableStep: "Check your internet connection and RPC settings.",
        technicalDetails: err.message,
      };
    }

    // Wallet issues
    if (message.includes("user rejected") || message.includes("cancelled")) {
      return {
        message: "Transaction cancelled.",
        type: ErrorType.WALLET,
        severity: "warning",
        actionableStep: "You'll need to sign the transaction to proceed.",
      };
    }

    if (message.includes("connector") || message.includes("wallet")) {
      return {
        message: "Wallet communication error.",
        type: ErrorType.WALLET,
        severity: "error",
        actionableStep: "Ensure your wallet extension is unlocked and active.",
        technicalDetails: err.message,
      };
    }

    // Check mapping again for error messages
    const matched = Object.entries(EVM_ERROR_MAP).find(([code]) =>
      message.includes(code.toLowerCase()),
    );
    if (matched) {
      return {
        message: matched[1].message,
        type: ErrorType.CONTRACT,
        severity: "error",
        actionableStep: matched[1].action,
        technicalDetails: err.message,
      };
    }

    return {
      message: err.message,
      type: ErrorType.UNKNOWN,
      severity: "error",
      technicalDetails: err.stack,
    };
  }

  // 3. Fallback
  return {
    message: "An unexpected error occurred.",
    type: ErrorType.UNKNOWN,
    severity: "error",
    actionableStep: "Refresh the page or contact support if this persists.",
  };
}

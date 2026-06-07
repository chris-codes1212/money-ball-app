"use client";

import { createContext, useContext, useState } from "react";

// Holds the user's bankroll on the client so the navbar (and anything else) can
// reflect a debit the instant a bet is placed, without a full page reload. The
// initial value is seeded from the server in the layout; the bet-slip updates it
// from the authoritative value returned by POST /api/bets.
type BankrollContextValue = {
  bankroll: string; // fixed-2 string, e.g. "975.50"
  setBankroll: (value: string) => void;
};

const BankrollContext = createContext<BankrollContextValue | null>(null);

export function BankrollProvider({
  initialBankroll,
  children,
}: {
  initialBankroll: string;
  children: React.ReactNode;
}) {
  const [bankroll, setBankroll] = useState(initialBankroll);
  return (
    <BankrollContext.Provider value={{ bankroll, setBankroll }}>
      {children}
    </BankrollContext.Provider>
  );
}

export function useBankroll() {
  const ctx = useContext(BankrollContext);
  if (!ctx) {
    throw new Error("useBankroll must be used within a BankrollProvider");
  }
  return ctx;
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { useBankroll } from "@/components/BankrollProvider";

type NavBarProps = {
  username?: string | null;
};

// Primary nav links. "Bets" points at the existing /dashboard route (bankroll +
// bet history); "Games" goes to the live games list.
const LINKS = [
  { href: "/", label: "Home" },
  { href: "/live-games", label: "Games" },
  { href: "/dashboard", label: "Bets" },
];

export default function NavBar({ username }: NavBarProps) {
  const [open, setOpen] = useState(false); // mobile menu
  const [menuOpen, setMenuOpen] = useState(false); // username dropdown
  const { bankroll } = useBankroll();
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the username dropdown on any outside click.
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  function handleSignOut() {
    signOut({ callbackUrl: "/" });
  }

  return (
    <nav className="fixed top-0 left-0 z-20 w-full bg-gray-800 shadow-md">
      <div className="flex items-center justify-between px-4 py-3">
        {/* LEFT */}
        <div className="text-white font-bold">BASE PICKS</div>

        {/* DESKTOP */}
        <div className="hidden md:flex items-center gap-6">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="text-white/80 hover:text-white">
              {l.label}
            </Link>
          ))}

          <div className="flex flex-col items-end">
            <span className="text-xs text-white/80">Balance</span>
            <span className="text-green-500 font-semibold">${bankroll}</span>
          </div>

          {/* Username dropdown -> Sign out */}
          {username && (
            <div className="relative border-l border-white/20 pl-4" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1 text-white/80 hover:text-white"
                aria-haspopup="true"
                aria-expanded={menuOpen}
              >
                {username}
                <span className={`text-xs transition-transform ${menuOpen ? "rotate-180" : ""}`}>▾</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-40 overflow-hidden rounded-md border border-white/10 bg-gray-900 shadow-lg">
                  <button
                    onClick={handleSignOut}
                    className="block w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-white/5"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* HAMBURGER */}
        <button className="md:hidden text-white" onClick={() => setOpen(!open)}>
          ☰
        </button>
      </div>

      {/* MOBILE MENU */}
      {open && (
        <div className="md:hidden px-4 pb-4 space-y-3 border-t border-white/10">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="block text-white/80 hover:text-white"
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}

          <div className="border-t border-white/10 pt-3">
            {username && <div className="text-white/80">{username}</div>}
            <div className="mt-1">
              <span className="text-xs text-white/80">Balance</span>
              <div className="text-green-500 font-semibold">${bankroll}</div>
            </div>
            <button
              onClick={handleSignOut}
              className="mt-3 text-sm font-semibold text-red-400 hover:text-red-300"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}


// import Link from "next/dist/client/link";

// type NavBarProps = {
//     // You can add props here if needed, e.g. user session data for conditional rendering
//     bankroll?: number;
//     username?: string | null;
// }

// export default function NavBar({ bankroll, username }: NavBarProps) {
//     return(
//         <nav className="fixed top-0 left-0 w-full bg-gray-800 p-2 flex justify-between z-20 shadow-md">

//             <div className="flex gap-4 items-center pl-4">
//                 <div className="text-white font-bold items-center justify-center">BASE PICKS</div>
//                 <Link href="/" className="text-white/80 hover:text-white">Home</Link>
//                 <Link href="/dashboard" className="text-white/80 hover:text-white">Dashboard</Link>
//             </div>

//             <div className="flex items-center pr-4 divide-x">
//                 {username && <div className="text-white/80 px-4">{username}</div>}
//                 <div className="flex gap-0.2 flex-col items-end px-4">
//                     <div className="text-white/80">Balance</div>
//                     <div className="text-green-500">${bankroll?.toFixed(2) ?? "0.00"}</div>
//                 </div>
            
//             </div>
//         </nav>
//     );
// }

"use client";

import Link from "next/link";
import { useState } from "react";
import { useBankroll } from "@/components/BankrollProvider";

type NavBarProps = {
  username?: string | null;
};

export default function NavBar({ username }: NavBarProps) {
  const [open, setOpen] = useState(false);
  const { bankroll } = useBankroll();

  return (
    <nav className="fixed top-0 left-0 z-20 w-full bg-gray-800 shadow-md">
      <div className="flex items-center justify-between px-4 py-3">
        {/* LEFT */}
        <div className="text-white font-bold">BASE PICKS</div>

        {/* DESKTOP LINKS */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/" className="text-white/80 hover:text-white">
            Home
          </Link>
          <Link href="/dashboard" className="text-white/80 hover:text-white">
            Dashboard
          </Link>

          {username && (
            <div className="text-white/80 border-l border-white/20 pl-4">
              {username}
            </div>
          )}

          <div className="flex flex-col items-end">
            <span className="text-xs text-white/80">Balance</span>
            <span className="text-green-500 font-semibold">
              ${bankroll}
            </span>
          </div>
        </div>

        {/* HAMBURGER BUTTON */}
        <button
          className="md:hidden text-white"
          onClick={() => setOpen(!open)}
        >
          ☰
        </button>
      </div>

      {/* MOBILE DROPDOWN */}
      {open && (
        <div className="md:hidden px-4 pb-4 space-y-3 border-t border-white/10">
          <Link
            href="/"
            className="block text-white/80 hover:text-white"
            onClick={() => setOpen(false)}
          >
            Home
          </Link>

          <Link
            href="/dashboard"
            className="block text-white/80 hover:text-white"
            onClick={() => setOpen(false)}
          >
            Dashboard
          </Link>

          <div className="border-t border-white/10 pt-3">
            {username && (
              <div className="text-white/80">{username}</div>
            )}

            <div className="mt-1">
              <span className="text-xs text-white/80">Balance</span>
              <div className="text-green-500 font-semibold">
                ${bankroll}
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
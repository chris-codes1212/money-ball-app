import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";
import Link from "next/dist/client/link";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Base Picks - MLB Betting Platform",
  description: "Smart MLB betting analytics and platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-gradient-to-br from-blue-900 to-red-400 font-sans`}
      >
        <AuthProvider>
            {children}
        </AuthProvider>
      </body>
    </html>
  );
}

// app/layout.tsx
// export default function RootLayout({
//   children,
// }: Readonly<{
//   children: React.ReactNode;
// }>) {
//   return (
//     <html lang="en">
//       <body className="${geistSans.variable} ${geistMono.variable} antialiased bg-gradient-to-br from-blue-900 to-red-400 min-h-screen font-sans">
        
//         {/* Wrap everything in AuthProvider */}
//         <AuthProvider>
          
//           <nav className="fixed top-0 left-0 w-full ...">
//              {/* Now the Nav can access user session data! */}
//              <span className="text-white font-bold">MONEY BALL</span>
//              <div className="flex gap-4">
//                 <Link href="/">Home</Link>
//                 {/* Example of what you can do later: {session ? <SignOutButton /> : <SignInButton />} */}
//              </div>
//           </nav>

//           <main className="pt-20">
//             {children}
//           </main>

//         </AuthProvider>

//       </body>
//     </html>
//   );
// }

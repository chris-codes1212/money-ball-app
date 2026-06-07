import { auth } from "@/auth";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  return (
    /* 1. Main container: Remove items-center/justify-center so content starts at top */
    <div className="relative">
      
      {/* 2. Fixed Navbar: Use fixed top-0 and w-full to pin it to the top of the viewport */}


      {/* 3. Main Content: Keep centering classes here instead of the parent div */}
      <main className="flex min-h-screen w-full flex-col items-center justify-center py-32 px-16">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-white mb-4 drop-shadow-lg">BASE PICKS</h1>
          <p className="text-xl text-white/90 mb-8">Your MLB Betting Platform</p>
          
          {session ? (
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-6">
              <h2 className="text-2xl font-semibold text-white mb-2">
                Welcome back, {session.user?.name || session.user?.email}!
              </h2>
              <Link href="/live-games" className="inline-block bg-white text-blue-900 px-6 py-3 rounded-lg font-semibold hover:bg-gray-100 transition-colors">
                Start Betting
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              <Link href="/auth/sign-in" className="inline-block bg-white text-blue-900 px-8 py-4 rounded-lg font-semibold hover:bg-gray-100 transition-colors mr-4">
                Sign In
              </Link>
              <Link href="/register" className="inline-block bg-blue-700 text-white px-8 py-4 rounded-lg font-semibold hover:bg-blue-800 transition-colors">
                Register
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

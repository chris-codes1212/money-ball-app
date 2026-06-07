"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid email or password");
        return;
      }

      if (result?.ok) {
        router.push("/");
      }
    } catch (err) {
      console.error(err);
      setError("Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          {/* Money Ball Title with MLB Colors */}
          <div className="text-center mb-8">
            {/* Baseball Diamond Icon */}
            <div className="flex justify-center mb-6">
              <svg
                className="w-20 h-20 text-blue-900 dark:text-blue-100"
                viewBox="0 0 120 120"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Baseball diamond shape */}
                <path
                  d="M60 15 L85 45 L60 75 L35 45 Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  fill="none"
                />
                {/* Home plate */}
                <path
                  d="M55 75 L60 80 L65 75 L60 70 Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="currentColor"
                  opacity="0.8"
                />
                {/* Bases */}
                <circle cx="60" cy="45" r="3" fill="currentColor" opacity="0.9" />
                <circle cx="85" cy="45" r="3" fill="currentColor" opacity="0.9" />
                <circle cx="35" cy="45" r="3" fill="currentColor" opacity="0.9" />
                {/* Base lines */}
                <line x1="60" y1="45" x2="85" y2="45" stroke="currentColor" strokeWidth="1" opacity="0.6" />
                <line x1="85" y1="45" x2="60" y2="75" stroke="currentColor" strokeWidth="1" opacity="0.6" />
                <line x1="60" y1="75" x2="35" y2="45" stroke="currentColor" strokeWidth="1" opacity="0.6" />
                <line x1="35" y1="45" x2="60" y2="45" stroke="currentColor" strokeWidth="1" opacity="0.6" />
              </svg>
            </div>

            {/* Money Ball Text */}
            <div className="mb-4">
              <h1 className="text-5xl md:text-6xl font-black text-blue-900 dark:text-blue-100 tracking-tight">
                BASE
              </h1>
              <h1 className="text-5xl md:text-6xl font-black text-red-600 dark:text-red-500 tracking-tight -mt-2">
                PICKS
              </h1>
            </div>
          </div>

          <div className="text-center">
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
              Sign in to your account
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              Welcome back to Base Picks
            </p>
          </div>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="bg-white dark:bg-slate-800 py-8 px-6 shadow-lg rounded-lg space-y-4 border-2 border-slate-200 dark:border-slate-700">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900 transition duration-150 ease-in-out"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 block w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-slate-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-900 focus:border-blue-900 transition duration-150 ease-in-out"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/50 border border-red-600 dark:border-red-800 rounded-md p-3">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-900 hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-900 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150 ease-in-out"
              >
                {isSubmitting ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Signing in...
                  </div>
                ) : (
                  "Sign in"
                )}
              </button>
            </div>

            <div className="text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Don't have an account?{" "}
                <a
                  href="/register"
                  className="font-medium text-blue-900 hover:text-blue-800 dark:text-blue-100 dark:hover:text-blue-200"
                >
                  Sign up
                </a>
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
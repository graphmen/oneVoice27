"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { useStore } from "@/lib/store";

export default function LoginPage() {
  const { login, ready, live, requestPasswordReset } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetNote, setResetNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResetNote("");
    const result = await login(email, password);
    setBusy(false);
    if (!result.ok) {
      setError(result.error || "Unable to sign in.");
      return;
    }
    router.push("/dashboard");
  }

  async function onForgotPassword() {
    if (!email.trim()) {
      setError("Enter the email you sign in with, then request a reset.");
      return;
    }
    setResetting(true);
    setError("");
    setResetNote("");
    const result = await requestPasswordReset(email);
    setResetting(false);
    if (!result.ok) {
      setError(result.error || "Could not send a reset email.");
      return;
    }
    setResetNote("If that email has a login, Firebase sent a reset link. Open the inbox and choose a new password.");
  }

  return (
    <div className="ov-bg grid min-h-dvh place-items-center px-4 py-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 inline-block">
          <BrandMark />
        </Link>
        <form onSubmit={onSubmit} className="glass rounded-lg p-6">
          <h1 className="text-2xl font-semibold">Sign in to SHEPHERD360</h1>
          <p className="mt-2 text-sm text-white/65">
            East Zimbabwe Conference holds the one conference entry account. Pastors and church clerks sign in with the
            email and password conference registered for them. Church members do not get an account.
          </p>
          <label className="mt-5 block text-sm text-white/70">Email</label>
          <input
            className="mt-1"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
          <label className="mt-4 block text-sm text-white/70">Password</label>
          <input
            className="mt-1"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          {error && <p className="mt-3 text-sm text-rose">{error}</p>}
          {resetNote && <p className="mt-3 text-sm text-ok">{resetNote}</p>}
          <button className="btn btn-primary btn-lg mt-5 w-full" disabled={!ready || busy}>
            {busy ? "Signing in…" : "Enter the field"}
          </button>
          {live ? (
            <button
              type="button"
              className="btn btn-ghost mt-2 w-full"
              disabled={!ready || busy || resetting}
              onClick={onForgotPassword}
            >
              {resetting ? "Sending reset email…" : "Forgot password"}
            </button>
          ) : (
            <p className="mt-3 text-xs text-white/50">
              This device is not connected to the live conference directory. Add Firebase keys before field use.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

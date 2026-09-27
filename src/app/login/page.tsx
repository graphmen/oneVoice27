"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { DEMO_PASSWORD } from "@/lib/constants";
import { useStore } from "@/lib/store";

const DEMOS = [
  { email: "master@onevoice27.org", label: "Master Administrator" },
  { email: "admin.harare@onevoice27.org", label: "Church Administrator" },
  { email: "pastor.tendai@onevoice27.org", label: "Pastor" },
];

export default function LoginPage() {
  const { login, ready, live, requestPasswordReset } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState(DEMOS[2].email);
  const [password, setPassword] = useState(DEMO_PASSWORD);
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
            Pastors, church administrators and conference leaders use role-based access. Location is never collected at
            login.{" "}
            {live
              ? "If conference or a church clerk registered you, use the email and password they gave you."
              : "This device is on the local demo store until Firebase keys are set."}
          </p>
          <label className="mt-5 block text-sm text-white/70">Email</label>
          <input className="mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label className="mt-4 block text-sm text-white/70">Password</label>
          <input
            className="mt-1"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
              Local demo has no email reset. Ask conference to set a new password on the shepherd record.
            </p>
          )}
        </form>
        <div className="mt-4 glass rounded-lg p-4 text-sm">
          <div className="text-xs uppercase tracking-[0.18em] text-white/45">Demo access</div>
          <p className="mt-1 text-white/60">Password for all demo roles: {DEMO_PASSWORD}</p>
          <div className="mt-3 grid gap-2">
            {DEMOS.map((d) => (
              <button
                key={d.email}
                type="button"
                className="btn btn-ghost h-auto min-h-11 w-full flex-col items-start gap-0.5 py-2 text-left sm:flex-row sm:items-center sm:justify-between"
                onClick={() => {
                  setEmail(d.email);
                  setPassword(DEMO_PASSWORD);
                }}
              >
                <span>{d.label}</span>
                <span className="break-all text-xs text-cyan">{d.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

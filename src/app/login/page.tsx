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
  const { login, ready } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState(DEMOS[2].email);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [error, setError] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const result = login(email, password);
    if (!result.ok) {
      setError(result.error || "Unable to sign in.");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="ov-bg grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 inline-block">
          <BrandMark />
        </Link>
        <form onSubmit={onSubmit} className="glass rounded-lg p-6">
          <h1 className="text-2xl font-semibold">Sign in to SHEPHERD360</h1>
          <p className="mt-2 text-sm text-white/65">
            Pastors, church administrators and conference leaders use role-based access. Location is never collected at
            login.
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
          <button className="btn btn-primary btn-lg mt-5 w-full" disabled={!ready}>
            Enter the field
          </button>
        </form>
        <div className="mt-4 glass rounded-lg p-4 text-sm">
          <div className="text-xs uppercase tracking-[0.18em] text-white/45">Demo access</div>
          <p className="mt-1 text-white/60">Password for all demo roles: {DEMO_PASSWORD}</p>
          <div className="mt-3 grid gap-2">
            {DEMOS.map((d) => (
              <button
                key={d.email}
                type="button"
                className="btn btn-ghost justify-between"
                onClick={() => {
                  setEmail(d.email);
                  setPassword(DEMO_PASSWORD);
                }}
              >
                <span>{d.label}</span>
                <span className="text-cyan text-xs">{d.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

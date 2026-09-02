import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { PILLARS } from "@/lib/constants";

export default function AboutPage() {
  return (
    <div className="ov-bg min-h-screen px-5 py-10 text-white">
      <div className="mx-auto max-w-3xl">
        <BrandMark />
        <h1 className="mt-8 text-4xl font-semibold">The movement behind the system</h1>
        <p className="mt-4 text-white/70">
          OneVoice27 is the global Seventh-day Adventist media-mission initiative leading to September 2027 — 2,000 years
          from Christ’s baptism and the beginning of His public ministry. The central message is Jesus Christ, Messiah
          and coming King, revealed through Scripture.
        </p>
        <div className="mt-8 grid gap-4">
          {PILLARS.map((p) => (
            <div key={p.title} className="glass rounded-3xl p-5">
              <h2 className="text-xl font-semibold text-cyan">{p.title}</h2>
              <p className="mt-2 text-white/70">{p.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-8 font-serif text-2xl text-white/85">
          “If Christians were to act in concert, moving forward as ONE, under the direction of ONE Power for the
          accomplishment of ONE purpose, they would move the world.”
        </p>
        <p className="mt-2 text-sm text-white/50">Testimonies for the Church, vol. 9, p. 221</p>
        <Link href="/" className="btn btn-primary mt-8">
          Back home
        </Link>
      </div>
    </div>
  );
}

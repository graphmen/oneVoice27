"use client";

import { Countdown } from "@/components/Countdown";
import { VERSES } from "@/lib/verses";

export default function MissionPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="text-xs uppercase tracking-[0.22em] text-magenta">One Voice 27</div>
      <h1 className="mt-2 text-3xl font-semibold">Mission for All</h1>
      <p className="mt-3 max-w-3xl text-white/70">
        Worldwide in September 2027 the Adventist Church will speak with one voice — Christ-focused, celebrating 2,000
        years from His baptism and the launch of His ministry. Digital posts are only the beginning. SHEPHERD360 is how
        local shepherds pursue people all the way home.
      </p>
      <div className="mt-6">
        <Countdown />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <article className="glass rounded-lg p-6">
          <h2 className="text-xl font-semibold">#AllThingsNew · 5 September 2026</h2>
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-white/75">
            <li>Pray — consecrate phones and influence.</li>
            <li>Prepare — Christ-centered Scripture designs ready.</li>
            <li>Post together at church (11:00–12:00 suggested).</li>
            <li>Participate — answer comments with warmth.</li>
            <li>Pursue — connect people to Bible study and a pastor.</li>
            <li>Proclaim — do not stop on 5 September.</li>
          </ol>
          <p className="mt-4 text-sm text-cyan">#ALLTHINGSNEW #ONEVOICE27 #HOPESTARTSHERE</p>
        </article>
        <article className="glass rounded-lg p-6">
          <h2 className="text-xl font-semibold">From media to membership care</h2>
          <p className="mt-3 text-white/70">
            After someone responds online, register them as a member or digital interest, assign a shepherd, capture the
            home geofence, and schedule the first visit. That is how One Voice 27 stays faithful to local churches.
          </p>
          <div className="mt-4 grid gap-2 text-sm">
            <a className="text-cyan" href="https://onevoice27.org/" target="_blank" rel="noreferrer">
              onevoice27.org
            </a>
            <a className="text-cyan" href="https://globalbibleschool.org" target="_blank" rel="noreferrer">
              Global Bible School
            </a>
            <a className="text-cyan" href="https://bit.ly/allthingsnew-SID" target="_blank" rel="noreferrer">
              SID Scripture designs
            </a>
          </div>
        </article>
      </div>

      <h2 className="mt-10 text-2xl font-semibold">Scripture designs for visitation</h2>
      <p className="mt-2 max-w-3xl text-white/60">
        The remaining #AllThingsNew graphics — Christ in His own words. Use them in the home, then invite people to Bible
        study.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {VERSES.map((v) => (
          <article key={v.id} className="glass overflow-hidden rounded-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={v.image}
              alt={`${v.reference} — ${v.theme}`}
              className="max-h-[380px] w-full object-cover object-top"
            />
            <div className="p-4">
              <div className="text-xs uppercase tracking-[0.16em] text-gold">{v.theme}</div>
              <p className="mt-2 font-serif text-lg leading-snug">“{v.text}”</p>
              <div className="mt-2 text-sm text-cyan">{v.reference}</div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

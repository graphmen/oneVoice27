import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { Countdown } from "@/components/Countdown";
import { HASHTAGS, MOVEMENT, PILLARS, SYSTEM_NAME, TAGLINE, VISIT_FLOW } from "@/lib/constants";
import { verseOfTheDay } from "@/lib/verses";

export default function HomePage() {
  const verse = verseOfTheDay();

  return (
    <div className="ov-bg wave-bottom min-h-dvh text-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-5 sm:py-5">
        <div className="min-w-0 sm:hidden">
          <BrandMark compact />
        </div>
        <div className="hidden min-w-0 sm:block">
          <BrandMark />
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link href="/about" className="hidden text-sm text-white/70 sm:inline">
            The movement
          </Link>
          <Link href="/login" className="btn btn-ghost">
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20 sm:px-5 sm:pb-24">
        <section className="grid items-center gap-8 py-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:py-16">
          <div>
            <div className="badge bg-magenta/20 text-magenta">Seventh-day Adventist Church · SID</div>
            <h1 className="mt-5 max-w-3xl text-[1.85rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              {SYSTEM_NAME}
            </h1>
            <p className="mt-4 max-w-2xl text-base text-white/75 sm:text-lg">{TAGLINE}</p>
            <p className="mt-4 max-w-2xl text-white/65">
              Digital mission creates interest. Shepherds finish the work. SHEPHERD360 helps pastors visit assigned
              members with GPS-verified presence, confidential notes, and conference-level accountability — so every
              member is cared for on the road to September 2027.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link href="/login" className="btn btn-primary btn-lg w-full sm:w-auto">
                Open SHEPHERD360
              </Link>
              <a href="https://onevoice27.org/" className="btn btn-ghost w-full sm:w-auto" target="_blank" rel="noreferrer">
                onevoice27.org
              </a>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 text-sm text-cyan">
              {HASHTAGS.map((h) => (
                <span key={h}>{h}</span>
              ))}
            </div>
          </div>
          <div className="grid gap-4">
            <Countdown />
            <article className="glass overflow-hidden rounded-lg">
              <div
                className="h-40 bg-cover bg-center"
                style={{ backgroundImage: `url(${verse.image})` }}
              />
              <div className="p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-gold">{verse.theme}</div>
                <p className="mt-2 font-serif text-xl leading-snug text-white/90">“{verse.text}”</p>
                <div className="mt-3 text-sm text-cyan">{verse.reference}</div>
              </div>
            </article>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {[
            ["Geofence verified", "A visit is confirmed only when the pastor is physically at the member’s registered home — then chooses to confirm."],
            ["Shepherd to sheep", "Pastors see who is due, overdue, in crisis, newly baptized, or reached through digital mission."],
            ["Conference visibility", "Master administrators watch churches, pastors, categories, overdue care, and exportable reports."],
          ].map(([title, body]) => (
            <div key={title} className="glass rounded-lg p-6">
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="mt-2 text-white/65">{body}</p>
            </div>
          ))}
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold sm:text-3xl">How a verified visit works</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {VISIT_FLOW.map((step, i) => (
              <div key={step} className="glass rounded-3xl p-5">
                <div className="text-cyan">0{i + 1}</div>
                <div className="mt-2 font-medium">{step}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold sm:text-3xl">One Voice. Four pillars. One flock.</h2>
          <p className="mt-3 max-w-3xl text-white/65">
            OneVoice27 embodies the Adventist Church’s 2025–2030 strategic plan. This system is the pastoral-care engine
            behind media evangelism: every Bible study request and every member can be shepherded in person.
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {PILLARS.map((p) => (
              <div key={p.title} className="glass rounded-lg p-6">
                <h3 className="text-xl font-semibold text-cyan">{p.title}</h3>
                <p className="mt-2 text-white/70">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-12 glass rounded-lg p-5 sm:mt-16 sm:p-8">
          <div className="text-sm uppercase tracking-[0.2em] text-magenta">Guiding philosophy</div>
          <p className="mt-4 max-w-4xl font-serif text-xl leading-snug text-white/90 sm:text-2xl">
            This is not a tool for counting houses. It helps the church answer: are our members being cared for,
            connected with, encouraged, and spiritually supported?
          </p>
          <p className="mt-4 text-white/60">{MOVEMENT}</p>
        </section>
      </main>

      <footer className="border-t border-white/10 px-5 py-8 pb-[max(2rem,env(safe-area-inset-bottom))] text-center text-sm text-white/50">
        SHEPHERD360 · {SYSTEM_NAME} · Southern Africa-Indian Ocean Division
      </footer>
    </div>
  );
}

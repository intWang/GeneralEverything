export function Hero() {
  return (
    <section className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-20">
      <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
        Dual-source analysis
      </p>
      <div className="max-w-3xl space-y-4">
        <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Start with a public video or a RingCentral recording.
        </h1>
        <p className="text-base leading-7 text-slate-600 sm:text-lg">
          This homepage shell keeps the entry point simple now, with room for
          the analysis workflow and results workspace in later tasks.
        </p>
      </div>
    </section>
  );
}

import { Hero } from "../components/hero";
import { InputSwitcher } from "../components/input-switcher";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <Hero />
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <InputSwitcher />
      </section>
    </main>
  );
}

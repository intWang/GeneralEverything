"use client";

import { useState } from "react";

import styles from "./homepage.module.css";
import { Hero } from "../components/hero";
import { InputSwitcher } from "../components/input-switcher";
import { ResultWorkspace } from "../components/result-workspace";
import type { InputMode } from "../lib/types";

export default function HomePage() {
  const [inputMode, setInputMode] = useState<InputMode>("public_video");

  return (
    <main className={styles.page}>
      <Hero />
      <section className={styles.content}>
        <InputSwitcher onChange={setInputMode} value={inputMode} />
        <ResultWorkspace />
      </section>
    </main>
  );
}

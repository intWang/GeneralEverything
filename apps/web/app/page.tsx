"use client";

import { useState } from "react";

import styles from "./homepage.module.css";
import { AITabs } from "../components/ai-tabs";
import { AnalyzeForm } from "../components/analyze-form";
import { Hero } from "../components/hero";
import { InputSwitcher } from "../components/input-switcher";
import { StatusTimeline } from "../components/status-timeline";
import { VideoInfoPanel } from "../components/video-info-panel";
import type { InputMode } from "../lib/types";

export default function HomePage() {
  const [inputMode, setInputMode] = useState<InputMode>("public_video");

  return (
    <main className={styles.page}>
      <Hero />
      <section className={styles.content}>
        <InputSwitcher onChange={setInputMode} value={inputMode} />
        <div className={styles.workflowLayout}>
          <AnalyzeForm inputMode={inputMode} />
          <div className={styles.workflowPanels}>
            <StatusTimeline />
            <VideoInfoPanel />
            <AITabs />
          </div>
        </div>
      </section>
    </main>
  );
}

import type { ReactNode } from "react";

import styles from "../app/homepage.module.css";

const platformChips = ["YouTube", "Instagram", "TikTok", "Facebook"];

type HeroProps = {
  inputArea: ReactNode;
};

export function Hero({ inputArea }: HeroProps) {
  return (
    <section className={styles.hero}>
      <div className={styles.heroGrid}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Fast video analysis</p>
          <h1 className={styles.heroTitle}>
            Paste a video URL. Get transcript, summary, and answers.
          </h1>
          <p className={styles.heroDescription}>
            Analyze public videos in one fast workspace built for review,
            recap, and follow-up.
          </p>
          <div className={styles.heroInputArea} id="analysis-entry">
            {inputArea}
          </div>
          <ul aria-label="Supported platforms" className={styles.chipList}>
            {platformChips.map((chip) => (
              <li className={styles.chipItem} key={chip}>
                {chip}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

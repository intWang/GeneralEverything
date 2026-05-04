import styles from "../app/homepage.module.css";

type TimelineItem = {
  detail?: string;
  label: string;
  state?: "active" | "complete" | "error" | "pending";
};

const DEFAULT_ITEMS: TimelineItem[] = [
  {
    label: "Waiting for a job to start",
    detail: "The backend status stream will attach here after submission.",
    state: "pending",
  },
  {
    label: "Transcription and AI steps",
    detail: "Upcoming tasks will replace this placeholder with real events.",
    state: "pending",
  },
];

type StatusTimelineProps = {
  items?: TimelineItem[];
};

export function StatusTimeline({
  items = DEFAULT_ITEMS,
}: StatusTimelineProps) {
  return (
    <section aria-label="Analysis status" className={styles.panel}>
      <h2 className={styles.panelTitle}>Status timeline</h2>
      <ol className={styles.timeline}>
        {items.map((item) => (
          <li
            key={item.label}
            className={styles.timelineItem}
            data-state={item.state ?? "pending"}
          >
            <p className={styles.timelineLabel}>{item.label}</p>
            {item.detail ? (
              <p className={styles.timelineDetail}>{item.detail}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

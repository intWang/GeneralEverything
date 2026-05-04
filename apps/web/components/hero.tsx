import styles from "../app/homepage.module.css";

const highlightChips = [
  "Transcript-first",
  "Summary-ready",
  "Ask AI follow-up",
];

export function Hero() {
  return (
    <section className={styles.hero}>
      <div
        style={{
          alignItems: "start",
          display: "grid",
          gap: "2rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))",
        }}
      >
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Video analysis for teams</p>
          <h1 className={styles.heroTitle}>
            Turn recordings into transcripts, summaries, and answers.
          </h1>
          <p className={styles.heroDescription}>
            Review meetings, training sessions, and internal video content in a
            workspace designed for faster understanding, clearer recaps, and
            grounded follow-up.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              marginTop: "1.5rem",
            }}
          >
            <a
              className={styles.primaryButton}
              href="#analysis-entry"
              style={{ display: "inline-flex", textDecoration: "none" }}
            >
              Start analysis
            </a>
            <a
              className={styles.secondaryButton}
              href="#workflow"
              style={{
                display: "inline-flex",
                marginTop: 0,
                textDecoration: "none",
              }}
            >
              See workflow
            </a>
          </div>
          <ul
            aria-label="Product highlights"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              listStyle: "none",
              margin: "1.5rem 0 0",
              padding: 0,
            }}
          >
            {highlightChips.map((chip) => (
              <li
                key={chip}
                style={{
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  borderRadius: "999px",
                  color: "#0f172a",
                  padding: "0.5rem 0.9rem",
                }}
              >
                {chip}
              </li>
            ))}
          </ul>
        </div>
        <section
          aria-label="Product preview"
          className={styles.panel}
          style={{
            display: "grid",
            gap: "1rem",
            padding: "1.5rem",
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              gap: "0.75rem",
              justifyContent: "space-between",
            }}
          >
            <div>
              <p
                style={{
                  color: "#475569",
                  fontSize: "0.875rem",
                  margin: 0,
                }}
              >
                Weekly enablement review
              </p>
              <p
                style={{
                  color: "#0f172a",
                  fontWeight: 600,
                  margin: "0.35rem 0 0",
                }}
              >
                Recording processed and ready for review
              </p>
            </div>
            <span
              style={{
                background: "#e0f2fe",
                borderRadius: "999px",
                color: "#0369a1",
                fontSize: "0.875rem",
                fontWeight: 600,
                padding: "0.4rem 0.8rem",
              }}
            >
              Ready
            </span>
          </div>
          <div
            style={{
              background: "#f8fafc",
              borderRadius: "0.75rem",
              display: "grid",
              gap: "0.5rem",
              padding: "1rem",
            }}
          >
            <p className={styles.sectionLabel} style={{ margin: 0 }}>
              Summary draft
            </p>
            <p style={{ color: "#475569", margin: 0 }}>
              The team aligned on rollout timing, flagged the open security
              review, and assigned customer enablement updates before launch.
            </p>
          </div>
          <div
            style={{
              background: "#f8fafc",
              borderRadius: "0.75rem",
              display: "grid",
              gap: "0.5rem",
              padding: "1rem",
            }}
          >
            <p className={styles.sectionLabel} style={{ margin: 0 }}>
              Transcript snippet
            </p>
            <p style={{ color: "#475569", margin: 0 }}>
              "Support owns the revised training deck, and Maya will confirm SSO
              validation before the customer-facing recap goes out."
            </p>
          </div>
          <div
            style={{
              background: "#f8fafc",
              borderRadius: "0.75rem",
              display: "grid",
              gap: "0.5rem",
              padding: "1rem",
            }}
          >
            <p className={styles.sectionLabel} style={{ margin: 0 }}>
              AI answer preview
            </p>
            <p style={{ color: "#475569", margin: 0 }}>
              Follow-up question: Which team owns the customer-ready update?
            </p>
            <p style={{ color: "#0f172a", margin: 0 }}>
              Answer: Support owns the training deck refresh and will share the
              updated version after SSO validation is complete.
            </p>
          </div>
        </section>
      </div>
    </section>
  );
}

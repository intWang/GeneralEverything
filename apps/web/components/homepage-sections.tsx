import styles from "../app/homepage.module.css";

const valuePoints = [
  "Built for recorded meetings",
  "Designed for training archives",
  "Structured for follow-up questions",
  "Ready for internal knowledge reuse",
];

const capabilities = [
  {
    description:
      "Capture searchable spoken content without replaying the full recording.",
    title: "Transcript",
  },
  {
    description:
      "Turn long recordings into concise takeaways, actions, and highlights.",
    title: "Summary",
  },
  {
    description:
      "Follow up with targeted questions after the first review is done.",
    title: "Ask AI",
  },
  {
    description:
      "Give teams a faster structural view of what the recording covered.",
    title: "Mind Map",
  },
];

const workflowSteps = [
  {
    description:
      "Start with the recording source your team already has on hand.",
    title: "Add a public video or recording source",
  },
  {
    description:
      "Pull the initial context needed to ground the rest of the workspace.",
    title: "Extract metadata and transcript",
  },
  {
    description:
      "Turn the recording into a short review and a navigable topic outline.",
    title: "Generate summary and topic structure",
  },
  {
    description:
      "Keep exploring the recording without jumping between disconnected tools.",
    title: "Ask follow-up questions in one workspace",
  },
];

const useCases = [
  {
    description:
      "Revisit decisions, highlights, and unresolved questions without replaying the full call.",
    title: "Meeting review",
  },
  {
    description:
      "Help teams absorb long training recordings faster and retain the important parts.",
    title: "Training recap",
  },
  {
    description:
      "Turn one-off recordings into reusable internal references for future work.",
    title: "Knowledge capture",
  },
];

const workspacePreviewBlocks = [
  {
    description:
      "Watch the analysis move from intake through transcript, summary, and follow-up readiness without losing the current stage.",
    title: "Status timeline",
  },
  {
    description:
      "Keep recording title, source, duration, and thumbnail context visible beside every downstream output.",
    title: "Video info",
  },
  {
    description:
      "Scan the transcript first so teams can confirm what was said before jumping into takeaways or Q&A.",
    title: "Transcript",
  },
  {
    description:
      "Turn long recordings into concise highlights, decisions, and next steps that are easier to share.",
    title: "Summary",
  },
  {
    description:
      "Ask grounded follow-up questions once the transcript and summary are ready, without leaving the workspace.",
    title: "Ask AI",
  },
];

export function HomepageSections() {
  return (
    <>
      <section aria-label="Product value" className={styles.content}>
        <ul
          style={{
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
            listStyle: "none",
            margin: 0,
            padding: 0,
          }}
        >
          {valuePoints.map((point) => (
            <li
              className={styles.panel}
              key={point}
              style={{ color: "#0f172a", fontWeight: 600 }}
            >
              {point}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.content} id="capabilities">
        <p className={styles.eyebrow}>Capabilities</p>
        <h2 className={styles.panelTitle} style={{ fontSize: "2rem" }}>
          Everything teams need after the recording ends.
        </h2>
        <div
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))",
            marginTop: "1.5rem",
          }}
        >
          {capabilities.map((capability) => (
            <article className={styles.panel} key={capability.title}>
              <h3 className={styles.panelTitle}>{capability.title}</h3>
              <p className={styles.workspaceDescription}>
                {capability.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.content} id="workflow">
        <p className={styles.eyebrow}>Workflow</p>
        <h2 className={styles.panelTitle} style={{ fontSize: "2rem" }}>
          Move from recording to follow-up in four steps.
        </h2>
        <ol
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(15rem, 1fr))",
            margin: "1.5rem 0 0",
            padding: 0,
          }}
        >
          {workflowSteps.map((step, index) => (
            <li
              className={styles.panel}
              key={step.title}
              style={{ listStyle: "none" }}
            >
              <p
                style={{
                  color: "#0369a1",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                Step {index + 1}
              </p>
              <h3
                className={styles.panelTitle}
                style={{ marginTop: "0.75rem" }}
              >
                {step.title}
              </h3>
              <p className={styles.workspaceDescription}>{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.content} id="use-cases">
        <p className={styles.eyebrow}>Use Cases</p>
        <h2 className={styles.panelTitle} style={{ fontSize: "2rem" }}>
          Built for the recordings teams already rely on.
        </h2>
        <div
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
            marginTop: "1.5rem",
          }}
        >
          {useCases.map((useCase) => (
            <article className={styles.panel} key={useCase.title}>
              <h3 className={styles.panelTitle}>{useCase.title}</h3>
              <p className={styles.workspaceDescription}>{useCase.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.content} id="preview">
        <div
          style={{
            alignItems: "start",
            display: "grid",
            gap: "1.5rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(18rem, 1fr))",
          }}
        >
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <p className={styles.eyebrow}>Preview</p>
            <h2 className={styles.panelTitle} style={{ fontSize: "2rem" }}>
              Review the workflow before you jump into the live workspace.
            </h2>
            <p className={styles.heroDescription} style={{ margin: 0 }}>
              The real analysis entry stays on this page. This preview simply
              shows how status, recording context, and AI outputs come together
              once a job is in motion.
            </p>
          </div>
          <section
            aria-label="Workspace preview"
            className={styles.panel}
            style={{ display: "grid", gap: "1rem", padding: "1.5rem" }}
          >
            <div style={{ display: "grid", gap: "0.5rem" }}>
              <p className={styles.eyebrow} style={{ margin: 0 }}>
                Product preview
              </p>
              <h3 className={styles.panelTitle}>
                Start with a recording. Leave with searchable answers.
              </h3>
              <p className={styles.workspaceDescription} style={{ margin: 0 }}>
                Track status, inspect recording details, read the transcript,
                review takeaways, and ask grounded follow-up questions from one
                place.
              </p>
            </div>
            <div
              style={{
                display: "grid",
                gap: "0.75rem",
                gridTemplateColumns: "repeat(auto-fit, minmax(11rem, 1fr))",
              }}
            >
              {workspacePreviewBlocks.map((block) => (
                <div
                  key={block.title}
                  style={{
                    background: "#f8fafc",
                    borderRadius: "0.75rem",
                    padding: "1rem",
                  }}
                >
                  <p className={styles.sectionLabel} style={{ margin: 0 }}>
                    {block.title}
                  </p>
                  <p
                    className={styles.workspaceDescription}
                    style={{ marginTop: "0.5rem" }}
                  >
                    {block.description}
                  </p>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
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
                Explore workflow
              </a>
            </div>
          </section>
        </div>
      </section>
    </>
  );
}

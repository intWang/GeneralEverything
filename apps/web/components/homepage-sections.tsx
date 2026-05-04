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
        <ul className={styles.valueBand}>
          {valuePoints.map((point) => (
            <li className={`${styles.panel} ${styles.valueItem}`} key={point}>
              {point}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.content} id="capabilities">
        <p className={styles.eyebrow}>Capabilities</p>
        <h2 className={styles.sectionHeading}>
          Everything teams need after the recording ends.
        </h2>
        <div className={styles.capabilityGrid}>
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
        <h2 className={styles.sectionHeading}>
          Move from recording to follow-up in four steps.
        </h2>
        <ol className={styles.workflowGrid}>
          {workflowSteps.map((step, index) => (
            <li className={`${styles.panel} ${styles.workflowStepCard}`} key={step.title}>
              <p className={styles.workflowStepNumber}>
                Step {index + 1}
              </p>
              <h3 className={`${styles.panelTitle} ${styles.workflowStepTitle}`}>
                {step.title}
              </h3>
              <p className={styles.workspaceDescription}>{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.content} id="use-cases">
        <p className={styles.eyebrow}>Use Cases</p>
        <h2 className={styles.sectionHeading}>
          Built for the recordings teams already rely on.
        </h2>
        <div className={styles.useCaseGrid}>
          {useCases.map((useCase) => (
            <article className={styles.panel} key={useCase.title}>
              <h3 className={styles.panelTitle}>{useCase.title}</h3>
              <p className={styles.workspaceDescription}>{useCase.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.content} id="preview">
        <div className={styles.previewGrid}>
          <div className={styles.previewIntro}>
            <p className={styles.eyebrow}>Preview</p>
            <h2 className={styles.sectionHeading}>
              Review the workflow before you jump into the live workspace.
            </h2>
            <p className={styles.previewIntroCopy}>
              The real analysis entry stays on this page. This preview simply
              shows how status, recording context, and AI outputs come together
              once a job is in motion.
            </p>
          </div>
          <section
            aria-label="Workspace preview"
            className={`${styles.panel} ${styles.previewWorkspace}`}
          >
            <div className={styles.previewWorkspaceHeader}>
              <p className={`${styles.eyebrow} ${styles.compactEyebrow}`}>
                Product preview
              </p>
              <h3 className={styles.panelTitle}>
                Start with a recording. Leave with searchable answers.
              </h3>
              <p className={styles.previewWorkspaceCopy}>
                Track status, inspect recording details, read the transcript,
                review takeaways, and ask grounded follow-up questions from one
                place.
              </p>
            </div>
            <div className={styles.previewBlocksGrid}>
              {workspacePreviewBlocks.map((block) => (
                <div className={styles.previewBlock} key={block.title}>
                  <p className={`${styles.sectionLabel} ${styles.compactLabel}`}>
                    {block.title}
                  </p>
                  <p className={styles.previewBlockCopy}>
                    {block.description}
                  </p>
                </div>
              ))}
            </div>
            <div className={styles.ctaRow}>
              <a
                className={`${styles.primaryButton} ${styles.buttonLink}`}
                href="#analysis-entry"
              >
                Start analysis
              </a>
              <a
                className={`${styles.secondaryButton} ${styles.secondaryButtonInline}`}
                href="#workflow"
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

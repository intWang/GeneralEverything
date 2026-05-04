import styles from "../app/homepage.module.css";

type ResultWorkspaceProps = {
  title?: string;
};

export function ResultWorkspace({
  title = "Results workspace",
}: ResultWorkspaceProps) {
  return (
    <section aria-label={title} className={styles.workspace}>
      <h2 className={styles.workspaceTitle}>{title}</h2>
      <p className={styles.workspaceDescription}>
        Analysis output will land here in a later task.
      </p>
    </section>
  );
}

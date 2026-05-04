type ResultWorkspaceProps = {
  title?: string;
};

export function ResultWorkspace({
  title = "Results workspace",
}: ResultWorkspaceProps) {
  return (
    <section
      aria-label={title}
      className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-slate-600"
    >
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mt-2 text-sm">
        Analysis output will land here in a later task.
      </p>
    </section>
  );
}

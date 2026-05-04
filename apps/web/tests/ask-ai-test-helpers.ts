export function buildAskAiMockReferences(transcriptSource: string) {
  const previewMaxChars = 72;
  const buildReference = (label: string, previewText: string) => {
    const normalizedPreview = previewText.trim().replace(/\s+/g, " ");
    const snippet =
      normalizedPreview.length > previewMaxChars
        ? `${normalizedPreview.slice(0, previewMaxChars - 3).trimEnd()}...`
        : normalizedPreview;

    return `${label}: ${snippet}`;
  };

  return [
    buildReference(
      "Transcript",
      `Transcript shell generated for ${transcriptSource}. It captures a longer explanation so the UI can render a compact source card preview.`,
    ),
    buildReference(
      "Summary",
      "Summary shell generated from transcript preview. It keeps enough detail to demonstrate trimming in the reference cards.",
    ),
    buildReference(
      "Mind map",
      "Mind map shell generated from summary preview. It expands into more context than the reference list should render in full.",
    ),
  ];
}

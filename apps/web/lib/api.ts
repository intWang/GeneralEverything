export type CreateJobResponse = {
  id: string;
  [key: string]: unknown;
};

export async function createJob(sourceUrl: string) {
  const payload = {
    source_url: sourceUrl,
  };

  const response = await fetch("/api/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to create job");
  }

  return (await response.json()) as CreateJobResponse;
}

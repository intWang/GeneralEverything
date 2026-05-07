import { expect, test } from "@playwright/test";

import { installPhase2ApiFixtures, phase2JobId } from "./phase2-fixtures";

test.beforeEach(async ({ page }) => {
  await installPhase2ApiFixtures(page);
});

test("opens a completed Phase 2 analysis and verifies grounded export flow", async ({
  page,
}) => {
  await page.goto(`/?job=${phase2JobId}`);

  await expect(
    page.getByRole("heading", {
      name: "Paste a video URL. Get transcript, summary, and answers.",
    }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Video info" })).toBeVisible();
  await expect(page.getByText("72%")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Download 1080p meeting recording" }),
  ).toBeVisible();
  await expect(
    page.getByText("This internal recording may require an authenticated browser session."),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Transcript" }).click();
  await expect(
    page.getByText(
      "02:01 While the media downloads, progress and transcript segments should appear in the workspace.",
    ),
  ).toBeVisible();

  await page.getByRole("tab", { name: "Ask AI" }).click();
  await page.getByRole("button", { name: "What should I review first?" }).click();
  await page.getByRole("button", { name: "Submit question" }).click();
  await expect(page.getByText("Review the streaming pipeline first")).toBeVisible();
  await expect(page.getByRole("button", { name: "Jump to transcript 02:01" })).toBeVisible();

  await page.getByRole("button", { name: "Export report" }).click();
  await expect(page.getByRole("link", { name: "Download report .md" })).toBeVisible();
  await expect(page.getByText("Report generated at 2026-05-07T19:30:00Z")).toBeVisible();
});

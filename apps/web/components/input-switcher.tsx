"use client";

import type { InputMode } from "../lib/types";

const INPUT_OPTIONS: Array<{ label: string; value: InputMode }> = [
  {
    label: "Public Video URL",
    value: "public-video-url",
  },
  {
    label: "RingCentral Recording URL",
    value: "ringcentral-recording-url",
  },
];

export function InputSwitcher() {
  return (
    <div
      aria-label="Input mode switcher"
      className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row"
    >
      {INPUT_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-sm font-medium text-slate-950 shadow-sm transition hover:border-slate-400"
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

"use client";

import styles from "../app/homepage.module.css";
import type { InputMode } from "../lib/types";

const INPUT_OPTIONS: Array<{ label: string; value: InputMode }> = [
  {
    label: "Public Video URL",
    value: "public_video",
  },
  {
    label: "RingCentral Recording URL",
    value: "ringcentral_recording",
  },
];

type InputSwitcherProps = {
  value: InputMode;
  onChange: (value: InputMode) => void;
};

export function InputSwitcher({ value, onChange }: InputSwitcherProps) {
  return (
    <fieldset className={styles.switcher}>
      <legend className={styles.sectionLabel}>Choose an input source</legend>
      {INPUT_OPTIONS.map((option) => (
        <label key={option.value} className={styles.switcherOption}>
          <input
            checked={value === option.value}
            className={styles.switcherRadio}
            name="input-mode"
            onChange={() => onChange(option.value)}
            type="radio"
            value={option.value}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

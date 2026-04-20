"use client";

import { useState } from "react";

interface NamePromptModalProps {
  defaultName?: string;
  onSubmit: (name: string) => void;
  onSkip: (memeName: string) => void;
  generateMemeName: () => string;
}

export default function NamePromptModal({
  defaultName,
  onSubmit,
  onSkip,
  generateMemeName,
}: NamePromptModalProps) {
  const [value, setValue] = useState(defaultName ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <div className="ar-name-modal" role="dialog" aria-modal="true">
      <div className="ar-name-backdrop" />
      <form className="ar-name-card" onSubmit={submit}>
        <div className="ar-name-kicker">before you sit down</div>
        <h2 className="ar-name-title">what should we call you?</h2>
        <p className="ar-name-sub">
          shows up on the leaderboard when you beat sinza. or doesn&apos;t.
        </p>
        <input
          autoFocus
          className="ar-name-input"
          type="text"
          maxLength={32}
          placeholder="your handle"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="ar-name-ctas">
          <button
            type="submit"
            className="ar-btn ar-btn-primary"
            disabled={!value.trim()}
          >
            save & play
          </button>
          <button
            type="button"
            className="ar-btn ar-btn-ghost"
            onClick={() => onSkip(generateMemeName())}
          >
            skip — give me a meme name
          </button>
        </div>
      </form>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import {
  Hero,
  Marquee,
  Roster,
  Roadmap,
  Leaderboard,
  WinsGallery,
  HowItWorks,
  SubmitAgent,
  Footer,
} from "./sections";

const DEFAULT_VARIANT = "noir";
const DEFAULT_ACCENT = "#ff4b2b";
const DEFAULT_VOICE = "cocky";

function Nav({ onPlayClick }: { onPlayClick: () => void }) {
  return (
    <nav className="km-nav">
      <div className="km-wrap km-nav-inner">
        <a className="km-logo" href="#">
          kingme<span className="km-logo-dot">.</span>dev
        </a>
        <div className="km-nav-links">
          <a>play</a>
          <a>how it works</a>
          <a>roadmap</a>
          <a>leaderboard</a>
          <a>for devs</a>
        </div>
        <a className="km-nav-cta" onClick={onPlayClick}>
          king me →
        </a>
      </div>
    </nav>
  );
}

export default function Landing() {
  const [variant] = useState(DEFAULT_VARIANT);
  const [accent] = useState(DEFAULT_ACCENT);
  const [copyVoice] = useState(DEFAULT_VOICE);
  const [mode, setMode] = useState<"demo" | "play">("demo");
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-variant", variant);
    document.documentElement.style.setProperty("--accent", accent);
  }, [variant, accent]);

  const onPlayClick = () => {
    setMode("play");
    if (heroRef.current) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <>
      <Nav onPlayClick={onPlayClick} />
      <div ref={heroRef}>
        <Hero
          variant={variant}
          accent={accent}
          copyVoice={copyVoice}
          mode={mode}
          setMode={setMode}
        />
      </div>
      <Marquee />
      <Roster />
      <Roadmap />
      <HowItWorks />
      <Leaderboard />
      <WinsGallery />
      <SubmitAgent />
      <Footer />
    </>
  );
}

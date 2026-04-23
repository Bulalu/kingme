"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FEATURED_AGENT, getAgentPath } from "@/lib/agents";
import {
  Hero,
  Marquee,
  Roster,
  Roadmap,
  Leaderboard,
  // WinsGallery,
  // HowItWorks,
  SubmitAgent,
  Footer,
} from "./sections";

const DEFAULT_VARIANT = "noir";
const DEFAULT_ACCENT = "#ff4b2b";
const DEFAULT_VOICE = "cocky";

function Nav() {
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
        <Link className="km-nav-cta" href={getAgentPath(FEATURED_AGENT.id)}>
          king me →
        </Link>
      </div>
    </nav>
  );
}

export default function Landing() {
  const [variant] = useState(DEFAULT_VARIANT);
  const [accent] = useState(DEFAULT_ACCENT);
  const [copyVoice] = useState(DEFAULT_VOICE);
  const [mode, setMode] = useState<"demo" | "play">("demo");

  useEffect(() => {
    document.documentElement.setAttribute("data-variant", variant);
    document.documentElement.style.setProperty("--accent", accent);
  }, [variant, accent]);

  return (
    <>
      <Nav />
      <Hero
        variant={variant}
        accent={accent}
        copyVoice={copyVoice}
        mode={mode}
        setMode={setMode}
      />
      <Marquee />
      <Roster />
      <Roadmap />
      {/* <HowItWorks /> */}
      <Leaderboard />
      {/* <WinsGallery /> */}
      <SubmitAgent />
      <Footer />
    </>
  );
}

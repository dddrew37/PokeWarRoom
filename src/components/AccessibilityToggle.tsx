"use client";

import { useEffect, useState } from "react";

export default function AccessibilityToggle() {
  const [isLarge, setIsLarge] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("poke-text-scale");
    if (stored === "large") {
      document.body.setAttribute("data-text-scale", "large");
      setIsLarge(true);
    }
  }, []);

  const toggleScale = () => {
    if (isLarge) {
      document.body.removeAttribute("data-text-scale");
      localStorage.setItem("poke-text-scale", "normal");
      setIsLarge(false);
    } else {
      document.body.setAttribute("data-text-scale", "large");
      localStorage.setItem("poke-text-scale", "large");
      setIsLarge(true);
    }
  };

  return (
    <button
      onClick={toggleScale}
      title="Toggle Large Text Mode"
      className="fixed bottom-4 right-4 z-50 flex items-center justify-center gap-1.5 px-3 py-2 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 text-red-500 rounded-xl shadow-2xl transition-all duration-300 group hover:border-red-900/40 cursor-pointer active:scale-95"
    >
      <span className="text-xs font-black uppercase tracking-widest font-mono">
        {isLarge ? "[Text: Default]" : "[Text: Large]"}
      </span>
      <span className="text-[10px] font-black bg-red-950/30 text-red-400 border border-red-900/35 px-1.5 py-0.5 rounded font-mono uppercase tracking-wider">
        AA
      </span>
    </button>
  );
}

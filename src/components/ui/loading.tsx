/** Écran de chargement (fallback Suspense) : rune qui tourne + lignes fantômes. */
export function Loading({ label = "Chargement des prix poe.ninja…", rows = 6 }: { label?: string; rows?: number }) {
  return (
    <div className="flex flex-col gap-6" role="status" aria-live="polite">
      <div className="flex items-center gap-4">
        <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden>
          <path
            className="spin-slow"
            d="M23 3 40 13v20L23 43 6 33V13z"
            fill="none"
            stroke="#ffb347"
            strokeWidth="1.4"
            strokeDasharray="6 4"
            style={{ filter: "drop-shadow(0 0 4px #ff7a2a)" }}
          />
          <circle className="pulse-glow" cx="23" cy="23" r="5" fill="#fff0b8" style={{ filter: "drop-shadow(0 0 8px #ff7a2a)" }} />
        </svg>
        <span className="flavour text-xl text-peach">{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skel h-[118px]" />
        ))}
      </div>
      <div className="skel h-24" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="skel h-12" style={{ width: `${96 - ((i * 7) % 20)}%` }} />
        ))}
      </div>
    </div>
  );
}

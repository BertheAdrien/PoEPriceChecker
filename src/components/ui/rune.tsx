import type { CSSProperties, ReactNode } from "react";

/** Cadre SVG : trait de base ; `ignite` = trait de feu qui fait le tour une fois, à l'apparition (fenêtres). */
export function Frame({ ignite }: { ignite?: boolean }) {
  return (
    <svg aria-hidden className={`rune-frame${ignite ? " ignite" : ""}`}>
      <rect className="base" width="100%" height="100%" />
      <rect className="full" pathLength={100} width="100%" height="100%" />
    </svg>
  );
}

const CORNERS: CSSProperties[] = [
  { top: 5, left: 5 },
  { top: 5, right: 5, transform: "scaleX(-1)" },
  { bottom: 5, left: 5, transform: "scaleY(-1)" },
  { bottom: 5, right: 5, transform: "scale(-1)" },
];

/** Coins dorés ciselés (`rich` : double filet, pour les cadres principaux). */
export function Corners({ size = 22, rich }: { size?: number; rich?: boolean }) {
  return (
    <>
      {CORNERS.map((pos, i) => (
        <svg
          key={i}
          aria-hidden
          width={size}
          height={size}
          viewBox="0 0 22 22"
          className="pointer-events-none absolute"
          style={pos}
        >
          <path d="M1 21V7Q1 1 7 1h14" fill="none" stroke={rich ? "#ffd27a" : "#d6a95a"} />
          {rich && <path d="M5 21V9q0-4 4-4h12" fill="none" stroke="#8a5a2a" />}
          <circle cx="4" cy="4" r="1.7" fill={rich ? "#fff0b8" : "#ffd27a"} />
        </svg>
      ))}
    </>
  );
}

/** Panneau encadré : cadre qui s'embrase au survol + coins optionnels. */
export function Panel({
  children,
  className = "",
  corners,
  rich,
  style,
}: {
  children: ReactNode;
  className?: string;
  corners?: boolean;
  rich?: boolean;
  style?: CSSProperties;
}) {
  return (
    <div className={`rune-panel ${className}`} style={style}>
      <Frame />
      {corners && <Corners rich={rich} size={rich ? 26 : 22} />}
      {children}
    </div>
  );
}

/** Sceau de cire : prix vérifié sur le trade. */
export function Seal({ size = 30, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 34 34"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className="shrink-0 drop-shadow-[0_2px_3px_rgba(0,0,0,0.6)]"
    >
      <path
        d="M17 1l3 3 4-1 1 4 4 1-1 4 3 3-3 3 1 4-4 1-1 4-4-1-3 3-3-3-4 1-1-4-4-1 1-4-3-3 3-3-1-4 4-1 1-4 4 1z"
        fill="#8e2219"
      />
      <circle cx="17" cy="17" r="9" fill="none" stroke="#c24a3c" />
      <path d="M12.5 17.5l3 3 6-7" fill="none" stroke="#f3c9a8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Tampon de travers : faux positif démenti par le trade. */
export function FalseStamp({ children = "Faux positif" }: { children?: ReactNode }) {
  return (
    <span className="inline-block -rotate-6 border-2 border-[#c94a3a] px-2 py-0.5 font-display text-[11px] font-bold tracking-[0.12em] text-danger">
      {children}
    </span>
  );
}

/** Filet décoratif avec losange central. */
export function Divider({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden width="100%" height="12" viewBox="0 0 1000 12" preserveAspectRatio="none" className={className}>
      <path d="M0 6h480M520 6h480" stroke="#4a2e18" />
      <path d="M500 1l5 5-5 5-5-5z" fill="#ffb347" />
    </svg>
  );
}

/** Rune hexagonale du rang (allumée pour le top 3). */
export function RankRune({ rank, lit }: { rank: number; lit: boolean }) {
  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-label={`Rang ${rank}`} role="img">
      <path d="M15 2 27 9v12l-12 7L3 21V9z" fill={lit ? "rgb(255 140 50 / 0.25)" : "#120c08"} stroke={lit ? "#ffb347" : "#5a3a20"} />
      <text
        x="15"
        y="19"
        textAnchor="middle"
        fontFamily="var(--font-cinzel), serif"
        fontSize={rank > 99 ? 7 : 9}
        fontWeight="700"
        fill={lit ? "#fff0b8" : "#a8927a"}
      >
        {roman(rank)}
      </text>
    </svg>
  );
}

/** Chiffres romains jusqu'à 39, nombres ensuite (le rang reste lisible). */
export function roman(n: number): string {
  if (n >= 40) return String(n);
  const tens = ["", "X", "XX", "XXX"][Math.floor(n / 10)];
  const units = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"][n % 10];
  return tens + units;
}

/** Couleur d'un item selon sa catégorie poe.ninja (inspirée des raretés du jeu). */
export function itemColor(category?: string): string {
  if (!category) return "var(--color-normal)";
  if (category.startsWith("Unique")) return "var(--color-unique)";
  if (category === "DivinationCard") return "var(--color-frost)";
  if (category === "Essence") return "var(--color-essence)";
  if (category === "Currency" || category === "Fragment" || category === "Scarab" || category === "Oil" || category === "Fossil")
    return "var(--color-currency)";
  return "var(--color-normal)";
}

/** Couleur de chaleur d'une marge : du rouge sombre au blanc incandescent. */
export function heatColor(marginPct: number): string {
  if (marginPct <= 0) return "#4a5868";
  if (marginPct >= 200) return "#fff0b8";
  if (marginPct >= 120) return "#ffb347";
  if (marginPct >= 70) return "#ff7a2a";
  return "#e0571f";
}

/** Étiquette colorée d'un item (nom + quantité). */
export function ItemPill({ name, qty, category }: { name: string; qty?: number; category?: string }) {
  const c = itemColor(category);
  return (
    <span
      className="inline-flex items-baseline gap-1 whitespace-nowrap border px-2.5 py-1 text-[13px] font-medium"
      style={{
        color: c,
        background: `color-mix(in srgb, ${c} 9%, transparent)`,
        borderColor: `color-mix(in srgb, ${c} 26%, transparent)`,
      }}
    >
      {qty !== undefined && <span className="num opacity-70">{qty}×</span>} {name}
    </span>
  );
}

/**
 * Mini-graphe 7 jours (sparkline poe.ninja : variation cumulée en %). Les jours sans donnée (null)
 * sont sautés ; braise vive si la tendance monte, braise refroidie (cuivre sombre) si elle baisse.
 */
export function Sparkline({ series, width = 96, height = 26 }: { series: (number | null)[]; width?: number; height?: number }) {
  const pts = series.flatMap((v, i) => (v === null ? [] : [[i, v] as const]));
  if (pts.length < 2) return null;
  const vals = pts.map(([, v]) => v);
  const min = Math.min(...vals);
  const range = Math.max(...vals) - min || 1;
  const pad = 2;
  const x = (i: number) => pad + (i / Math.max(1, series.length - 1)) * (width - 2 * pad);
  const y = (v: number) => height - pad - ((v - min) / range) * (height - 2 * pad);
  const line = pts.map(([i, v], n) => `${n ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const area = `${line} L${x(pts[pts.length - 1][0]).toFixed(1)} ${height} L${x(pts[0][0]).toFixed(1)} ${height} Z`;
  const up = vals[vals.length - 1] >= vals[0];
  const stroke = up ? "#ffb347" : "#c0583a";
  const [lastI, lastV] = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="shrink-0 overflow-visible">
      <path d={area} fill={up ? "rgb(255 179 71 / 0.12)" : "rgb(192 88 58 / 0.1)"} />
      <path d={line} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(lastI)} cy={y(lastV)} r="2.2" fill={stroke} />
    </svg>
  );
}

/** Spinner runique (vérification en cours, chargement). */
export function RuneSpinner({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden className="shrink-0">
      <circle cx="9" cy="9" r="7" fill="none" stroke="rgb(140 196 240 / 0.3)" strokeWidth="2" />
      <path className="spin-slow" d="M9 2a7 7 0 0 1 7 7" fill="none" stroke="#8cc4f0" strokeWidth="2" strokeLinecap="round" style={{ transformOrigin: "9px 9px", transformBox: "view-box" }} />
    </svg>
  );
}

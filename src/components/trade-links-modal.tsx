"use client";

import { useEffect } from "react";
import type { TradeLink } from "@/lib/trade/links";
import { Corners, Divider, Frame } from "./ui/rune";

/**
 * Fenêtre listant les liens trade d'une opportunité. Les navigateurs n'autorisent qu'un nouvel onglet
 * par clic : chaque lien est donc un clic séparé (toujours autorisé). Le bouton « Tout ouvrir » ne
 * marche que si les pop-ups sont autorisées pour le site.
 */
export function TradeLinksModal({
  title,
  links,
  onClose,
}: {
  title: string;
  links: TradeLink[];
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const openAll = () => {
    for (const l of links) window.open(l.url, "_blank", "noopener");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-[3px]"
      style={{ background: "radial-gradient(circle at 50% 35%, rgb(40 18 6 / 0.55), rgb(4 2 1 / 0.85) 70%)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Liens trade"
        className="rune-panel dialog-in w-full max-w-lg px-7 pt-6 pb-5"
        style={{
          background:
            "radial-gradient(100% 70% at 50% -10%, rgb(255 110 30 / 0.22), transparent 60%), linear-gradient(180deg, #1c130c, #0e0907)",
          boxShadow: "0 40px 120px -20px rgb(255 90 20 / 0.35)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <Frame ignite />
        <Corners rich size={26} />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-[11px] tracking-[0.3em] text-muted">LIENS TRADE</p>
            <h2 className="mt-1.5 font-display text-lg leading-snug font-bold text-cream">{title}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="size-11 shrink-0 border border-edge text-muted hover:border-flame hover:text-cream"
          >
            ✕
          </button>
        </div>
        <Divider className="my-4" />
        <ul className="flex flex-col gap-2.5">
          {links.map((l) => (
            <li key={`${l.role}-${l.item}`}>
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center justify-between gap-3 px-4 py-3 text-text shadow-[inset_0_0_0_1px_#3a2414] transition hover:bg-ember/10 hover:text-text hover:shadow-[inset_0_0_0_1px_#ff9a4a,0_0_18px_-4px_rgb(255_120_40/0.5)]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className={`shrink-0 border px-2 py-0.5 font-display text-[11px] tracking-[0.12em] ${
                      l.role === "input" ? "border-flame/40 text-flame" : "border-jade/40 text-jade"
                    }`}
                  >
                    {l.role === "input" ? "Achat" : "Vente"}
                  </span>
                  <span className="truncate font-medium text-unique">{l.item}</span>
                </span>
                <span aria-hidden className="text-flame">
                  ↗
                </span>
              </a>
            </li>
          ))}
        </ul>
        {links.length > 1 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-edge-soft pt-4 text-xs text-faint">
            <span>« Tout ouvrir » nécessite d&apos;autoriser les pop-ups pour ce site.</span>
            <button onClick={openAll} className="btn-fire shrink-0 px-4 py-2.5 font-display text-sm font-bold tracking-wide">
              Tout ouvrir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

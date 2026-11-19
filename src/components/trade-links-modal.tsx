"use client";

import { useEffect } from "react";
import type { TradeLink } from "@/lib/trade/links";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Liens trade"
        className="w-full max-w-md rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-zinc-100">{title}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-100" aria-label="Fermer">
            ✕
          </button>
        </div>
        <ul className="flex flex-col gap-2">
          {links.map((l) => (
            <li key={`${l.role}-${l.item}`}>
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center justify-between gap-2 rounded border px-3 py-2 text-sm hover:bg-zinc-800 ${
                  l.role === "input" ? "border-sky-700/60 text-sky-300" : "border-emerald-700/60 text-emerald-300"
                }`}
              >
                <span className="truncate">{l.label}</span>
                <span aria-hidden>↗</span>
              </a>
            </li>
          ))}
        </ul>
        {links.length > 1 && (
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-zinc-500">
            <span>« Tout ouvrir » nécessite d&apos;autoriser les pop-ups pour ce site.</span>
            <button
              onClick={openAll}
              className="shrink-0 rounded border border-amber-500/60 px-2 py-1 text-amber-300 hover:bg-zinc-800"
            >
              Tout ouvrir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

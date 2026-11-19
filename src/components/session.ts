"use client";

/**
 * État de l'onglet (filtres, tri, vérifications trade) conservé entre le tableau et la page d'une
 * opportunité. `sessionStorage` : propre à l'onglet, vidé à sa fermeture ; peut être indisponible
 * (navigation privée, stockage bloqué) → toujours optionnel.
 */
const PREFIX = "poe-price-checker:";

/** `fetchedAt` fourni : la valeur n'est rendue que si elle date des mêmes données poe.ninja. */
export function readSession<T>(key: string, fetchedAt?: string): T | undefined {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const v = JSON.parse(raw) as { fetchedAt?: string; value: T };
    if (fetchedAt !== undefined && v.fetchedAt !== fetchedAt) return undefined;
    return v.value;
  } catch {
    return undefined;
  }
}

export function writeSession(key: string, value: unknown, fetchedAt?: string): void {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify({ fetchedAt, value }));
  } catch {
    // stockage indisponible : l'état est simplement perdu à la navigation
  }
}

export interface EngineConfig {
  /** Part du revenu retirée par prudence (poe.ninja ne donne qu'une valeur par item). */
  safetyMargin: number;
  /** Volume échangé minimum (en chaos) pour un item de l'exchange acheté ou vendu. */
  minVolumeChaos: number;
  /** Nombre d'annonces minimum pour un item issu des stashes. */
  minListings: number;
  /** Longueur des chaînes PNJ (en étapes). */
  minChainSteps: number;
  maxChainSteps: number;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  safetyMargin: 0.05,
  minVolumeChaos: 300,
  minListings: 5,
  minChainSteps: 2,
  maxChainSteps: 4,
};

export function resolveConfig(partial: Partial<EngineConfig> = {}): EngineConfig {
  return { ...DEFAULT_ENGINE_CONFIG, ...partial };
}

import { z } from "zod";

/** Schémas minimaux : seuls les champs utilisés sont validés, le reste est toléré. */

export const leaguesSchema = z.array(z.object({ id: z.string(), name: z.string() }));

const exchangeItem = z.object({
  id: z.string(),
  name: z.string(),
  image: z.string().nullish(),
  category: z.string().nullish(),
  detailsId: z.string().nullish(),
});

/** Variation sur 7 jours : `totalChange` (%) et `data` = 7 points de variation cumulée (%), null si inconnu. */
const sparkline = z
  .object({ totalChange: z.number().nullish(), data: z.array(z.number().nullable()).nullish() })
  .nullish();

export const exchangeOverviewSchema = z.object({
  core: z.object({
    primary: z.string(),
    secondary: z.string().nullish(),
    rates: z.record(z.string(), z.number()).nullish(),
    items: z.array(exchangeItem).nullish(),
  }),
  items: z.array(exchangeItem),
  lines: z.array(
    z.object({
      id: z.string(),
      primaryValue: z.number(),
      volumePrimaryValue: z.number().nullish(),
      sparkline,
    }),
  ),
});

export const itemOverviewSchema = z.object({
  lines: z.array(
    z.object({
      name: z.string(),
      baseType: z.string().nullish(),
      variant: z.string().nullish(),
      links: z.number().nullish(),
      chaosValue: z.number(),
      divineValue: z.number().nullish(),
      count: z.number().nullish(),
      listingCount: z.number().nullish(),
      sparkLine: sparkline,
      detailsId: z.string().nullish(),
      icon: z.string().nullish(),
    }),
  ),
});

export type ExchangeOverview = z.infer<typeof exchangeOverviewSchema>;
export type ItemOverview = z.infer<typeof itemOverviewSchema>;

/**
 * Configuration price math (Phase 3).
 *
 * ```text
 * variant price (or base price) + flavour surcharge + eggless surcharge
 * ```
 *
 * Everything is integer paise — the same representation the database stores,
 * so the preview the customer sees is computed exactly the way a future
 * order phase will compute the authoritative total. This module is shared by
 * the configurator UI today and the order server tomorrow; prices always come
 * from the database, never from client input.
 */

export type PriceConfiguration = {
  /** Null when the product uses its base price (no variant applies). */
  variantPaise: number | null;
  flavourSurchargePaise: number;
  egglessSelected: boolean;
  egglessSurchargePaise: number;
};

/** Total in paise. Pure function — safe to unit test exhaustively. */
export function configurationTotalPaise(
  basePaise: number,
  configuration: PriceConfiguration,
): number {
  const variant = configuration.variantPaise ?? basePaise;
  return (
    Math.max(0, Math.floor(variant)) +
    Math.max(0, Math.floor(configuration.flavourSurchargePaise)) +
    (configuration.egglessSelected
      ? Math.max(0, Math.floor(configuration.egglessSurchargePaise))
      : 0)
  );
}

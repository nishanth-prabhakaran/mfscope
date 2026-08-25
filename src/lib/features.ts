/**
 * Feature availability driven by the active data provider.
 *
 * The app now runs on MFAPI.in, which serves only scheme lists and NAV
 * history. Anything that needs a factsheet (holdings, sectors, expense ratio,
 * category risk stats, peers) has no data source, so those surfaces are hidden
 * rather than shown broken.
 */
export const FACTSHEET_AVAILABLE = false;

export const DATA_SOURCE = {
  label: "MFAPI",
  url: "https://www.mfapi.in",
} as const;

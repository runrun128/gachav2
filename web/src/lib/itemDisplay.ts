import { ItemTier } from "@identity-slot/game-core";
import { CSSProperties } from "react";

export const TIER_COLOR: Record<ItemTier, string> = {
  shop: "#4dd0e1",
  common: "#9aa0a6",
  uncommon: "#2ecc71",
  rare: "#9b59b6",
  legendary: "#f1c40f",
};

export function accentStyle(color: string): CSSProperties {
  return { "--rc": color } as CSSProperties;
}

/** Display labels and colours for the card facets and stats. */

import type { CardType, Plan, Rarity, Stat } from "../engine/types.ts";

export const TYPE_LABEL: Readonly<Record<CardType, string>> = { vocal: "ボーカル", dance: "ダンス", visual: "ビジュアル", assist: "アシスト" };
export const TYPE_SHORT: Readonly<Record<CardType, string>> = { vocal: "Vo", dance: "Da", visual: "Vi", assist: "As" };
export const TYPE_COLOR: Readonly<Record<CardType, string>> = { vocal: "bg-rose-500", dance: "bg-sky-500", visual: "bg-amber-400", assist: "bg-slate-500" };
export const STAT_SHORT: Readonly<Record<Stat, string>> = { vocal: "Vo", dance: "Da", visual: "Vi" };
export const STAT_TEXT: Readonly<Record<Stat, string>> = { vocal: "text-rose-600", dance: "text-sky-600", visual: "text-amber-600" };
export const PLAN_LABEL: Readonly<Record<Plan, string>> = { common: "共通", sense: "センス", logic: "ロジック", anomaly: "アノマリー" };
export const PLAN_COLOR: Readonly<Record<Plan, string>> = { common: "bg-slate-200 text-slate-700", sense: "bg-orange-100 text-orange-800", logic: "bg-blue-100 text-blue-800", anomaly: "bg-purple-100 text-purple-800" };
export const RARITY_LABEL: Readonly<Record<Rarity, string>> = { r: "R", sr: "SR", ssr: "SSR" };
export const RARITY_COLOR: Readonly<Record<Rarity, string>> = { r: "bg-slate-100 text-slate-700", sr: "bg-yellow-100 text-yellow-800", ssr: "bg-gradient-to-r from-pink-100 to-yellow-100 text-pink-800" };

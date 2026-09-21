/**
 * Japanese names for occasions, filters and conditions (docs/adr/0004), used by
 * the 「カウントを調整」 panel and the breakdown. Pure. A word the dictionaries do
 * not know falls back to the game's own word, so a new effect group or a new
 * threshold is still shown, only less prettily, until someone names it here.
 */

import type { ConditionRef, FilterRef, ParsedTrigger } from "../engine/types.ts";

/** Occasion → what happens, without the trailing 「時」. */
export const OCCASION_LABEL: Readonly<Record<string, string>> = {
  ProduceStart: "プロデュース開始",
  EndLesson: "レッスン終了",
  EndStepEventSchool: "授業・営業終了",
  EndAudition: "試験・オーディション終了",
  EndBeforeAuditionRefresh: "試験・オーディション開始",
  StartPresent: "活動支給・差し入れ選択",
  EndStepEventActivity: "おでかけ終了",
  StartShop: "相談選択",
  StartRefresh: "休む選択",
  StartCustomize: "特別指導開始",
  GetProduceCard: "スキルカード獲得",
  DeleteProduceCard: "スキルカード削除",
  UpgradeProduceCard: "スキルカード強化",
  ChangeProduceCard: "スキルカードチェンジ",
  CustomizeProduceCard: "スキルカードカスタマイズ",
  BuyShopItemProduceCard: "相談でスキルカード交換",
  GetProduceDrink: "Pドリンク獲得",
  BuyShopItemProduceDrink: "相談でPドリンク交換",
  GetProduceItem: "Pアイテム獲得",
};

const MEMBER_LABEL: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  lessonStat: { vocal: "ボーカル", dance: "ダンス", visual: "ビジュアル" },
  lessonKind: { sp: "SPレッスン", normal: "通常レッスン" },
  cardType: { mental: "メンタル", active: "アクティブ" },
  rarity: { ssr: "SSR" },
  cardName: { starter: "名前に「基本」" },
  effectGroup: {
    parameter_buff: "好調",
    lesson_buff: "集中",
    card_play_aggressive: "やる気",
    review: "好印象",
    block: "元気",
    concentration: "強気",
    full_power: "全力",
    preservation: "温存",
  },
};

const FAMILY_LABEL: Readonly<Record<string, string>> = {
  lessonKind: "レッスンの種類",
  cardType: "カードタイプ",
  rarity: "レアリティ",
  cardName: "カード名",
  effectGroup: "効果",
};

const STAT_KIND: Readonly<Record<string, string>> = { vocal: "ボーカル", dance: "ダンス", visual: "ビジュアル" };

export function occasionLabel(occasion: string): string {
  return OCCASION_LABEL[occasion] ?? occasion;
}

export function familyLabel(family: string): string {
  return FAMILY_LABEL[family] ?? family;
}

export function memberLabel(family: string, member: string): string {
  return MEMBER_LABEL[family]?.[member] ?? member;
}

function filterLabel(f: FilterRef): string {
  return memberLabel(f.family, f.member);
}

function boundLabel(c: ConditionRef, unit: string, scale = 1): string {
  const lo = `${c.min / scale}${unit}以上`;
  const hi = `${c.max / scale}${unit}以下`;
  if (c.min > 0 && c.max > 0) return `${lo}${hi}`;
  return c.max > 0 ? hi : lo;
}

/** 「所持スキルカード20枚以上」「ダンス700以上」「体力50%以上」「所持している好印象のスキルカード8枚以上」. */
export function conditionLabel(c: ConditionRef): string {
  const stat = STAT_KIND[c.kind];
  if (stat) return `${stat}${boundLabel(c, "")}`;
  if (c.kind === "stamina_ratio") return `体力${boundLabel(c, "%", 10)}`;
  if (c.kind === "produce_card_count") return `所持スキルカード${boundLabel(c, "枚")}`;
  if (c.kind === "produce_card_search_count") {
    const subject = (c.subject ?? []).map(filterLabel).join("・");
    return `所持している${subject ? `${subject}の` : ""}スキルカード${boundLabel(c, "枚")}`;
  }
  return `${c.kind} ${boundLabel(c, "")}`;
}

/** Breakdown wording of a trigger: 「スキルカード獲得時（好印象）／ダンス700以上」. */
export function triggerLabel(t: ParsedTrigger): string {
  const filters = (t.filters ?? []).map(filterLabel);
  const head = `${occasionLabel(t.occasion)}時${filters.length > 0 ? `（${filters.join("・")}）` : ""}`;
  return [head, ...(t.conditions ?? []).map(conditionLabel)].join("／");
}

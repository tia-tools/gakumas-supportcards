/**
 * Milestone 0 prototype (throwaway): join the gakumasu-diff tables for every
 * support card, classify every skill effect against the game's own
 * SupportCardProduceSkillFilter table, and print the resolved effects of the
 * cards named on the command line at each 凸 level.
 *
 * Usage:  bun scripts/prototype-join.ts s_card-3-0016 s_card-3-0073
 *
 * Tables are read from .cache/gakumasu-diff/<Table>.yaml when present and
 * fetched from the upstream repository (and cached) otherwise.
 */

import { load as loadYaml } from "js-yaml";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = "https://raw.githubusercontent.com/vertesan/gakumasu-diff/main/";
const CACHE_DIR = ".cache/gakumasu-diff";

// ── Raw table shapes (only the fields this prototype reads) ─────────────────

interface RawSupportCard {
  id: string;
  name: string;
  type: string;
  rarity: string;
  planType: string;
  assetId: string;
  supportCardLevelLimitId: string;
}
interface RawSkillLevel {
  supportCardId: string;
  produceSkillId: string;
  produceSkillLevel: number;
  supportCardLevel: number;
}
interface RawProduceSkill {
  id: string;
  level: number;
  activationCount: number;
  produceEffectId1: string;
  produceTriggerId1: string;
  activationRatePermil1: number;
  produceEffectId2: string;
  produceTriggerId2: string;
  activationRatePermil2: number;
  produceEffectId3: string;
  produceTriggerId3: string;
  activationRatePermil3: number;
}
interface RawProduceReward {
  resourceType: string;
  resourceId: string;
  resourceLevel: number;
}
interface RawProduceEffect {
  id: string;
  produceEffectType: string;
  effectValueMin: number;
  effectValueMax: number;
  produceRewards: RawProduceReward[];
}
interface RawProduceTrigger {
  id: string;
  phaseType: string;
}
interface RawFilterRow {
  id: string;
  title: string;
  order: number;
  produceEffectTypes: string[];
  produceTriggerIds: string[];
}
interface RawLevelLimit {
  id: string;
  rank: string;
  levelLimit: number;
}
interface RawEventSupportCard {
  supportCardId: string;
  number: number;
  supportCardLevel: number;
  produceStepEventDetailId: string;
}
interface RawEventDetail {
  id: string;
  produceEffectIds: string[];
  supportCardId: string;
}
interface RawProduceItemSkill {
  produceTriggerId: string;
  produceItemEffectId: string;
}
interface RawProduceItem {
  id: string;
  name: string;
  fireLimit: number;
  produceTriggerId: string;
  skills: RawProduceItemSkill[];
}
interface RawProduceItemEffect {
  id: string;
  effectType: string;
  produceEffectId: string;
}

// ── Loading ─────────────────────────────────────────────────────────────────

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

async function loadTable<T>(name: string, requiredKeys: readonly string[]): Promise<T[]> {
  const path = join(CACHE_DIR, `${name}.yaml`);
  let text: string;
  if (existsSync(path)) {
    text = readFileSync(path, "utf8");
  } else {
    const res = await fetch(`${BASE_URL}${name}.yaml`);
    if (!res.ok) throw new Error(`fetch ${name}.yaml: HTTP ${res.status}`);
    text = await res.text();
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(path, text);
  }
  const parsed: unknown = loadYaml(text);
  if (!Array.isArray(parsed)) throw new Error(`${name}.yaml is not a list`);
  for (const row of parsed) {
    if (!isRecord(row)) throw new Error(`${name}.yaml: non-object row`);
    for (const k of requiredKeys) {
      if (!(k in row)) throw new Error(`${name}.yaml: row missing ${k}: ${JSON.stringify(row).slice(0, 120)}`);
    }
  }
  // The key check above is the only structural validation this prototype does.
  return parsed as T[];
}

// ── Taxonomy ────────────────────────────────────────────────────────────────

type Stat = "vocal" | "dance" | "visual";

const PARAM_ADDITIONS = ["ProduceEffectType_VocalAddition", "ProduceEffectType_DanceAddition", "ProduceEffectType_VisualAddition"];

interface TaxonomyRow extends RawFilterRow {
  source: "game" | "extension";
  /** Route profiles may count this row as another (game) row; conditional variants of a category. */
  countsAs?: string;
}

/**
 * Rows the game's filter table does not have (as of 2026-09-16) but that card
 * skills or card-granted P-items use. Trigger ids listed here match exactly or
 * as a `-`-delimited prefix of the effect's trigger id. Titles follow the game's
 * own skill/item description wording. Each entry must go away once the game
 * table grows a row covering the trigger (the generator will flag that).
 */
const EXTENSION_ROWS: TaxonomyRow[] = [
  {
    id: "ext-vocaladdition-p_trigger-get_produce_card-produce_card_search_count-exam_review-0008",
    title: "スキルカード獲得時、所持している好印象効果のスキルカードが8枚以上の場合パラメータ上昇",
    order: 101,
    produceEffectTypes: PARAM_ADDITIONS,
    produceTriggerIds: ["p_trigger-get_produce_card-produce_card_search_count-p_card_search-deck_all-effect_group-visible-exam_review-000-0008_0000"],
    countsAs: "s_card_p_skill_filter-vocaladdition-p_trigger-get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_review-000",
    source: "extension",
  },
  {
    id: "ext-vocaladdition-p_trigger-get_produce_card-produce_card_search_count-exam_preservation-0008",
    title: "スキルカード獲得時、所持している温存効果のスキルカードが8枚以上の場合パラメータ上昇",
    order: 102,
    produceEffectTypes: PARAM_ADDITIONS,
    produceTriggerIds: ["p_trigger-get_produce_card-produce_card_search_count-p_card_search-deck_all-effect_group-visible-exam_preservation-000-0008_0000"],
    countsAs: "s_card_p_skill_filter-vocaladdition-p_trigger-get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_preservation-000",
    source: "extension",
  },
  {
    id: "ext-vocaladdition-p_trigger-get_produce_card-produce_card_search_count-exam_lesson_buff-0008",
    title: "スキルカード獲得時、所持している集中効果のスキルカードが8枚以上の場合パラメータ上昇",
    order: 103,
    produceEffectTypes: PARAM_ADDITIONS,
    produceTriggerIds: ["p_trigger-get_produce_card-produce_card_search_count-p_card_search-deck_all-effect_group-visible-exam_lesson_buff-000-0008_0000"],
    countsAs: "s_card_p_skill_filter-vocaladdition-p_trigger-get_produce_card-0000_0000-p_card_search-deck_all-effect_group-visible-exam_lesson_buff-000",
    source: "extension",
  },
  {
    id: "ext-vocaladdition-p_trigger-buy_shop_item_produce_card",
    title: "相談でスキルカード交換後パラメータ上昇",
    order: 104,
    produceEffectTypes: PARAM_ADDITIONS,
    produceTriggerIds: ["p_trigger-buy_shop_item_produce_card"],
    source: "extension",
  },
  {
    id: "ext-vocaladdition-p_trigger-end_before_audition_refresh",
    title: "試験・オーディション前の休憩後パラメータ上昇",
    order: 105,
    produceEffectTypes: PARAM_ADDITIONS,
    produceTriggerIds: ["p_trigger-end_before_audition_refresh"],
    source: "extension",
  },
  {
    id: "ext-vocaladdition-p_trigger-end_lesson-lesson_sp",
    title: "SPレッスン終了時パラメータ上昇",
    order: 106,
    produceEffectTypes: PARAM_ADDITIONS,
    produceTriggerIds: ["p_trigger-end_lesson-lesson_sp"],
    countsAs: "s_card_p_skill_filter-vocaladdition-p_trigger-end_lesson-lesson_vocal_sp",
    source: "extension",
  },
];

/**
 * Effect types the taxonomy has no row for and that carry no parameter value
 * (or are handled outside the taxonomy). Anything else that fails to classify
 * is an error, never silently dropped.
 */
const NON_PARAMETER_EFFECT_TYPES = new Set<string>([
  "ProduceEffectType_SupportCardProduceCardUpgradeProbabilityUp", // スキルカード強化確率
  "ProduceEffectType_SupportCardEventProducePointAdditionValueUp", // own-event P-point bonus
  "ProduceEffectType_SupportCardEventStaminaRecoverUp", // own-event stamina bonus
  "ProduceEffectType_ProducePointAddition",
  "ProduceEffectType_ProduceReward",
  "ProduceEffectType_ProduceRewardSet",
  "ProduceEffectType_ProduceCardUpgrade",
  "ProduceEffectType_ProduceCardChange",
  "ProduceEffectType_ProduceCardDelete",
  "ProduceEffectType_ProduceCardDuplicate",
  "ProduceEffectType_StaminaRecoverFix",
  "ProduceEffectType_ShopPriceDiscountMultiple",
  "ProduceEffectType_CustomizeProduceCardProducePointDownMultiple",
]);

/** Own-card event parameter multiplier, permil (500 = +50%). Handled as a modifier, not a category. */
const EVENT_BONUS_TYPE = "ProduceEffectType_SupportCardEventParameterAdditionValueUp";

function statOf(effectType: string): Stat | null {
  if (effectType.startsWith("ProduceEffectType_Vocal")) return "vocal";
  if (effectType.startsWith("ProduceEffectType_Dance")) return "dance";
  if (effectType.startsWith("ProduceEffectType_Visual")) return "visual";
  return null;
}

interface Classified {
  categoryId: string;
  title: string;
  stat: Stat;
  value: number;
  effectType: string;
  triggerId: string;
  match: "exact" | "prefix";
  source: "game" | "extension";
}
interface Unclassified {
  where: string;
  effectType: string;
  triggerId: string;
  matches: number;
}

class Classifier {
  private readonly rows: TaxonomyRow[];
  readonly unclassified = new Map<string, Unclassified>();
  readonly skippedByType = new Map<string, number>();
  readonly matchStats = { exact: 0, prefix: 0, extension: 0 };

  constructor(gameRows: RawFilterRow[], extensionRows: TaxonomyRow[]) {
    this.rows = [...gameRows.map((r) => ({ ...r, source: "game" as const })), ...extensionRows];
  }

  private find(effectType: string, triggerId: string): { row: TaxonomyRow; match: "exact" | "prefix" } | { rows: TaxonomyRow[] } {
    const byType = this.rows.filter((r) => r.produceEffectTypes.includes(effectType));
    const exact = byType.filter((r) => r.produceTriggerIds.includes(triggerId));
    if (exact.length === 1 && exact[0]) return { row: exact[0], match: "exact" };
    if (exact.length > 1) return { rows: exact };
    let best: { row: TaxonomyRow; len: number }[] = [];
    for (const r of byType) {
      for (const t of r.produceTriggerIds) {
        if (!triggerId.startsWith(`${t}-`)) continue;
        const cur = best[0];
        if (!cur || t.length > cur.len) best = [{ row: r, len: t.length }];
        else if (t.length === cur.len && !best.some((b) => b.row === r)) best.push({ row: r, len: t.length });
      }
    }
    if (best.length === 1 && best[0]) return { row: best[0].row, match: "prefix" };
    return { rows: best.map((b) => b.row) };
  }

  classify(where: string, effect: RawProduceEffect, triggerId: string): Classified | null {
    const found = this.find(effect.produceEffectType, triggerId);
    if ("row" in found) {
      const stat = statOf(effect.produceEffectType);
      if (!stat) return null; // a taxonomy row for a non-parameter effect (stamina, P-point, SP rate...)
      this.matchStats[found.match]++;
      if (found.row.source === "extension") this.matchStats.extension++;
      return {
        categoryId: found.row.id,
        title: found.row.title,
        stat,
        value: effect.effectValueMin,
        effectType: effect.produceEffectType,
        triggerId,
        match: found.match,
        source: found.row.source,
      };
    }
    if (found.rows.length === 0 && NON_PARAMETER_EFFECT_TYPES.has(effect.produceEffectType)) {
      this.skippedByType.set(effect.produceEffectType, (this.skippedByType.get(effect.produceEffectType) ?? 0) + 1);
      return null;
    }
    const key = `${effect.produceEffectType}|${triggerId}`;
    if (!this.unclassified.has(key)) {
      this.unclassified.set(key, { where, effectType: effect.produceEffectType, triggerId, matches: found.rows.length });
    }
    return null;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

const TOTSU_RANKS = [
  "SupportCardLevelLimitRank_Unknown",
  "SupportCardLevelLimitRank__1",
  "SupportCardLevelLimitRank__2",
  "SupportCardLevelLimitRank__3",
  "SupportCardLevelLimitRank__4",
];

interface SkillEffect extends Classified {
  /** 0 = unlimited; otherwise the per-produce activation cap (「プロデュース中N回」). */
  activationCount: number;
}
interface Resolved {
  effects: SkillEffect[];
  /** Own-card event parameter bonus in permil, 0 when the card has none at this level. */
  eventBonusPermil: number;
}
interface EventPart {
  level: number;
  number: number;
  params: { stat: Stat; value: number }[];
  items: string[];
  other: string[];
}
interface ItemInfo {
  name: string;
  fireLimit: number;
  effects: Classified[];
  other: string[];
}

async function main(): Promise<void> {
  const wanted = process.argv.slice(2);
  const t0 = Date.now();
  const [cards, slVocal, slDance, slVisual, slAssist, skills, effects, triggers, filterRows, levelLimits, eventCards, eventDetails, items, itemEffects] =
    await Promise.all([
      loadTable<RawSupportCard>("SupportCard", ["id", "name", "type", "rarity", "planType", "assetId", "supportCardLevelLimitId"]),
      loadTable<RawSkillLevel>("SupportCardProduceSkillLevelVocal", ["supportCardId", "produceSkillId", "produceSkillLevel", "supportCardLevel"]),
      loadTable<RawSkillLevel>("SupportCardProduceSkillLevelDance", ["supportCardId", "produceSkillId", "produceSkillLevel", "supportCardLevel"]),
      loadTable<RawSkillLevel>("SupportCardProduceSkillLevelVisual", ["supportCardId", "produceSkillId", "produceSkillLevel", "supportCardLevel"]),
      loadTable<RawSkillLevel>("SupportCardProduceSkillLevelAssist", ["supportCardId", "produceSkillId", "produceSkillLevel", "supportCardLevel"]),
      loadTable<RawProduceSkill>("ProduceSkill", ["id", "level", "activationCount", "produceEffectId1", "produceTriggerId1", "activationRatePermil1"]),
      loadTable<RawProduceEffect>("ProduceEffect", ["id", "produceEffectType", "effectValueMin", "effectValueMax", "produceRewards"]),
      loadTable<RawProduceTrigger>("ProduceTrigger", ["id", "phaseType"]),
      loadTable<RawFilterRow>("SupportCardProduceSkillFilter", ["id", "title", "order", "produceEffectTypes", "produceTriggerIds"]),
      loadTable<RawLevelLimit>("SupportCardLevelLimit", ["id", "rank", "levelLimit"]),
      loadTable<RawEventSupportCard>("ProduceEventSupportCard", ["supportCardId", "number", "supportCardLevel", "produceStepEventDetailId"]),
      loadTable<RawEventDetail>("ProduceStepEventDetail", ["id", "produceEffectIds"]),
      loadTable<RawProduceItem>("ProduceItem", ["id", "name", "fireLimit", "produceTriggerId", "skills"]),
      loadTable<RawProduceItemEffect>("ProduceItemEffect", ["id", "effectType", "produceEffectId"]),
    ]);
  console.log(
    `Loaded 14 tables in ${Date.now() - t0} ms: SupportCard ${cards.length}, ProduceSkill ${skills.length}, ProduceEffect ${effects.length}, ProduceTrigger ${triggers.length}, Filter ${filterRows.length}, EventSupportCard ${eventCards.length}, EventDetail ${eventDetails.length}, ProduceItem ${items.length}, ProduceItemEffect ${itemEffects.length}`,
  );

  const skillByIdLevel = new Map(skills.map((s) => [`${s.id}:${s.level}`, s]));
  const effectById = new Map(effects.map((e) => [e.id, e]));
  const triggerById = new Map(triggers.map((t) => [t.id, t]));
  const eventDetailById = new Map(eventDetails.map((d) => [d.id, d]));
  const itemById = new Map(items.map((i) => [i.id, i]));
  const itemEffectById = new Map(itemEffects.map((e) => [e.id, e]));
  const skillLevelsByCard = new Map<string, RawSkillLevel[]>();
  for (const sl of [...slVocal, ...slDance, ...slVisual, ...slAssist]) {
    const list = skillLevelsByCard.get(sl.supportCardId) ?? [];
    list.push(sl);
    skillLevelsByCard.set(sl.supportCardId, list);
  }
  const eventsByCard = new Map<string, RawEventSupportCard[]>();
  for (const ev of eventCards) {
    const list = eventsByCard.get(ev.supportCardId) ?? [];
    list.push(ev);
    eventsByCard.set(ev.supportCardId, list);
  }
  const levelLimitsById = new Map<string, number[]>();
  for (const ll of levelLimits) {
    const arr = levelLimitsById.get(ll.id) ?? [];
    arr[TOTSU_RANKS.indexOf(ll.rank)] = ll.levelLimit;
    levelLimitsById.set(ll.id, arr);
  }

  const classifier = new Classifier(filterRows, EXTENSION_ROWS);
  const obs = {
    activationRateNonZero: new Set<string>(),
    activationCounts: new Map<number, number>(),
    minMaxDiffer: new Set<string>(),
    cardsWithoutSkills: [] as string[],
    cardsWithEventBonus: new Set<string>(),
    itemsGranted: new Map<string, ItemInfo>(),
    eventEffectTypes: new Map<string, number>(),
    categoriesUsed: new Map<string, number>(),
  };

  // Resolve one card at one level: for each skill, the row with the highest supportCardLevel <= level.
  function resolve(card: RawSupportCard, level: number): Resolved {
    const rows = skillLevelsByCard.get(card.id) ?? [];
    const best = new Map<string, RawSkillLevel>();
    for (const r of rows) {
      if (r.supportCardLevel > level) continue;
      const cur = best.get(r.produceSkillId);
      if (!cur || r.supportCardLevel > cur.supportCardLevel) best.set(r.produceSkillId, r);
    }
    const out: Resolved = { effects: [], eventBonusPermil: 0 };
    for (const r of best.values()) {
      const skill = skillByIdLevel.get(`${r.produceSkillId}:${r.produceSkillLevel}`);
      if (!skill) throw new Error(`${card.id}: missing ProduceSkill ${r.produceSkillId} lv${r.produceSkillLevel}`);
      const pairs: [string, string, number][] = [
        [skill.produceEffectId1, skill.produceTriggerId1, skill.activationRatePermil1],
        [skill.produceEffectId2, skill.produceTriggerId2, skill.activationRatePermil2],
        [skill.produceEffectId3, skill.produceTriggerId3, skill.activationRatePermil3],
      ];
      for (const [effectId, triggerId, rate] of pairs) {
        if (!effectId) continue;
        const effect = effectById.get(effectId);
        if (!effect) throw new Error(`${card.id}: missing ProduceEffect ${effectId}`);
        if (!triggerById.has(triggerId)) throw new Error(`${card.id}: missing ProduceTrigger ${triggerId}`);
        if (rate !== 0) obs.activationRateNonZero.add(`${skill.id} rate=${rate}`);
        if (effect.effectValueMin !== effect.effectValueMax) obs.minMaxDiffer.add(effect.id);
        if (effect.produceEffectType === EVENT_BONUS_TYPE) {
          out.eventBonusPermil += effect.effectValueMin;
          obs.cardsWithEventBonus.add(card.id);
          continue;
        }
        const c = classifier.classify(`${card.id} ${skill.id}`, effect, triggerId);
        if (!c) continue;
        obs.activationCounts.set(skill.activationCount, (obs.activationCounts.get(skill.activationCount) ?? 0) + 1);
        obs.categoriesUsed.set(c.categoryId, (obs.categoriesUsed.get(c.categoryId) ?? 0) + 1);
        out.effects.push({ ...c, activationCount: skill.activationCount });
      }
    }
    return out;
  }

  function resolveEvents(card: RawSupportCard): EventPart[] {
    const evs = (eventsByCard.get(card.id) ?? []).sort((a, b) => a.number - b.number);
    return evs.map((ev) => {
      const detail = eventDetailById.get(ev.produceStepEventDetailId);
      if (!detail) throw new Error(`${card.id}: missing event detail ${ev.produceStepEventDetailId}`);
      const part: EventPart = { level: ev.supportCardLevel, number: ev.number, params: [], items: [], other: [] };
      for (const effectId of detail.produceEffectIds) {
        const effect = effectById.get(effectId);
        if (!effect) throw new Error(`${card.id}: missing event effect ${effectId}`);
        obs.eventEffectTypes.set(effect.produceEffectType, (obs.eventEffectTypes.get(effect.produceEffectType) ?? 0) + 1);
        const stat = statOf(effect.produceEffectType);
        if (stat && PARAM_ADDITIONS.includes(effect.produceEffectType)) {
          part.params.push({ stat, value: effect.effectValueMin });
        } else if (effect.produceEffectType === "ProduceEffectType_ProduceReward") {
          for (const rw of effect.produceRewards) {
            if (rw.resourceType === "ProduceResourceType_ProduceItem") {
              part.items.push(rw.resourceId);
              recordItem(rw.resourceId);
            } else part.other.push(`${effect.produceEffectType}:${rw.resourceType}`);
          }
        } else if (NON_PARAMETER_EFFECT_TYPES.has(effect.produceEffectType)) {
          part.other.push(effect.produceEffectType);
        } else {
          throw new Error(`${card.id}: unexpected event effect type ${effect.produceEffectType} (${effectId})`);
        }
      }
      return part;
    });
  }

  function recordItem(itemId: string): void {
    if (obs.itemsGranted.has(itemId)) return;
    const item = itemById.get(itemId);
    if (!item) throw new Error(`missing ProduceItem ${itemId}`);
    const info: ItemInfo = { name: item.name, fireLimit: item.fireLimit, effects: [], other: [] };
    for (const sk of item.skills) {
      const ie = itemEffectById.get(sk.produceItemEffectId);
      if (!ie) throw new Error(`missing ProduceItemEffect ${sk.produceItemEffectId}`);
      if (ie.effectType !== "ProduceItemEffectType_ProduceEffect") {
        info.other.push(ie.effectType);
        continue;
      }
      const pe = effectById.get(ie.produceEffectId);
      if (!pe) throw new Error(`missing ProduceEffect ${ie.produceEffectId} (item ${itemId})`);
      const trig = sk.produceTriggerId || item.produceTriggerId;
      if (!triggerById.has(trig)) throw new Error(`item ${itemId}: missing ProduceTrigger ${trig}`);
      const c = classifier.classify(`item ${itemId}`, pe, trig);
      if (c) info.effects.push(c);
      else info.other.push(pe.produceEffectType);
    }
    obs.itemsGranted.set(itemId, info);
  }

  // Pass over every card at every breakpoint level so the classifier sees every effect.
  for (const card of cards) {
    const limits = levelLimitsById.get(card.supportCardLevelLimitId);
    if (!limits || limits.length !== 5) throw new Error(`${card.id}: level limits ${card.supportCardLevelLimitId} incomplete`);
    const rows = skillLevelsByCard.get(card.id) ?? [];
    if (rows.length === 0) obs.cardsWithoutSkills.push(card.id);
    for (const lv of new Set(rows.map((r) => r.supportCardLevel))) resolve(card, lv);
    resolveEvents(card);
  }
  console.log(`Processed ${cards.length} cards`);

  // Print the requested cards.
  for (const id of wanted) {
    const card = cards.find((c) => c.id === id);
    if (!card) {
      console.log(`\n${id}: not found`);
      continue;
    }
    const limits = levelLimitsById.get(card.supportCardLevelLimitId) ?? [];
    console.log(`\n${card.id} ${card.name}  ${card.rarity} ${card.type} ${card.planType} asset=${card.assetId} levelLimit: ${limits.join("/")}`);
    for (let totsu = 0; totsu < 5; totsu++) {
      const lv = limits[totsu];
      if (lv === undefined) continue;
      const r = resolve(card, lv);
      console.log(`  凸${totsu} (level ${lv})${r.eventBonusPermil ? `  own-event params +${r.eventBonusPermil / 10}%` : ""}:`);
      for (const e of r.effects) {
        const cap = e.activationCount === 0 ? "unlimited" : `max ${e.activationCount}/run`;
        console.log(`    [${e.title}] ${e.stat} +${e.value}  (${cap}; ${e.match}${e.source === "extension" ? ", extension" : ""}; @ ${e.triggerId})`);
      }
    }
    for (const ev of resolveEvents(card)) {
      const params = ev.params.map((p) => `${p.stat} +${p.value}`).join(", ") || "-";
      const its = ev.items
        .map((i) => {
          const it = obs.itemsGranted.get(i);
          const eff = it?.effects.map((e) => `[${e.title}] ${e.stat} +${e.value}`).join(", ") || "no parameter effect";
          return `${i} ${it?.name ?? "?"} (fireLimit=${it?.fireLimit ?? "?"}: ${eff})`;
        })
        .join("; ");
      console.log(`  event #${ev.number} (unlock lv${ev.level}): params ${params}; items ${its || "-"}; other ${ev.other.join(", ") || "-"}`);
    }
  }

  // Report.
  console.log("\n=== Classification report ===");
  console.log(`Unclassified (effectType, trigger) pairs: ${classifier.unclassified.size}`);
  for (const u of classifier.unclassified.values()) console.log(`  ${u.effectType} @ ${u.triggerId} (candidates=${u.matches}) e.g. ${u.where}`);
  console.log(`Match statistics: exact ${classifier.matchStats.exact}, prefix ${classifier.matchStats.prefix}, via extension rows ${classifier.matchStats.extension}`);
  console.log(`Taxonomy categories used by parameter effects: ${obs.categoriesUsed.size} of ${filterRows.length + EXTENSION_ROWS.length}`);
  console.log("Skipped as non-parameter (by effect type):");
  for (const [t, n] of [...classifier.skippedByType].sort((a, b) => b[1] - a[1])) console.log(`  ${n.toString().padStart(5)}  ${t}`);
  console.log(`Cards without skill rows: ${obs.cardsWithoutSkills.length} ${obs.cardsWithoutSkills.join(" ")}`);
  console.log(`Cards with an own-event parameter bonus: ${obs.cardsWithEventBonus.size}`);
  console.log(`Skills with activationRatePermil != 0: ${obs.activationRateNonZero.size}`);
  console.log(`activationCount distribution over classified parameter effects (0 = unlimited): ${[...obs.activationCounts].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(" ")}`);
  console.log(`Effects with min != max: ${obs.minMaxDiffer.size}`);
  console.log("Event effect types:");
  for (const [t, n] of [...obs.eventEffectTypes].sort((a, b) => b[1] - a[1])) console.log(`  ${n.toString().padStart(5)}  ${t}`);
  let withParams = 0;
  console.log(`Items granted by card events: ${obs.itemsGranted.size}`);
  for (const [id, it] of obs.itemsGranted) {
    if (it.effects.length === 0) continue;
    withParams++;
    const eff = it.effects.map((e) => `[${e.title}] ${e.stat} +${e.value} (${e.match}${e.source === "extension" ? ", extension" : ""})`).join("; ");
    console.log(`  ${id} ${it.name} fireLimit=${it.fireLimit}: ${eff}`);
  }
  console.log(`  (${withParams} items with parameter effects, ${obs.itemsGranted.size - withParams} without)`);

  if (classifier.unclassified.size > 0) process.exit(1);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

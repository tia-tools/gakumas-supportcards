/**
 * Builds the card records (`Card` from src/engine/types.ts) from the raw
 * tables: resolves each card's skills at every breakpoint level, folds in the
 * card's events (parameter rewards and granted P-items) at their unlock
 * levels, and records the own-event parameter bonus. Pure: takes tables and a
 * classifier, returns cards plus a report; throws only on data the design
 * cannot represent (unknown enum values, dangling ids).
 */

import { EVENT_CATEGORY_ID, type Breakpoint, type Card, type CardType, type ClassifiedEffect, type LevelLimits, type Plan, type Rarity } from "../../src/engine/types.ts";
import { EVENT_BONUS_EFFECT_TYPE, NON_PARAMETER_EFFECT_TYPES, PARAM_ADDITION_TYPES, lessonStatOf, type Classification, type Classifier } from "./classify.ts";
import type { RawEventSupportCard, RawProduceEffect, RawProduceItem, RawProduceSkill, RawSkillLevel, RawSupportCard, Tables } from "./tables.ts";

const CARD_TYPE: Readonly<Record<string, CardType>> = {
  SupportCardType_Vocal: "vocal",
  SupportCardType_Dance: "dance",
  SupportCardType_Visual: "visual",
  SupportCardType_Assist: "assist",
};
const RARITY: Readonly<Record<string, Rarity>> = {
  SupportCardRarity_R: "r",
  SupportCardRarity_Sr: "sr",
  SupportCardRarity_Ssr: "ssr",
};
const PLAN: Readonly<Record<string, Plan>> = {
  ProducePlanType_Common: "common",
  ProducePlanType_Plan1: "sense",
  ProducePlanType_Plan2: "logic",
  ProducePlanType_Plan3: "anomaly",
  ProducePlanType_Sense: "sense",
  ProducePlanType_Logic: "logic",
  ProducePlanType_Anomaly: "anomaly",
};
const TOTSU_RANKS = [
  "SupportCardLevelLimitRank_Unknown",
  "SupportCardLevelLimitRank__1",
  "SupportCardLevelLimitRank__2",
  "SupportCardLevelLimitRank__3",
  "SupportCardLevelLimitRank__4",
] as const;

export interface UnclassifiedPair {
  effectType: string;
  triggerId: string;
  reason: "no-row" | "ambiguous";
  candidateRowIds: string[];
  /** One card or item that uses the pair. */
  example: string;
}

export interface BuildReport {
  unclassified: UnclassifiedPair[];
  /** Occurrences of skipped non-parameter effect types, by type. */
  skippedByType: Map<string, number>;
  /** Number of (effect, trigger) resolutions by match kind. */
  matches: { exact: number; prefix: number };
  /** Category ids actually used by at least one parameter effect. */
  categoriesUsed: Set<string>;
}

function mapEnum<T>(table: Readonly<Record<string, T>>, value: string, what: string, cardId: string): T {
  const mapped = table[value];
  if (mapped === undefined) throw new Error(`${cardId}: unknown ${what} "${value}"`);
  return mapped;
}

function index<T>(rows: readonly T[], key: (row: T) => string): Map<string, T> {
  return new Map(rows.map((r) => [key(r), r]));
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const r of rows) {
    const list = out.get(key(r)) ?? [];
    list.push(r);
    out.set(key(r), list);
  }
  return out;
}

function effectSortKey(e: ClassifiedEffect): string {
  return `${e.kind}|${e.categoryId}|${e.stat}|${e.itemId ?? ""}|${e.value}`;
}

class CardBuilder {
  private readonly skillByIdLevel: Map<string, RawProduceSkill>;
  private readonly effectById: Map<string, RawProduceEffect>;
  private readonly triggerIds: Set<string>;
  private readonly eventDetailById: Map<string, { id: string; produceEffectIds: string[] }>;
  private readonly itemById: Map<string, RawProduceItem>;
  private readonly itemEffectById: Map<string, { id: string; effectType: string; produceEffectId: string }>;
  private readonly skillLevelsByCard: Map<string, RawSkillLevel[]>;
  private readonly eventsByCard: Map<string, RawEventSupportCard[]>;
  private readonly itemEffectsCache = new Map<string, ClassifiedEffect[]>();
  readonly report: BuildReport = { unclassified: [], skippedByType: new Map(), matches: { exact: 0, prefix: 0 }, categoriesUsed: new Set() };

  constructor(
    tables: Tables,
    private readonly classifier: Classifier,
  ) {
    this.skillByIdLevel = index(tables.skills, (s) => `${s.id}:${s.level}`);
    this.effectById = index(tables.effects, (e) => e.id);
    this.triggerIds = new Set(tables.triggers.map((t) => t.id));
    this.eventDetailById = index(tables.eventDetails, (d) => d.id);
    this.itemById = index(tables.items, (i) => i.id);
    this.itemEffectById = index(tables.itemEffects, (e) => e.id);
    this.skillLevelsByCard = groupBy(tables.skillLevels, (r) => r.supportCardId);
    this.eventsByCard = groupBy(tables.eventCards, (e) => e.supportCardId);
  }

  private effect(id: string, where: string): RawProduceEffect {
    const e = this.effectById.get(id);
    if (!e) throw new Error(`${where}: missing ProduceEffect ${id}`);
    if (e.effectValueMin !== e.effectValueMax) throw new Error(`${where}: ${id} has a value range (${e.effectValueMin}..${e.effectValueMax}); the engine assumes fixed values`);
    return e;
  }

  private classifyOrRecord(effect: RawProduceEffect, triggerId: string, where: string): Classification {
    if (!this.triggerIds.has(triggerId)) throw new Error(`${where}: missing ProduceTrigger ${triggerId}`);
    const c = this.classifier.classify(effect.produceEffectType, triggerId);
    if (c.kind === "classified") {
      this.report.matches[c.match]++;
      this.report.categoriesUsed.add(c.row.id);
    } else if (c.kind === "non-parameter" && c.reason === "whitelisted-type") {
      this.report.skippedByType.set(effect.produceEffectType, (this.report.skippedByType.get(effect.produceEffectType) ?? 0) + 1);
    } else if (c.kind === "unclassified") {
      const dup = this.report.unclassified.some((u) => u.effectType === effect.produceEffectType && u.triggerId === triggerId);
      if (!dup) {
        this.report.unclassified.push({
          effectType: effect.produceEffectType,
          triggerId,
          reason: c.reason,
          candidateRowIds: c.candidates.map((r) => r.id),
          example: where,
        });
      }
    }
    return c;
  }

  /** Skills active at `level`: for each skill id, the row with the highest supportCardLevel <= level. */
  private skillsAt(cardId: string, level: number): RawProduceSkill[] {
    const best = new Map<string, RawSkillLevel>();
    for (const r of this.skillLevelsByCard.get(cardId) ?? []) {
      if (r.supportCardLevel > level) continue;
      const cur = best.get(r.produceSkillId);
      if (!cur || r.supportCardLevel > cur.supportCardLevel) best.set(r.produceSkillId, r);
    }
    return [...best.values()].map((r) => {
      const skill = this.skillByIdLevel.get(`${r.produceSkillId}:${r.produceSkillLevel}`);
      if (!skill) throw new Error(`${cardId}: missing ProduceSkill ${r.produceSkillId} lv${r.produceSkillLevel}`);
      return skill;
    });
  }

  private skillEffects(cardId: string, level: number): { effects: ClassifiedEffect[]; eventBonusPermil: number } {
    const effects: ClassifiedEffect[] = [];
    let eventBonusPermil = 0;
    for (const skill of this.skillsAt(cardId, level)) {
      const pairs = [
        [skill.produceEffectId1, skill.produceTriggerId1],
        [skill.produceEffectId2, skill.produceTriggerId2],
        [skill.produceEffectId3, skill.produceTriggerId3],
      ] as const;
      for (const [effectId, triggerId] of pairs) {
        if (!effectId) continue;
        const where = `${cardId} ${skill.id}`;
        const effect = this.effect(effectId, where);
        if (effect.produceEffectType === EVENT_BONUS_EFFECT_TYPE) {
          eventBonusPermil += effect.effectValueMin;
          continue;
        }
        const c = this.classifyOrRecord(effect, triggerId, where);
        if (c.kind !== "classified") continue;
        const e: ClassifiedEffect = { categoryId: c.row.id, stat: c.stat, value: effect.effectValueMin, kind: "skill" };
        if (skill.activationCount > 0) e.cap = skill.activationCount;
        const ls = lessonStatOf(triggerId);
        if (ls) e.triggerStat = ls;
        effects.push(e);
      }
    }
    return { effects, eventBonusPermil };
  }

  private itemEffects(itemId: string): ClassifiedEffect[] {
    const cached = this.itemEffectsCache.get(itemId);
    if (cached) return cached;
    const item = this.itemById.get(itemId);
    if (!item) throw new Error(`missing ProduceItem ${itemId}`);
    const out: ClassifiedEffect[] = [];
    for (const sk of item.skills) {
      const ie = this.itemEffectById.get(sk.produceItemEffectId);
      if (!ie) throw new Error(`item ${itemId}: missing ProduceItemEffect ${sk.produceItemEffectId}`);
      if (ie.effectType !== "ProduceItemEffectType_ProduceEffect") continue; // exam-time enchants score 0
      const where = `item ${itemId} ${item.name}`;
      const effect = this.effect(ie.produceEffectId, where);
      const triggerId = sk.produceTriggerId || item.produceTriggerId;
      const c = this.classifyOrRecord(effect, triggerId, where);
      if (c.kind !== "classified") continue;
      const e: ClassifiedEffect = { categoryId: c.row.id, stat: c.stat, value: effect.effectValueMin, kind: "item", itemId, itemName: item.name };
      if (item.fireLimit > 0) e.cap = item.fireLimit;
      const ls = lessonStatOf(triggerId);
      if (ls) e.triggerStat = ls;
      out.push(e);
    }
    this.itemEffectsCache.set(itemId, out);
    return out;
  }

  /** Effects of every event unlocked at or below `level`. */
  private eventEffects(cardId: string, level: number): ClassifiedEffect[] {
    const out: ClassifiedEffect[] = [];
    for (const ev of this.eventsByCard.get(cardId) ?? []) {
      if (ev.supportCardLevel > level) continue;
      const detail = this.eventDetailById.get(ev.produceStepEventDetailId);
      if (!detail) throw new Error(`${cardId}: missing event detail ${ev.produceStepEventDetailId}`);
      for (const effectId of detail.produceEffectIds) {
        const where = `${cardId} event #${ev.number}`;
        const effect = this.effect(effectId, where);
        if (PARAM_ADDITION_TYPES.has(effect.produceEffectType)) {
          const stat = effect.produceEffectType.includes("Vocal") ? "vocal" : effect.produceEffectType.includes("Dance") ? "dance" : "visual";
          out.push({ categoryId: EVENT_CATEGORY_ID, stat, value: effect.effectValueMin, kind: "event" });
        } else if (effect.produceEffectType === "ProduceEffectType_ProduceReward") {
          for (const rw of effect.produceRewards) {
            if (rw.resourceType === "ProduceResourceType_ProduceItem") out.push(...this.itemEffects(rw.resourceId));
          }
        } else if (NON_PARAMETER_EFFECT_TYPES.has(effect.produceEffectType)) {
          this.report.skippedByType.set(effect.produceEffectType, (this.report.skippedByType.get(effect.produceEffectType) ?? 0) + 1);
        } else {
          throw new Error(`${where}: unexpected event effect type ${effect.produceEffectType} (${effectId})`);
        }
      }
    }
    return out;
  }

  build(raw: RawSupportCard): Card {
    const levels = new Set<number>([1]);
    for (const r of this.skillLevelsByCard.get(raw.id) ?? []) levels.add(r.supportCardLevel);
    for (const ev of this.eventsByCard.get(raw.id) ?? []) levels.add(ev.supportCardLevel);
    const breakpoints: Breakpoint[] = [];
    for (const level of [...levels].sort((a, b) => a - b)) {
      const { effects, eventBonusPermil } = this.skillEffects(raw.id, level);
      const all = [...effects, ...this.eventEffects(raw.id, level)].sort((a, b) => effectSortKey(a).localeCompare(effectSortKey(b)));
      const bp: Breakpoint = { minLevel: level, effects: all, eventBonusPermil };
      const prev = breakpoints.at(-1);
      if (prev && JSON.stringify({ ...prev, minLevel: 0 }) === JSON.stringify({ ...bp, minLevel: 0 })) continue;
      breakpoints.push(bp);
    }
    return {
      id: raw.id,
      name: raw.name,
      assetId: raw.assetId,
      type: mapEnum(CARD_TYPE, raw.type, "type", raw.id),
      rarity: mapEnum(RARITY, raw.rarity, "rarity", raw.id),
      plan: mapEnum(PLAN, raw.planType, "planType", raw.id),
      breakpoints,
    };
  }
}

/** Rarity → level at 凸0..凸4, checked to be one limit table per rarity. */
export function buildLevelLimits(tables: Tables): LevelLimits {
  const byId = new Map<string, number[]>();
  for (const ll of tables.levelLimits) {
    const rank = TOTSU_RANKS.indexOf(ll.rank as (typeof TOTSU_RANKS)[number]);
    if (rank < 0) throw new Error(`SupportCardLevelLimit ${ll.id}: unknown rank ${ll.rank}`);
    const arr = byId.get(ll.id) ?? [];
    arr[rank] = ll.levelLimit;
    byId.set(ll.id, arr);
  }
  const limitIdByRarity = new Map<Rarity, string>();
  for (const c of tables.cards) {
    const rarity = mapEnum(RARITY, c.rarity, "rarity", c.id);
    const prev = limitIdByRarity.get(rarity);
    if (prev && prev !== c.supportCardLevelLimitId) throw new Error(`rarity ${rarity} uses two level-limit tables: ${prev} and ${c.supportCardLevelLimitId} (${c.id})`);
    limitIdByRarity.set(rarity, c.supportCardLevelLimitId);
  }
  const five = (rarity: Rarity): readonly [number, number, number, number, number] => {
    const id = limitIdByRarity.get(rarity);
    const arr = id ? byId.get(id) : undefined;
    const [a, b, c, d, e] = arr ?? [];
    if (a === undefined || b === undefined || c === undefined || d === undefined || e === undefined) {
      throw new Error(`no complete level-limit table for rarity ${rarity}`);
    }
    return [a, b, c, d, e];
  };
  return { r: five("r"), sr: five("sr"), ssr: five("ssr") };
}

export function buildCards(tables: Tables, classifier: Classifier): { cards: Card[]; report: BuildReport } {
  const builder = new CardBuilder(tables, classifier);
  const cards = tables.cards.map((raw) => builder.build(raw)).sort((a, b) => a.id.localeCompare(b.id));
  return { cards, report: builder.report };
}

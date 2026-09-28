/**
 * Builds the card records (`Card` from src/engine/types.ts) from the raw
 * tables: resolves each card's skills at every breakpoint level, folds in the
 * card's events (parameter rewards and granted P-items) at their unlock
 * levels, and records the own-event parameter bonus. Pure: takes tables,
 * returns cards plus a report; throws only on data the design cannot represent
 * (unknown enum values, dangling ids).
 *
 * An effect that cannot be counted — a trigger piece of unknown kind
 * (scripts/lib/parse-trigger.ts) or an effect type that is neither a parameter
 * type nor audited as non-parameter (scripts/lib/effect-types.ts) — is left out
 * and its card is reported as held, so the rest of an update can publish
 * (docs/adr/0005).
 */

import { type Breakpoint, type Card, type CardType, type ClassifiedEffect, type HeldCard, type ItemGrant, type LevelLimits, type ParsedTrigger, type Plan, type Rarity, type Stat } from "../../src/engine/types.ts";
import { EVENT_BONUS_EFFECT_TYPE, NON_PARAMETER_EFFECT_TYPES, PARAM_ADDITION_TYPES, PARAM_BONUS_TYPES, SP_RATE_EFFECT_TYPES, parameterStatOf } from "./effect-types.ts";
import { parseTrigger, type ParseResult } from "./parse-trigger.ts";
import type { RawEventSupportCard, RawProduceEffect, RawProduceItem, RawProduceItemSkill, RawProduceSkill, RawSkillLevel, RawSupportCard, Tables } from "./tables.ts";

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
const ITEM_RESOURCE_TYPE = "ProduceResourceType_ProduceItem";
const DRINK_RESOURCE_TYPE = "ProduceResourceType_ProduceDrink";
/** Reward resources a card event may grant that add no parameter by themselves (a skill card). Anything else fails the build. */
const NON_PARAMETER_RESOURCE_TYPES: ReadonlySet<string> = new Set(["ProduceResourceType_ProduceCard"]);
/** Quantity in a direct reward's effect id (`p_effect-produce_reward-0001_0001-produce_drink-…`) and in a reward set's (`…-drink_set-all-random-02_02`). */
const DIRECT_REWARD_QUANTITY = /^p_effect-produce_reward-(\d{4})_(\d{4})-/;
const REWARD_SET_QUANTITY = /-(\d{2})_(\d{2})$/;

/** The one quantity a reward id names; a range (min ≠ max) or no quantity at all stops the run (decision A16). */
function quantityOf(id: string, pattern: RegExp, where: string): number {
  const m = pattern.exec(id);
  if (!m || m[1] === undefined || m[2] === undefined) throw new Error(`${where}: no quantity in reward id ${id}`);
  const [min, max] = [Number(m[1]), Number(m[2])];
  if (min !== max) throw new Error(`${where}: reward id ${id} names a range ${min}..${max}; the engine assumes a fixed quantity`);
  return min;
}
const TOTSU_RANKS = [
  "SupportCardLevelLimitRank_Unknown",
  "SupportCardLevelLimitRank__1",
  "SupportCardLevelLimitRank__2",
  "SupportCardLevelLimitRank__3",
  "SupportCardLevelLimitRank__4",
] as const;

export interface BuildReport {
  /** Cards with an effect that cannot be counted, sorted by id; the effect itself is left out of the card. */
  held: HeldCard[];
  /** Occurrences of skipped non-parameter effect types, by type. */
  skippedByType: Map<string, number>;
  /** Occasions actually used by at least one parameter effect. */
  occasionsUsed: Set<string>;
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

/** Code-unit string order: `localeCompare` depends on the runtime's ICU data, and generated output must be byte-identical across machines. */
export function byCodeUnit(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function effectSortKey(e: ClassifiedEffect): string {
  return `${e.kind}|${e.bonus ? 0 : 1}|${JSON.stringify(e.trigger ?? null)}|${e.stat}|${e.itemId ?? ""}|${e.value}`;
}

/** What one P-item contributes: its countable stat effects, the reasons its card is held, and the grant record when it counts for anything. */
interface ItemResult {
  effects: ClassifiedEffect[];
  held: string[];
  grant?: ItemGrant;
}

/** What one skill of a P-item is: a countable stat effect, a drink grant, a reason to hold the card, or nothing that counts. */
type ItemSkillResult = { effect: ClassifiedEffect } | { drinks: NonNullable<ItemGrant["drinks"]> } | { held: string } | null;

/** The `spRate` flag after reading `level`: set at level 1; a later-only appearance is for a person to decide (decision A15). */
function spRateAfter(cardId: string, level: number, spHere: boolean, spRate: boolean): boolean {
  if (!spHere) return spRate;
  if (level === 1) return true;
  if (!spRate) throw new Error(`${cardId}: SP発生率+ appears at level ${level} but not at level 1; the SP badge would be wrong at 凸0`);
  return spRate;
}

class CardBuilder {
  private readonly skillByIdLevel: Map<string, RawProduceSkill>;
  private readonly effectById: Map<string, RawProduceEffect>;
  private readonly phaseByTrigger: Map<string, string>;
  private readonly parsedTriggers = new Map<string, ParseResult>();
  private readonly eventDetailById: Map<string, { id: string; produceEffectIds: string[] }>;
  private readonly itemById: Map<string, RawProduceItem>;
  private readonly itemEffectById: Map<string, { id: string; effectType: string; produceEffectId: string }>;
  private readonly skillLevelsByCard: Map<string, RawSkillLevel[]>;
  private readonly eventsByCard: Map<string, RawEventSupportCard[]>;
  private readonly itemEffectsCache = new Map<string, ItemResult>();
  private readonly heldReasons = new Map<string, Set<string>>();
  /** Card id → item id → the grant, collected while the card's events are read. */
  private readonly grantsByCard = new Map<string, Map<string, ItemGrant>>();
  readonly report: BuildReport = { held: [], skippedByType: new Map(), occasionsUsed: new Set() };

  constructor(tables: Tables) {
    this.skillByIdLevel = index(tables.skills, (s) => `${s.id}:${s.level}`);
    this.effectById = index(tables.effects, (e) => e.id);
    this.phaseByTrigger = new Map(tables.triggers.map((t) => [t.id, t.phaseType]));
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

  private skip(effectType: string): void {
    this.report.skippedByType.set(effectType, (this.report.skippedByType.get(effectType) ?? 0) + 1);
  }

  /**
   * What a (effect, trigger) pair contributes: a countable parameter effect,
   * nothing (an audited non-parameter type), or the reason its card is held.
   */
  private resolve(effect: RawProduceEffect, triggerId: string, where: string): { stat: Stat; trigger: ParsedTrigger; bonus: boolean } | { held: string } | null {
    const phaseType = this.phaseByTrigger.get(triggerId);
    if (phaseType === undefined) throw new Error(`${where}: missing ProduceTrigger ${triggerId}`);
    const grantedItem = effect.produceRewards.find((r) => r.resourceType === ITEM_RESOURCE_TYPE);
    if (grantedItem) throw new Error(`${where}: a skill granting a P-item (${grantedItem.resourceId}) is not supported`);
    const stat = parameterStatOf(effect.produceEffectType);
    if (!stat) {
      if (!NON_PARAMETER_EFFECT_TYPES.has(effect.produceEffectType)) return { held: `${where}: effect type ${effect.produceEffectType} is neither a stat nor audited as non-parameter` };
      this.skip(effect.produceEffectType);
      return null;
    }
    const parsed = this.parsed(triggerId, phaseType, where);
    if ("held" in parsed) return parsed;
    this.report.occasionsUsed.add(parsed.trigger.occasion);
    return { stat, trigger: parsed.trigger, bonus: PARAM_BONUS_TYPES.has(effect.produceEffectType) };
  }

  /** The trigger id read as occasion, filters and conditions, cached; a piece of unknown kind is a reason to hold the card. */
  private parsed(triggerId: string, phaseType: string, where: string): { trigger: ParsedTrigger } | { held: string } {
    let parsed = this.parsedTriggers.get(triggerId);
    if (!parsed) {
      parsed = parseTrigger(triggerId, phaseType);
      this.parsedTriggers.set(triggerId, parsed);
    }
    if (parsed.kind === "unknown-piece") return { held: `${where}: trigger ${triggerId} has a piece of unknown kind: ${parsed.piece}` };
    return { trigger: parsed.trigger };
  }

  /**
   * Drinks per fire when the effect grants P-drinks; null when it grants nothing
   * countable here — a skill-card set or card is ignored (decision A10). A reward
   * set naming neither drink nor card, or an unreadable quantity, stops the run (A16).
   */
  private drinksOf(effect: RawProduceEffect, where: string): number | null {
    if (effect.produceEffectType === "ProduceEffectType_ProduceReward") {
      return effect.produceRewards.some((r) => r.resourceType === DRINK_RESOURCE_TYPE) ? quantityOf(effect.id, DIRECT_REWARD_QUANTITY, where) : null;
    }
    if (effect.produceEffectType !== "ProduceEffectType_ProduceRewardSet" || effect.id.includes("card")) return null;
    if (!effect.id.includes("drink")) throw new Error(`${where}: reward set ${effect.id} names neither drink nor card`);
    return quantityOf(effect.id, REWARD_SET_QUANTITY, where);
  }

  private hold(cardId: string, reason: string): void {
    const reasons = this.heldReasons.get(cardId) ?? new Set<string>();
    reasons.add(reason);
    this.heldReasons.set(cardId, reasons);
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

  /** `spRate`: a skill active at this level is SP発生率+ (skipped as non-parameter, marked on the card). */
  private skillEffects(cardId: string, level: number): { effects: ClassifiedEffect[]; eventBonusPermil: number; spRate: boolean } {
    const effects: ClassifiedEffect[] = [];
    let eventBonusPermil = 0;
    let spRate = false;
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
        if (SP_RATE_EFFECT_TYPES.has(effect.produceEffectType)) spRate = true;
        const r = this.resolve(effect, triggerId, where);
        if (!r) continue;
        if ("held" in r) {
          this.hold(cardId, r.held);
          continue;
        }
        const e: ClassifiedEffect = { stat: r.stat, value: effect.effectValueMin, kind: "skill" };
        if (skill.activationCount > 0) e.cap = skill.activationCount;
        e.trigger = r.trigger;
        if (r.bonus) e.bonus = true;
        effects.push(e);
      }
    }
    return { effects, eventBonusPermil, spRate };
  }

  private itemEffects(itemId: string): ItemResult {
    const cached = this.itemEffectsCache.get(itemId);
    if (cached) return cached;
    const item = this.itemById.get(itemId);
    if (!item) throw new Error(`missing ProduceItem ${itemId}`);
    const out: ClassifiedEffect[] = [];
    const held: string[] = [];
    let drinks: ItemGrant["drinks"];
    for (const sk of item.skills) {
      const r = this.itemSkill(item, sk);
      if (r === null) continue;
      if ("held" in r) held.push(r.held);
      else if ("drinks" in r) drinks = r.drinks;
      else out.push(r.effect);
    }
    const result: ItemResult = { effects: out, held };
    if (out.length > 0 || drinks) {
      const grant: ItemGrant = { itemId, itemName: item.name, assetId: item.assetId };
      if (item.fireLimit > 0) grant.cap = item.fireLimit;
      if (drinks) grant.drinks = drinks;
      result.grant = grant;
    }
    this.itemEffectsCache.set(itemId, result);
    return result;
  }

  private itemSkill(item: RawProduceItem, sk: RawProduceItemSkill): ItemSkillResult {
    const ie = this.itemEffectById.get(sk.produceItemEffectId);
    if (!ie) throw new Error(`item ${item.id}: missing ProduceItemEffect ${sk.produceItemEffectId}`);
    if (ie.effectType === "ProduceItemEffectType_ExamStatusEnchant") return null; // exam-time enchants score 0
    if (ie.effectType !== "ProduceItemEffectType_ProduceEffect") throw new Error(`item ${item.id} ${item.name}: unknown ProduceItemEffect type "${ie.effectType}"`);
    const where = `item ${item.id} ${item.name}`;
    const effect = this.effect(ie.produceEffectId, where);
    const triggerId = sk.produceTriggerId || item.produceTriggerId;
    const perFire = this.drinksOf(effect, where);
    if (perFire !== null) {
      const t = this.drinkTrigger(triggerId, where, effect.produceEffectType);
      return "held" in t ? t : { drinks: { perFire, trigger: t.trigger } };
    }
    const r = this.resolve(effect, triggerId, where);
    if (!r) return null;
    if ("held" in r) return r;
    const e: ClassifiedEffect = { stat: r.stat, value: effect.effectValueMin, kind: "item", itemId: item.id, itemName: item.name };
    if (item.fireLimit > 0) e.cap = item.fireLimit;
    e.trigger = r.trigger;
    if (r.bonus) e.bonus = true;
    return { effect: e };
  }

  /** The trigger of a drink-granting item effect, counted like a stat effect's and reported as skipped like every non-parameter type. */
  private drinkTrigger(triggerId: string, where: string, effectType: string): { trigger: ParsedTrigger } | { held: string } {
    const phaseType = this.phaseByTrigger.get(triggerId);
    if (phaseType === undefined) throw new Error(`${where}: missing ProduceTrigger ${triggerId}`);
    this.skip(effectType);
    const parsed = this.parsed(triggerId, phaseType, where);
    if ("trigger" in parsed) this.report.occasionsUsed.add(parsed.trigger.occasion);
    return parsed;
  }

  /** Effects of an event's rewards: a granted P-item's effects (its held reasons and its grant go to the card); nothing for the audited resource types. */
  private rewardEffects(cardId: string, rewards: readonly { resourceType: string; resourceId: string }[], where: string): ClassifiedEffect[] {
    const out: ClassifiedEffect[] = [];
    for (const rw of rewards) {
      if (rw.resourceType === ITEM_RESOURCE_TYPE) {
        const item = this.itemEffects(rw.resourceId);
        out.push(...item.effects);
        for (const reason of item.held) this.hold(cardId, reason);
        if (item.grant) (this.grantsByCard.get(cardId) ?? this.grantsByCard.set(cardId, new Map()).get(cardId))?.set(item.grant.itemId, item.grant);
      } else if (!NON_PARAMETER_RESOURCE_TYPES.has(rw.resourceType)) throw new Error(`${where}: unsupported reward "${rw.resourceType}" (${rw.resourceId})`);
    }
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
          out.push({ stat, value: effect.effectValueMin, kind: "event" });
        } else if (effect.produceEffectType === "ProduceEffectType_ProduceReward") {
          out.push(...this.rewardEffects(cardId, effect.produceRewards, where));
        } else if (NON_PARAMETER_EFFECT_TYPES.has(effect.produceEffectType)) {
          this.skip(effect.produceEffectType);
        } else {
          this.hold(cardId, `${where}: event effect type ${effect.produceEffectType} (${effectId}) is neither a parameter reward nor audited as non-parameter`);
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
    let spRate = false;
    for (const level of [...levels].sort((a, b) => a - b)) {
      const { effects, eventBonusPermil, spRate: spHere } = this.skillEffects(raw.id, level);
      spRate = spRateAfter(raw.id, level, spHere, spRate); // the badge covers every 凸 column, so the flag must hold from level 1
      const all = [...effects, ...this.eventEffects(raw.id, level)].sort((a, b) => byCodeUnit(effectSortKey(a), effectSortKey(b)));
      const bp: Breakpoint = { minLevel: level, effects: all, eventBonusPermil };
      const prev = breakpoints.at(-1);
      if (prev && JSON.stringify({ ...prev, minLevel: 0 }) === JSON.stringify({ ...bp, minLevel: 0 })) continue;
      breakpoints.push(bp);
    }
    const reasons = this.heldReasons.get(raw.id);
    if (reasons) this.report.held.push({ id: raw.id, name: raw.name, reasons: [...reasons].sort(byCodeUnit) });
    const card: Card = {
      id: raw.id,
      name: raw.name,
      assetId: raw.assetId,
      type: mapEnum(CARD_TYPE, raw.type, "type", raw.id),
      rarity: mapEnum(RARITY, raw.rarity, "rarity", raw.id),
      plan: mapEnum(PLAN, raw.planType, "planType", raw.id),
      breakpoints,
    };
    if (spRate) card.spRate = true;
    const grants = [...(this.grantsByCard.get(raw.id)?.values() ?? [])].sort((a, b) => byCodeUnit(a.itemId, b.itemId));
    if (grants.length > 0) card.items = grants;
    return card;
  }
}

/** Rarity → level at 凸0..凸4, checked to be one limit table per rarity. */
export function buildLevelLimits(tables: Tables): LevelLimits {
  const byId = new Map<string, number[]>();
  for (const ll of tables.levelLimits) {
    const rank = TOTSU_RANKS.findIndex((r) => r === ll.rank);
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

export function buildCards(tables: Tables): { cards: Card[]; report: BuildReport } {
  const builder = new CardBuilder(tables);
  const cards = tables.cards.map((raw) => builder.build(raw)).sort((a, b) => byCodeUnit(a.id, b.id));
  builder.report.held.sort((a, b) => byCodeUnit(a.id, b.id));
  return { cards, report: builder.report };
}

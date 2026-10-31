/**
 * Builds the skill card data gkms-memomemo reads (data/skillcard-data-file.ts) from the upstream
 * tables. Pure: tables, the ProduceSkill rows and the clock are passed in.
 *
 * The pool is every released ProduceCard row at upgradeCount 0 or 1 that can be a produce memory:
 * P-idol unique cards (searchTag idol-unique), support-card event cards (originSupportCardId),
 * starter cards (searchTag starter, except level 0 of 表現の基本), trouble cards and Legend cards are
 * left out (gkms-memomemo decisions D8, D37, D38). Throws, naming the row, on anything the design
 * cannot represent, so `bun run generate` writes nothing (decisions K2, K6–K8 of
 * docs/plans/EXECPLAN_SKILLCARD_DATA_AND_ICONS.md).
 */

import {
  SKILLCARD_DATA_FORMAT_VERSION,
  type CustomizationKind,
  type HifAbility,
  type Idol,
  type SkillCard,
  type SkillCardDataFile,
  type SkillCardPlan,
  type SkillCardRarity,
  type SkillCardType,
} from "../../data/skillcard-data-file.ts";
import { byCodeUnit } from "./build-cards.ts";
import type { RawCardCustomize, RawCharacter, RawProduceCard, RawProduceSkill, SkillCardTables } from "./tables.ts";

const PLANS = new Map<string, SkillCardPlan>([
  ["ProducePlanType_Plan1", "sense"],
  ["ProducePlanType_Plan2", "logic"],
  ["ProducePlanType_Plan3", "anomaly"],
  ["ProducePlanType_Common", "free"],
]);
const RARITIES = new Map<string, SkillCardRarity>([
  ["ProduceCardRarity_N", "N"],
  ["ProduceCardRarity_R", "R"],
  ["ProduceCardRarity_Sr", "SR"],
  ["ProduceCardRarity_Ssr", "SSR"],
  ["ProduceCardRarity_Legend", "Legend"],
]);
/** Trouble cards are known and left out of the pool; any other category is a surprise. */
const TYPES = new Map<string, SkillCardType | "trouble">([
  ["ProduceCardCategory_ActiveSkill", "active"],
  ["ProduceCardCategory_MentalSkill", "mental"],
  ["ProduceCardCategory_Trouble", "trouble"],
]);

/** 表現の基本: the one starter card that can be a produce memory, at level 0 only. */
const STARTER_EXCEPTION = { id: "p_card-00-men-0_003", upgrade: 0 };
/** The scenario group of 初星アイドルフェスティバル (H.I.F.) in MemoryAbility.produceGroupIds. */
export const HIF_PRODUCE_GROUP = "produce_group-003";
/** An H.I.F. ability's card appears only inside its skill's effect id. */
const HIF_EFFECT = /^p_effect-exam_status_enchant-enchant-p_ef-hif_memory-(p_card-.+)-enc02$/;
/** No grow-effect type: the overwrite field is unset. */
const NO_OVERWRITE = "ProduceCardGrowEffectType_Unknown";

function known<T>(map: Map<string, T>, value: string, what: string, where: string): T {
  const mapped = map.get(value);
  if (mapped === undefined) throw new Error(`${where}: unknown ${what} "${value}"`);
  return mapped;
}

/** True when the row is released at `now`: viewStartTime is "0" or epoch milliseconds not later than `now`. */
export function isReleased(card: Pick<RawProduceCard, "id" | "upgradeCount" | "viewStartTime">, now: number): boolean {
  if (card.viewStartTime === "0") return true;
  if (!/^\d+$/.test(card.viewStartTime)) throw new Error(`${card.id} level ${card.upgradeCount}: viewStartTime "${card.viewStartTime}" is neither "0" nor epoch milliseconds`);
  return Number(card.viewStartTime) <= now;
}

/** The pool rules that need no enum value: level, release and the card's origin. */
function passesSourceRules(card: RawProduceCard, now: number): boolean {
  if (card.upgradeCount !== 0 && card.upgradeCount !== 1) return false;
  if (card.searchTag === "idol-unique" || card.originSupportCardId !== "") return false;
  if (card.searchTag === "starter" && !(card.id === STARTER_EXCEPTION.id && card.upgradeCount === STARTER_EXCEPTION.upgrade)) return false;
  return isReleased(card, now);
}

/** The game's escape for a line break, backslash and `n`, becomes a real one (decision K6). */
function gameText(text: string): string {
  return text.replaceAll("\\n", "\n");
}

interface LabelSources {
  growTypeById: Map<string, string>;
  labelByGrowType: Map<string, string>;
}

/**
 * A step's label: its description, else the generic label of its first grow effect's type
 * (decision K6). Stops when the step's overwrite type would label it differently, since nothing
 * says which of the two the game shows.
 */
export function stepLabel(row: RawCardCustomize, sources: LabelSources): string {
  const where = `ProduceCardCustomize ${row.id} step ${row.customizeCount}`;
  const firstGrowId = row.produceCardGrowEffectIds[0];
  const growType = firstGrowId === undefined ? undefined : sources.growTypeById.get(firstGrowId);
  if (firstGrowId !== undefined && growType === undefined) throw new Error(`${where}: missing ProduceCardGrowEffect ${firstGrowId}`);
  if (row.description !== "") return gameText(row.description);
  const generic = growType === undefined ? undefined : sources.labelByGrowType.get(growType);
  if (row.overwriteProduceCardGrowEffectType !== NO_OVERWRITE) {
    const overwritten = sources.labelByGrowType.get(row.overwriteProduceCardGrowEffectType);
    if (overwritten !== generic) {
      throw new Error(`${where}: no description, and its overwrite type ${row.overwriteProduceCardGrowEffectType} (${overwritten ?? "no label"}) and its first grow effect's type ${growType ?? "none"} (${generic ?? "no label"}) would label it differently`);
    }
  }
  if (generic === undefined || generic === "") throw new Error(`${where}: no description and no label for grow effect type ${growType ?? "(no grow effect)"}`);
  return gameText(generic);
}

interface CardSources extends LabelSources {
  stepsByKind: Map<string, RawCardCustomize[]>;
  guideLabelsByCard: Map<string, string[]>;
}

function customizationOf(card: RawProduceCard, sources: CardSources): SkillCard["customization"] {
  const kinds: CustomizationKind[] = card.produceCardCustomizeIds.map((kindId) => {
    const rows = sources.stepsByKind.get(kindId);
    if (rows === undefined) throw new Error(`${card.id} level ${card.upgradeCount}: missing ProduceCardCustomize ${kindId}`);
    const steps = [...rows].sort((a, b) => a.customizeCount - b.customizeCount).map((row) => ({ step: row.customizeCount, label: stepLabel(row, sources) }));
    return { id: kindId, steps };
  });
  return { limit: card.maxCustomizeCount, kinds };
}

/** The card as published, or null for a trouble or Legend card (known, and not in the pool). */
function toSkillCard(card: RawProduceCard, sources: CardSources): SkillCard | null {
  const where = `${card.id} level ${card.upgradeCount}`;
  const type = known(TYPES, card.category, "category", where);
  const rarity = known(RARITIES, card.rarity, "rarity", where);
  const plan = known(PLANS, card.planType, "plan", where);
  if (type === "trouble" || rarity === "Legend") return null;
  return {
    id: card.id,
    upgrade: card.upgradeCount,
    name: card.name,
    plan,
    rarity,
    type,
    order: card.order,
    guideLabels: sources.guideLabelsByCard.get(card.id) ?? [],
    art: { asset: card.assetId, perIdol: card.isCharacterAsset },
    customization: customizationOf(card, sources),
  };
}

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) out.set(key(row), [...(out.get(key(row)) ?? []), row]);
  return out;
}

/** Each card id's guide labels, in the order the categories are listed, without repeats. */
function guideLabelsByCard(tables: SkillCardTables): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const category of tables.guideCategories) {
    for (const cardId of category.produceCardIds) {
      const labels = out.get(cardId) ?? [];
      if (!labels.includes(category.label)) out.set(cardId, [...labels, category.label]);
    }
  }
  return out;
}

function cardSources(tables: SkillCardTables): CardSources {
  return {
    growTypeById: new Map(tables.growEffects.map((g) => [g.id, g.effectType])),
    labelByGrowType: new Map(tables.growEffectDescriptions.map((d) => [d.type, d.produceCardCustomizeDescription])),
    stepsByKind: groupBy(tables.customizes, (row) => row.id),
    guideLabelsByCard: guideLabelsByCard(tables),
  };
}

/**
 * The pool, in the game's order (`order`, then id, so two cards sharing an order stay apart) and
 * base before +. A row the pool would hold twice means the dump is broken.
 */
export function buildPool(tables: SkillCardTables, now: number): SkillCard[] {
  const sources = cardSources(tables);
  const pool = tables.cards.filter((card) => passesSourceRules(card, now)).flatMap((card) => toSkillCard(card, sources) ?? []);
  const seen = new Set<string>();
  for (const card of pool) {
    const key = `${card.id} level ${card.upgrade}`;
    if (seen.has(key)) throw new Error(`ProduceCard ${key} appears twice`);
    seen.add(key);
  }
  return pool.sort((a, b) => byCodeUnit(a.order, b.order) || byCodeUnit(a.id, b.id) || a.upgrade - b.upgrade);
}

/** The playable P-idols in the game's order. */
export function buildIdols(characters: readonly RawCharacter[]): Idol[] {
  const playable = characters.filter((c) => c.isPlayable).sort((a, b) => a.order - b.order);
  playable.forEach((c, i) => {
    const prev = playable[i - 1];
    if (prev !== undefined && prev.order === c.order) throw new Error(`Character ${prev.id} and ${c.id} share order ${c.order}; the idols' order would be undefined`);
  });
  return playable.map((c) => ({ id: c.id, name: `${c.lastName}${c.firstName}` }));
}

/** The card id named by an ability's skill, or a thrown error naming the ability. */
function hifCardOf(abilityId: string, skillRows: readonly RawProduceSkill[]): string {
  if (skillRows.length === 0) throw new Error(`MemoryAbility ${abilityId}: missing ProduceSkill`);
  const cards = new Set<string>();
  for (const skill of skillRows) {
    const effects = [skill.produceEffectId1, skill.produceEffectId2, skill.produceEffectId3].filter((id) => typeof id === "string" && id !== "");
    const match = effects.length === 1 ? HIF_EFFECT.exec(effects[0] ?? "") : null;
    const card = match?.[1];
    if (card === undefined) throw new Error(`MemoryAbility ${abilityId}: its skill ${skill.id} level ${skill.level} should have exactly one effect p_effect-exam_status_enchant-enchant-p_ef-hif_memory-<card id>-enc02, has ${JSON.stringify(effects)}`);
    cards.add(card);
  }
  if (cards.size > 1) throw new Error(`MemoryAbility ${abilityId}: its skill's levels name different cards: ${[...cards].join(", ")}`);
  return [...cards][0] ?? "";
}

/**
 * The H.I.F. abilities whose card is in the pool, by id (decision K7). An ability whose card
 * exists but is not released yet is left out; any other card outside the pool stops the run.
 */
export function buildHifAbilities(tables: SkillCardTables, skills: readonly RawProduceSkill[], pool: readonly SkillCard[], now: number): HifAbility[] {
  const skillsById = groupBy(skills, (s) => s.id);
  const poolIds = new Set(pool.map((c) => c.id));
  const baseRows = new Map(tables.cards.filter((c) => c.upgradeCount === 0).map((c) => [c.id, c]));
  const out: HifAbility[] = [];
  for (const ability of tables.memoryAbilities) {
    if (ability.produceGroupIds.length !== 1 || ability.produceGroupIds[0] !== HIF_PRODUCE_GROUP) continue;
    const card = hifCardOf(ability.id, skillsById.get(ability.skillId) ?? []);
    if (poolIds.has(card)) {
      out.push({ id: ability.id, card });
      continue;
    }
    const base = baseRows.get(card);
    if (base === undefined) throw new Error(`MemoryAbility ${ability.id}: names ${card}, which is not a ProduceCard`);
    if (isReleased(base, now)) throw new Error(`MemoryAbility ${ability.id}: names ${card} (${base.name}), which is released but not in the pool`);
  }
  return out.sort((a, b) => byCodeUnit(a.id, b.id));
}

export function buildSkillCardData(tables: SkillCardTables, skills: readonly RawProduceSkill[], now: number): SkillCardDataFile {
  const cards = buildPool(tables, now);
  return {
    formatVersion: SKILLCARD_DATA_FORMAT_VERSION,
    idols: buildIdols(tables.characters),
    cards,
    hifAbilities: buildHifAbilities(tables, skills, cards, now),
  };
}

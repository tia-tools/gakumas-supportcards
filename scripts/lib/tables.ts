/**
 * Loading of the upstream `vertesan/gakumasu-diff` YAML tables.
 *
 * Each table is read from `<cacheDir>/<Table>.yaml` when present, otherwise
 * fetched from `<baseUrl><Table>.yaml` and written to the cache. Only the
 * fields the generators read are declared and checked for presence.
 */

import { load as loadYaml } from "js-yaml";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const DEFAULT_BASE_URL = "https://raw.githubusercontent.com/vertesan/gakumasu-diff/main/";
export const DEFAULT_CACHE_DIR = ".cache/gakumasu-diff";

export interface RawSupportCard {
  id: string;
  name: string;
  type: string;
  rarity: string;
  planType: string;
  assetId: string;
  supportCardLevelLimitId: string;
}
export interface RawSkillLevel {
  supportCardId: string;
  produceSkillId: string;
  produceSkillLevel: number;
  supportCardLevel: number;
}
export interface RawProduceSkill {
  id: string;
  level: number;
  activationCount: number;
  produceEffectId1: string;
  produceTriggerId1: string;
  produceEffectId2: string;
  produceTriggerId2: string;
  produceEffectId3: string;
  produceTriggerId3: string;
}
export interface RawProduceReward {
  resourceType: string;
  resourceId: string;
}
export interface RawProduceEffect {
  id: string;
  produceEffectType: string;
  effectValueMin: number;
  effectValueMax: number;
  produceRewards: RawProduceReward[];
}
export interface RawProduceTrigger {
  id: string;
  phaseType: string;
}
export interface RawLevelLimit {
  id: string;
  rank: string;
  levelLimit: number;
}
export interface RawEventSupportCard {
  supportCardId: string;
  number: number;
  supportCardLevel: number;
  produceStepEventDetailId: string;
}
export interface RawEventDetail {
  id: string;
  produceEffectIds: string[];
}
export interface RawProduceItemSkill {
  produceTriggerId: string;
  produceItemEffectId: string;
}
export interface RawProduceItem {
  id: string;
  name: string;
  assetId: string;
  fireLimit: number;
  produceTriggerId: string;
  skills: RawProduceItemSkill[];
}
export interface RawProduceItemEffect {
  id: string;
  effectType: string;
  produceEffectId: string;
}

/** One skill card at one upgrade level (ProduceCard.yaml has one row per id and upgradeCount). */
export interface RawProduceCard {
  id: string;
  upgradeCount: number;
  name: string;
  assetId: string;
  isCharacterAsset: boolean;
  rarity: string;
  planType: string;
  category: string;
  searchTag: string;
  originSupportCardId: string;
  produceCardCustomizeIds: string[];
  maxCustomizeCount: number;
  /** Epoch milliseconds as a string, or "0" for always. */
  viewStartTime: string;
  order: string;
}
/** One step of a customization kind; the kind's rows share its id. */
export interface RawCardCustomize {
  id: string;
  customizeCount: number;
  description: string;
  overwriteProduceCardGrowEffectType: string;
  produceCardGrowEffectIds: string[];
}
export interface RawGrowEffect {
  id: string;
  effectType: string;
}
export interface RawGrowEffectDescription {
  type: string;
  produceCardCustomizeDescription: string;
}
export interface RawMemoryAbility {
  id: string;
  skillId: string;
  produceGroupIds: string[];
}
export interface RawGuideCategory {
  label: string;
  produceCardIds: string[];
}
export interface RawCharacter {
  id: string;
  lastName: string;
  firstName: string;
  isPlayable: boolean;
  order: number;
}

/** The tables the skill card data (data/skillcards.generated.ts) is built from, besides ProduceSkill. */
export interface SkillCardTables {
  cards: RawProduceCard[];
  customizes: RawCardCustomize[];
  growEffects: RawGrowEffect[];
  growEffectDescriptions: RawGrowEffectDescription[];
  memoryAbilities: RawMemoryAbility[];
  guideCategories: RawGuideCategory[];
  characters: RawCharacter[];
}

export interface Tables {
  cards: RawSupportCard[];
  skillLevels: RawSkillLevel[];
  skills: RawProduceSkill[];
  effects: RawProduceEffect[];
  triggers: RawProduceTrigger[];
  levelLimits: RawLevelLimit[];
  eventCards: RawEventSupportCard[];
  eventDetails: RawEventDetail[];
  items: RawProduceItem[];
  itemEffects: RawProduceItemEffect[];
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

/** True when `rows` is a list of objects each carrying every key in `keys`. */
function isRowsOf<T>(rows: unknown, keys: readonly (keyof T & string)[]): rows is T[] {
  return Array.isArray(rows) && rows.every((row) => isRecord(row) && keys.every((k) => k in row));
}

export interface LoadOptions {
  cacheDir?: string;
  baseUrl?: string;
}

async function readTableText(name: string, opts: LoadOptions): Promise<string> {
  // GAKUMASU_DIFF_CACHE lets a test point the generators at a modified copy of the tables.
  const cacheDir = opts.cacheDir ?? process.env["GAKUMASU_DIFF_CACHE"] ?? DEFAULT_CACHE_DIR;
  const path = join(cacheDir, `${name}.yaml`);
  if (existsSync(path)) return readFileSync(path, "utf8");
  const res = await fetch(`${opts.baseUrl ?? DEFAULT_BASE_URL}${name}.yaml`);
  if (!res.ok) throw new Error(`fetch ${name}.yaml: HTTP ${res.status}`);
  const text = await res.text();
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(path, text);
  return text;
}

/** The YAML type a field must have, checked by `loadTypedTable`. */
export type FieldType = "string" | "number" | "boolean" | "string[]";
export type FieldTypes<T> = Readonly<Record<keyof T & string, FieldType>>;

function hasType(value: unknown, type: FieldType): boolean {
  if (type === "string[]") return Array.isArray(value) && value.every((v) => typeof v === "string");
  return typeof value === type;
}

/** How an error names a row: its id, else its type (the key of ProduceDescriptionProduceCardGrowEffect). */
function rowName(row: Record<string, unknown>): string {
  const name = row["id"] ?? row["type"];
  return typeof name === "string" ? name : "no id";
}

/** The first field of the first row whose value lacks its type, described for an error; null when every row is well typed. */
export function firstMistyped(rows: readonly unknown[], fields: Readonly<Record<string, FieldType>>): string | null {
  for (const [i, row] of rows.entries()) {
    if (!isRecord(row)) return `row ${i} is not a mapping`;
    for (const [field, type] of Object.entries(fields)) {
      if (!hasType(row[field], type)) return `row ${i} (${rowName(row)}): ${field} should be ${type}, is ${JSON.stringify(row[field]) ?? "missing"}`;
    }
  }
  return null;
}

function isTypedRows<T>(rows: unknown, fields: FieldTypes<T>): rows is T[] {
  return Array.isArray(rows) && firstMistyped(rows, fields) === null;
}

/**
 * Like `loadTable`, but every row must also give each declared field its type. For the tables of
 * the skill card data (data/skillcards.generated.ts), where a value of another type would not fail
 * a comparison but silently fail it: an upgradeCount of "1" would drop the card from the pool
 * (decision K15 of docs/plans/EXECPLAN_SKILLCARD_DATA_AND_ICONS.md).
 */
export async function loadTypedTable<T>(name: string, fields: FieldTypes<T>, opts: LoadOptions = {}): Promise<T[]> {
  const parsed: unknown = loadYaml(await readTableText(name, opts));
  if (!Array.isArray(parsed)) throw new Error(`${name}.yaml: expected a list of rows`);
  if (!isTypedRows<T>(parsed, fields)) throw new Error(`${name}.yaml: ${firstMistyped(parsed, fields) ?? "malformed"}`);
  return parsed;
}

export async function loadTable<T>(name: string, keys: readonly (keyof T & string)[], opts: LoadOptions = {}): Promise<T[]> {
  const parsed: unknown = loadYaml(await readTableText(name, opts));
  if (!isRowsOf<T>(parsed, keys)) {
    throw new Error(`${name}.yaml: expected a list of rows each having ${keys.join(", ")}`);
  }
  return parsed;
}

export async function loadTables(opts: LoadOptions = {}): Promise<Tables> {
  const skillLevelKeys = ["supportCardId", "produceSkillId", "produceSkillLevel", "supportCardLevel"] as const;
  const [cards, slVocal, slDance, slVisual, slAssist, skills, effects, triggers, levelLimits, eventCards, eventDetails, items, itemEffects] =
    await Promise.all([
      loadTable<RawSupportCard>("SupportCard", ["id", "name", "type", "rarity", "planType", "assetId", "supportCardLevelLimitId"], opts),
      loadTable<RawSkillLevel>("SupportCardProduceSkillLevelVocal", skillLevelKeys, opts),
      loadTable<RawSkillLevel>("SupportCardProduceSkillLevelDance", skillLevelKeys, opts),
      loadTable<RawSkillLevel>("SupportCardProduceSkillLevelVisual", skillLevelKeys, opts),
      loadTable<RawSkillLevel>("SupportCardProduceSkillLevelAssist", skillLevelKeys, opts),
      loadTable<RawProduceSkill>("ProduceSkill", ["id", "level", "activationCount", "produceEffectId1", "produceTriggerId1"], opts),
      loadTable<RawProduceEffect>("ProduceEffect", ["id", "produceEffectType", "effectValueMin", "effectValueMax", "produceRewards"], opts),
      loadTable<RawProduceTrigger>("ProduceTrigger", ["id", "phaseType"], opts),
      loadTable<RawLevelLimit>("SupportCardLevelLimit", ["id", "rank", "levelLimit"], opts),
      loadTable<RawEventSupportCard>("ProduceEventSupportCard", ["supportCardId", "number", "supportCardLevel", "produceStepEventDetailId"], opts),
      loadTable<RawEventDetail>("ProduceStepEventDetail", ["id", "produceEffectIds"], opts),
      loadTable<RawProduceItem>("ProduceItem", ["id", "name", "assetId", "fireLimit", "produceTriggerId", "skills"], opts),
      loadTable<RawProduceItemEffect>("ProduceItemEffect", ["id", "effectType", "produceEffectId"], opts),
    ]);
  return {
    cards,
    skillLevels: [...slVocal, ...slDance, ...slVisual, ...slAssist],
    skills,
    effects,
    triggers,
    levelLimits,
    eventCards,
    eventDetails,
    items,
    itemEffects,
  };
}

const PRODUCE_CARD_FIELDS: FieldTypes<RawProduceCard> = {
  id: "string",
  upgradeCount: "number",
  name: "string",
  assetId: "string",
  isCharacterAsset: "boolean",
  rarity: "string",
  planType: "string",
  category: "string",
  searchTag: "string",
  originSupportCardId: "string",
  produceCardCustomizeIds: "string[]",
  maxCustomizeCount: "number",
  viewStartTime: "string",
  order: "string",
};

/**
 * The skill card tables (docs/plans/EXECPLAN_SKILLCARD_DATA_AND_ICONS.md), each field typed.
 * ProduceSkill is not among them: `loadTables` already reads it, with the fields the H.I.F.
 * abilities need.
 */
export async function loadSkillCardTables(opts: LoadOptions = {}): Promise<SkillCardTables> {
  const [cards, customizes, growEffects, growEffectDescriptions, memoryAbilities, guideCategories, characters] = await Promise.all([
    loadTypedTable<RawProduceCard>("ProduceCard", PRODUCE_CARD_FIELDS, opts),
    loadTypedTable<RawCardCustomize>("ProduceCardCustomize", { id: "string", customizeCount: "number", description: "string", overwriteProduceCardGrowEffectType: "string", produceCardGrowEffectIds: "string[]" }, opts),
    loadTypedTable<RawGrowEffect>("ProduceCardGrowEffect", { id: "string", effectType: "string" }, opts),
    loadTypedTable<RawGrowEffectDescription>("ProduceDescriptionProduceCardGrowEffect", { type: "string", produceCardCustomizeDescription: "string" }, opts),
    loadTypedTable<RawMemoryAbility>("MemoryAbility", { id: "string", skillId: "string", produceGroupIds: "string[]" }, opts),
    loadTypedTable<RawGuideCategory>("ProduceGuideProduceCardCategory", { label: "string", produceCardIds: "string[]" }, opts),
    loadTypedTable<RawCharacter>("Character", { id: "string", lastName: "string", firstName: "string", isPlayable: "boolean", order: "number" }, opts),
  ]);
  return { cards, customizes, growEffects, growEffectDescriptions, memoryAbilities, guideCategories, characters };
}

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
  fireLimit: number;
  produceTriggerId: string;
  skills: RawProduceItemSkill[];
}
export interface RawProduceItemEffect {
  id: string;
  effectType: string;
  produceEffectId: string;
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
      loadTable<RawProduceItem>("ProduceItem", ["id", "name", "fireLimit", "produceTriggerId", "skills"], opts),
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

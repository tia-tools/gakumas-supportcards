/**
 * THROWAWAY prototype for Milestone 0 of docs/plans/EXECPLAN_COUNTING_MODEL.md.
 * Writes nothing; delete once Milestone 1 has moved the parser into scripts/lib/.
 *
 *   bun scripts/prototype-occasions.ts            summary + findings
 *   bun scripts/prototype-occasions.ts --verbose  also every parsed trigger and every mapping line
 *
 * 1. Parses every trigger id carrying a Vocal/Dance/Visual effect on a support
 *    card skill or a card-granted P-item into occasion / filters / conditions.
 * 2. Restates each shipped route profile's `counts` in the new shape by parsing
 *    each category's own trigger id, and prints which new field carries which number.
 * 3. Compares, per effect use, today's count with the count the restated profile yields.
 * 4. Shows where the game keeps the wording of a trigger.
 */

import { Classifier, mergeTaxonomy, statOf, type TaxonomySource } from "./lib/classify.ts";
import { loadTable, loadTables, type Tables } from "./lib/tables.ts";
import { TAXONOMY_EXTENSIONS } from "../data/taxonomy.extensions.ts";
import { SCENARIOS } from "../data/scenarios/index.ts";
import { routeCount } from "../src/engine/score.ts";
import type { RouteProfile, TaxonomyRow } from "../src/engine/types.ts";

// ---------------------------------------------------------------- parser

export interface FilterRef {
  family: "lessonStat" | "lessonKind" | "cardType" | "rarity" | "cardName" | "effectGroup";
  member: string;
}
export interface ConditionRef {
  /** `vocal`, `stamina_ratio`, `produce_card_count`, `produce_card_search_count`, … */
  kind: string;
  /** For `produce_card_search_count`: which held cards are counted; empty = all. */
  subject: FilterRef[];
  /** `NNNN_NNNN` is min_max; 0 on either side means unbounded (`0000_0900` = 900以下). */
  min: number;
  max: number;
}
export interface ParsedTrigger {
  occasion: string;
  filters: FilterRef[];
  conditions: ConditionRef[];
  scenarioToken?: string;
}
export type ParseResult = { kind: "parsed"; trigger: ParsedTrigger } | { kind: "unknown-piece"; piece: string };

const RANGE = /^(\d{4})_(\d{4})$/;
/** Pieces with no meaning for counting. */
const NOISE_AFTER_HEAD: ReadonlySet<string> = new Set(["initial", "no_description"]);
/** Inside a card search: `deck_all` is the search scope; the trailing `1` of `…-ssr-deck_all-1` has no wording in the skill text. */
const SEARCH_NOISE: ReadonlySet<string> = new Set(["deck_all", "1"]);
const SEARCH_FILTERS: Readonly<Record<string, FilterRef>> = {
  mental_skill: { family: "cardType", member: "mental" },
  active_skill: { family: "cardType", member: "active" },
  ssr: { family: "rarity", member: "ssr" },
  starter: { family: "cardName", member: "starter" },
};

function snake(phaseType: string): string {
  return phaseType.replace(/^ProducePhaseType_/, "").replace(/(?<!^)([A-Z])/g, "_$1").toLowerCase();
}

export function parseTrigger(triggerId: string, phaseType: string): ParseResult {
  const occasion = phaseType.replace(/^ProducePhaseType_/, "");
  const head = `p_trigger-${snake(phaseType)}`;
  if (triggerId !== head && !triggerId.startsWith(`${head}-`)) return { kind: "unknown-piece", piece: `head≠${head}` };
  const tokens = triggerId === head ? [] : triggerId.slice(head.length + 1).split("-");
  const out: ParsedTrigger = { occasion, filters: [], conditions: [] };
  /** Open `produce_card_search_count`: filters go to its subject until a range closes it. */
  let open: ConditionRef | null = null;
  let inSearch = false;
  const pushFilter = (f: FilterRef): void => void (open ? open.subject : out.filters).push(f);

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i] ?? "";
    const next = tokens[i + 1] ?? "";
    const range = RANGE.exec(t);
    if (range) {
      if (open) {
        open.min = Number(range[1]);
        open.max = Number(range[2]);
        out.conditions.push(open);
        open = null;
        inSearch = false;
      } else if (t !== "0000_0000") return { kind: "unknown-piece", piece: t };
      continue;
    }
    if (i === 0 && NOISE_AFTER_HEAD.has(t)) continue;
    const lesson = /^lesson_(?:(vocal|dance|visual)(?:_(sp|normal))?|(sp|normal))$/.exec(t);
    if (lesson) {
      if (lesson[1]) pushFilter({ family: "lessonStat", member: lesson[1] });
      const kind = lesson[2] ?? lesson[3];
      if (kind) pushFilter({ family: "lessonKind", member: kind });
      continue;
    }
    if (t === "p_card_search") {
      inSearch = true;
      continue;
    }
    if (inSearch && SEARCH_NOISE.has(t)) continue;
    const searchFilter = inSearch ? SEARCH_FILTERS[t] : undefined;
    if (searchFilter) {
      pushFilter(searchFilter);
      continue;
    }
    if (t === "effect_group") {
      const member = /^exam_(.+)$/.exec(tokens[i + 2] ?? "");
      if (next !== "visible" || !member || !/^\d{3}$/.test(tokens[i + 3] ?? "")) return { kind: "unknown-piece", piece: tokens.slice(i, i + 4).join("-") };
      pushFilter({ family: "effectGroup", member: member[1] ?? "" });
      i += 3;
      continue;
    }
    if (t === "produce_card_search_count") {
      open = { kind: t, subject: [], min: 0, max: 0 };
      continue;
    }
    const scenario = /^for_(.+)$/.exec(t);
    if (scenario && i === tokens.length - 1) {
      out.scenarioToken = scenario[1] ?? "";
      continue;
    }
    const nextRange = RANGE.exec(next);
    if (/^[a-z_]+$/.test(t) && nextRange && !open) {
      out.conditions.push({ kind: t, subject: [], min: Number(nextRange[1]), max: Number(nextRange[2]) });
      inSearch = false;
      i++;
      continue;
    }
    return { kind: "unknown-piece", piece: t };
  }
  if (open) return { kind: "unknown-piece", piece: "produce_card_search_count without a range" };
  return { kind: "parsed", trigger: out };
}

export function conditionKey(occasion: string, c: ConditionRef): string {
  const subject = c.subject.length ? `[${c.subject.map((f) => `${f.family}.${f.member}`).join(",")}]` : "";
  const bound = c.max ? (c.min ? `${c.min}..${c.max}` : `<=${c.max}`) : `>=${c.min}`;
  return `${occasion}/${c.kind}${subject}${bound}`;
}

function show(p: ParsedTrigger): string {
  const parts = [p.occasion, ...p.filters.map((f) => `${f.family}=${f.member}`), ...p.conditions.map((c) => conditionKey("", c).slice(1))];
  if (p.scenarioToken) parts.push(`for=${p.scenarioToken}`);
  return parts.join("  ");
}

// ---------------------------------------------------------------- uses of triggers in the card data

const ITEM_RESOURCE_TYPE = "ProduceResourceType_ProduceItem";

interface Use {
  triggerId: string;
  effectType: string;
  cap: number;
  where: string;
  /** Concatenated `produceDescriptions[].text` of the skill or item. */
  text: string;
}

interface Described {
  id: string;
  level?: number;
  produceDescriptions: { text: string }[];
}

function collectUses(tables: Tables, skillText: Map<string, string>, itemText: Map<string, string>): Use[] {
  const effectById = new Map(tables.effects.map((e) => [e.id, e]));
  const uses: Use[] = [];
  const add = (triggerId: string, effectId: string, cap: number, where: string, text: string): void => {
    const effect = effectById.get(effectId);
    if (effect && statOf(effect.produceEffectType)) uses.push({ triggerId, effectType: effect.produceEffectType, cap, where, text });
  };
  const cardIds = new Set(tables.cards.map((c) => c.id));
  const usedSkills = new Set(tables.skillLevels.filter((r) => cardIds.has(r.supportCardId)).map((r) => `${r.produceSkillId}:${r.produceSkillLevel}`));
  for (const s of tables.skills) {
    const key = `${s.id}:${s.level}`;
    if (!usedSkills.has(key)) continue;
    for (const [e, t] of [[s.produceEffectId1, s.produceTriggerId1], [s.produceEffectId2, s.produceTriggerId2], [s.produceEffectId3, s.produceTriggerId3]] as const) {
      if (e) add(t, e, s.activationCount, `skill ${s.id} lv${s.level}`, skillText.get(key) ?? "");
    }
  }
  const detailById = new Map(tables.eventDetails.map((d) => [d.id, d]));
  const itemById = new Map(tables.items.map((i) => [i.id, i]));
  const itemEffectById = new Map(tables.itemEffects.map((e) => [e.id, e]));
  const seenItems = new Set<string>();
  for (const ev of tables.eventCards) {
    if (!cardIds.has(ev.supportCardId)) continue;
    for (const effectId of detailById.get(ev.produceStepEventDetailId)?.produceEffectIds ?? []) {
      for (const rw of effectById.get(effectId)?.produceRewards ?? []) {
        const item = rw.resourceType === ITEM_RESOURCE_TYPE ? itemById.get(rw.resourceId) : undefined;
        if (!item || seenItems.has(item.id)) continue;
        seenItems.add(item.id);
        for (const sk of item.skills) {
          const ie = itemEffectById.get(sk.produceItemEffectId);
          if (ie?.effectType !== "ProduceItemEffectType_ProduceEffect") continue;
          add(sk.produceTriggerId || item.produceTriggerId, ie.produceEffectId, item.fireLimit, `item ${item.id} ${item.name}`, itemText.get(item.id) ?? "");
        }
      }
    }
  }
  return uses;
}

/** The trigger wording: everything before the first 「、<stat>上昇」 / 「、Pポイント」 etc.; newlines dropped. The two ProduceStart triggers have no clause (「初期ダンス上昇+10」). */
function triggerClause(text: string): string {
  const flat = text.replace(/\n/g, "");
  if (/^初期|パラメータボーナス/.test(flat)) return "(none: run start)";
  const m = /^(.*?)、?(?:ボーカル|ダンス|ビジュアル)上昇\+/.exec(flat);
  return m?.[1] ?? "";
}

// ---------------------------------------------------------------- restating a profile

interface Restated {
  occasions: Map<string, number>;
  /** occasion → family → member → count */
  filters: Map<string, Map<string, Map<string, number>>>;
  /** Only conditions whose old number differs from their parent's count. */
  conditions: Map<string, number>;
  lines: string[];
  homeless: string[];
}

/** Count of an occasion narrowed by filters, ignoring conditions and the lesson-stat filter (the lesson split carries that one). */
function parentCount(r: Restated, p: ParsedTrigger): { n: number; missing: string[] } {
  const missing: string[] = [];
  let n = r.occasions.get(p.occasion);
  if (n === undefined) {
    missing.push(`occasions.${p.occasion}`);
    n = 0;
  }
  for (const f of p.filters) {
    if (f.family === "lessonStat") continue;
    const v = r.filters.get(p.occasion)?.get(f.family)?.get(f.member);
    if (v === undefined) missing.push(`filters.${p.occasion}.${f.family}.${f.member}`);
    else n = Math.min(n, v);
  }
  return { n, missing };
}

function restate(profile: RouteProfile, rows: ReadonlyMap<string, TaxonomySource>, phaseById: ReadonlyMap<string, string>): Restated {
  const r: Restated = { occasions: new Map(), filters: new Map(), conditions: new Map(), lines: [], homeless: [] };
  const parsed: { id: string; n: number; p: ParsedTrigger }[] = [];
  for (const [id, n] of Object.entries(profile.counts)) {
    const triggerId = rows.get(id)?.produceTriggerIds[0];
    // An extension row may name a trigger id that exists only with further pieces (`p_trigger-end_before_audition_refresh`).
    const phase = triggerId === undefined ? undefined : (phaseById.get(triggerId) ?? [...phaseById].find(([id]) => id.startsWith(`${triggerId}-`))?.[1]);
    const res = triggerId === undefined || phase === undefined ? undefined : parseTrigger(triggerId, phase);
    if (res?.kind !== "parsed") r.homeless.push(`${id} = ${n} (${res ? res.piece : "no taxonomy row or trigger"})`);
    else parsed.push({ id, n, p: res.trigger });
  }
  const short = (id: string): string => id.replace(/^s_card_p_skill_filter-vocaladdition-p_trigger-/, "…");
  const countable = (p: ParsedTrigger): FilterRef[] => p.filters.filter((f) => f.family !== "lessonStat");
  // Pass 1: occasions (no filter besides the lesson stat, no condition).
  for (const { id, n, p } of parsed) {
    if (countable(p).length || p.conditions.length) continue;
    r.occasions.set(p.occasion, n);
    r.lines.push(`counts[${short(id)}] = ${n}  ->  occasions.${p.occasion}`);
  }
  // Pass 2: single filters.
  for (const { id, n, p } of parsed) {
    const fs = countable(p);
    if (p.conditions.length || fs.length === 0) continue;
    const [f] = fs;
    if (fs.length > 1 || !f) {
      r.homeless.push(`${id} = ${n} (category with ${fs.length} filters)`);
      continue;
    }
    const fam = r.filters.get(p.occasion) ?? new Map<string, Map<string, number>>();
    const members = fam.get(f.family) ?? new Map<string, number>();
    members.set(f.member, n);
    fam.set(f.family, members);
    r.filters.set(p.occasion, fam);
    r.lines.push(`counts[${short(id)}] = ${n}  ->  filters.${p.occasion}.${f.family}.members.${f.member}`);
  }
  // Pass 3: conditions — at the maximum (nothing to state) or an explicit entry.
  for (const { id, n, p } of parsed) {
    if (!p.conditions.length) continue;
    const { n: parent, missing } = parentCount(r, p);
    const keys = p.conditions.map((c) => conditionKey(p.occasion, c));
    if (missing.length) r.homeless.push(`${id} = ${n} (parent has no number: ${missing.join(", ")})`);
    else if (n === parent) r.lines.push(`counts[${short(id)}] = ${n}  ->  ${keys.join(" & ")} at the maximum (${parent}); nothing stated`);
    else {
      for (const k of keys) r.conditions.set(k, n);
      r.lines.push(`counts[${short(id)}] = ${n}  ->  conditions["${keys.join('" & "')}"] = ${n}   ** parent is ${parent}: C7 says profiles ship no such entry **`);
    }
  }
  return r;
}

function newCount(r: Restated, p: ParsedTrigger): { n: number; missing: string[] } {
  const { n, missing } = parentCount(r, p);
  let out = n;
  for (const c of p.conditions) out = Math.min(out, r.conditions.get(conditionKey(p.occasion, c)) ?? out);
  return { n: out, missing };
}

// ---------------------------------------------------------------- main

if (import.meta.main) {
  const verbose = process.argv.includes("--verbose");
  const tables = await loadTables();
  const textOf = (rows: Described[], key: (d: Described) => string): Map<string, string> => new Map(rows.map((d) => [key(d), d.produceDescriptions.map((x) => x.text).join("")]));
  const skillText = textOf(await loadTable<Described>("ProduceSkill", ["id", "level", "produceDescriptions"]), (d) => `${d.id}:${d.level}`);
  const itemText = textOf(await loadTable<Described>("ProduceItem", ["id", "produceDescriptions"]), (d) => d.id);

  const phaseById = new Map(tables.triggers.map((t) => [t.id, t.phaseType]));
  const uses = collectUses(tables, skillText, itemText);
  const flat = uses.filter((u) => !u.effectType.includes("GrowthRate"));

  // 1. parse
  const parsedById = new Map<string, ParsedTrigger>();
  const unplaced: string[] = [];
  for (const id of new Set(uses.map((u) => u.triggerId))) {
    const res = parseTrigger(id, phaseById.get(id) ?? "");
    if (res.kind === "parsed") parsedById.set(id, res.trigger);
    else unplaced.push(`${id}: ${res.piece}`);
  }
  const occasions = new Set([...parsedById.values()].map((p) => p.occasion));
  console.log(`triggers parsed: ${parsedById.size} | occasions: ${occasions.size} | unplaced pieces: ${unplaced.length}`);
  for (const u of unplaced) console.log(`  UNPLACED ${u}`);
  if (verbose) for (const [id, p] of [...parsedById].sort()) console.log(`  ${show(p)}   <- ${id}`);

  // Every trigger the game defines, used by a card or not: a preview of what the shape rules of C4 will meet.
  const allUnplaced = new Map<string, string[]>();
  for (const t of tables.triggers) {
    const res = parseTrigger(t.id, t.phaseType);
    if (res.kind === "unknown-piece") allUnplaced.set(res.piece, [...(allUnplaced.get(res.piece) ?? []), t.id]);
  }
  console.log(`\nall ${tables.triggers.length} rows of ProduceTrigger.yaml: ${[...allUnplaced.values()].flat().length} do not parse, by piece:`);
  for (const [piece, ids] of [...allUnplaced].sort((a, b) => b[1].length - a[1].length)) console.log(`  ${piece}  x${ids.length}  e.g. ${ids[0]}`);

  // 2 + 3. restate every profile and compare per use
  const sources = mergeTaxonomy(tables.filterRows, TAXONOMY_EXTENSIONS);
  const classifier = new Classifier(sources);
  const rowById = new Map(sources.map((s) => [s.id, s]));
  const taxonomy: ReadonlyMap<string, TaxonomyRow> = rowById;
  let homeless = 0;
  for (const scenario of SCENARIOS) {
    for (const profile of scenario.profiles) {
      const r = restate(profile, rowById, phaseById);
      homeless += r.homeless.length;
      console.log(`\n== ${scenario.id}/${profile.id}: ${Object.keys(profile.counts).length} counts -> ${r.occasions.size} occasions, ${[...r.filters.values()].reduce((a, f) => a + [...f.values()].reduce((b, m) => b + m.size, 0), 0)} filter members, ${r.conditions.size} stated conditions; without a home: ${r.homeless.length}`);
      for (const h of r.homeless) console.log(`  HOMELESS ${h}`);
      if (verbose) for (const l of r.lines) console.log(`  ${l}`);
      else for (const l of r.lines.filter((x) => x.includes("**"))) console.log(`  ${l}`);
      for (const [occasion, fams] of r.filters) {
        for (const [family, members] of fams) console.log(`  filters.${occasion}.${family}: ${[...members].map(([m, n]) => `${m} ${n}`).join(", ")}`);
      }
      const seen = new Set<string>();
      for (const u of flat) {
        const p = parsedById.get(u.triggerId);
        const c = classifier.classify(u.effectType, u.triggerId);
        if (!p || c.kind !== "classified") continue;
        const old = routeCount(profile, taxonomy, c.row.id);
        const { n, missing } = newCount(r, p);
        const cap = (x: number): number => (u.cap ? Math.min(u.cap, x) : x);
        const key = `${u.triggerId}|${u.cap}`;
        if ((old === n && !missing.length) || seen.has(key)) continue;
        seen.add(key);
        const verdict = missing.length ? `NO NUMBER for ${missing.join(", ")}` : cap(old) === cap(n) ? "count differs, capped count equal: no score moves" : "SCORE MOVES";
        console.log(`  DIFF old ${old} new ${n} cap ${u.cap || "-"}  ${verdict}  <- ${u.triggerId} [${u.where}]`);
      }
    }
  }
  console.log(`\ncategory counts without a home: ${homeless}`);

  // 4. wording
  const clauses = new Map<string, Set<string>>();
  for (const u of uses) clauses.set(u.triggerId, (clauses.get(u.triggerId) ?? new Set()).add(triggerClause(u.text)));
  const bad = [...clauses].filter(([, s]) => s.size !== 1 || s.has(""));
  console.log(`\ntrigger wording from produceDescriptions[].text: ${clauses.size - bad.length} of ${clauses.size} triggers give exactly one clause`);
  for (const [id, s] of bad) console.log(`  ${id}: ${JSON.stringify([...s])}`);
  if (verbose) for (const [id, s] of [...clauses].sort()) console.log(`  ${[...s][0]}   <- ${id}`);
}

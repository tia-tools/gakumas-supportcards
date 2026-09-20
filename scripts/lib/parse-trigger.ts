/**
 * Reads a `ProduceTrigger` id as occasion, filters and conditions
 * (docs/adr/0004; decisions C1–C5 and C10–C12 of
 * docs/plans/EXECPLAN_COUNTING_MODEL.md). Pure: no I/O.
 *
 * A trigger id is `p_trigger-` + the phase type in snake case + pieces joined
 * by `-`. The occasion is the phase type itself. A piece is one of:
 *   - nothing to count: `initial` / `no_description` right after the head, the
 *     unbounded range `0000_0000`, and `deck_all` / `1` inside a card search;
 *   - a filter: `lesson_{stat}`, `lesson_{stat}_{kind}`, `lesson_{kind}`; after
 *     `p_card_search`, `mental_skill` / `active_skill` / `ssr` / `starter`;
 *     `effect_group-visible-exam_{group}-NNN`;
 *   - a condition: a name followed by a range `NNNN_NNNN` (minimum_maximum,
 *     0000 = unbounded), or `produce_card_search_count` + the card search that
 *     says which held cards are counted + the closing range;
 *   - a scenario restriction: a final `for_{token}`.
 *
 * Shape decides for a piece never seen before (C4, C12): a new name before a
 * range is a condition, a new `exam_*` group or lesson kind is a new member of
 * its family, and anything else — including a new word inside a card search,
 * where three families share one position, and an unknown `for_` token — is a
 * piece of unknown kind: the caller hides the card and asks a person.
 */

import type { ConditionRef, FilterRef, ParsedTrigger } from "../../src/engine/types.ts";

export type ParseResult = { kind: "parsed"; trigger: ParsedTrigger } | { kind: "unknown-piece"; piece: string };

const PHASE_PREFIX = "ProducePhaseType_";
const RANGE = /^(\d{4})_(\d{4})$/;
const UNBOUNDED = "0000_0000";
const NOISE_AFTER_HEAD: ReadonlySet<string> = new Set(["initial", "no_description"]);
/** `deck_all` is the search scope; the trailing `1` of `…-ssr-deck_all-1` has no wording in the skill text. */
const SEARCH_NOISE: ReadonlySet<string> = new Set(["deck_all", "1"]);
const SEARCH_FILTERS: Readonly<Record<string, FilterRef>> = {
  mental_skill: { family: "cardType", member: "mental" },
  active_skill: { family: "cardType", member: "active" },
  ssr: { family: "rarity", member: "ssr" },
  starter: { family: "cardName", member: "starter" },
};
const LESSON = /^lesson_(?:(vocal|dance|visual)(?:_([a-z]+))?|([a-z]+))$/;

/**
 * `for_{token}` → the scenario the trigger is restricted to (C5): this site's
 * scenario id, or the token itself for a scenario the site does not ship, which
 * no profile matches and therefore counts 0 everywhere. A token missing here is
 * a piece of unknown kind; add it when the game adds a scenario.
 */
export const SCENARIO_TOKENS: Readonly<Record<string, string>> = {
  hif: "hif",
  hif_memory: "hif",
  hajime_legend: "hajime-legend",
  hajime_legend_ssr: "hajime-legend",
  nia_master: "nia_master",
};

export function occasionOf(phaseType: string): string {
  return phaseType.startsWith(PHASE_PREFIX) ? phaseType.slice(PHASE_PREFIX.length) : phaseType;
}

function headOf(occasion: string): string {
  return `p_trigger-${occasion.replace(/(?<!^)([A-Z])/g, "_$1").toLowerCase()}`;
}

export function parseTrigger(triggerId: string, phaseType: string, scenarioTokens: Readonly<Record<string, string>> = SCENARIO_TOKENS): ParseResult {
  const occasion = occasionOf(phaseType);
  const head = headOf(occasion);
  if (triggerId !== head && !triggerId.startsWith(`${head}-`)) return { kind: "unknown-piece", piece: `${triggerId} does not start with ${head}` };
  const tokens = triggerId === head ? [] : triggerId.slice(head.length + 1).split("-");

  const filters: FilterRef[] = [];
  const conditions: ConditionRef[] = [];
  let scenario: string | undefined;
  /** An open `produce_card_search_count`: filters describe the held cards it counts until a range closes it. */
  let counted: FilterRef[] | null = null;
  let inSearch = false;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i] ?? "";
    const range = RANGE.exec(t);
    if (range) {
      if (counted) {
        const c: ConditionRef = { kind: "produce_card_search_count", min: Number(range[1]), max: Number(range[2]) };
        if (counted.length > 0) c.subject = counted;
        conditions.push(c);
        counted = null;
        inSearch = false;
      } else if (t !== UNBOUNDED) return { kind: "unknown-piece", piece: t };
      continue;
    }
    if (i === 0 && NOISE_AFTER_HEAD.has(t)) continue;
    if (t === "p_card_search") {
      inSearch = true;
      continue;
    }
    if (inSearch && SEARCH_NOISE.has(t)) continue;
    const searched = inSearch ? SEARCH_FILTERS[t] : undefined;
    if (searched) {
      (counted ?? filters).push(searched);
      continue;
    }
    if (t === "effect_group") {
      const group = /^exam_([a-z_]+)$/.exec(tokens[i + 2] ?? "");
      if (tokens[i + 1] !== "visible" || !group || !/^\d{3}$/.test(tokens[i + 3] ?? "")) return { kind: "unknown-piece", piece: tokens.slice(i, i + 4).join("-") };
      (counted ?? filters).push({ family: "effectGroup", member: group[1] ?? "" });
      i += 3;
      continue;
    }
    if (t === "produce_card_search_count" && !counted) {
      counted = [];
      continue;
    }
    if (counted) return { kind: "unknown-piece", piece: t };
    const nextRange = RANGE.exec(tokens[i + 1] ?? "");
    if (nextRange && /^[a-z_]+$/.test(t)) {
      conditions.push({ kind: t, min: Number(nextRange[1]), max: Number(nextRange[2]) });
      inSearch = false;
      i++;
      continue;
    }
    const lesson = inSearch ? null : LESSON.exec(t);
    if (lesson) {
      if (lesson[1]) filters.push({ family: "lessonStat", member: lesson[1] });
      const kind = lesson[2] ?? lesson[3];
      if (kind) filters.push({ family: "lessonKind", member: kind });
      continue;
    }
    const forScenario = /^for_([a-z_]+)$/.exec(t);
    if (forScenario && i === tokens.length - 1) {
      scenario = scenarioTokens[forScenario[1] ?? ""];
      if (scenario === undefined) return { kind: "unknown-piece", piece: t };
      continue;
    }
    return { kind: "unknown-piece", piece: t };
  }
  if (counted) return { kind: "unknown-piece", piece: "produce_card_search_count without a closing range" };

  const trigger: ParsedTrigger = { occasion };
  if (filters.length > 0) trigger.filters = filters;
  if (conditions.length > 0) trigger.conditions = conditions;
  if (scenario !== undefined) trigger.scenario = scenario;
  return { kind: "parsed", trigger };
}

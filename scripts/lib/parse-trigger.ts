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
 *
 * Each kind of piece has a reader below; `parseTrigger` tries them in a fixed
 * order, which is part of the meaning: a range closes an open count before
 * anything else is asked, `effect_group` takes the three tokens after it, a
 * condition name takes the range after it, and a name inside an open count that
 * no earlier reader took is of unknown kind.
 */

import type { ConditionRef, FilterRef, ParsedTrigger } from "../../src/engine/types.ts";

export type ParseResult = { kind: "parsed"; trigger: ParsedTrigger } | { kind: "unknown-piece"; piece: string };
type Failure = Extract<ParseResult, { kind: "unknown-piece" }>;

const PHASE_PREFIX = "ProducePhaseType_";
const RANGE = /^(\d{4})_(\d{4})$/;
const UNBOUNDED = "0000_0000";
const WORD = /^[a-z_]+$/;
const NOISE_AFTER_HEAD: ReadonlySet<string> = new Set(["initial", "no_description"]);
/** `deck_all` is the search scope; the trailing `1` of `…-ssr-deck_all-1` has no wording in the skill text. */
const SEARCH_NOISE: ReadonlySet<string> = new Set(["deck_all", "1"]);
const SEARCH_FILTERS: Readonly<Record<string, FilterRef>> = {
  mental_skill: { family: "cardType", member: "mental" },
  active_skill: { family: "cardType", member: "active" },
  ssr: { family: "rarity", member: "ssr" },
  starter: { family: "cardName", member: "starter" },
};
const LESSON_PREFIX = "lesson_";
const LESSON_STATS: ReadonlySet<string> = new Set(["vocal", "dance", "visual"]);

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

/** What the readers share while one id is read. */
interface State {
  tokens: readonly string[];
  scenarioTokens: Readonly<Record<string, string>>;
  filters: FilterRef[];
  conditions: ConditionRef[];
  scenario?: string;
  /** An open `produce_card_search_count`: filters describe the held cards it counts until a range closes it. */
  counted: FilterRef[] | null;
  inSearch: boolean;
}

/** How many tokens a reader took (at least 1), a piece of unknown kind, or null when the token is not of its kind. */
type Read = number | Failure | null;
type Reader = (s: State, i: number) => Read;

const token = (s: State, i: number): string => s.tokens[i] ?? "";
const unknown = (piece: string): Failure => ({ kind: "unknown-piece", piece });

/** A range closes an open count as its condition; outside one, only the unbounded range is allowed. */
const readRange: Reader = (s, i) => {
  const t = token(s, i);
  const range = RANGE.exec(t);
  if (!range) return null;
  if (s.counted) {
    const c: ConditionRef = { kind: "produce_card_search_count", min: Number(range[1]), max: Number(range[2]) };
    if (s.counted.length > 0) c.subject = s.counted;
    s.conditions.push(c);
    s.counted = null;
    s.inSearch = false;
    return 1;
  }
  return t === UNBOUNDED ? 1 : unknown(t);
};

/** Pieces with nothing to count; `p_card_search` opens a card search. */
const readNoise: Reader = (s, i) => {
  const t = token(s, i);
  if (i === 0 && NOISE_AFTER_HEAD.has(t)) return 1;
  if (t === "p_card_search") {
    s.inSearch = true;
    return 1;
  }
  return s.inSearch && SEARCH_NOISE.has(t) ? 1 : null;
};

/** Inside a card search, a card type, rarity or name — a filter on the occasion, or on an open count. */
const readSearchFilter: Reader = (s, i) => {
  const searched = s.inSearch ? SEARCH_FILTERS[token(s, i)] : undefined;
  if (!searched) return null;
  (s.counted ?? s.filters).push(searched);
  return 1;
};

/** `effect_group-visible-exam_{group}-NNN`: four tokens, a filter on the occasion or on an open count. */
const readEffectGroup: Reader = (s, i) => {
  if (token(s, i) !== "effect_group") return null;
  const group = /^exam_([a-z_]+)$/.exec(token(s, i + 2));
  if (token(s, i + 1) !== "visible" || !group || !/^\d{3}$/.test(token(s, i + 3))) return unknown(s.tokens.slice(i, i + 4).join("-"));
  (s.counted ?? s.filters).push({ family: "effectGroup", member: group[1] ?? "" });
  return 4;
};

/** `produce_card_search_count` opens a count of held cards, closed by the next range. */
const readCountOpen: Reader = (s, i) => {
  if (token(s, i) !== "produce_card_search_count" || s.counted) return null;
  s.counted = [];
  return 1;
};

/** Inside an open count, only the pieces above are allowed. */
const readInsideCount: Reader = (s, i) => (s.counted ? unknown(token(s, i)) : null);

/** A name followed by a range: a condition, whatever the name (C4). */
const readCondition: Reader = (s, i) => {
  const t = token(s, i);
  const range = RANGE.exec(token(s, i + 1));
  if (!range || !WORD.test(t)) return null;
  s.conditions.push({ kind: t, min: Number(range[1]), max: Number(range[2]) });
  s.inSearch = false;
  return 2;
};

/** `lesson_{stat}`, `lesson_{stat}_{kind}` or `lesson_{kind}`, outside a card search; a new kind is a new member (C12). */
const readLesson: Reader = (s, i) => {
  const t = token(s, i);
  if (s.inSearch || !t.startsWith(LESSON_PREFIX)) return null;
  const parts = t.slice(LESSON_PREFIX.length).split("_");
  const [first, second] = parts;
  const stat = first !== undefined && LESSON_STATS.has(first) ? first : undefined;
  const kind = stat === undefined ? first : second;
  if (parts.length > 2 || (stat === undefined && parts.length !== 1) || (kind !== undefined && !/^[a-z]+$/.test(kind))) return null;
  if (stat !== undefined) s.filters.push({ family: "lessonStat", member: stat });
  if (kind !== undefined) s.filters.push({ family: "lessonKind", member: kind });
  return 1;
};

/** A final `for_{token}`: the scenario the trigger is restricted to (C5); an unknown token is never assumed to mean 0. */
const readScenario: Reader = (s, i) => {
  const t = token(s, i);
  const forScenario = /^for_([a-z_]+)$/.exec(t);
  if (!forScenario || i !== s.tokens.length - 1) return null;
  const scenario = s.scenarioTokens[forScenario[1] ?? ""];
  if (scenario === undefined) return unknown(t);
  s.scenario = scenario;
  return 1;
};

/** In the order the pieces are tried; see the module comment for why the order matters. */
const READERS: readonly Reader[] = [readRange, readNoise, readSearchFilter, readEffectGroup, readCountOpen, readInsideCount, readCondition, readLesson, readScenario];

function readToken(s: State, i: number): number | Failure {
  for (const reader of READERS) {
    const read = reader(s, i);
    if (read !== null) return read;
  }
  return unknown(token(s, i));
}

export function parseTrigger(triggerId: string, phaseType: string, scenarioTokens: Readonly<Record<string, string>> = SCENARIO_TOKENS): ParseResult {
  const occasion = occasionOf(phaseType);
  const head = headOf(occasion);
  if (triggerId !== head && !triggerId.startsWith(`${head}-`)) return unknown(`${triggerId} does not start with ${head}`);
  const tokens = triggerId === head ? [] : triggerId.slice(head.length + 1).split("-");
  const s: State = { tokens, scenarioTokens, filters: [], conditions: [], counted: null, inSearch: false };

  let i = 0;
  while (i < tokens.length) {
    const read = readToken(s, i);
    if (typeof read !== "number") return read;
    i += read;
  }
  if (s.counted) return unknown("produce_card_search_count without a closing range");

  const trigger: ParsedTrigger = { occasion };
  if (s.filters.length > 0) trigger.filters = s.filters;
  if (s.conditions.length > 0) trigger.conditions = s.conditions;
  if (s.scenario !== undefined) trigger.scenario = s.scenario;
  return { kind: "parsed", trigger };
}

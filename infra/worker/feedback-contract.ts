/**
 * What the page's feedback form sends to `POST /feedback`, shared by the form (src/app/) and the
 * Worker (feedback.ts) so the two cannot disagree on a limit. No I/O, nothing Worker-specific:
 * importing it from the page adds only these constants to the bundle.
 */

/** Category key → Japanese title prefix. The key is also the issue label in tia-tools/feedback. */
export const FEEDBACK_CATEGORIES = { bug: "バグ", request: "要望", other: "その他" } as const;
export type FeedbackCategory = keyof typeof FEEDBACK_CATEGORIES;

/** Characters of the user's message, after trimming. */
export const FEEDBACK_MESSAGE_MAX = 4000;

/**
 * The page's query string at the time of sending (scenario, profile, filters, count overrides),
 * so a report can be reproduced by opening the same view. `URLSearchParams` percent-encodes
 * everything outside this set, so a real query string always matches, and nothing matching it
 * can break out of the Markdown link it is written into.
 */
export const FEEDBACK_VIEW_PATTERN = /^(\?[A-Za-z0-9._~%&=+*-]{1,2000})?$/;

/** The commit the page was built from (`git rev-parse --short=12 HEAD`), or "unknown". */
export const FEEDBACK_COMMIT_PATTERN = /^([0-9a-f]{7,40}|unknown)$/;

export interface FeedbackPayload {
  category: FeedbackCategory;
  message: string;
  /** "" when the page has no query string (the default view). */
  view: string;
  commit: string;
}

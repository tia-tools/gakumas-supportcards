/**
 * The feedback form's rules (first plan, Milestone 6 and decision D42): what is sent to
 * `POST /feedback` and how each answer is worded. Pure; `FeedbackForm.tsx` renders it and does
 * the fetch. The limits come from the contract the Worker checks against.
 */

import { FEEDBACK_MESSAGE_MAX, FEEDBACK_VIEW_PATTERN, type FeedbackCategory, type FeedbackPayload } from "../../infra/worker/feedback-contract.ts";

/**
 * The view to attach: the page's query string re-serialized the way `URLSearchParams` encodes
 * it, or "" for the default view and for a query too long to attach (it would be refused).
 */
export function viewToAttach(search: string): string {
  const query = new URLSearchParams(search).toString();
  const view = query === "" ? "" : `?${query}`;
  return FEEDBACK_VIEW_PATTERN.test(view) ? view : "";
}

/** Null when the message cannot be sent yet; the form keeps its button disabled. */
export function buildPayload(category: FeedbackCategory, message: string, search: string, commit: string): FeedbackPayload | null {
  const trimmed = message.trim();
  if (trimmed === "" || trimmed.length > FEEDBACK_MESSAGE_MAX) return null;
  return { category, message: trimmed, view: viewToAttach(search), commit };
}

/** What the form says after the Worker answered with `status` (0 = no answer at all). */
export function resultText(status: number): string {
  switch (status) {
    case 200:
      return "送信しました。ありがとうございます。";
    case 429:
      return "本日の送信回数の上限に達しました。明日もう一度お試しください。";
    case 400:
    case 413:
      return "内容を送信できませんでした。本文を短くしてもう一度お試しください。";
    case 0:
      return "送信できませんでした。通信状況を確認してもう一度お試しください。";
    default:
      return "送信できませんでした。時間をおいてもう一度お試しください。";
  }
}

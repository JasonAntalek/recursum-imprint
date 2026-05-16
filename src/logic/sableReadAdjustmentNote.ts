import type { SableReadAdjustmentNote } from "../types/imprint";

const readToneSignals = [
  "challenge",
  "direct",
  "gentle",
  "harsh",
  "language",
  "softer",
  "spiritual",
  "strong",
  "tone",
];

const readScopeSignals = [
  "business",
  "decision",
  "decisions",
  "family",
  "friction",
  "personal",
  "pressure",
  "relationship",
  "relationships",
  "work",
];

const operatingSignals = [
  ...readToneSignals,
  ...readScopeSignals,
  "avoid",
  "clear",
  "deadline",
  "deadlines",
  "do not",
  "don't",
  "help",
  "need",
  "prefer",
  "respond",
  "response",
  "use",
];

export function sableReadAdjustmentText(note?: SableReadAdjustmentNote) {
  const text = note?.text.trim();
  return text ? text : undefined;
}

export function sableReadAdjustmentKind(note?: SableReadAdjustmentNote) {
  const text = sableReadAdjustmentText(note)?.toLowerCase();

  if (!text) {
    return undefined;
  }

  if (readToneSignals.some((signal) => text.includes(signal))) {
    return "tone";
  }

  if (readScopeSignals.some((signal) => text.includes(signal))) {
    return "scope";
  }

  return "general";
}

export function sableReadAdjustmentShouldGuideRecursum(note?: SableReadAdjustmentNote) {
  const text = sableReadAdjustmentText(note)?.toLowerCase();

  if (!text) {
    return false;
  }

  return operatingSignals.some((signal) => text.includes(signal));
}

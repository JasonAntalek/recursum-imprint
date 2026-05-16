import type { FinalNoteIntent, FinalNoteToSable } from "../types/imprint";

const readyConfirmations = new Set([
  "ready",
  "nothing else",
  "no",
  "all set",
  "looks good",
  "continue",
  "ready.",
  "nothing else.",
]);

const instructionSignals = [
  "avoid",
  "change",
  "changes",
  "challenge",
  "clear",
  "context",
  "deadline",
  "deadlines",
  "direct",
  "do not",
  "don't",
  "energy",
  "focus",
  "help",
  "keep",
  "need",
  "needs",
  "pace",
  "please",
  "prefer",
  "priority",
  "remember",
  "respond",
  "response",
  "support",
  "transition",
  "work best",
];

export function inferFinalNoteIntent(text: string): FinalNoteIntent {
  return readyConfirmations.has(text.trim().toLowerCase())
    ? "ready_confirmation"
    : "additional_context";
}

export function createFinalNoteToSable(text: string): FinalNoteToSable {
  return {
    text,
    intent: inferFinalNoteIntent(text),
  };
}

export function hasFinalNoteText(finalNoteToSable: FinalNoteToSable) {
  return finalNoteToSable.text.trim().length > 0;
}

export function finalNoteAdditionalContext(finalNoteToSable?: FinalNoteToSable) {
  if (finalNoteToSable?.intent !== "additional_context") {
    return undefined;
  }

  const text = finalNoteToSable.text.trim();
  return text ? text : undefined;
}

export function finalNoteShouldGuideRecursum(finalNoteToSable?: FinalNoteToSable) {
  const context = finalNoteAdditionalContext(finalNoteToSable)?.toLowerCase();

  if (!context) {
    return false;
  }

  return instructionSignals.some((signal) => context.includes(signal));
}

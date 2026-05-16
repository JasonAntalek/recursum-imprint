import type {
  FinalNoteToSable,
  ImprintAnswers,
  SableReadAdjustmentNote,
} from "../types/imprint";
import type { SableRead } from "../types/sable";
import { finalNoteAdditionalContext } from "./finalNoteToSable";
import {
  sableReadAdjustmentKind,
  sableReadAdjustmentText,
} from "./sableReadAdjustmentNote";
import {
  cleanText,
  decisionInstruction,
  joinList,
  lowerFirst,
  punctuate,
  regulationInstruction,
  regulationPreferences,
  selectionSet,
  sentence,
} from "./imprintAnswerUtils";

function fallbackName(name?: string) {
  return name ?? "you";
}

function userSubject(name?: string) {
  return name ?? "You";
}

function userVerb(name: string | undefined, pluralVerb: string, singularVerb: string) {
  return name ? singularVerb : pluralVerb;
}

function closingLine(name: string | undefined, friction?: string, direction?: string) {
  if (friction && direction) {
    return `${userSubject(name)} ${userVerb(name, "do", "does")} not need more noise. ${userSubject(name)} ${userVerb(name, "need", "needs")} the next move that protects ${lowerFirst(direction)} without feeding ${lowerFirst(friction)}.`;
  }

  if (direction) {
    return `${userSubject(name)} ${userVerb(name, "move", "moves")} best when the task serves ${lowerFirst(direction)}, not when the room gets louder.`;
  }

  if (friction) {
    return `${userSubject(name)} ${userVerb(name, "do", "does")} not stall from lack of intelligence. Watch ${lowerFirst(friction)} and keep the next move clean.`;
  }

  return `${userSubject(name)} ${userVerb(name, "do", "does")} not need a grand label. ${userSubject(name)} ${userVerb(name, "need", "needs")} a useful starting pattern.`;
}

export function generateSableRead(
  answers: ImprintAnswers,
  finalNoteToSable?: FinalNoteToSable,
  sableReadAdjustmentNote?: SableReadAdjustmentNote,
): SableRead {
  const name = cleanText(answers["identity-name"]?.text);
  const descriptors = selectionSet(answers, "core-descriptors");
  const motivator = selectionSet(answers, "action-motivation");
  const friction = selectionSet(answers, "friction-points");
  const workWorld = selectionSet(answers, "work-income-world");
  const brand = selectionSet(answers, "public-identity");
  const leadership = selectionSet(answers, "leadership-collaboration-style");
  const fear = selectionSet(answers, "fear-resistance");
  const aliveness = selectionSet(answers, "alive-unstoppable");
  const decision = selectionSet(answers, "decision-lead");
  const boundaries = selectionSet(answers, "time-energy-boundaries");
  const regulation = boundaries.selected.filter((value) => regulationPreferences.has(value));
  const desiredAiUse = selectionSet(answers, "future-recursum-help");
  const responseStyle = selectionSet(answers, "response-style");
  const learning = selectionSet(answers, "learning-preference");
  const direction = selectionSet(answers, "long-term-direction");
  const fiveYearPicture = cleanText(answers["five-year-picture"]?.text);
  const subject = userSubject(name);
  const directName = fallbackName(name);
  const regulationMove = regulationInstruction(regulation);
  const decisionMove = decisionInstruction(decision.primary);
  const finalContext = finalNoteAdditionalContext(finalNoteToSable);
  const readAdjustment = sableReadAdjustmentText(sableReadAdjustmentNote);
  const readAdjustmentKind = sableReadAdjustmentKind(sableReadAdjustmentNote);

  const signal =
    sentence([
      descriptors.selected.length > 0
        ? `${subject} ${userVerb(name, "come", "comes")} through as ${joinList(descriptors.selected)}.`
        : undefined,
      motivator.primary
        ? `${subject} ${userVerb(name, "move", "moves")} when ${lowerFirst(motivator.primary)} is protected.`
        : undefined,
      aliveness.primary
        ? `Recursum should notice when ${lowerFirst(aliveness.primary)} starts creating momentum.`
        : undefined,
    ]) || "Enough signal is present for Recursum to stop beginning generically.";
  const pattern =
    sentence([
      workWorld.selected.length > 0
        ? `The current arena is ${joinList(workWorld.selected)}.`
        : undefined,
      brand.selected.length > 0
        ? `The public signal leans toward ${joinList(brand.selected)}.`
        : undefined,
      leadership.primary
        ? `In collaboration, ${directName} tends toward ${lowerFirst(leadership.primary)}.`
        : undefined,
      readAdjustment && readAdjustmentKind === "tone"
        ? `After seeing the read, adjust the delivery lens: ${punctuate(readAdjustment)}`
        : undefined,
      responseStyle.primary || learning.primary
        ? `Recursum should be ${[
            responseStyle.primary ? lowerFirst(responseStyle.primary) : undefined,
            learning.primary ? `clear through ${lowerFirst(learning.primary)}` : undefined,
          ]
            .filter(Boolean)
            .join(" and ")}.`
        : undefined,
    ]) ||
    "The useful pattern is still forming. Recursum should stay observant and avoid pretending the map is complete.";
  const edge =
    sentence([
      friction.primary
        ? `The stall point to watch is ${lowerFirst(friction.primary)}.`
        : undefined,
      fear.primary
        ? `Under pressure, ${lowerFirst(fear.primary)} can start driving the room.`
        : undefined,
      decision.primary
        ? `When decisions get murky, ${decisionMove ?? `support the ${lowerFirst(decision.primary)} pattern`}.`
        : undefined,
      regulationMove ? `When intensity rises, ${regulationMove}.` : undefined,
      readAdjustment && readAdjustmentKind === "scope"
        ? `Scope the card signal with this refinement: ${punctuate(readAdjustment)}`
        : undefined,
    ]) || "The edge is over-expanding the read before the user has given enough context. Keep it clean.";
  const bestUseOfRecursum =
    sentence([
      desiredAiUse.selected.length > 0
        ? `Use Recursum for ${joinList(desiredAiUse.selected.map(lowerFirst))}.`
        : undefined,
      responseStyle.primary
        ? `Ask for ${lowerFirst(responseStyle.primary)} before the work gets too broad.`
        : undefined,
      direction.primary
        ? `Let recommendations serve ${lowerFirst(direction.primary)}.`
        : undefined,
      fiveYearPicture ? `Keep the five-year picture in view: ${punctuate(fiveYearPicture)}` : undefined,
      finalContext ? `Carry this final note as live context: ${punctuate(finalContext)}` : undefined,
      readAdjustment && readAdjustmentKind === "general"
        ? `Carry this post-read refinement without rewriting the card signal: ${punctuate(readAdjustment)}`
        : undefined,
    ]) || "Use Recursum to turn the next real signal into a practical move.";

  return {
    title: "The Sable Read",
    signal,
    pattern,
    edge,
    bestUseOfRecursum,
    closingLine: closingLine(name, friction.primary, direction.primary),
  };
}

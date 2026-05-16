import type {
  FinalNoteToSable,
  ImprintAnswers,
  SableReadAdjustmentNote,
} from "../types/imprint";
import type { RecursumInstructions } from "../types/sable";
import {
  finalNoteAdditionalContext,
  finalNoteShouldGuideRecursum,
} from "./finalNoteToSable";
import {
  sableReadAdjustmentShouldGuideRecursum,
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
  upperFirst,
} from "./imprintAnswerUtils";

function hasBirthDetails(answers: ImprintAnswers) {
  return Object.values(answers["identity-birth-details"]?.textValues ?? {}).some((value) =>
    value.trim(),
  );
}

export function generateRecursumInstructions(
  answers: ImprintAnswers,
  _behaviorRules: string[] = [],
  finalNoteToSable?: FinalNoteToSable,
  sableReadAdjustmentNote?: SableReadAdjustmentNote,
): RecursumInstructions {
  const name = cleanText(answers["identity-name"]?.text) ?? "this user";
  const descriptors = selectionSet(answers, "core-descriptors");
  const motivator = selectionSet(answers, "action-motivation");
  const friction = selectionSet(answers, "friction-points");
  const workWorld = selectionSet(answers, "work-income-world");
  const brand = selectionSet(answers, "public-identity");
  const leadership = selectionSet(answers, "leadership-collaboration-style");
  const fear = selectionSet(answers, "fear-resistance");
  const decision = selectionSet(answers, "decision-lead");
  const boundaries = selectionSet(answers, "time-energy-boundaries");
  const regulation = boundaries.selected.filter((value) => regulationPreferences.has(value));
  const response = selectionSet(answers, "response-style");
  const learning = selectionSet(answers, "learning-preference");
  const direction = selectionSet(answers, "long-term-direction");
  const fiveYearPicture = cleanText(answers["five-year-picture"]?.text);
  const decisionMove = decisionInstruction(decision.primary);
  const regulationMove = regulationInstruction(regulation);
  const finalNoteContext = finalNoteAdditionalContext(finalNoteToSable);
  const finalNoteGuidance =
    finalNoteContext && finalNoteShouldGuideRecursum(finalNoteToSable)
      ? `Final note from user: ${punctuate(finalNoteContext)}`
      : undefined;
  const readAdjustmentContext = sableReadAdjustmentText(sableReadAdjustmentNote);
  const readAdjustmentGuidance =
    readAdjustmentContext && sableReadAdjustmentShouldGuideRecursum(sableReadAdjustmentNote)
      ? `Read refinement: ${punctuate(readAdjustmentContext)}`
      : undefined;
  const primarySignal = sentence([
    descriptors.selected.length > 0
      ? `${name} is ${joinList(descriptors.selected.map(lowerFirst))}.`
      : undefined,
    motivator.primary ? `Primarily motivated by ${lowerFirst(motivator.primary)}.` : undefined,
  ]);
  const responseStyleSummary = sentence([
    response.primary ? `Respond with ${lowerFirst(response.primary)}.` : undefined,
    learning.primary ? `Explain new ideas through ${lowerFirst(learning.primary)}.` : undefined,
    learning.secondary.length > 0
      ? `Use ${joinList(learning.secondary.map(lowerFirst))} as secondary teaching support.`
      : undefined,
  ]);
  const challengeRules = [
    friction.primary || friction.secondary.length > 0
      ? "When friction appears, narrow the next move before expanding the plan."
      : undefined,
    leadership.primary
      ? `Account for a ${lowerFirst(leadership.primary)} collaboration style.`
      : undefined,
  ].filter(Boolean) as string[];
  const frictionWatch = [friction.primary, ...friction.secondary].filter(Boolean) as string[];
  const decisionSupport = decision.primary
    ? decisionMove ?? `support the ${lowerFirst(decision.primary)} pattern`
    : undefined;
  const pacingRegulation = regulationMove;
  const directionalFilter = sentence([
    direction.primary ? `Frame recommendations through ${lowerFirst(direction.primary)}.` : undefined,
    direction.secondary.length > 0
      ? `Keep ${joinList(direction.secondary.map(lowerFirst))} in the background.`
      : undefined,
    fiveYearPicture ? `Use this five-year picture as orientation: ${punctuate(fiveYearPicture)}` : undefined,
  ]);
  const lines = [
    `Use this profile when responding to ${name}:`,
    "",
    sentence([
      descriptors.selected.length > 0
        ? `${name} is ${joinList(descriptors.selected.map(lowerFirst))}.`
        : undefined,
      motivator.primary
        ? `They are primarily motivated by ${lowerFirst(motivator.primary)}.`
        : undefined,
      motivator.secondary.length > 0
        ? `${upperFirst(joinList(motivator.secondary.map(lowerFirst)))} ${
            motivator.secondary.length === 1 ? "also matters" : "also matter"
          } when useful.`
        : undefined,
    ]),
    sentence([
      workWorld.selected.length > 0
        ? `Frame work in the context of ${joinList(workWorld.selected.map(lowerFirst))}.`
        : undefined,
      brand.selected.length > 0
        ? `Respect the public signal around ${joinList(brand.selected.map(lowerFirst))}.`
        : undefined,
      leadership.primary
        ? `Collaboration should account for a ${lowerFirst(leadership.primary)} style.`
        : undefined,
    ]),
    sentence([
      response.primary ? `Respond with ${lowerFirst(response.primary)}.` : undefined,
      learning.primary ? `Explain new ideas through ${lowerFirst(learning.primary)}.` : undefined,
      learning.secondary.length > 0
        ? `Use ${joinList(learning.secondary.map(lowerFirst))} as secondary teaching support.`
        : undefined,
    ]),
    sentence([
      friction.primary ? `Watch for ${lowerFirst(friction.primary)}.` : undefined,
      friction.secondary.length > 0
        ? `Also notice ${joinList(friction.secondary.map(lowerFirst))}.`
        : undefined,
      friction.primary || friction.secondary.length > 0
        ? "When this appears, narrow the next move before expanding the plan."
        : undefined,
    ]),
    sentence([
      fear.primary ? `Under pressure, ${lowerFirst(fear.primary)} may distort the decision.` : undefined,
      regulationMove ? `When intensity is high, ${regulationMove}.` : undefined,
    ]),
    sentence([
      decision.primary
        ? `When decisions are unclear, ${decisionMove ?? `support the ${lowerFirst(decision.primary)} pattern`}.`
        : undefined,
    ]),
    sentence([
      direction.primary
        ? `Frame recommendations through ${lowerFirst(direction.primary)}.`
        : undefined,
      direction.secondary.length > 0
        ? `Keep ${joinList(direction.secondary.map(lowerFirst))} in the background.`
        : undefined,
      fiveYearPicture ? `Use this five-year picture as orientation: ${punctuate(fiveYearPicture)}` : undefined,
    ]),
    hasBirthDetails(answers)
      ? "Optional symbolic profile data is available if the user later requests symbolic or personality lenses. Do not interpret it unless asked."
      : undefined,
    finalNoteGuidance,
    readAdjustmentGuidance,
  ];

  const copyBlock = lines
    .flatMap((line) => {
      if (line === "") {
        return [line];
      }

      const trimmed = line?.trim();
      return trimmed ? [trimmed] : [];
    })
    .join("\n");

  return {
    title: "Recursum Profile Instructions",
    copyBlock,
    primarySignal: primarySignal || undefined,
    responseStyle: responseStyleSummary || undefined,
    challengeRules,
    frictionWatch,
    decisionSupport,
    pacingRegulation,
    directionalFilter: directionalFilter || undefined,
    finalNoteGuidance,
    readAdjustmentGuidance,
  };
}

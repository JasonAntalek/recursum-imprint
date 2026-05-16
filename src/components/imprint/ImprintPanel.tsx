import type { ImprintAnswers, ImprintRoom } from "../../types/imprint";
import type { RecursumInstructions } from "../../types/sable";
import { getRoomMilestone } from "../../logic/recognitionLayer";
import { Clipboard, Download } from "lucide-react";
import { SablePresence } from "../sable/SablePresence";

interface ImprintPanelProps {
  answers: ImprintAnswers;
  calibrationStarted: boolean;
  currentRoomIndex: number;
  isFinalReview?: boolean;
  instructionMessage?: string;
  instructionStatus?: string;
  onCopyInstructions?: () => void;
  onDownloadInstructions?: () => void;
  recursumInstructions?: RecursumInstructions;
  statusOverride?: string;
  totalRooms: number;
  room: ImprintRoom;
}

interface RecursumInstructionsPanelProps {
  className?: string;
  instructionMessage?: string;
  instructionStatus?: string;
  onCopyInstructions?: () => void;
  onDownloadInstructions?: () => void;
  recursumInstructions?: RecursumInstructions;
}

function answerSummary(answers: ImprintAnswers, blockId: string) {
  const answer = answers[blockId];

  if (!answer) {
    return "calibrating";
  }

  const selected = answer.selected ?? [];
  const text = (answer.text ?? "").trim();
  const clarification = (answer.clarification ?? "").trim();
  const textValues = Object.values(answer.textValues ?? {}).filter((value) => value.trim());

  if (text) {
    return text;
  }

  if (textValues.length > 0) {
    return textValues.join(", ");
  }

  const displayValue = (value: string) =>
    value === "Other" && answer.otherClarification?.trim()
      ? answer.otherClarification.trim()
      : value;

  if (answer.primary) {
    const secondary = selected.filter((value) => value !== answer.primary).map(displayValue);
    const lines = [`Primary: ${displayValue(answer.primary)}`];

    if (secondary.length > 0) {
      lines.push(`Also present: ${secondary.join(", ")}`);
    }

    if (clarification) {
      lines.push(clarification);
    }

    return lines.join("\n");
  }

  const selectedText = selected.map(displayValue).join(", ");
  return selectedText
    ? [selectedText, clarification].filter(Boolean).join("\n")
    : "calibrating";
}

function hasTextValues(answers: ImprintAnswers, blockId: string) {
  return Object.values(answers[blockId]?.textValues ?? {}).some((value) => value.trim());
}

function optionalTextAddedSummary(answers: ImprintAnswers, blockId: string, label: string) {
  const text = answers[blockId]?.text?.trim();
  return text ? `${label}: Added` : "";
}

function relationshipSummary(answers: ImprintAnswers) {
  const answer = answers["identity-close-profile"];

  if (!answer || answer.selected.length === 0) {
    return "calibrating";
  }

  if (answer.selected.includes("No one to add now")) {
    return "None added now";
  }

  const refs = answer.conditionalClarifications ?? {};
  const lines = answer.selected.map((selected) => {
    if (selected === "Partner / spouse") {
      return `Partner / spouse: ${refs["partner-reference"]?.trim() || "selected"}`;
    }

    if (selected === "Children") {
      const reference = refs["children-reference"]?.trim() || "selected";
      const context = refs["children-context"]?.trim();
      return [`Children: ${reference}`, context ? `Context: ${context}` : ""]
        .filter(Boolean)
        .join("\n");
    }

    if (selected === "Parents") {
      return `Parents: ${refs["parents-context"]?.trim() || "selected"}`;
    }

    if (selected === "Close friends / chosen family") {
      return `Close friends / chosen family: ${refs["chosen-family-context"]?.trim() || "selected"}`;
    }

    if (selected === "Team / collaborators") {
      return `Team / collaborators: ${refs["team-context"]?.trim() || "selected"}`;
    }

    if (selected === "Other") {
      return `Other: ${answer.otherClarification?.trim() || refs["other-relationship-reference"]?.trim() || "selected"}`;
    }

    return selected;
  });

  return lines.join("\n");
}

function combinedSummary(answers: ImprintAnswers, blockIds: string[]) {
  const parts = blockIds
    .map((blockId) => answerSummary(answers, blockId))
    .filter((value) => value !== "calibrating");

  return parts.length > 0 ? parts.join(" / ") : "calibrating";
}

function labeledSummary(answers: ImprintAnswers, blockId: string, label: string) {
  const value = answerSummary(answers, blockId);
  return value === "calibrating" ? "" : `${label}: ${value}`;
}

const regulationPreferenceLabels = new Set([
  "I need quiet recovery",
  "I need movement or physical reset",
  "I need space before making decisions",
]);

function regulationSummary(answers: ImprintAnswers) {
  const answer = answers["time-energy-boundaries"];
  const selected = answer?.selected.filter((value) => regulationPreferenceLabels.has(value)) ?? [];
  return selected.length > 0 ? `Regulation: ${selected.join(", ")}` : "";
}

export function RecursumInstructionsPanel({
  className = "",
  instructionMessage,
  instructionStatus = "Ready to copy",
  onCopyInstructions,
  onDownloadInstructions,
  recursumInstructions,
}: RecursumInstructionsPanelProps) {
  return (
    <aside
      className={["imprint-panel", "recursum-instructions-panel", className].filter(Boolean).join(" ")}
      aria-label="Recursum Instructions"
    >
      <div className="telemetry-header">
        <span>RECURSUM INSTRUCTIONS</span>
        <div className="telemetry-progress">
          <strong>{instructionStatus}</strong>
          <small>Operating brief</small>
        </div>
      </div>
      <div className="meter">
        <span style={{ width: "100%" }} />
      </div>
      <div className="instruction-copy-block">
        <pre>{recursumInstructions?.copyBlock}</pre>
      </div>
      <div className="instruction-actions" aria-label="Recursum instruction actions">
        <button className="nav-button primary" onClick={onCopyInstructions} type="button">
          <Clipboard size={18} />
          Copy Recursum Instructions
        </button>
        <button className="nav-button secondary" onClick={onDownloadInstructions} type="button">
          <Download size={18} />
          Download Instructions
        </button>
      </div>
      {instructionMessage ? <p className="copy-status">{instructionMessage}</p> : null}
    </aside>
  );
}

export function ImprintPanel({
  answers,
  calibrationStarted,
  currentRoomIndex,
  instructionMessage,
  instructionStatus = "Ready to copy",
  isFinalReview = false,
  onCopyInstructions,
  onDownloadInstructions,
  recursumInstructions,
  statusOverride,
  totalRooms,
  room,
}: ImprintPanelProps) {
  const progress = Math.round(((currentRoomIndex + 1) / totalRooms) * 100);
  const calibrationStatus =
    statusOverride ?? (calibrationStarted ? "Initial Imprint forming" : "Calibration pending");
  const milestone = getRoomMilestone(room.id);
  const identityAnchor = [
    combinedSummary(answers, ["identity-name"]),
    hasTextValues(answers, "identity-birth-details") ? "Birth Details: Added" : "",
  ]
    .filter(Boolean)
    .join("\n");
  const pressurePattern = [
    combinedSummary(answers, ["fear-resistance", "time-energy-boundaries"]),
    regulationSummary(answers),
  ]
    .filter(Boolean)
    .join("\n");
  const workBrandContext = [
    combinedSummary(answers, ["work-income-world", "public-identity"]),
    labeledSummary(answers, "leadership-collaboration-style", "Leadership / Collaboration"),
  ]
    .filter(Boolean)
    .join("\n");
  const aiRelationship = [
    combinedSummary(answers, ["current-ai-use", "future-recursum-help", "response-style"]),
    labeledSummary(answers, "learning-preference", "Learning Preference"),
  ]
    .filter(Boolean)
    .join("\n");
  const directionSummary = [
    combinedSummary(answers, ["long-term-direction"]),
    optionalTextAddedSummary(answers, "five-year-picture", "Five-Year Picture"),
  ]
    .filter(Boolean)
    .join("\n");
  const signals = [
    { label: "Identity Anchor", value: identityAnchor },
    { label: "Relationship Anchors", value: relationshipSummary(answers) },
    { label: "Core Signal", value: combinedSummary(answers, ["core-descriptors"]) },
    { label: "Motivator", value: combinedSummary(answers, ["action-motivation"]) },
    { label: "Friction Pattern", value: combinedSummary(answers, ["friction-points"]) },
    {
      label: "Work / Brand Context",
      value: workBrandContext,
    },
    {
      label: "Pressure Pattern",
      value: pressurePattern,
    },
    {
      label: "AI Relationship",
      value: aiRelationship,
    },
    { label: "Direction", value: directionSummary },
  ];
  const renderSignalRows = () =>
    signals.map((signal) => {
      const [lead, ...details] = signal.value.split("\n").filter(Boolean);

      return (
        <div className="signal-row" key={signal.label}>
          <span>{signal.label}</span>
          <strong>{lead}</strong>
          {details.length > 0 ? <p className="signal-detail">{details.join("\n")}</p> : null}
        </div>
      );
    });

  if (isFinalReview) {
    return (
      <RecursumInstructionsPanel
        instructionMessage={instructionMessage}
        instructionStatus={instructionStatus}
        onCopyInstructions={onCopyInstructions}
        onDownloadInstructions={onDownloadInstructions}
        recursumInstructions={recursumInstructions}
      />
    );
  }

  return (
    <aside className="imprint-panel" aria-label="Initial Imprint calibration telemetry">
      <div className="telemetry-header">
        <span>{isFinalReview ? "ACTIVE PROFILE" : "INITIAL IMPRINT"}</span>
        <div className="telemetry-progress">
          <strong>{isFinalReview ? "Ready" : `${progress}%`}</strong>
          <small>{isFinalReview ? "Profile Instructions" : milestone}</small>
        </div>
      </div>
      <div className="meter">
        <span style={{ width: `${isFinalReview ? 100 : progress}%` }} />
      </div>
      <SablePresence
        className="imprint-sable-signal"
        message={calibrationStatus}
        statusLabel="IMPRINT SIGNAL"
        variant="compact"
      />
      <div className="telemetry-block">
        <span>Status</span>
        <strong>{calibrationStatus}</strong>
      </div>
      <div className="telemetry-block">
        <span>{isFinalReview ? "Output" : "Current room"}</span>
        <strong>{isFinalReview ? "Mini-Bio / Profile Instructions" : room.title}</strong>
      </div>
      <div className="signal-stack desktop-signal-stack">
        {renderSignalRows()}
      </div>
      <details className="mobile-imprint-drawer">
        <summary>
          <span>View Imprint</span>
          <strong>{calibrationStatus}</strong>
        </summary>
        <div className="signal-stack mobile-signal-stack">{renderSignalRows()}</div>
      </details>
    </aside>
  );
}

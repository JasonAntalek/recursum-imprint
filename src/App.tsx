import { ChevronLeft, ChevronRight, Clipboard, Download } from "lucide-react";
import { imprintRooms } from "./data/imprintRooms";
import { sampleImprintAnswers } from "./data/sampleImprintAnswers";
import { DevJumpButton } from "./components/dev/DevJumpButton";
import { AppShell } from "./components/layout/AppShell";
import { Header } from "./components/layout/Header";
import { ImprintPanel, RecursumInstructionsPanel } from "./components/imprint/ImprintPanel";
import { ProgressPath } from "./components/journey/ProgressPath";
import { isRoomComplete, RoomView } from "./components/journey/RoomView";
import { SablePresence } from "./components/sable/SablePresence";
import { exportImprintPayload } from "./logic/exportImprintPayload";
import { createFinalNoteToSable, hasFinalNoteText } from "./logic/finalNoteToSable";
import { generateBehaviorRules } from "./logic/generateBehaviorRules";
import { generateRecursumInstructions } from "./logic/generateRecursumInstructions";
import { generateSableRead } from "./logic/generateSableRead";
import { getImprintStageLabel, type ImprintFlowState } from "./logic/getImprintStageLabel";
import type {
  FinalNoteToSable,
  ImprintAnswer,
  ImprintAnswers,
  ImprintRoomId,
  SableReadAdjustmentNote,
} from "./types/imprint";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// TEMP DEV TOOL: remove or set false before public production use.
const SHOW_DEV_TOOLS = true;

const FINAL_NOTE_PLACEHOLDER = [
  "Ready.",
  "Nothing else.",
  "Please remember that I work best under clear deadlines.",
  "I\u2019m in transition right now, so context may change.",
].join("\n");

const READ_REFINEMENT_PLACEHOLDER =
  "Example: The friction pattern is right, but it shows up most in business decisions, not personal ones.";

const profileSections: Array<{ label: string; roomId: ImprintRoomId }> = [
  { label: "Identity Anchor", roomId: "identity" },
  { label: "Core Signal", roomId: "what-moves-you" },
  { label: "Friction Pattern", roomId: "what-moves-you" },
  { label: "Work / Brand Context", roomId: "what-you-are-building" },
  { label: "Pressure Pattern", roomId: "pressure" },
  { label: "AI Relationship", roomId: "recursum-meeting-style" },
  { label: "Direction", roomId: "direction-and-first-imprint" },
  { label: "Behavior Rules", roomId: "direction-and-first-imprint" },
];

type RoomMetricMap = Record<string, string>;

interface TestingMetrics {
  sessionStartedAt: string;
  roomStartedAt: RoomMetricMap;
  roomCompletedAt: RoomMetricMap;
  totalCompletionTime: number | null;
  roomsVisited: string[];
  editOneAreaClicked: boolean;
  payloadCopied: boolean;
}

function createInitialTestingMetrics(): TestingMetrics {
  const now = new Date().toISOString();
  const firstRoom = imprintRooms[0];

  return {
    sessionStartedAt: now,
    roomStartedAt: firstRoom ? { [firstRoom.id]: now } : {},
    roomCompletedAt: {},
    totalCompletionTime: null,
    roomsVisited: firstRoom ? [firstRoom.id] : [],
    editOneAreaClicked: false,
    payloadCopied: false,
  };
}

function createCompletedTestingMetrics(): TestingMetrics {
  const now = new Date().toISOString();
  const roomMetrics = Object.fromEntries(imprintRooms.map((room) => [room.id, now]));

  return {
    sessionStartedAt: now,
    roomStartedAt: roomMetrics,
    roomCompletedAt: roomMetrics,
    totalCompletionTime: 0,
    roomsVisited: imprintRooms.map((room) => room.id),
    editOneAreaClicked: false,
    payloadCopied: false,
  };
}

function formatDuration(milliseconds: number | null) {
  if (milliseconds === null) {
    return "Still in progress";
  }

  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

function copyTextWithDom(text: string) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  textArea.setSelectionRange(0, text.length);

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textArea);
  }
}

async function copyTextToClipboard(text: string) {
  if (copyTextWithDom(text)) {
    return true;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    return false;
  }

  return false;
}

function filenamePart(value?: string) {
  const cleaned = value
    ?.trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return cleaned || "user";
}

function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function formatSableReadMarkdown(sableRead: ReturnType<typeof generateSableRead>) {
  return [
    `# ${sableRead.title}`,
    "",
    `## The Signal`,
    sableRead.signal,
    "",
    `## The Pattern`,
    sableRead.pattern,
    "",
    `## The Edge`,
    sableRead.edge,
    "",
    `## Best Use of Recursum`,
    sableRead.bestUseOfRecursum,
    "",
    `## Sable's Closing Read`,
    sableRead.closingLine,
  ].join("\n");
}

function normalizeAnswerValue(answer: ImprintAnswer | undefined, value: string | undefined) {
  if (!value) {
    return undefined;
  }

  if (value === "Other") {
    return answer?.otherClarification?.trim() || undefined;
  }

  return value;
}

function primaryOrFirstAnswer(answers: ImprintAnswers, blockId: string) {
  const answer = answers[blockId];
  return normalizeAnswerValue(answer, answer?.primary ?? answer?.selected?.[0]);
}

const regulationPreferenceLabels = new Set([
  "I need quiet recovery",
  "I need movement or physical reset",
  "I need space before making decisions",
]);

function firstRegulationPreference(answers: ImprintAnswers) {
  const answer = answers["time-energy-boundaries"];
  const value = answer?.selected.find((selected) => regulationPreferenceLabels.has(selected));
  return normalizeAnswerValue(answer, value);
}

function regulationPhrase(value?: string) {
  if (!value) {
    return "";
  }

  if (value === "I need quiet recovery") {
    return "needing quiet recovery";
  }

  if (value === "I need movement or physical reset") {
    return "needing movement or physical reset";
  }

  if (value === "I need space before making decisions") {
    return "needing space before decisions";
  }

  return lowerFirst(value);
}

function sentenceJoin(parts: string[]) {
  if (parts.length <= 1) {
    return parts[0] ?? "";
  }

  if (parts.length === 2) {
    return `${parts[0]} and ${parts[1]}`;
  }

  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function lowerFirst(value: string) {
  return `${value.charAt(0).toLowerCase()}${value.slice(1)}`;
}

function recognitionSynopsis(answers: ImprintAnswers) {
  const motivator = primaryOrFirstAnswer(answers, "action-motivation");
  const friction = primaryOrFirstAnswer(answers, "friction-points");
  const workContext = primaryOrFirstAnswer(answers, "work-income-world");
  const leadership = primaryOrFirstAnswer(answers, "leadership-collaboration-style");
  const responseStyle = primaryOrFirstAnswer(answers, "response-style");
  const learningPreference = primaryOrFirstAnswer(answers, "learning-preference");
  const regulationPreference = firstRegulationPreference(answers);
  const fiveYearPicture = answers["five-year-picture"]?.text?.trim();
  const phrases = [
    motivator ? `moved by ${motivator}` : "",
    friction ? `slowed by ${friction}` : "",
    workContext ? `operating in ${workContext}` : "",
    leadership ? `collaborating through ${lowerFirst(leadership)}` : "",
    responseStyle ? `prefer support that feels ${lowerFirst(responseStyle)}` : "",
    learningPreference ? `learn through ${lowerFirst(learningPreference)}` : "",
    regulationPreference ? `regulate by ${regulationPhrase(regulationPreference)}` : "",
    fiveYearPicture ? "holding a five-year picture" : "",
  ]
    .filter(Boolean)
    .slice(0, 5);

  return phrases.length > 0
    ? `You are ${sentenceJoin(phrases)}.`
    : "Recursum has enough signal to begin with context.";
}

function beginningRules(behaviorRules: string[]) {
  const focusRules = behaviorRules.filter(
    (rule) => rule.startsWith("Hold focus on ") && !rule.includes("Threshold"),
  );
  const rules = focusRules.length >= 2 ? focusRules : behaviorRules;

  return rules.slice(0, 4);
}

function testingSnapshot(metrics: TestingMetrics) {
  return {
    sessionStartedAt: metrics.sessionStartedAt,
    roomStartedAt: metrics.roomStartedAt,
    roomCompletedAt: metrics.roomCompletedAt,
    totalCompletionTime: metrics.totalCompletionTime,
    totalCompletionTimeLabel: formatDuration(metrics.totalCompletionTime),
    roomsVisited: metrics.roomsVisited,
    roomsCompleted: Object.keys(metrics.roomCompletedAt),
    roomsCompletedCount: Object.keys(metrics.roomCompletedAt).length,
    editOneAreaClicked: metrics.editOneAreaClicked,
    payloadCopied: metrics.payloadCopied,
  };
}

function FinalNoteToSableView({
  finalNoteToSable,
  onBack,
  onGenerate,
  onTextChange,
}: {
  finalNoteToSable: FinalNoteToSable;
  onBack: () => void;
  onGenerate: () => void;
  onTextChange: (text: string) => void;
}) {
  const noteReady = hasFinalNoteText(finalNoteToSable);

  return (
    <section className="room-view final-note-view" aria-labelledby="final-note-title">
      <div className="panel-kicker">FINAL CONFIRMATION</div>
      <h2 id="final-note-title">Final Note to Sable</h2>
      <p className="final-note-helper">
        Last check. If the cards missed something important, put it here. If not, write{" "}
        &ldquo;Ready&rdquo; and I&rsquo;ll make the read.
      </p>
      <SablePresence
        message="This is the closing handoff. One last note, or a simple ready signal, then Sable can make the read."
        statusLabel={noteReady ? "READY FOR SABLE READ" : "FINAL NOTE NEEDED"}
        variant="room"
      />
      <article className="card-block final-note-panel">
        <div className="block-header">
          <div>
            <p className="block-prompt">Final Note to Sable</p>
            <span className="block-meta">Required handoff</span>
          </div>
          <span className={["required-chip", noteReady ? "is-complete" : ""].join(" ")}>
            {noteReady ? "Set" : "Required"}
          </span>
        </div>
        <textarea
          aria-label="Final Note to Sable"
          className="final-note-textarea"
          onChange={(event) => onTextChange(event.target.value)}
          placeholder={FINAL_NOTE_PLACEHOLDER}
          required
          rows={8}
          value={finalNoteToSable.text}
        />
      </article>
      <footer className="navigation-bar final-note-actions">
        <button className="nav-button secondary" onClick={onBack} type="button">
          <ChevronLeft size={18} />
          Back
        </button>
        <button
          className="nav-button primary"
          disabled={!noteReady}
          onClick={onGenerate}
          type="button"
        >
          Generate Sable Read
          <ChevronRight size={18} />
        </button>
      </footer>
    </section>
  );
}

function ReviewPlaceholder({
  answers,
  behaviorRules,
  finalNoteToSable,
  instructionMessage,
  instructionStatus,
  onCopyInstructions,
  onDownloadInstructions,
  onPayloadCopied,
  onCloseRecalibrate,
  onRecalibrateProfile,
  onSelectProfileSection,
  onUpdateSableRead,
  recalibrationMode,
  recursumInstructions,
  sableReadAdjustmentNote,
  stageSubtitle,
  testingMetrics,
}: {
  answers: ImprintAnswers;
  behaviorRules: string[];
  finalNoteToSable: FinalNoteToSable;
  instructionMessage?: string;
  instructionStatus?: string;
  onCopyInstructions: () => void;
  onDownloadInstructions: () => void;
  onPayloadCopied: () => void;
  onCloseRecalibrate: () => void;
  onRecalibrateProfile: () => void;
  onSelectProfileSection: (roomId: ImprintRoomId) => void;
  onUpdateSableRead: (text: string) => void;
  recalibrationMode: boolean;
  recursumInstructions: ReturnType<typeof generateRecursumInstructions>;
  sableReadAdjustmentNote?: SableReadAdjustmentNote;
  stageSubtitle: string;
  testingMetrics: TestingMetrics;
}) {
  const [copyStatus, setCopyStatus] = useState("");
  const [readRefinementStatus, setReadRefinementStatus] = useState("");
  const [readRefinementText, setReadRefinementText] = useState(
    sableReadAdjustmentNote?.text ?? "",
  );
  const [testingCopyStatus, setTestingCopyStatus] = useState("");
  const recalibrationPanelRef = useRef<HTMLDivElement>(null);
  const sableRead = useMemo(
    () => generateSableRead(answers, finalNoteToSable, sableReadAdjustmentNote),
    [answers, finalNoteToSable, sableReadAdjustmentNote],
  );
  const snapshot = useMemo(() => testingSnapshot(testingMetrics), [testingMetrics]);
  const testingJson = useMemo(() => JSON.stringify(snapshot, null, 2), [snapshot]);
  const payload = useMemo(
    () =>
      exportImprintPayload({
        answers,
        behaviorRules,
        finalNoteToSable,
        sableReadAdjustmentNote,
        profileStatus: "active",
        selectedRoute: null,
      }),
    [answers, behaviorRules, finalNoteToSable, sableReadAdjustmentNote],
  );
  const payloadJson = useMemo(() => JSON.stringify(payload, null, 2), [payload]);
  const nameSlug = filenamePart(answers["identity-name"]?.text);
  const hasSavedReadAdjustment = Boolean(sableReadAdjustmentNote?.text.trim());
  const canUpdateSableRead = readRefinementText.trim().length > 0 || hasSavedReadAdjustment;

  async function copyPayload() {
    if (await copyTextToClipboard(payloadJson)) {
      setCopyStatus("Payload copied.");
      onPayloadCopied();
      return;
    }

    setCopyStatus("Copy unavailable. You can manually select the payload.");
  }

  async function copyTestingSnapshot() {
    if (await copyTextToClipboard(testingJson)) {
      setTestingCopyStatus("Testing snapshot copied.");
      return;
    }

    setTestingCopyStatus("Copy unavailable. You can manually select the snapshot.");
  }

  function downloadSableRead() {
    downloadTextFile(`sable-read-${nameSlug}.md`, formatSableReadMarkdown(sableRead));
  }

  function updateSableRead() {
    if (!canUpdateSableRead) {
      return;
    }

    onUpdateSableRead(readRefinementText);
    setReadRefinementStatus("Sable Read updated.");
  }

  useEffect(() => {
    setReadRefinementText(sableReadAdjustmentNote?.text ?? "");
  }, [sableReadAdjustmentNote?.text]);

  useEffect(() => {
    if (!recalibrationMode) {
      return;
    }

    requestAnimationFrame(() => {
      recalibrationPanelRef.current?.scrollIntoView({
        block: "center",
        behavior: "smooth",
      });
    });

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        return;
      }

      if (
        recalibrationPanelRef.current?.contains(target) ||
        (target instanceof Element && target.closest(".recalibrate-profile-button"))
      ) {
        return;
      }

      onCloseRecalibrate();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onCloseRecalibrate, recalibrationMode]);

  return (
    <section className="room-view review-view" aria-labelledby="review-title">
      <div className="panel-kicker">ACTIVE IMPRINT</div>
      <h2 id="review-title">Your Sable Read</h2>
      <p className="final-subline">{stageSubtitle}</p>
      <SablePresence
        message="This is the profile reveal. Not a verdict. A clean read of the starting pattern Recursum should respect."
        statusLabel="ACTIVE PROFILE READY"
        variant="imprint"
      />
      <div className="sable-read-stack" aria-label="Sable Read">
        <section className="sable-read-section">
          <span>The Signal</span>
          <p>{sableRead.signal}</p>
        </section>
        <section className="sable-read-section">
          <span>The Pattern</span>
          <p>{sableRead.pattern}</p>
        </section>
        <section className="sable-read-section">
          <span>The Edge</span>
          <p>{sableRead.edge}</p>
        </section>
        <section className="sable-read-section">
          <span>Best Use of Recursum</span>
          <p>{sableRead.bestUseOfRecursum}</p>
        </section>
        <section className="sable-read-section">
          <span>Sable's Closing Read</span>
          <p>{sableRead.closingLine}</p>
        </section>
      </div>
      <details className="read-refinement-panel" open>
        <summary>Refine the Sable Read</summary>
        <p>Something off, missing, or too strong? Tell Sable what to adjust.</p>
        <textarea
          aria-label="Refine the Sable Read"
          className="read-refinement-textarea"
          onChange={(event) => {
            setReadRefinementText(event.target.value);
            setReadRefinementStatus("");
          }}
          placeholder={READ_REFINEMENT_PLACEHOLDER}
          rows={5}
          value={readRefinementText}
        />
        <div className="read-refinement-actions">
          <button
            className="nav-button primary"
            disabled={!canUpdateSableRead}
            onClick={updateSableRead}
            type="button"
          >
            Update Sable Read
          </button>
          {readRefinementStatus ? <span>{readRefinementStatus}</span> : null}
        </div>
      </details>
      <RecursumInstructionsPanel
        className="mobile-recursum-instructions-panel"
        instructionMessage={instructionMessage}
        instructionStatus={instructionStatus}
        onCopyInstructions={onCopyInstructions}
        onDownloadInstructions={onDownloadInstructions}
        recursumInstructions={recursumInstructions}
      />
      <div className="final-actions" aria-label="Profile output actions">
        <button
          className="nav-button secondary"
          onClick={downloadSableRead}
          type="button"
        >
          <Download size={18} />
          Download Sable Read
        </button>
        <button
          className="nav-button secondary recalibrate-profile-button"
          onClick={onRecalibrateProfile}
          type="button"
        >
          Recalibrate Profile
        </button>
      </div>
      {recalibrationMode ? (
        <div className="profile-recalibration-panel" ref={recalibrationPanelRef}>
          <SablePresence
            message="Good. Click the signal that needs cleaning. No need to reopen the whole hallway."
            statusLabel="RECALIBRATION ACTIVE"
            variant="compact"
          />
          <div className="profile-section-grid" aria-label="Profile sections">
            {profileSections.map((section) => (
              <button
                key={section.label}
                onClick={() => onSelectProfileSection(section.roomId)}
                type="button"
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      <details className="developer-payload-preview">
        <summary>Developer Payload Preview</summary>
        <div className="payload-toolbar">
          <button onClick={copyPayload} type="button">
            <Clipboard size={16} />
            Copy Payload
          </button>
          {copyStatus ? <span>{copyStatus}</span> : null}
        </div>
        <pre>{payloadJson}</pre>
      </details>
      <details className="developer-payload-preview testing-notes-snapshot">
        <summary>Testing Notes Snapshot</summary>
        <div className="testing-notes-grid" aria-label="Testing notes summary">
          <div>
            <span>Completion time</span>
            <strong>{snapshot.totalCompletionTimeLabel}</strong>
          </div>
          <div>
            <span>Rooms completed</span>
            <strong>{snapshot.roomsCompletedCount}</strong>
          </div>
          <div>
            <span>Recalibrated</span>
            <strong>{snapshot.editOneAreaClicked ? "Yes" : "No"}</strong>
          </div>
          <div>
            <span>Payload copied</span>
            <strong>{snapshot.payloadCopied ? "Yes" : "No"}</strong>
          </div>
        </div>
        <div className="payload-toolbar">
          <button onClick={copyTestingSnapshot} type="button">
            <Clipboard size={16} />
            Copy Testing Snapshot
          </button>
          {testingCopyStatus ? <span>{testingCopyStatus}</span> : null}
        </div>
        <pre>{testingJson}</pre>
      </details>
    </section>
  );
}

export default function App() {
  const journeyTopRef = useRef<HTMLDivElement>(null);
  const [currentRoomIndex, setCurrentRoomIndex] = useState(0);
  const [answers, setAnswers] = useState<ImprintAnswers>({});
  const [isCurrentRoomValid, setIsCurrentRoomValid] = useState(false);
  const [calibrationStarted, setCalibrationStarted] = useState(false);
  const [finalNoteVisible, setFinalNoteVisible] = useState(false);
  const [finalNoteToSable, setFinalNoteToSable] = useState(() => createFinalNoteToSable(""));
  const [sableReadAdjustmentNote, setSableReadAdjustmentNote] = useState<
    SableReadAdjustmentNote | undefined
  >(undefined);
  const [reviewVisible, setReviewVisible] = useState(false);
  const [sableReadGenerated, setSableReadGenerated] = useState(false);
  const [showThresholdPreview, setShowThresholdPreview] = useState(false);
  const [showMidpointRecognition, setShowMidpointRecognition] = useState(false);
  const [midpointRecognitionSeen, setMidpointRecognitionSeen] = useState(false);
  const [testingMetrics, setTestingMetrics] = useState(createInitialTestingMetrics);
  const [copyInstructionsStatus, setCopyInstructionsStatus] = useState("");
  const [profileInstructionsCopied, setProfileInstructionsCopied] = useState(false);
  const [profileInstructionsUpdated, setProfileInstructionsUpdated] = useState(false);
  const [recalibrationMode, setRecalibrationMode] = useState(false);
  const [returnToFinalAfterRoom, setReturnToFinalAfterRoom] = useState(false);
  const [completedRoomIds, setCompletedRoomIds] = useState<string[]>([]);
  const [devJumpProminent, setDevJumpProminent] = useState(false);
  const [furthestRoomIndexReached, setFurthestRoomIndexReached] = useState(0);
  const [returnRoomIndex, setReturnRoomIndex] = useState<number | null>(null);
  const [reopenMessage, setReopenMessage] = useState("");
  const currentRoom = imprintRooms[currentRoomIndex];
  const behaviorRules = useMemo(
    () => Array.from(new Set(imprintRooms.flatMap((room) => generateBehaviorRules(room)))),
    [],
  );
  const recursumInstructions = useMemo(
    () =>
      generateRecursumInstructions(
        answers,
        behaviorRules,
        finalNoteToSable,
        sableReadAdjustmentNote,
      ),
    [answers, behaviorRules, finalNoteToSable, sableReadAdjustmentNote],
  );
  const roomsCompleted = completedRoomIds.length === imprintRooms.length;
  const isInitialImprintComplete = roomsCompleted && sableReadGenerated;
  const isFinalNoteReady = hasFinalNoteText(finalNoteToSable);

  const canGoBack = currentRoomIndex > 0;
  const isFinalRoom = currentRoomIndex === imprintRooms.length - 1;
  const isCurrentRoomComplete = useMemo(
    () => isRoomComplete(currentRoom, answers),
    [answers, currentRoom],
  );
  const canApplyCurrentRoom = returnToFinalAfterRoom ? isCurrentRoomComplete : isCurrentRoomValid;

  useEffect(() => {
    if (!SHOW_DEV_TOOLS) {
      return;
    }

    function syncDevJumpVisibility() {
      setDevJumpProminent(window.scrollY > 160);
    }

    syncDevJumpVisibility();
    window.addEventListener("scroll", syncDevJumpVisibility, { passive: true });

    return () => {
      window.removeEventListener("scroll", syncDevJumpVisibility);
    };
  }, []);

  useEffect(() => {
    const scrollTarget = journeyTopRef.current;

    if (!scrollTarget) {
      return;
    }

    requestAnimationFrame(() => {
      scrollTarget.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }, [currentRoomIndex, finalNoteVisible, reviewVisible]);

  useEffect(() => {
    if (currentRoom.id === "pressure" && !midpointRecognitionSeen) {
      setShowMidpointRecognition(true);
      setMidpointRecognitionSeen(true);
    }
  }, [currentRoom.id, midpointRecognitionSeen]);

  useEffect(() => {
    const now = new Date().toISOString();

    setTestingMetrics((currentMetrics) => ({
      ...currentMetrics,
      roomStartedAt: currentMetrics.roomStartedAt[currentRoom.id]
        ? currentMetrics.roomStartedAt
        : {
            ...currentMetrics.roomStartedAt,
            [currentRoom.id]: now,
          },
      roomsVisited: currentMetrics.roomsVisited.includes(currentRoom.id)
        ? currentMetrics.roomsVisited
        : [...currentMetrics.roomsVisited, currentRoom.id],
    }));
  }, [currentRoom.id]);

  const handleAnswerChange = useCallback((blockId: string, answer: ImprintAnswer) => {
    setAnswers((currentAnswers) => ({
      ...currentAnswers,
      [blockId]: answer,
    }));
  }, []);

  function handleFinalNoteTextChange(text: string) {
    setFinalNoteToSable(createFinalNoteToSable(text));
  }

  function showFinalNoteToSable() {
    setFinalNoteVisible(true);
    setReviewVisible(false);
    setRecalibrationMode(false);
    setShowThresholdPreview(false);
    setShowMidpointRecognition(false);
    setIsCurrentRoomValid(false);
  }

  function handleGenerateSableRead() {
    if (!isFinalNoteReady) {
      return;
    }

    const completedAt = new Date().toISOString();
    const isRegenerating = sableReadGenerated || returnToFinalAfterRoom;

    setCompletedRoomIds(imprintRooms.map((room) => room.id));
    setTestingMetrics((currentMetrics) => ({
      ...currentMetrics,
      roomCompletedAt: {
        ...currentMetrics.roomCompletedAt,
        [currentRoom.id]: currentMetrics.roomCompletedAt[currentRoom.id] ?? completedAt,
      },
      totalCompletionTime:
        currentMetrics.totalCompletionTime ??
        Date.parse(completedAt) - Date.parse(currentMetrics.sessionStartedAt),
    }));
    setSableReadGenerated(true);
    setFinalNoteVisible(false);
    setReviewVisible(true);
    setRecalibrationMode(false);
    setReturnToFinalAfterRoom(false);
    setReturnRoomIndex(null);
    setReopenMessage("");
    setShowThresholdPreview(false);
    setShowMidpointRecognition(false);
    setIsCurrentRoomValid(false);
    setCopyInstructionsStatus("");
    setProfileInstructionsCopied(false);
    setProfileInstructionsUpdated(isRegenerating);
  }

  function handleUpdateSableReadAdjustment(text: string) {
    const trimmed = text.trim();

    setSableReadAdjustmentNote(
      trimmed
        ? {
            text,
            updatedAt: new Date().toISOString(),
          }
        : undefined,
    );
    setCopyInstructionsStatus("");
    setProfileInstructionsCopied(false);
    setProfileInstructionsUpdated(true);
  }

  function handleBack() {
    if (finalNoteVisible) {
      setFinalNoteVisible(false);
      return;
    }

    if (reviewVisible) {
      setReviewVisible(false);
      return;
    }

    if (returnToFinalAfterRoom) {
      setReturnToFinalAfterRoom(false);
      setReopenMessage("");
      setReviewVisible(true);
      return;
    }

    if (returnRoomIndex !== null) {
      setCurrentRoomIndex(returnRoomIndex);
      setReturnRoomIndex(null);
      setReopenMessage("");
      return;
    }

    setShowThresholdPreview(false);
    setIsCurrentRoomValid(false);
    setCurrentRoomIndex((index) => Math.max(0, index - 1));
  }

  function markRoomComplete(roomId: string, completedAt: string) {
    setTestingMetrics((currentMetrics) => ({
      ...currentMetrics,
      roomCompletedAt: {
        ...currentMetrics.roomCompletedAt,
        [roomId]: currentMetrics.roomCompletedAt[roomId] ?? completedAt,
      },
    }));
    setCompletedRoomIds((currentIds) =>
      currentIds.includes(roomId) ? currentIds : [...currentIds, roomId],
    );
  }

  function completeRecalibration() {
    const completedAt = new Date().toISOString();

    markRoomComplete(currentRoom.id, completedAt);
    setTestingMetrics((currentMetrics) => ({
      ...currentMetrics,
      roomCompletedAt: {
        ...currentMetrics.roomCompletedAt,
        [currentRoom.id]: currentMetrics.roomCompletedAt[currentRoom.id] ?? completedAt,
      },
    }));
    setProfileInstructionsUpdated(true);
    setProfileInstructionsCopied(false);
    setCopyInstructionsStatus("");
    setRecalibrationMode(false);
    setReturnToFinalAfterRoom(false);
    setReturnRoomIndex(null);
    setReopenMessage("");
    setShowThresholdPreview(false);
    setShowMidpointRecognition(false);
    setIsCurrentRoomValid(false);
    setReviewVisible(true);
  }

  function handleRecalibrationBack() {
    setShowThresholdPreview(false);
    setShowMidpointRecognition(false);
    setIsCurrentRoomValid(false);
    setCurrentRoomIndex((index) => Math.max(0, index - 1));
  }

  function handleRecalibrationNext() {
    if (!isCurrentRoomComplete) {
      return;
    }

    markRoomComplete(currentRoom.id, new Date().toISOString());
    setShowThresholdPreview(false);
    setShowMidpointRecognition(false);
    setIsCurrentRoomValid(false);
    setCurrentRoomIndex((index) => Math.min(imprintRooms.length - 1, index + 1));
  }

  function handleContinue() {
    if (!canApplyCurrentRoom) {
      return;
    }

    if (returnToFinalAfterRoom) {
      if (isFinalRoom) {
        markRoomComplete(currentRoom.id, new Date().toISOString());
        showFinalNoteToSable();
        return;
      }

      completeRecalibration();
      return;
    }

    const completedAt = new Date().toISOString();
    markRoomComplete(currentRoom.id, completedAt);

    if (returnRoomIndex !== null) {
      setCurrentRoomIndex(returnRoomIndex);
      setReturnRoomIndex(null);
      setReopenMessage("");
      return;
    }

    if (isFinalRoom) {
      setTestingMetrics((currentMetrics) => ({
        ...currentMetrics,
        roomCompletedAt: {
          ...currentMetrics.roomCompletedAt,
          [currentRoom.id]: currentMetrics.roomCompletedAt[currentRoom.id] ?? completedAt,
        },
      }));
      setCompletedRoomIds(imprintRooms.map((room) => room.id));
      setFurthestRoomIndexReached(imprintRooms.length - 1);
      showFinalNoteToSable();
      return;
    }

    if (currentRoom.id === "threshold") {
      setCalibrationStarted(true);
      setShowThresholdPreview(false);
    }

    setIsCurrentRoomValid(false);
    setCurrentRoomIndex((index) => {
      const nextIndex = Math.min(imprintRooms.length - 1, index + 1);
      setFurthestRoomIndexReached((currentFurthest) => Math.max(currentFurthest, nextIndex));
      return nextIndex;
    });
  }

  function beginThresholdCalibration() {
    markRoomComplete("threshold", new Date().toISOString());
    setCalibrationStarted(true);
    setShowThresholdPreview(false);
    setIsCurrentRoomValid(false);
    setFurthestRoomIndexReached((currentFurthest) => Math.max(currentFurthest, 1));
    setCurrentRoomIndex(1);
  }

  async function handleCopyInstructions(instructions: string) {
    if (await copyTextToClipboard(instructions)) {
      setCopyInstructionsStatus("Copied. Recursum Instructions ready to paste.");
      setProfileInstructionsCopied(true);
      setTestingMetrics((currentMetrics) => ({
        ...currentMetrics,
        payloadCopied: true,
      }));
      return;
    }

    setCopyInstructionsStatus("Copy unavailable. You can manually select the text.");
  }

  function handleDownloadInstructions() {
    downloadTextFile(
      `recursum-instructions-${filenamePart(answers["identity-name"]?.text)}.md`,
      recursumInstructions.copyBlock,
    );
  }

  function handleRecalibrateProfile() {
    setRecalibrationMode((isOpen) => !isOpen);
    setTestingMetrics((currentMetrics) => ({
      ...currentMetrics,
      editOneAreaClicked: true,
    }));
  }

  function handleSelectProfileSection(roomId: ImprintRoomId) {
    const roomIndex = imprintRooms.findIndex((room) => room.id === roomId);

    if (roomIndex < 0) {
      return;
    }

    setCurrentRoomIndex(roomIndex);
    setReturnToFinalAfterRoom(true);
    setRecalibrationMode(false);
    setFinalNoteVisible(false);
    setReviewVisible(false);
    setShowThresholdPreview(false);
    setShowMidpointRecognition(false);
    setIsCurrentRoomValid(false);
    setReopenMessage("Recalibration active. Clean the signal. No need to reopen the whole hallway.");
  }

  function handleActiveImprintSelect() {
    if (!isInitialImprintComplete) {
      return;
    }

    if (returnToFinalAfterRoom) {
      if (!isCurrentRoomComplete) {
        return;
      }

      if (isFinalRoom) {
        markRoomComplete(currentRoom.id, new Date().toISOString());
        showFinalNoteToSable();
        return;
      }

      completeRecalibration();
      return;
    }

    setReviewVisible(true);
    setFinalNoteVisible(false);
    setRecalibrationMode(false);
    setReturnToFinalAfterRoom(false);
    setReturnRoomIndex(null);
    setReopenMessage("");
    setShowThresholdPreview(false);
    setShowMidpointRecognition(false);
    setIsCurrentRoomValid(false);
  }

  function handleDevJumpToCompletedImprint() {
    setAnswers(sampleImprintAnswers);
    setFinalNoteToSable(createFinalNoteToSable("Ready"));
    setSableReadAdjustmentNote(undefined);
    setCurrentRoomIndex(imprintRooms.length - 1);
    setIsCurrentRoomValid(true);
    setCalibrationStarted(true);
    setFinalNoteVisible(false);
    setReviewVisible(true);
    setSableReadGenerated(true);
    setShowThresholdPreview(false);
    setShowMidpointRecognition(false);
    setMidpointRecognitionSeen(true);
    setTestingMetrics(createCompletedTestingMetrics());
    setCompletedRoomIds(imprintRooms.map((room) => room.id));
    setFurthestRoomIndexReached(imprintRooms.length - 1);
    setReturnRoomIndex(null);
    setReopenMessage("");
    setCopyInstructionsStatus("");
    setProfileInstructionsCopied(false);
    setProfileInstructionsUpdated(false);
    setRecalibrationMode(false);
    setReturnToFinalAfterRoom(false);
  }

  function handleProgressRoomSelect(roomIndex: number) {
    const room = imprintRooms[roomIndex];

    if (!room || !completedRoomIds.includes(room.id)) {
      return;
    }

    if (reviewVisible || isInitialImprintComplete) {
      setReturnToFinalAfterRoom(true);
      setReopenMessage("Recalibration active. Clean the signal. No need to reopen the whole hallway.");
    } else if (roomIndex < furthestRoomIndexReached) {
      setReturnRoomIndex(furthestRoomIndexReached);
      setReopenMessage("Signal reopened. Adjust what changed. The rest stays intact.");
    } else {
      setReturnRoomIndex(null);
      setReopenMessage("");
    }

    setCurrentRoomIndex(roomIndex);
    setFinalNoteVisible(false);
    setReviewVisible(false);
    setRecalibrationMode(false);
    setShowThresholdPreview(false);
    setShowMidpointRecognition(false);
    setIsCurrentRoomValid(false);
  }

  const panelStatus = finalNoteVisible
    ? isFinalNoteReady
      ? "Ready for Sable Read"
      : "Final Note Needed"
    : reviewVisible
      ? recalibrationMode
        ? "Recalibration active"
        : profileInstructionsCopied
          ? "Copied"
          : profileInstructionsUpdated
            ? "Updated"
            : "Ready to copy"
      : returnToFinalAfterRoom
        ? "Recalibration active"
        : undefined;
  const instructionStatus = profileInstructionsCopied
    ? "Copied"
    : profileInstructionsUpdated
      ? "Updated"
      : "Ready to copy";
  const flowState: ImprintFlowState = finalNoteVisible
    ? "final_confirmation"
    : reviewVisible
      ? "completed"
      : calibrationStarted
        ? "in_progress"
        : "not_started";
  const stageLabel = getImprintStageLabel({
    activeProfileStatus: profileInstructionsUpdated ? "updated" : "ready",
    flowState,
    isInitialImprintComplete,
    isRecalibrationMode: !finalNoteVisible && (recalibrationMode || returnToFinalAfterRoom),
  });

  return (
    <AppShell>
      {SHOW_DEV_TOOLS ? (
        <DevJumpButton
          isProminent={devJumpProminent}
          onClick={handleDevJumpToCompletedImprint}
        />
      ) : null}
      <Header subtitle={stageLabel.subtitle} title={stageLabel.title} />
      <ProgressPath
        completedRoomIds={completedRoomIds}
        currentRoomIndex={currentRoomIndex}
        isFinalConfirmation={finalNoteVisible}
        isFinalReview={reviewVisible}
        isInitialImprintComplete={isInitialImprintComplete}
        isRecalibrating={returnToFinalAfterRoom}
        onActiveImprintSelect={handleActiveImprintSelect}
        onRoomSelect={handleProgressRoomSelect}
        rooms={imprintRooms}
      />
      <div className="journey-top-anchor" ref={journeyTopRef} />

      <div className={["workspace-grid", reviewVisible ? "is-final-review" : ""].join(" ")}>
        <div className="journey-content">
          {reviewVisible ? (
            <ReviewPlaceholder
              answers={answers}
              behaviorRules={behaviorRules}
              finalNoteToSable={finalNoteToSable}
              instructionMessage={copyInstructionsStatus}
              instructionStatus={instructionStatus}
              onCloseRecalibrate={() => setRecalibrationMode(false)}
              onCopyInstructions={() => handleCopyInstructions(recursumInstructions.copyBlock)}
              onDownloadInstructions={handleDownloadInstructions}
              onPayloadCopied={() =>
                setTestingMetrics((currentMetrics) => ({
                  ...currentMetrics,
                  payloadCopied: true,
                }))
              }
              onRecalibrateProfile={handleRecalibrateProfile}
              onSelectProfileSection={handleSelectProfileSection}
              onUpdateSableRead={handleUpdateSableReadAdjustment}
              recalibrationMode={recalibrationMode}
              recursumInstructions={recursumInstructions}
              sableReadAdjustmentNote={sableReadAdjustmentNote}
              stageSubtitle={stageLabel.subtitle}
              testingMetrics={testingMetrics}
            />
          ) : finalNoteVisible ? (
            <FinalNoteToSableView
              finalNoteToSable={finalNoteToSable}
              onBack={handleBack}
              onGenerate={handleGenerateSableRead}
              onTextChange={handleFinalNoteTextChange}
            />
          ) : (
            <>
              <RoomView
                answers={answers}
                calibrationStarted={calibrationStarted}
                onAnswerChange={handleAnswerChange}
                onBeginThresholdCalibration={beginThresholdCalibration}
                onDismissMidpointRecognition={() => setShowMidpointRecognition(false)}
                onOpenThresholdPreview={() => setShowThresholdPreview(true)}
                onValidityChange={setIsCurrentRoomValid}
                reopenMessage={reopenMessage}
                room={currentRoom}
                showMidpointRecognition={showMidpointRecognition && currentRoom.id === "pressure"}
                showThresholdPreview={showThresholdPreview}
              />
              <footer className="navigation-bar">
                {returnToFinalAfterRoom ? (
                  <>
                    <button
                      className="nav-button secondary"
                      disabled={currentRoomIndex === 0}
                      onClick={handleRecalibrationBack}
                      type="button"
                    >
                      <ChevronLeft size={18} />
                      Back
                    </button>
                    <button
                      className="nav-button secondary"
                      disabled={!isCurrentRoomComplete || currentRoomIndex === imprintRooms.length - 1}
                      onClick={handleRecalibrationNext}
                      type="button"
                    >
                      Next
                      <ChevronRight size={18} />
                    </button>
                    <button
                      className="nav-button primary"
                      disabled={!canApplyCurrentRoom}
                      onClick={handleContinue}
                      type="button"
                    >
                      Update Imprint
                      <ChevronRight size={18} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="nav-button secondary"
                      disabled={!canGoBack}
                      onClick={handleBack}
                      type="button"
                    >
                      <ChevronLeft size={18} />
                      Back
                    </button>
                    <button
                      className="nav-button primary"
                      disabled={!canApplyCurrentRoom}
                      onClick={handleContinue}
                      type="button"
                    >
                      Continue
                      <ChevronRight size={18} />
                    </button>
                  </>
                )}
              </footer>
            </>
          )}
        </div>
        <ImprintPanel
          answers={answers}
          calibrationStarted={calibrationStarted}
          room={currentRoom}
          currentRoomIndex={currentRoomIndex}
          instructionMessage={copyInstructionsStatus}
          instructionStatus={instructionStatus}
          isFinalReview={reviewVisible}
          onCopyInstructions={() => handleCopyInstructions(recursumInstructions.copyBlock)}
          onDownloadInstructions={handleDownloadInstructions}
          recursumInstructions={recursumInstructions}
          statusOverride={panelStatus}
          totalRooms={imprintRooms.length}
        />
      </div>
    </AppShell>
  );
}

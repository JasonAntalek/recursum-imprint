import { useEffect, useMemo } from "react";
import type { CardBlock, ImprintAnswer, ImprintAnswers, ImprintRoom } from "../../types/imprint";
import { CardSelector } from "../cards/CardSelector";
import { SablePresence } from "../sable/SablePresence";
import { SableReadout } from "../sable/SableReadout";

interface RoomViewProps {
  room: ImprintRoom;
  answers: ImprintAnswers;
  calibrationStarted: boolean;
  onAnswerChange: (blockId: string, answer: ImprintAnswer) => void;
  onBeginThresholdCalibration: () => void;
  onOpenThresholdPreview: () => void;
  onValidityChange: (isValid: boolean) => void;
  onDismissMidpointRecognition: () => void;
  reopenMessage?: string;
  showThresholdPreview: boolean;
  showMidpointRecognition: boolean;
}

function hasAnswer(block: CardBlock, answer?: ImprintAnswer) {
  if (!answer) {
    return !block.required;
  }

  if (block.mode === "text") {
    return !block.required || (answer.text ?? "").trim().length > 0;
  }

  if (block.id === "threshold-readiness") {
    return answer.selected.includes("Begin Calibration");
  }

  if (block.required && answer.selected.length === 0) {
    return false;
  }

  if (block.primaryRequired && answer.selected.length > 1 && !answer.primary) {
    return false;
  }

  if (block.clarificationRequired && !(answer.clarification ?? "").trim()) {
    return false;
  }

  if (answer.selected.includes("Other") && !(answer.otherClarification ?? "").trim()) {
    return false;
  }

  const conditionalClarifications = answer.conditionalClarifications ?? {};
  const requiredConditionalRules = answer.selected.flatMap((selected) =>
    selected === "Other"
      ? []
      : (block.conditionalClarifications?.[selected] ?? []).filter((rule) => rule.required),
  );

  return requiredConditionalRules.every((rule) => conditionalClarifications[rule.id]?.trim());
}

export function isRoomComplete(room: ImprintRoom, answers: ImprintAnswers) {
  return room.blocks.every((block) => hasAnswer(block, answers[block.id]));
}

function ThresholdPreview({ onBegin }: { onBegin: () => void }) {
  return (
    <aside className="threshold-preview" aria-label="What this creates">
      <span>Calibration preview</span>
      <h3>What this creates</h3>
      <p>
        Your Initial Imprint creates an Active Profile Recursum can use to shape future responses.
        It helps Recursum understand how to address you, what motivates you, what can slow you down,
        how you work under pressure, and how you prefer AI to respond.
      </p>
      <ul>
        <li>How Recursum addresses you</li>
        <li>What motivates you</li>
        <li>What can slow you down</li>
        <li>What context your work lives in</li>
        <li>How you tend to decide under pressure</li>
        <li>How direct, warm, structured, or challenging Recursum should be</li>
        <li>What direction future support should serve</li>
      </ul>
      <p>
        This is not meant to define you permanently. It creates a useful starting profile that can
        be refined later.
      </p>
      <button className="preview-action" onClick={onBegin} type="button">
        Begin Calibration
      </button>
    </aside>
  );
}

function MidpointRecognition({ onDismiss }: { onDismiss: () => void }) {
  return (
    <aside className="midpoint-recognition" aria-label="Sable recognition">
      <p>
        A shape is forming now. Not a label. A working pattern. Recursum is starting to see what
        moves you, what complicates movement, and what kind of support will not insult your
        intelligence.
      </p>
      <button onClick={onDismiss} type="button">
        Dismiss
      </button>
    </aside>
  );
}

export function RoomView({
  room,
  answers,
  calibrationStarted,
  onAnswerChange,
  onBeginThresholdCalibration,
  onDismissMidpointRecognition,
  onOpenThresholdPreview,
  onValidityChange,
  reopenMessage,
  showMidpointRecognition,
  showThresholdPreview,
}: RoomViewProps) {
  const isValid = useMemo(() => isRoomComplete(room, answers), [answers, room]);
  const isThreshold = room.id === "threshold";
  const thresholdReadout = showThresholdPreview
    ? "Preview open. The Active Profile shows what Recursum will learn from this calibration."
    : calibrationStarted
      ? "Calibration started. Recursum is now forming the Active Profile."
      : room.sableReadout;

  useEffect(() => {
    onValidityChange(isValid);
  }, [isValid, onValidityChange]);

  return (
    <section className="room-view" aria-labelledby="room-title">
      <div className="panel-kicker">{room.eyebrow}</div>
      <h2 id="room-title">{room.title}</h2>
      <SablePresence
        message={room.sableFrame}
        statusLabel={room.id === "threshold" ? "SABLE ONLINE" : "GUIDE SIGNAL"}
        variant={room.id === "threshold" ? "threshold" : "room"}
      />

      {reopenMessage ? (
        <aside className="reopen-recognition" aria-label="Sable recalibration note">
          {reopenMessage}
        </aside>
      ) : null}

      {showMidpointRecognition ? (
        <MidpointRecognition onDismiss={onDismissMidpointRecognition} />
      ) : null}

      <div className="block-stack">
        {room.blocks.map((block) => {
          const answer = answers[block.id];
          const complete = hasAnswer(block, answer);
          const isVisibleOptionalDrawer = block.id === "identity-birth-details";

          return (
            <article className="card-block" key={block.id}>
              <div className="block-header">
                <div>
                  <p className="block-prompt">{block.prompt}</p>
                  {block.maxSelections ? (
                    <span className="block-meta">Choose up to {block.maxSelections}</span>
                  ) : null}
                </div>
                <span className={["required-chip", complete ? "is-complete" : ""].join(" ")}>
                  {block.required ? (complete ? "Set" : "Required") : "Optional"}
                </span>
              </div>

              {block.drawer && isVisibleOptionalDrawer ? (
                <div className="block-drawer block-drawer-open">
                  <p>{block.drawer.body}</p>
                  <CardSelector
                    answer={answer}
                    block={block}
                    onChange={(nextAnswer) => {
                      onAnswerChange(block.id, nextAnswer);
                    }}
                  />
                </div>
              ) : block.drawer ? (
                <details className="block-drawer">
                  <summary>{block.drawer.title}</summary>
                  <p>{block.drawer.body}</p>
                  <CardSelector
                    answer={answer}
                    block={block}
                    onChange={(nextAnswer) => {
                      onAnswerChange(block.id, nextAnswer);
                    }}
                  />
                </details>
              ) : (
                <CardSelector
                  answer={answer}
                  block={block}
                  onChange={(nextAnswer) => {
                    onAnswerChange(block.id, nextAnswer);

                    if (block.id !== "threshold-readiness") {
                      return;
                    }

                    if (nextAnswer.selected.includes("Show me what this creates")) {
                      onOpenThresholdPreview();
                    }

                    if (nextAnswer.selected.includes("Begin Calibration")) {
                      onBeginThresholdCalibration();
                    }
                  }}
                />
              )}
            </article>
          );
        })}
      </div>

      {showThresholdPreview ? (
        <ThresholdPreview
          onBegin={() => {
            onAnswerChange("threshold-readiness", {
              selected: ["Begin Calibration"],
              clarification: "",
              conditionalClarifications: {},
              otherClarification: "",
              text: "",
            });
            onBeginThresholdCalibration();
          }}
        />
      ) : null}

      {isThreshold || isValid ? <SableReadout text={isThreshold ? thresholdReadout : room.sableReadout} /> : null}
    </section>
  );
}

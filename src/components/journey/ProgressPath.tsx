import type { ImprintRoom } from "../../types/imprint";

type ProgressRoomState = "locked" | "active" | "calibrated";

interface ProgressPathProps {
  rooms: ImprintRoom[];
  currentRoomIndex: number;
  completedRoomIds: string[];
  isInitialImprintComplete: boolean;
  isFinalReview?: boolean;
  isFinalConfirmation?: boolean;
  isRecalibrating?: boolean;
  onActiveImprintSelect: () => void;
  onRoomSelect: (roomIndex: number) => void;
}

function roomState(
  room: ImprintRoom,
  index: number,
  currentRoomIndex: number,
  completedRoomIds: string[],
  isFinalReview: boolean,
): ProgressRoomState {
  if (!isFinalReview && index === currentRoomIndex) {
    return "active";
  }

  if (completedRoomIds.includes(room.id)) {
    return "calibrated";
  }

  return "locked";
}

const stateLabels: Record<ProgressRoomState, string> = {
  locked: "Pending",
  active: "Calibrating",
  calibrated: "Calibrated",
};

export function ProgressPath({
  rooms,
  currentRoomIndex,
  completedRoomIds,
  isFinalConfirmation = false,
  isInitialImprintComplete,
  isFinalReview = false,
  isRecalibrating = false,
  onActiveImprintSelect,
  onRoomSelect,
}: ProgressPathProps) {
  const totalSteps = rooms.length + 1;
  const activeStep = isFinalReview ? totalSteps : currentRoomIndex + 1;
  const activeRoom = rooms[currentRoomIndex];
  const currentTitle = isFinalReview
    ? "Active Imprint"
    : isFinalConfirmation
      ? "Final Note to Sable"
      : activeRoom?.title;
  const currentState = isFinalReview
    ? "Active"
    : isRecalibrating
      ? "Recalibrating"
      : isFinalConfirmation
        ? "Ready for Sable Read"
        : activeRoom && completedRoomIds.includes(activeRoom.id)
          ? "Calibrated"
          : "Calibrating";

  return (
    <nav
      className={["progress-path", isInitialImprintComplete ? "has-active-imprint" : ""].join(" ")}
      aria-label="Imprint calibration rooms"
    >
      <div className="progress-mobile-summary" aria-label="Current Imprint step">
        <span>
          {String(activeStep).padStart(2, "0")} / {String(totalSteps).padStart(2, "0")}
        </span>
        <strong>{currentTitle}</strong>
        <em>{currentState}</em>
      </div>
      <div className="progress-scroll-row">
        {rooms.map((room, index) => {
          const state = roomState(room, index, currentRoomIndex, completedRoomIds, isFinalReview);
          const isClickable = state === "calibrated";

          return (
            <button
              className={[
                "path-node",
                `is-${state}`,
                isClickable ? "is-clickable" : "",
              ].join(" ")}
              disabled={!isClickable}
              key={room.id}
              onClick={() => onRoomSelect(index)}
              type="button"
            >
              <span className="node-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="node-title">{room.title}</span>
              <span className="node-state">
                {state === "active" && isRecalibrating ? "Recalibrating" : stateLabels[state]}
              </span>
            </button>
          );
        })}
        {isInitialImprintComplete ? (
          <button
            className={[
              "path-node",
              "active-imprint-node",
              isFinalReview ? "is-active-imprint" : "is-calibrated",
            ].join(" ")}
            onClick={onActiveImprintSelect}
            type="button"
          >
            <span className="node-index">{String(totalSteps).padStart(2, "0")}</span>
            <span className="node-title">Active Imprint</span>
            <span className="node-state">Active</span>
          </button>
        ) : null}
      </div>
    </nav>
  );
}

import type { ImprintRoom } from "../../types/imprint";

type ProgressRoomState = "locked" | "active" | "calibrated";

interface ProgressPathProps {
  rooms: ImprintRoom[];
  currentRoomIndex: number;
  completedRoomIds: string[];
  isInitialImprintComplete: boolean;
  isFinalReview?: boolean;
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
  isInitialImprintComplete,
  isFinalReview = false,
  isRecalibrating = false,
  onActiveImprintSelect,
  onRoomSelect,
}: ProgressPathProps) {
  return (
    <nav
      className={["progress-path", isInitialImprintComplete ? "has-active-imprint" : ""].join(" ")}
      aria-label="Imprint calibration rooms"
    >
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
          <span className="node-index">08</span>
          <span className="node-title">Active Imprint</span>
          <span className="node-state">Active</span>
        </button>
      ) : null}
    </nav>
  );
}

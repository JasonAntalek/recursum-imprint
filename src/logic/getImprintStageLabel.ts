export type ImprintFlowState =
  | "not_started"
  | "in_progress"
  | "final_confirmation"
  | "completed"
  | "reviewing";
export type ActiveProfileStatus = "ready" | "updated";

interface GetImprintStageLabelArgs {
  flowState: ImprintFlowState;
  activeProfileStatus?: ActiveProfileStatus;
  isInitialImprintComplete: boolean;
  isRecalibrationMode: boolean;
}

export function getImprintStageLabel({
  activeProfileStatus = "ready",
  flowState,
  isInitialImprintComplete,
  isRecalibrationMode,
}: GetImprintStageLabelArgs) {
  if (flowState === "final_confirmation") {
    return {
      title: isInitialImprintComplete ? "ACTIVE IMPRINT" : "INITIAL IMPRINT",
      subtitle: "Ready for Sable Read",
    };
  }

  if (isRecalibrationMode) {
    return {
      title: "RECALIBRATING IMPRINT",
      subtitle: "Updating Active Profile",
    };
  }

  if (activeProfileStatus === "updated" && isInitialImprintComplete) {
    return {
      title: "ACTIVE IMPRINT",
      subtitle: "Profile Instructions Updated",
    };
  }

  if (flowState === "reviewing") {
    return {
      title: "ACTIVE IMPRINT",
      subtitle: "Sable Read + Recursum Instructions",
    };
  }

  if (flowState === "completed" || isInitialImprintComplete) {
    return {
      title: "ACTIVE IMPRINT",
      subtitle: "Profile Instructions Ready",
    };
  }

  if (flowState === "in_progress") {
    return {
      title: "INITIAL IMPRINT",
      subtitle: "Calibration in Progress",
    };
  }

  return {
    title: "INITIAL IMPRINT",
    subtitle: "Begin Calibration",
  };
}

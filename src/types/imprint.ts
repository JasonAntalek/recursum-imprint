export type ImprintRoomId =
  | "threshold"
  | "identity"
  | "what-moves-you"
  | "what-you-are-building"
  | "pressure"
  | "recursum-meeting-style"
  | "direction-and-first-imprint";

export type SelectionMode = "single" | "multi" | "text";

export type FinalNoteIntent = "additional_context" | "ready_confirmation";

export interface FinalNoteToSable {
  text: string;
  intent: FinalNoteIntent;
}

export interface SableReadAdjustmentNote {
  text: string;
  updatedAt?: string;
}

export interface CardOption {
  id: string;
  label: string;
}

export interface CardDrawer {
  title: string;
  body: string;
}

export interface TextFieldRule {
  id: string;
  label: string;
  placeholder?: string;
  inputType?: "text" | "date" | "time";
}

export interface ConditionalClarificationRule {
  id: string;
  prompt: string;
  required?: boolean;
  placeholder?: string;
}

export interface CardBlock {
  id: string;
  prompt: string;
  mode: SelectionMode;
  required: boolean;
  maxSelections?: number;
  options?: CardOption[];
  primaryRequired?: boolean;
  primaryOptional?: boolean;
  clarificationEnabled?: boolean;
  clarificationRequired?: boolean;
  clarificationPlaceholder?: string;
  conditionalClarifications?: Record<string, ConditionalClarificationRule[]>;
  placeholder?: string;
  textFields?: TextFieldRule[];
  drawer?: CardDrawer;
}

export interface ImprintRoom {
  id: ImprintRoomId;
  title: string;
  eyebrow: string;
  sableFrame: string;
  sableReadout: string;
  blocks: CardBlock[];
  imprintSummaryLabel: string;
}

export interface ImprintAnswer {
  selected: string[];
  primary?: string;
  clarification?: string;
  otherClarification?: string;
  conditionalClarifications?: Record<string, string>;
  text?: string;
  textValues?: Record<string, string>;
}

export type ImprintAnswers = Record<string, ImprintAnswer>;

export interface ImprintState {
  currentRoomIndex: number;
  answers: ImprintAnswers;
  reviewVisible: boolean;
}

export interface BehaviorRule {
  id: string;
  label: string;
  value: string;
}

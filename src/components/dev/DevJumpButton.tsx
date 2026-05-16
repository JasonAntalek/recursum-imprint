interface DevJumpButtonProps {
  isProminent?: boolean;
  onClick: () => void;
}

export function DevJumpButton({ isProminent = false, onClick }: DevJumpButtonProps) {
  return (
    <button
      aria-label="Developer shortcut: jump to completed imprint"
      className={`dev-jump-button${isProminent ? " is-prominent" : ""}`}
      onClick={onClick}
      type="button"
    >
      DEV: Complete
    </button>
  );
}

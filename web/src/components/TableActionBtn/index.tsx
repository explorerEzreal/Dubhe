import { ReactNode } from "react";

export type TableActionBtnProps = {
  icon: ReactNode;
  label: string;
  ariaLabel?: string;
  danger?: boolean;
  onClick: () => void;
};

export function TableActionBtn({
  icon,
  label,
  ariaLabel = label,
  danger = false,
  onClick,
}: TableActionBtnProps) {
  return (
    <button
      type='button'
      className={`table-action-btn${danger ? ' table-action-btn-danger' : ''}`}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

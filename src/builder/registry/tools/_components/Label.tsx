interface LabelProps {
  children: React.ReactNode;
}

export function Label({ children }: LabelProps) {
  return (
    <span className="text-xs text-[var(--text-secondary)]">{children}</span>
  );
}

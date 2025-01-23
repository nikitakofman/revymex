interface ToolGridProps {
  children: React.ReactNode;
  cols?: number;
  gap?: number;
}

interface ToolButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: "default" | "primary";
  size?: "sm" | "md";
}

interface ToolInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const ToolContainer = ({ children }: { children: React.ReactNode }) => (
  <div className="p-1 space-y-4 bg-[var(--bg-panel)] text-[var(--text-primary)]">
    {children}
  </div>
);

export const ToolSection = ({ children }: { children: React.ReactNode }) => (
  <div className="space-y-2">{children}</div>
);

export const ToolLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="text-sm text-[var(--text-secondary)]">{children}</span>
);

export const ToolButton = ({
  children,
  active,
  variant = "default",
  size = "md",
  className = "",
  ...props
}: ToolButtonProps) => {
  const baseStyles =
    "rounded-[var(--radius-sm)] flex items-center gap-2 transition-colors";
  const variants = {
    default: `
        bg-[var(--control-bg)]
        hover:bg-[var(--control-bg-hover)]
        border border-[var(--control-border)]
        hover:border-[var(--control-border-hover)]
        text-[var(--text-primary)]
        ${active ? "bg-[var(--control-bg-active)]" : ""}
      `,
    primary: `
        bg-[var(--button-primary-bg)]
        hover:bg-[var(--button-primary-hover)]
        text-white
        ${active ? "bg-[var(--button-primary-hover)]" : ""}
      `,
  };

  const sizes = {
    sm: "px-2 py-1 text-sm",
    md: "px-3 py-2",
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};

export const ToolButtonGroup = ({
  children,
}: {
  children: React.ReactNode;
}) => <div className="flex gap-2">{children}</div>;

export const ToolInput = ({
  label,
  className = "",
  ...props
}: ToolInputProps) => (
  <div className="flex items-center gap-2">
    {label && <ToolLabel>{label}</ToolLabel>}
    <input
      className={`
          w-20 px-2 py-1 
          bg-[var(--control-bg)]
          border border-[var(--control-border)]
          hover:border-[var(--control-border-hover)]
          focus:border-[var(--border-focus)]
          text-[var(--text-primary)]
          rounded-[var(--radius-sm)]
          focus:outline-none 
          ${className}
        `}
      {...props}
    />
  </div>
);

export const ToolGrid = ({ children }: ToolGridProps) => (
  <div
    className={`
    grid grid-cols-3 gap-2  bg-[var(--bg-surface)] 
      rounded-[var(--radius-md)]
      border border-[var(--border-light)]
      shadow-[var(--shadow-sm)]
      p-2
    `}
  >
    {children}
  </div>
);

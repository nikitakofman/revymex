import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/providers/cn";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:
    | "default"
    | "primary"
    | "secondary"
    | "error"
    | "success"
    | "warning"
    | "ghost"
    | "link";
  size?: "xs" | "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  active?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      disabled,
      children,
      active,
      ...props
    },
    ref
  ) => {
    // Base styles that apply to all buttons
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 rounded-[var(--radius-md)]";

    // Size variations
    const sizeStyles = {
      xs: "h-6 px-2 text-xs",
      sm: "h-7 px-2.5  text-xs",
      md: "h-9 px-[10px] text-base",
      lg: "h-12 px-6 text-lg",
    };

    // Icon sizes based on button size
    const iconSizes = {
      xs: "h-3 w-3",
      sm: "h-3.5 w-3.5",
      md: "h-4 w-4",
      lg: "h-5 w-5",
    };

    // Spacing for icons based on button size
    const iconSpacing = {
      xs: `${children ? "mr-1" : ""}`,
      sm: `${children ? "mr-1.5" : ""}`,
      md: `${children ? "mr-2" : ""}`,
      lg: `${children ? "mr-3" : ""}`,
    };

    // Variant styles using CSS variables
    const variantStyles = {
      default:
        "bg-[var(--control-bg)] text-[var(--text-primary)] hover:bg-[var(--control-bg-hover)] active:bg-[var(--control-bg-active)]",
      primary:
        "bg-[var(--button-primary-bg)] text-white hover:bg-[var(--button-primary-hover)] active:bg-[var(--button-primary-hover)]",
      secondary:
        "bg-[var(--button-secondary-bg)] text-[var(--text-primary)] hover:bg-[var(--button-secondary-hover)] active:bg-[var(--button-secondary-hover)]",
      error:
        "bg-[var(--error)] text-white hover:bg-[var(--error)]/90 active:bg-[var(--error)]/80",
      success:
        "bg-[var(--success)] text-white hover:bg-[var(--success)]/90 active:bg-[var(--success)]/80",
      warning:
        "bg-[var(--warning)] text-white hover:bg-[var(--warning)]/90 active:bg-[var(--warning)]/80",
      ghost:
        "bg-transparent hover:bg-[var(--bg-hover)] text-[var(--text-primary)]",
      link: "bg-transparent underline-offset-4 hover:underline text-[var(--accent)] hover:text-[var(--accent-hover)]",
    };

    // Helper to handle right icon spacing
    const getRightIconSpacing = (
      size: keyof typeof sizeStyles,
      hasChildren: boolean
    ) => {
      if (!hasChildren) return "";
      return iconSpacing[size].replace("mr-", "ml-");
    };

    // Function to render icon with correct size
    const renderIcon = (icon: React.ReactNode, position: "left" | "right") => {
      if (!icon) return null;

      const spacingClass =
        position === "left"
          ? iconSpacing[size]
          : getRightIconSpacing(size, !!children);

      if (React.isValidElement(icon)) {
        const iconWithSize = React.cloneElement(icon, {
          className: `${iconSizes[size]} ${spacingClass} ${
            icon.props.className || ""
          }`,
        });
        return iconWithSize;
      }

      return <span className={`${spacingClass}`}>{icon}</span>;
    };

    return (
      <button
        className={cn(
          baseStyles,
          sizeStyles[size],
          variantStyles[variant],
          "disabled:bg-[var(--control-bg)] disabled:text-[var(--text-disabled)]",
          className
        )}
        disabled={isLoading || disabled}
        ref={ref}
        {...props}
      >
        {isLoading && (
          <Loader2
            className={cn(
              iconSizes[size],
              children ? iconSpacing[size] : "",
              "animate-spin"
            )}
          />
        )}
        {!isLoading && leftIcon && renderIcon(leftIcon, "left")}
        {children}
        {!isLoading && rightIcon && renderIcon(rightIcon, "right")}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;

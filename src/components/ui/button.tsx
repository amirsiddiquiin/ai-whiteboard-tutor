import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[transform,background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--violet)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--ink)] text-white shadow-[0_8px_20px_rgba(28,26,44,0.18)] hover:bg-[var(--violet-dark)]",
        secondary:
          "border border-[var(--line)] bg-white/70 text-[var(--ink)] hover:border-[var(--violet-soft)] hover:bg-white",
        ghost: "text-[var(--muted)] hover:bg-white/70 hover:text-[var(--ink)]",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-12 px-6 text-sm",
        lg: "h-14 px-7 text-base",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

export function Button({ asChild, className, size, variant, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";

  return <Component className={cn(buttonVariants({ size, variant }), className)} {...props} />;
}

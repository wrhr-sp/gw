import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../cn";

export const buttonVariants = cva(
  "inline-flex h-10 items-center justify-center gap-2 rounded-control border px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "border-primary bg-primary text-white hover:bg-primary/90",
        secondary: "border-border bg-surface text-text hover:bg-background",
        danger: "border-danger bg-surface text-danger hover:bg-danger/5",
        ghost: "border-transparent bg-transparent text-text hover:bg-background",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>
  & VariantProps<typeof buttonVariants>
  & { asChild?: boolean };

export function Button({ asChild = false, className, variant, type, ...props }: ButtonProps) {
  const classes = cn(buttonVariants({ variant }), className);
  if (asChild) return <Slot className={classes} {...props} />;
  return <button className={classes} type={type ?? "button"} {...props} />;
}

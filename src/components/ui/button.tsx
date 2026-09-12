"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

export const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-medium text-base outline-none transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64 data-loading:select-none data-loading:text-transparent sm:text-sm [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        duo: "h-12 gap-2 rounded-lg px-6 text-[15px] sm:h-12 sm:text-[15px] [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-5",
        "duo-lg": "h-14 gap-2.5 rounded-lg px-8 text-[18px] sm:h-14 sm:text-[18px] [&_svg:not([class*='size-'])]:size-6 sm:[&_svg:not([class*='size-'])]:size-6",
        "duo-sm": "h-10 gap-1.5 rounded-lg px-4 text-[14px] sm:h-10 sm:text-[14px]",
        default: "h-9 px-[calc(--spacing(3)-1px)] sm:h-8",
        icon: "size-9 sm:size-8",
        "icon-lg": "size-10 sm:size-9",
        "icon-sm": "size-8 sm:size-7",
        "icon-xl":
          "size-11 sm:size-10 [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-4.5",
        "icon-xs":
          "size-7 rounded-md before:rounded-[calc(var(--radius-md)-1px)] sm:size-6 not-in-data-[slot=input-group]:[&_svg:not([class*='size-'])]:size-4 sm:not-in-data-[slot=input-group]:[&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 px-[calc(--spacing(3.5)-1px)] sm:h-9",
        sm: "h-8 gap-1.5 px-[calc(--spacing(2.5)-1px)] sm:h-7",
        xl: "h-11 px-[calc(--spacing(4)-1px)] text-lg sm:h-10 sm:text-base [&_svg:not([class*='size-'])]:size-5 sm:[&_svg:not([class*='size-'])]:size-4.5",
        xs: "h-7 gap-1 rounded-md px-[calc(--spacing(2)-1px)] text-sm before:rounded-[calc(var(--radius-md)-1px)] sm:h-6 sm:text-xs [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5",
      },
      variant: {
        /* §4 Duolingo buttons: solid fill + flat-color drop in the role's -deep
           variant. Press = translateY(2px) + shadow trim. Never a blurred shadow. */
        duo: "duo-drop border-transparent font-display font-bold tracking-[0.04em] transition-[transform,box-shadow,background-color] duration-100 disabled:opacity-100 [--duo-shadow-color:var(--brand-deep)] bg-brand text-white hover:bg-brand-hover data-pressed:bg-brand-hover disabled:bg-brand/45 *:data-[slot=button-loading-indicator]:text-white",
        "duo-danger": "duo-drop border-transparent font-display font-bold tracking-[0.04em] transition-[transform,box-shadow,background-color] duration-100 disabled:opacity-100 [--duo-shadow-color:var(--heart-deep)] bg-heart text-white hover:brightness-105 data-pressed:brightness-105 *:data-[slot=button-loading-indicator]:text-white",
        "duo-warning": "duo-drop border-transparent font-display font-bold tracking-[0.04em] transition-[transform,box-shadow,background-color] duration-100 disabled:opacity-100 [--duo-shadow-color:var(--streak-deep)] bg-streak text-white hover:brightness-105 data-pressed:brightness-105 *:data-[slot=button-loading-indicator]:text-white",
        "duo-info": "duo-drop border-transparent font-display font-bold tracking-[0.04em] transition-[transform,box-shadow,background-color] duration-100 disabled:opacity-100 [--duo-shadow-color:var(--macaw-deep)] bg-macaw text-white hover:brightness-105 data-pressed:brightness-105 *:data-[slot=button-loading-indicator]:text-white",
        "duo-super": "duo-drop border-transparent font-display font-bold tracking-[0.04em] transition-[transform,box-shadow,background-color] duration-100 disabled:opacity-100 [--duo-shadow-color:var(--super-deep)] bg-super text-white hover:brightness-105 data-pressed:brightness-105 *:data-[slot=button-loading-indicator]:text-white",
        "duo-xp": "duo-drop border-transparent font-display font-bold tracking-[0.04em] transition-[transform,box-shadow,background-color] duration-100 disabled:opacity-100 [--duo-shadow-color:var(--xp-deep)] bg-xp text-[#3c3c3c] hover:brightness-105 data-pressed:brightness-105",
        "duo-secondary": "duo-drop font-display font-bold tracking-[0.04em] transition-[transform,box-shadow,background-color] duration-100 [--duo-shadow-color:var(--input)] border-2 border-input bg-card text-foreground hover:bg-accent data-pressed:bg-accent",
        "duo-ghost": "border-transparent font-display font-bold tracking-[0.04em] text-brand hover:bg-brand/8 data-pressed:bg-brand/8",
        default:
          "not-disabled:inset-shadow-[0_1px_--theme(--color-white/16%)] border-primary bg-primary text-primary-foreground shadow-primary/24 shadow-xs hover:bg-primary/90 data-pressed:bg-primary/90 *:data-[slot=button-loading-indicator]:text-primary-foreground [:active,[data-pressed]]:inset-shadow-[0_1px_--theme(--color-black/8%)] [:disabled,:active,[data-pressed]]:shadow-none",
        destructive:
          "not-disabled:inset-shadow-[0_1px_--theme(--color-white/16%)] border-destructive bg-destructive text-white shadow-destructive/24 shadow-xs hover:bg-destructive/90 data-pressed:bg-destructive/90 *:data-[slot=button-loading-indicator]:text-white [:active,[data-pressed]]:inset-shadow-[0_1px_--theme(--color-black/8%)] [:disabled,:active,[data-pressed]]:shadow-none",
        "destructive-outline":
          "border-input bg-popover not-dark:bg-clip-padding text-destructive-foreground shadow-xs/5 not-disabled:not-active:not-data-pressed:before:shadow-[0_1px_--theme(--color-black/4%)] hover:border-destructive/32 hover:bg-destructive/4 data-pressed:border-destructive/32 data-pressed:bg-destructive/4 *:data-[slot=button-loading-indicator]:text-foreground dark:bg-input/32 dark:not-disabled:before:shadow-[0_-1px_--theme(--color-white/2%)] dark:not-disabled:not-active:not-data-pressed:before:shadow-[0_-1px_--theme(--color-white/6%)] [:disabled,:active,[data-pressed]]:shadow-none",
        ghost:
          "border-transparent text-foreground hover:bg-accent data-pressed:bg-accent *:data-[slot=button-loading-indicator]:text-foreground",
        link: "border-transparent text-foreground underline-offset-4 hover:underline data-pressed:underline *:data-[slot=button-loading-indicator]:text-foreground",
        outline:
          "border-input bg-popover not-dark:bg-clip-padding text-foreground shadow-xs/5 not-disabled:not-active:not-data-pressed:before:shadow-[0_1px_--theme(--color-black/4%)] hover:bg-accent/50 data-pressed:bg-accent/50 *:data-[slot=button-loading-indicator]:text-foreground dark:bg-input/32 dark:data-pressed:bg-input/64 dark:hover:bg-input/64 dark:not-disabled:before:shadow-[0_-1px_--theme(--color-white/2%)] dark:not-disabled:not-active:not-data-pressed:before:shadow-[0_-1px_--theme(--color-white/6%)] [:disabled,:active,[data-pressed]]:shadow-none",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90 data-pressed:bg-secondary/90 *:data-[slot=button-loading-indicator]:text-secondary-foreground [:active,[data-pressed]]:bg-secondary/80",
      },
    },
  },
);

export interface ButtonProps extends useRender.ComponentProps<"button"> {
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  render,
  children,
  loading = false,
  disabled: disabledProp,
  ...props
}: ButtonProps): React.ReactElement {
  const isDisabled: boolean = Boolean(loading || disabledProp);
  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>["type"] =
    render ? undefined : "button";

  const defaultProps = {
    children: (
      <>
        {children}
        {loading && (
          <Spinner
            className="pointer-events-none absolute"
            data-slot="button-loading-indicator"
          />
        )}
      </>
    ),
    className: cn(buttonVariants({ className, size, variant })),
    "aria-disabled": loading || undefined,
    "data-loading": loading ? "" : undefined,
    "data-slot": "button",
    disabled: isDisabled,
    type: typeValue,
  };

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(defaultProps, props),
    render,
  });
}

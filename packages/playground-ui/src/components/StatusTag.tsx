import type { ReactNode } from "react";

const variantClass = {
  success: "tag tag-success",
  danger: "tag tag-danger",
  neutral: "tag tag-neutral",
} as const;

export function StatusTag({
  variant,
  children,
}: {
  variant: "success" | "danger" | "neutral";
  children: ReactNode;
}) {
  return <span className={variantClass[variant]}>{children}</span>;
}

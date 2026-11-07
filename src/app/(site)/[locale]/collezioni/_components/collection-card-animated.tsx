"use client";

import type { ReactNode } from "react";

import { useScrollReveal } from "@/hooks/use-scroll-reveal";

interface Props {
  index: number;
  children: ReactNode;
}

/**
 * Client wrapper that staggers a fade-up reveal as the element scrolls into
 * view. Receives the (Server-rendered) CollectionCard as `children` so the
 * Client/Server boundary stays clean.
 */
export function CollectionCardAnimated({ index, children }: Props) {
  const { ref, isRevealed } = useScrollReveal<HTMLDivElement>({
    threshold: 0.15,
    rootMargin: "0px 0px -50px 0px",
  });

  const delay = Math.min(index * 30, 600);

  return (
    <div
      ref={ref}
      style={{
        opacity: isRevealed ? 1 : 0,
        transform: isRevealed ? "translateY(0)" : "translateY(30px)",
        transition: `opacity var(--dur-hero) var(--ease-out-expo) ${delay}ms, transform var(--dur-hero) var(--ease-out-expo) ${delay}ms`,
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

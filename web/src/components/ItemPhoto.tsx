"use client";

import { useState } from "react";
import { cn } from "./ui";

/** Menu item photo with a striped placeholder fallback (matches mockups). */
export function ItemPhoto({
  src,
  alt,
  className,
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showPlaceholder = !src || failed;

  return (
    <div className={cn("relative overflow-hidden bg-brand-tint/60", className)}>
      {showPlaceholder ? (
        <div
          className="grid h-full w-full place-items-center text-[11px] font-medium text-brand/50"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, transparent, transparent 8px, rgba(192,57,43,0.08) 8px, rgba(192,57,43,0.08) 16px)",
          }}
        >
          photo
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src!}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}

import type { CSSProperties } from "react";

/** Material Symbols Outlined icon (font loaded in globals.css). */
export function Icon({
  name,
  className,
  fill,
  style,
}: {
  name: string;
  className?: string;
  fill?: boolean;
  style?: CSSProperties;
}) {
  return (
    <span
      className={"material-symbols-outlined" + (className ? " " + className : "")}
      style={fill ? { fontVariationSettings: "'FILL' 1", ...style } : style}
      aria-hidden
    >
      {name}
    </span>
  );
}

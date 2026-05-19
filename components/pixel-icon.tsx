"use client";

import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

/**
 * Pixel-art icon renderer using the `pixelarticons` Iconify set.
 * Inherits `currentColor`. Render larger (32–80px) for chunky pixel look.
 */
export const ICONS = {
  // books / reading
  book: "book",
  "open-book": "book-open",
  "closed-book": "book",
  books: "book",
  bookmark: "bookmark",
  bookmarks: "bookmarks",
  notes: "notes",
  notebook: "notes",
  pencil: "edit",
  edit: "edit",
  memo: "notes",

  // love
  heart: "heart",
  "heart-fill": "heart",
  "two-hearts": "heart",
  "sparkling-heart": "heart",
  "red-heart": "heart",
  "pink-heart": "heart",
  "purple-heart": "heart",
  "revolving-hearts": "heart",
  "heart-with-arrow": "heart",
  "heart-broken": "heart-broken",

  // mail
  mail: "mail",
  envelope: "mail",
  "love-letter": "mail-arrow-right",
  "envelope-with-arrow": "mail-arrow-right",
  "incoming-envelope": "mail-unread",
  inbox: "downasaur",

  // gifts / accents
  gift: "gift",
  "wrapped-gift": "gift",
  sparkles: "sparkles",
  flare: "sparkles",
  zap: "zap",
  star: "sparkles",
  "glowing-star": "sparkles",
  "shooting-star": "sparkles",
  flower: "sun",
  blossom: "sun",
  rose: "sun",
  bouquet: "sun",
  "potted-plant": "sun",
  moon: "moon",
  sun: "sun",
  cloud: "cloud",
  fire: "fire",
  coffee: "coffee",
  music: "music",

  // status / faces
  warning: "warning-box",
  alert: "alert",
  sad: "mood-sad",
  happy: "smile",
  "pleading-face": "mood-sad",
  frown: "frown",

  // arrows / nav
  "arrow-left": "arrow-left",
  "arrow-right": "arrow-right",
  "chevron-left": "chevron-left",
  "chevron-right": "chevron-right",

  // misc
  plus: "plus",
  close: "close",
  check: "check",
  download: "download",
  upload: "upload",
  trash: "trash",
  image: "image",
  user: "human",
  more: "more-horizontal",
  palette: "drop-half",
} as const;

export type IconName = keyof typeof ICONS;

export function PixelIcon({
  name,
  size = 20,
  className,
  ...rest
}: {
  name: IconName;
  size?: number;
  className?: string;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, "children">) {
  return (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      style={{ width: size, height: size, lineHeight: 0 }}
      {...rest}
    >
      <Icon
        icon={`pixelarticons:${ICONS[name]}`}
        width={size}
        height={size}
      />
    </span>
  );
}

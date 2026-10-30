const SIZES = { sm: "h-8 w-8 text-[11px]", md: "h-10 w-10 text-xs", lg: "h-14 w-14 text-base" } as const;

/** Initials in a neutral chip. There are no member photos to show (and private photos are never shown here). */
export function Avatar({ firstName, lastName, size = "md" }: { firstName: string; lastName: string; size?: keyof typeof SIZES }) {
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-pill bg-ink font-heading font-extrabold tracking-tight text-lime ${SIZES[size]}`}>
      {initials}
    </span>
  );
}

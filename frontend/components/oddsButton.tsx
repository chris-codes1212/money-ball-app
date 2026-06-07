type OddsButtonProps = {
  outcome: string;
  odds: number;
  selected?: boolean;
  // Locked, e.g. while the user already has a pending bet on this game.
  locked?: boolean;
  onSelect?: (outcome: string, odds: number) => void;
};

export default function OddsButton({ outcome, odds, selected, locked, onSelect }: OddsButtonProps) {
  // 0 is the backend's "not offered" sentinel (terminal count, or a non-strike
  // foul with fewer than two strikes). Render it disabled rather than bettable.
  const offered = odds !== 0;
  const clickable = offered && !locked;

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onSelect?.(outcome, odds)}
      className={[
        "group flex w-full flex-col items-center rounded px-4 pt-2 pb-2 font-bold text-white transition sm:w-auto",
        clickable
          ? "cursor-pointer bg-gray-700 hover:bg-green-600"
          : "cursor-not-allowed bg-gray-800 text-white/40",
        selected ? "ring-2 ring-green-400" : "",
      ].join(" ")}
    >
      <span>{outcome}</span>
      <span
        className={
          clickable
            ? "text-green-500 group-hover:text-gray-700"
            : "text-white/30"
        }
      >
        {offered ? (odds > 0 ? `+${odds}` : `${odds}`) : "—"}
      </span>
    </button>
  );
}

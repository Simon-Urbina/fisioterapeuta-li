import { cn } from "@/lib/utils";

export function Stepper({
  steps,
  current,
}: {
  steps: string[];
  current: number; // 0-indexed
}) {
  return (
    <ol className="flex items-center gap-2 sm:gap-4">
      {steps.map((label, i) => {
        const state =
          i < current ? "done" : i === current ? "active" : "pending";
        return (
          <li key={label} className="flex flex-1 items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium",
                  state === "done" && "bg-deep-600 text-white",
                  state === "active" && "bg-sky-300 text-deep-700",
                  state === "pending" && "bg-white text-ink-600 border border-sky-300"
                )}
              >
                {i + 1}
              </span>
              <span
                className={cn(
                  "hidden text-sm sm:inline",
                  state === "pending" ? "text-ink-600" : "text-ink-900 font-medium"
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className="h-px flex-1 bg-sky-300" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

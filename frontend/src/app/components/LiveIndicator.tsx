import { useSocket } from "../hooks/useSocket";

/**
 * Tiny indicator dot — drop in header/sidebar for dev & user confidence.
 *
 *   <LiveIndicator />             // green dot + "Live" when connected
 *   <LiveIndicator showLabel={false} />
 */
export function LiveIndicator({ showLabel = true }: { showLabel?: boolean }) {
  const { connected } = useSocket();

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs"
      title={connected ? "Real-time connected" : "Reconnecting..."}
    >
      <span
        className={`inline-block h-2 w-2 rounded-full ${
          connected ? "bg-emerald-500 animate-pulse" : "bg-red-500"
        }`}
      />
      {showLabel && (
        <span className={connected ? "text-emerald-600" : "text-red-600"}>
          {connected ? "Live" : "Offline"}
        </span>
      )}
    </span>
  );
}

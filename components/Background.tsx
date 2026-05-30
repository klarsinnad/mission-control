"use client";

/**
 * Layered atmospheric backdrop:
 *  - deep radial base
 *  - three drifting aurora blobs (CSS keyframes, GPU-friendly)
 *  - perspective grid floor
 *  - faint noise grain
 */
export function Background() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#04050a] noise">
      {/* base vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% -10%, rgba(99,102,241,0.18), transparent 55%), radial-gradient(100% 80% at 90% 110%, rgba(34,211,238,0.10), transparent 50%)",
        }}
      />

      {/* aurora blobs */}
      <div
        className="animate-aurora absolute -left-[10%] top-[-15%] h-[55vw] w-[55vw] rounded-full opacity-[0.5] blur-[120px]"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, #6d5cff, transparent 60%)",
        }}
      />
      <div
        className="animate-aurora absolute right-[-12%] top-[10%] h-[48vw] w-[48vw] rounded-full opacity-40 blur-[130px]"
        style={{
          background:
            "radial-gradient(circle at 60% 40%, #1fb6d6, transparent 60%)",
          animationDelay: "-8s",
        }}
      />
      <div
        className="animate-aurora absolute bottom-[-25%] left-[25%] h-[50vw] w-[50vw] rounded-full opacity-30 blur-[140px]"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, #d946ef, transparent 62%)",
          animationDelay: "-15s",
        }}
      />

      {/* grid floor */}
      <div className="grid-overlay absolute inset-x-0 top-0 h-[60vh]" />

      {/* top fade for legibility */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(4,5,10,0.55) 0%, transparent 22%, transparent 78%, rgba(4,5,10,0.65) 100%)",
        }}
      />
    </div>
  );
}

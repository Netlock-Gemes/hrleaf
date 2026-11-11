export default function LoadingAdmin() {
  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-3 pt-6 sm:px-6 sm:pt-10" aria-busy="true" aria-label="Loading">
      <div className="flex motion-safe:animate-pulse flex-col gap-4 [animation-duration:1.6s]">
        <div className="h-7 w-40 rounded bg-[--surface-dark]" />
        <div className="h-3.5 w-64 rounded bg-[--surface-dark]" />
        <div className="panel mt-4 h-72" />
      </div>
    </main>
  );
}

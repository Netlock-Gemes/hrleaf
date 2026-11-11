/** Shown while a note loads: the header shape plus a few text lines, so nothing jumps. */
export default function LoadingNote() {
  return (
    <div className="editor-main" aria-busy="true" aria-label="Loading note">
      <div className="mx-auto flex h-14 w-full max-w-[52rem] items-center gap-2 px-3 sm:px-0">
        <div className="h-5 w-5 rounded bg-[--surface-dark]" />
        <div className="h-3.5 w-24 rounded bg-[--surface-dark]" />
      </div>
      <div className="mx-auto w-full max-w-[52rem] px-5 pt-10 sm:px-0">
        <div className="flex animate-pulse flex-col gap-3 [animation-duration:1.6s]">
          <div className="h-7 w-2/5 rounded bg-[--surface-dark]" />
          <div className="mt-3 h-3.5 w-full rounded bg-[--surface-dark]" />
          <div className="h-3.5 w-11/12 rounded bg-[--surface-dark]" />
          <div className="h-3.5 w-4/5 rounded bg-[--surface-dark]" />
          <div className="mt-3 h-3.5 w-full rounded bg-[--surface-dark]" />
          <div className="h-3.5 w-3/5 rounded bg-[--surface-dark]" />
        </div>
      </div>
    </div>
  );
}

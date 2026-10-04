import { LoaderCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import type { ConfirmationState } from "@/lib/confirmation";
export function ConfirmationModal({
  state,
  cancel,
  submit,
}: {
  state: ConfirmationState | null;
  cancel: () => void;
  submit: () => Promise<void>;
}) {
  return (
    <Dialog
      open={!!state}
      onOpenChange={(open) => {
        if (!open) cancel();
      }}
    >
      {state && (
        <DialogContent
          closeDisabled={state.busy}
          className="w-[calc(100%_-_2rem)] max-w-md gap-6 rounded-[28px] border-ink/10 bg-paper p-8 text-ink shadow-2xl sm:rounded-[28px]"
        >
          <div className="space-y-4 pr-4">
            <DialogTitle className="font-display text-3xl font-black tracking-tight">
              {state.options.title}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-ink-soft">
              {state.options.message}
            </DialogDescription>
          </div>
          {state.error && (
            <p
              role="alert"
              className="rounded-2xl border border-red-800/15 bg-red-50 p-4 text-sm text-red-800"
            >
              {state.error}
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              autoFocus
              type="button"
              disabled={state.busy}
              onClick={cancel}
              className="rounded-full border border-ink/15 px-6 py-3 text-[10px] font-bold tracking-[0.15em] transition hover:border-accent hover:text-accent disabled:opacity-50"
            >
              VOLVER
            </button>
            <button
              type="button"
              disabled={state.busy}
              onClick={() => void submit()}
              aria-busy={state.busy}
              className={`flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-3 text-[10px] font-black tracking-[0.12em] text-cream transition disabled:cursor-wait disabled:opacity-60 ${state.options.destructive ? "bg-[#633450] hover:bg-[#4d263f]" : "bg-accent hover:bg-ink"}`}
            >
              {state.busy && <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />}
              {state.busy ? "PROCESANDO…" : state.options.label}
            </button>
          </div>
        </DialogContent>
      )}
    </Dialog>
  );
}

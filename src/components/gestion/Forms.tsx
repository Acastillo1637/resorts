import { useState, type ReactNode } from "react";
import { button, input } from "../AppShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { errorMensaje } from "@/lib/booking";

export function Campo({ nombre, children }: { nombre: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold">
      {nombre}
      {children}
    </label>
  );
}
export function Editor({
  titulo,
  cerrar,
  children,
}: {
  titulo: string;
  cerrar: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) cerrar();
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>
            Completa los datos y guarda para aplicar los cambios.
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export interface CampoConfig {
  key: string;
  label: string;
  type?: string;
  required?: boolean;
  min?: number;
  options?: { value: string; label: string }[];
}
export function Formulario({
  campos,
  inicial,
  guardar,
  texto = "Guardar",
}: {
  campos: CampoConfig[];
  inicial?: Record<string, string>;
  guardar: (valores: Record<string, string>) => Promise<void>;
  texto?: string;
}) {
  const [valores, setValores] = useState<Record<string, string>>(inicial ?? {});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await guardar(valores);
        } catch (err) {
          setError(errorMensaje(err));
        } finally {
          setBusy(false);
        }
      }}
    >
      {campos.map((c) => (
        <Campo key={c.key} nombre={c.label}>
          {c.options ? (
            <select
              className={input}
              required={c.required}
              value={valores[c.key] ?? ""}
              onChange={(e) => setValores({ ...valores, [c.key]: e.target.value })}
            >
              <option value="">Seleccionar…</option>
              {c.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              className={input}
              type={c.type ?? "text"}
              required={c.required}
              min={c.min}
              step={c.type === "number" ? "0.01" : undefined}
              maxLength={1000}
              value={valores[c.key] ?? ""}
              onChange={(e) => setValores({ ...valores, [c.key]: e.target.value })}
            />
          )}
        </Campo>
      ))}
      {error && (
        <p role="alert" className="text-sm text-red-700 sm:col-span-2">
          {error}
        </p>
      )}
      <button disabled={busy} className={`${button} sm:col-span-2`}>
        {busy ? "Guardando…" : texto}
      </button>
    </form>
  );
}

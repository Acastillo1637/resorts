import { useState } from "react";
import { button, card } from "../AppShell";
import { Editor, Formulario, type CampoConfig } from "./Forms";
import { guardar, type Gestion } from "@/lib/gestion";
import { moneda } from "@/lib/booking";
import type { Perfil } from "@/lib/auth";
const opts = (v: string[]) => v.map((value) => ({ value, label: value }));
export function Catalogos({
  tab,
  datos,
  hotel,
  perfil,
  listo,
}: {
  tab: string;
  datos: Gestion;
  hotel: string;
  perfil: Perfil;
  listo: () => Promise<void>;
}) {
  const [edit, setEdit] = useState<{
    id?: string;
    values: Record<string, string>;
    tipo?: boolean;
  } | null>(null);
  const gerente = perfil.rol === "gerente";
  const campos: Record<string, CampoConfig[]> = {
    Hoteles: [
      { key: "nombre", label: "Nombre", required: true },
      {
        key: "region_id",
        label: "Región",
        required: true,
        options: datos.regiones.map((r) => ({ value: r.id, label: r.nombre })),
      },
      { key: "direccion", label: "Dirección", required: true },
      { key: "descripcion", label: "Descripción" },
      { key: "servicios", label: "Servicios (separados por coma)" },
      { key: "estado", label: "Estado", required: true, options: opts(["activo", "inactivo"]) },
    ],
    Habitaciones: [
      { key: "numero", label: "Número", required: true },
      {
        key: "tipo",
        label: "Tipo",
        required: true,
        options: datos.tipos.map((t) => ({ value: t.codigo, label: t.nombre })),
      },
      { key: "capacidad", label: "Capacidad", type: "number", min: 1, required: true },
      {
        key: "precio_noche",
        label: "Precio por noche (CLP)",
        type: "number",
        min: 0,
        required: true,
      },
      {
        key: "estado",
        label: "Estado",
        required: true,
        options: opts(["activa", "mantenimiento", "inactiva"]),
      },
      { key: "caracteristicas", label: "Características" },
    ],
    Huéspedes: [
      { key: "nombre", label: "Nombre completo", required: true },
      { key: "documento", label: "Documento / pasaporte / RUT", required: true },
      { key: "email", label: "Correo", type: "email" },
      { key: "telefono", label: "Teléfono", type: "tel" },
      { key: "notas", label: "Observaciones" },
    ],
    Servicios: [
      { key: "nombre", label: "Nombre", required: true },
      { key: "descripcion", label: "Descripción" },
      { key: "precio", label: "Precio (CLP)", type: "number", min: 0, required: true },
      {
        key: "activo",
        label: "Estado",
        required: true,
        options: [
          { value: "true", label: "Activo" },
          { value: "false", label: "Inactivo" },
        ],
      },
    ],
  };
  const tablas: Record<string, string> = {
    Hoteles: "hoteles",
    Habitaciones: "habitaciones",
    Huéspedes: "huespedes",
    Servicios: "servicios_adicionales",
  };
  const records: Record<string, unknown>[] = (tab === "Hoteles"
    ? datos.hoteles.filter(
        (h) => (!perfil.hotel_id || h.id === perfil.hotel_id) && (!hotel || h.id === hotel),
      )
    : tab === "Habitaciones"
      ? datos.habitaciones
      : tab === "Huéspedes"
        ? datos.huespedes
        : datos.servicios) as unknown as Record<string, unknown>[];
  const rows = records.filter((x) => tab === "Hoteles" || !hotel || x["hotel_id"] === hotel);
  const puedeEditar = gerente || ["Huéspedes", "Servicios"].includes(tab);
  return (
    <section className={card}>
      <div className="mb-5 flex gap-3">
        {puedeEditar && (
          <button
            className={button}
            disabled={tab === "Hoteles" ? !!perfil.hotel_id : !hotel}
            onClick={() => setEdit({ values: {} })}
          >
            Agregar {tab.toLowerCase()}
          </button>
        )}
        {tab === "Habitaciones" && gerente && !perfil.hotel_id && (
          <button className={button} onClick={() => setEdit({ values: {}, tipo: true })}>
            Nuevo tipo
          </button>
        )}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {rows.map((x) => (
          <article key={String(x["id"])} className="rounded-2xl border border-ink/10 p-5">
            <h3 className="text-xl font-bold">{String(x["nombre"] ?? x["numero"])}</h3>
            {(campos[tab] ?? [])
              .filter((c) => !["nombre", "numero", "region_id"].includes(c.key))
              .map((c) => (
                <p className="mt-1 text-sm" key={c.key}>
                  {c.label}:{" "}
                  {c.key.startsWith("precio")
                    ? moneda(Number(x[c.key]))
                    : Array.isArray(x[c.key])
                      ? (x[c.key] as string[]).join(", ")
                      : String(x[c.key] ?? "—")}
                </p>
              ))}
            {puedeEditar && (
              <button
                className={`${button} mt-4`}
                onClick={() =>
                  setEdit({
                    id: String(x["id"]),
                    values: Object.fromEntries(
                      Object.entries(x).map(([k, v]) => [
                        k,
                        Array.isArray(v) ? v.join(", ") : String(v ?? ""),
                      ]),
                    ),
                  })
                }
              >
                Editar
              </button>
            )}
            {tab === "Huéspedes" && (
              <div className="mt-4 text-sm">
                <b>Historial de reservas</b>
                {datos.reservas
                  .filter((r) => r.huesped_id === x["id"])
                  .map((r) => (
                    <p key={r.id}>
                      {r.fecha_inicio} → {r.fecha_fin} · {r.estado}
                    </p>
                  ))}
              </div>
            )}
          </article>
        ))}
      </div>
      {!rows.length && <p className="py-8 text-sm">Todavía no hay registros.</p>}
      {edit && (
        <Editor titulo={edit.tipo ? "Tipo de habitación" : tab} cerrar={() => setEdit(null)}>
          <Formulario
            campos={
              edit.tipo
                ? [
                    { key: "codigo", label: "Código único", required: true },
                    { key: "nombre", label: "Nombre", required: true },
                    { key: "descripcion", label: "Descripción" },
                  ]
                : (campos[tab] ?? [])
            }
            inicial={edit.values}
            guardar={async (v) => {
              const values: Record<string, unknown> = {};
              for (const c of edit.tipo
                ? [{ key: "codigo" }, { key: "nombre" }, { key: "descripcion" }]
                : (campos[tab] ?? []))
                values[c.key] = v[c.key] ?? "";
              if (!edit.tipo) {
                if (tab !== "Hoteles") values["hotel_id"] = edit.values["hotel_id"] || hotel;
                if (tab === "Hoteles")
                  values["servicios"] = (v["servicios"] ?? "")
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                if (tab === "Habitaciones") {
                  values["capacidad"] = Number(v["capacidad"]);
                  values["precio_noche"] = Number(v["precio_noche"]);
                  if (!Number.isInteger(values["capacidad"]))
                    throw new Error("La capacidad debe ser entera.");
                }
                if (tab === "Servicios") {
                  values["precio"] = Number(v["precio"]);
                  values["activo"] = v["activo"] === "true";
                }
              }
              await guardar(edit.tipo ? "tipos_habitacion" : tablas[tab]!, values, edit.id);
              setEdit(null);
              await listo();
            }}
          />
        </Editor>
      )}
    </section>
  );
}

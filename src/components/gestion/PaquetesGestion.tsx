import { useState } from "react";
import { esGerencia } from "@/lib/roles";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Gestion } from "@/lib/gestion";
import { rpc } from "@/lib/gestion";
import { enteroPaquete } from "@/lib/package-input";
import { supabase } from "@/lib/supabase";
import type { Paquete } from "@/lib/catalog";
import type { Perfil } from "@/lib/auth";
import { errorMensaje, moneda } from "@/lib/booking";
import { button, card, input } from "../AppShell";
import { Editor, Formulario, type CampoConfig } from "./Forms";
type Producto = Omit<Paquete, "hotel" | "servicios"> & { activo: boolean };
export function PaquetesGestion({
  datos,
  hotel,
  perfil,
  crear = false,
}: {
  datos: Gestion;
  hotel: string;
  perfil: Perfil;
  crear?: boolean;
}) {
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Producto | null | "nuevo">(crear && hotel ? "nuevo" : null);
  const [servicios, setServicios] = useState<{ servicio_id: string; cantidad: number }[]>([]);
  const q = useQuery({
    queryKey: ["paquetes-gestion", perfil.id, perfil.rol, perfil.hotel_id, hotel],
    enabled: esGerencia(perfil.rol),
    queryFn: async () => {
      let query = supabase.from("paquetes").select("*").order("nombre");
      if (hotel) query = query.eq("hotel_id", hotel);
      const [p, s] = await Promise.all([query, supabase.from("paquete_servicios").select("*")]);
      if (p.error) throw p.error;
      if (s.error) throw s.error;
      return {
        paquetes: p.data as Producto[],
        servicios: s.data as { paquete_id: string; servicio_id: string; cantidad: number }[],
      };
    },
  });
  if (!esGerencia(perfil.rol)) return <p>La gestión de paquetes está disponible para gerencia.</p>;
  const hotelId = edit && edit !== "nuevo" ? edit.hotel_id : hotel;
  const campos: CampoConfig[] = [
    { key: "nombre", label: "Nombre", required: true },
    { key: "descripcion", label: "Descripción", required: true },
    { key: "experiencia", label: "Experiencia", required: true },
    { key: "noches", label: "Noches", type: "number", integer: true, min: 1, required: true },
    {
      key: "tipo",
      label: "Categoría",
      required: true,
      options: datos.tipos
        .filter((t) =>
          datos.habitaciones.some((h) => h.hotel_id === hotelId && h.tipo === t.codigo),
        )
        .map((t) => ({ value: t.codigo, label: t.nombre })),
    },
    ...[
      ["capacidad", "Capacidad total", 1],
      ["min_huespedes", "Mínimo huéspedes (igual a capacidad para ocupación exacta)", 1],
      ["min_adultos", "Mínimo adultos", 1],
      ["max_ninos", "Máximo niños", 0],
      ["precio", "Precio del paquete (CLP)", 0],
      ["precio_referencial", "Precio referencial (CLP, opcional)", 0],
    ].map(([key, label, min]) => ({
      key: String(key),
      label: String(label),
      min: Number(min),
      type: "number",
      integer: true,
      clp: String(key).startsWith("precio"),
      required: key !== "precio_referencial",
    })),
    {
      key: "activo",
      label: "Estado",
      required: true,
      options: [
        { value: "true", label: "Activo" },
        { value: "false", label: "Inactivo" },
      ],
    },
    {
      key: "destacado",
      label: "Destacado",
      required: true,
      options: [
        { value: "true", label: "Sí" },
        { value: "false", label: "No" },
      ],
    },
    { key: "vigente_desde", label: "Vigencia desde (opcional)", type: "date" },
    { key: "vigente_hasta", label: "Vigencia hasta (opcional)", type: "date" },
    { key: "condiciones", label: "Condiciones" },
    { key: "no_incluye", label: "No incluye" },
  ];
  const defaults =
    edit && edit !== "nuevo"
      ? Object.fromEntries(Object.entries(edit).map(([k, v]) => [k, v == null ? "" : String(v)]))
      : {
          noches: "2",
          capacidad: "2",
          min_huespedes: "1",
          min_adultos: "1",
          max_ninos: "1",
          activo: "true",
          destacado: "false",
          experiencia: "Escapada",
        };
  return (
    <section className={card}>
      <button
        className={button}
        disabled={!hotel}
        onClick={() => {
          setEdit("nuevo");
          setServicios([]);
        }}
      >
        Crear paquete
      </button>
      {!hotel && <p className="mt-3 text-sm">Selecciona un hotel para crear un paquete.</p>}
      {q.error && <p role="alert">{errorMensaje(q.error)}</p>}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {q.data?.paquetes.map((p) => (
          <article key={p.id} className="rounded-2xl border border-ink/10 p-5">
            <h3 className="font-bold">{p.nombre}</h3>
            <p className="mt-2 text-sm">
              {p.noches} noches · {moneda(Number(p.precio))} · {p.activo ? "Activo" : "Inactivo"}
              {p.destacado ? " · Destacado" : ""}
            </p>
            <button
              className={`${button} mt-4`}
              onClick={() => {
                setEdit(p);
                setServicios(
                  q.data?.servicios
                    .filter((s) => s.paquete_id === p.id)
                    .map((s) => ({ servicio_id: s.servicio_id, cantidad: s.cantidad })) ?? [],
                );
              }}
            >
              Editar
            </button>
          </article>
        ))}
      </div>
      {edit && (
        <Editor titulo="Gestionar paquete" cerrar={() => setEdit(null)}>
          <fieldset className="mb-6 space-y-3">
            <legend className="mb-3 font-bold">Servicios incluidos del hotel</legend>
            {datos.servicios
              .filter(
                (s) =>
                  s.hotel_id === hotelId &&
                  (s.activo || servicios.some((x) => x.servicio_id === s.id)),
              )
              .map((s) => {
                const item = servicios.find((x) => x.servicio_id === s.id);
                return (
                  <div key={s.id} className="flex items-center gap-3">
                    <label className="flex-1 text-sm">
                      <input
                        type="checkbox"
                        checked={!!item}
                        onChange={(e) =>
                          setServicios(
                            e.target.checked
                              ? [...servicios, { servicio_id: s.id, cantidad: 1 }]
                              : servicios.filter((x) => x.servicio_id !== s.id),
                          )
                        }
                      />{" "}
                      {s.nombre}
                      {!s.activo ? " (inactivo; quitar para guardar)" : ""}
                    </label>
                    {item && (
                      <input
                        aria-label={`Cantidad de ${s.nombre}`}
                        className={`${input} max-w-24`}
                        type="number"
                        min={1}
                        step={1}
                        value={item.cantidad}
                        onKeyDown={(e) => {
                          if ([".", ",", "e", "E", "+", "-"].includes(e.key)) e.preventDefault();
                        }}
                        onPaste={(e) => {
                          if (!/^\d+$/.test(e.clipboardData.getData("text"))) e.preventDefault();
                        }}
                        onChange={(e) => {
                          if (!/^\d*$/.test(e.target.value)) return;
                          setServicios(
                            servicios.map((x) =>
                              x.servicio_id === s.id
                                ? { ...x, cantidad: Number(e.target.value) }
                                : x,
                            ),
                          );
                        }}
                      />
                    )}
                  </div>
                );
              })}
          </fieldset>
          <Formulario
            campos={campos}
            inicial={defaults}
            guardar={async (v) => {
              const valores: Record<string, unknown> = {
                ...v,
                id: edit !== "nuevo" ? edit.id : null,
                hotel_id: hotelId,
                imagen_url: "",
              };
              for (const key of [
                "noches",
                "capacidad",
                "min_huespedes",
                "min_adultos",
                "max_ninos",
                "precio",
              ])
                valores[key] = enteroPaquete(
                  v[key] ?? "",
                  ["max_ninos", "precio"].includes(key) ? 0 : 1,
                );
              valores["precio_referencial"] = v["precio_referencial"]
                ? enteroPaquete(v["precio_referencial"])
                : null;
              for (const key of ["vigente_desde", "vigente_hasta"]) valores[key] = v[key] || null;
              valores["activo"] = v["activo"] === "true";
              valores["destacado"] = v["destacado"] === "true";
              const cantidades = servicios.map((s) => ({
                ...s,
                cantidad: enteroPaquete(String(s.cantidad), 1),
              }));
              await rpc("fn_guardar_paquete", { p_datos: valores, p_servicios: cantidades });
              setEdit(null);
              await Promise.all([
                qc.invalidateQueries({ queryKey: ["paquetes-gestion"] }),
                qc.invalidateQueries({ queryKey: ["paquetes"] }),
              ]);
            }}
          />
        </Editor>
      )}
    </section>
  );
}

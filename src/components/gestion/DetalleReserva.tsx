import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { button } from "../AppShell";
import { Formulario } from "./Forms";
import {
  estados,
  estadoVisible,
  errorMensaje,
  moneda,
  pagado,
  titular,
  totalReserva,
  type Reserva,
} from "@/lib/booking";
import { cargarDetalleReserva, rpc, type Gestion } from "@/lib/gestion";
import { nuevaIdempotencia } from "@/lib/idempotency";
import { accesoReserva } from "@/lib/roles";
import { supabase } from "@/lib/supabase";
import { useConfirmation } from "@/hooks/use-confirmation";
import { cancellationConfirmation } from "@/lib/confirmation";
import { useAuth } from "@/hooks/use-auth";
const opciones = (v: string[]) => v.map((value) => ({ value, label: value }));
export function DetalleReserva({
  reservaId,
  datos,
  listo,
  editar,
}: {
  reservaId: string;
  datos: Gestion;
  listo: () => Promise<void>;
  editar: () => void;
}) {
  const auth = useAuth();
  const query = useQuery({
    queryKey: [
      "detalle-reserva",
      reservaId,
      auth.perfil?.id,
      auth.perfil?.rol,
      auth.perfil?.hotel_id,
    ],
    queryFn: () => cargarDetalleReserva(reservaId),
    enabled: !!auth.perfil,
  });
  if (!auth.perfil || query.isPending) return <p role="status">Cargando reserva…</p>;
  if (query.error)
    return (
      <div>
        <p role="alert">No se pudo cargar la reserva: {errorMensaje(query.error)}</p>
        <button className={button} onClick={() => void query.refetch()}>
          Reintentar
        </button>
      </div>
    );
  if (!query.data)
    return <p role="status">La reserva no existe o no tienes autorización para consultarla.</p>;
  if (!accesoReserva(auth.perfil, query.data.hotel_id))
    return <p role="alert">No autorizado para este hotel.</p>;
  return <ContenidoReserva r={query.data} datos={datos} listo={listo} editar={editar} />;
}
function ContenidoReserva({
  r,
  datos,
  listo,
  editar,
}: {
  r: Reserva;
  datos: Gestion;
  listo: () => Promise<void>;
  editar: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [id] = useState(() => nuevaIdempotencia());
  const qc = useQueryClient();
  const auth = useAuth();
  const { confirm: askConfirmation, dialog } = useConfirmation();
  const historial = useQuery({
    queryKey: ["historial", r.id, auth.perfil?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("eventos_reserva")
        .select("id,tipo_evento,creado_en")
        .eq("reserva_id", r.id)
        .order("creado_en", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  async function cambiar(estado: string) {
    setError("");
    const ok = await askConfirmation(
      estado === "cancelada"
        ? cancellationConfirmation
        : {
            title: "Actualizar reserva",
            message: `¿Cambiar la reserva a ${estados[estado as keyof typeof estados]}?`,
            label: "CONFIRMAR CAMBIO",
          },
      async () => {
        const updated = (await rpc("fn_estado_reserva", {
          p_reserva_id: r.id,
          p_estado: estado,
        })) as Reserva;
        qc.setQueriesData<Gestion>({ queryKey: ["gestion", auth.perfil?.id] }, (previous) =>
          previous
            ? {
                ...previous,
                reservas: previous.reservas.map((item) =>
                  item.id === r.id ? { ...item, ...updated } : item,
                ),
              }
            : previous,
        );
        await qc.invalidateQueries({ queryKey: ["detalle-reserva", r.id] });
      },
    );
    if (ok) {
      setBusy(true);
      try {
        await listo();
      } catch (e) {
        setError(errorMensaje(e));
      } finally {
        setBusy(false);
      }
    }
  }
  return (
    <div className="space-y-5">
      {dialog}
      {r.paquete_id && (
        <p className="font-bold text-accent">
          Paquete · {r.paquete_snapshot?.nombre ?? "Estadía contratada"}
        </p>
      )}
      <p>
        <b>{titular(r)}</b> · {r.fecha_inicio} → {r.fecha_fin}
        <br />
        {estados[estadoVisible(r)]} · {r.adultos} adultos · {r.ninos} niños
      </p>
      <p className="text-sm">{r.notas || "Sin observaciones."}</p>
      {estadoVisible(r) === "vencida" && (
        <p role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Vencimiento por fecha, sin checkout registrado. Estado original: {estados[r.estado]}.
          {r.estado === "check_in"
            ? " Pendiente de regularización: concilia el saldo y registra el checkout real."
            : " No se registró el cierre operativo de esta reserva."}
        </p>
      )}
      <div className="rounded-xl bg-accent-soft p-4">
        Total: {moneda(totalReserva(r))} · Abonado: {moneda(pagado(r))}
        <br />
        Pago: {pagado(r) >= totalReserva(r) ? "Pagado" : pagado(r) > 0 ? "Parcial" : "Pendiente"}
      </div>
      <div className="flex flex-wrap gap-2">
        {estadoVisible(r) !== "vencida" && ["pendiente", "confirmada"].includes(r.estado) && (
          <>
            <button className={button} disabled={!!r.paquete_id} onClick={editar}>
              Editar
            </button>
            <button className={button} disabled={busy} onClick={() => cambiar("cancelada")}>
              Cancelar
            </button>
          </>
        )}
        {r.estado === "pendiente" && estadoVisible(r) !== "vencida" && (
          <button className={button} disabled={busy} onClick={() => cambiar("confirmada")}>
            Confirmar
          </button>
        )}
        {r.estado === "confirmada" && estadoVisible(r) !== "vencida" && (
          <button className={button} disabled={busy} onClick={() => cambiar("check_in")}>
            Check-in
          </button>
        )}
        {r.estado === "check_in" && (
          <button className={button} disabled={busy} onClick={() => cambiar("check_out")}>
            {estadoVisible(r) === "vencida" ? "REGISTRAR CHECKOUT · REGULARIZAR" : "Check-out"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-red-700">
          {error}
        </p>
      )}
      {!["cancelada", "check_out"].includes(r.estado_registrado ?? r.estado) && (
        <>
          <h3 className="font-bold">Registrar pago o reembolso</h3>
          <Formulario
            inicial={{
              monto: String(Math.max(0, totalReserva(r) - pagado(r))),
              tipo: "pago",
              metodo: "transferencia",
            }}
            campos={[
              { key: "monto", label: "Monto (CLP)", type: "number", min: 0.01, required: true },
              {
                key: "tipo",
                label: "Movimiento",
                required: true,
                options: opciones(["pago", "reembolso"]),
              },
              {
                key: "metodo",
                label: "Método",
                required: true,
                options: opciones(["efectivo", "tarjeta", "transferencia"]),
              },
              { key: "referencia", label: "Referencia / comprobante" },
            ]}
            guardar={async (v) => {
              const ok = await askConfirmation(
                {
                  title: "Registrar movimiento",
                  message: `¿Registrar ${v["tipo"]} por ${moneda(Number(v["monto"]))}?`,
                  label: "REGISTRAR MOVIMIENTO",
                },
                async () => {
                  await rpc("fn_registrar_pago", {
                    p_reserva_id: r.id,
                    p_monto: Number(v["monto"]),
                    p_tipo: v["tipo"],
                    p_metodo: v["metodo"],
                    p_referencia: v["referencia"] ?? "",
                    p_idempotencia: id,
                  });
                },
              );
              if (ok) await listo();
            }}
          />
          {!["check_out", "vencida"].includes(estadoVisible(r)) && (
            <>
              <h3 className="font-bold">Añadir servicio</h3>
              <Formulario
                campos={[
                  {
                    key: "servicio",
                    label: "Servicio",
                    required: true,
                    options: datos.servicios
                      .filter((s) => s.hotel_id === r.hotel_id && s.activo)
                      .map((s) => ({
                        value: s.id,
                        label: `${s.nombre} · ${moneda(Number(s.precio))}`,
                      })),
                  },
                  { key: "cantidad", label: "Cantidad", type: "number", min: 1, required: true },
                ]}
                inicial={{ cantidad: "1" }}
                guardar={async (v) => {
                  await rpc("fn_contratar_servicio", {
                    p_reserva_id: r.id,
                    p_servicio_id: v["servicio"],
                    p_cantidad: Number(v["cantidad"]),
                  });
                  await listo();
                }}
              />
            </>
          )}
        </>
      )}
      <h3 className="font-bold">Servicios contratados</h3>
      {r.servicios_contratados.length ? (
        r.servicios_contratados.map((s) => (
          <p className="text-sm" key={s.id}>
            {s.servicios_adicionales?.nombre} × {s.cantidad} ·{" "}
            {moneda(s.cantidad * Number(s.precio_unitario))}
          </p>
        ))
      ) : (
        <p className="text-sm">Sin servicios adicionales.</p>
      )}
      <h3 className="font-bold">Movimientos</h3>
      {r.pagos.length ? (
        r.pagos.map((p) => (
          <p className="text-sm" key={p.id}>
            {new Date(p.creado_en).toLocaleString("es-CL")} · {p.tipo} · {p.metodo} ·{" "}
            {moneda(Number(p.monto))} · {p.referencia}
          </p>
        ))
      ) : (
        <p className="text-sm">Sin pagos registrados.</p>
      )}
      <h3 className="font-bold">Historial</h3>
      {historial.error ? (
        <p role="alert">{errorMensaje(historial.error)}</p>
      ) : (
        historial.data?.map((e) => (
          <p className="text-sm" key={e.id}>
            {new Date(e.creado_en).toLocaleString("es-CL")} · {e.tipo_evento}
          </p>
        ))
      )}
    </div>
  );
}

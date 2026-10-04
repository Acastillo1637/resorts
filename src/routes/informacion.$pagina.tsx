import { createFileRoute, notFound } from "@tanstack/react-router";
import { SiteFooter } from "@/components/SiteFooter";
const contenido: Record<string, { titulo: string; texto: string[]; accion: string; href: string }> =
  {
    membresia: {
      titulo: "Membresía Almond Resorts",
      texto: [
        "Crea tu cuenta para consultar disponibilidad, reservar y gestionar tus estadías desde el portal del huésped.",
        "La cuenta no tiene costo. Los servicios y tarifas se muestran antes de confirmar cada reserva. Puedes suscribirte a novedades desde el pie de página.",
      ],
      accion: "Crear mi cuenta",
      href: "/registro",
    },
    arquitectos: {
      titulo: "Arquitectos y paisaje",
      texto: [
        "Descubre hoteles donde la arquitectura dialoga con el paisaje chileno: Antumalal en Pucón, Tierra Patagonia y los lodges Explora.",
        "Consulta la ficha de cada establecimiento y su sitio oficial para conocer su propuesta de diseño y alojamiento.",
      ],
      accion: "Explorar hoteles",
      href: "/hoteles",
    },
    eventos: {
      titulo: "Encuentros y eventos",
      texto: [
        "Encuentra alojamiento para tus encuentros en Chile. Puedes reservar habitaciones disponibles en el portal.",
        "Los salones, banquetes, grupos y eventos privados requieren coordinación directa con el establecimiento. La ficha enlaza su sitio oficial; no se incluyen en una reserva de habitación.",
      ],
      accion: "Elegir establecimiento",
      href: "/hoteles",
    },
    privacidad: {
      titulo: "Privacidad",
      texto: [
        "Almond Resorts utiliza los datos entregados al registrar tu cuenta —nombre, correo, documento y teléfono— para autenticarte y gestionar reservas. Supabase almacena la información y controla el acceso por usuario y rol.",
        "El personal autorizado del hotel accede a la información necesaria para operar tu estadía. La suscripción guarda tu correo solo para novedades, con tu consentimiento. La aplicación conserva una sesión de autenticación en tu navegador.",
        "Para solicitar acceso, rectificación o eliminación de tus datos, contacta a la administración que habilitó tu cuenta. La eliminación de antecedentes de reservas está sujeta a las obligaciones aplicables. Nunca compartas tu contraseña.",
      ],
      accion: "Mi cuenta",
      href: "/mi-cuenta",
    },
    terminos: {
      titulo: "Términos de reserva",
      texto: [
        "Las reservas se registran en el sistema de Almond Resorts y dependen de la disponibilidad de habitaciones para las fechas y capacidad seleccionadas. El portal muestra el precio antes de confirmar.",
        "La disponibilidad y las tarifas se consultan en Almond Resorts. Antes de confirmar, revisa las fechas, los huéspedes y los servicios incluidos en tu reserva. Las imágenes de ambiente se identifican como tales; no representan fotografías oficiales de los hoteles.",
        "Solo se incluyen los servicios expresamente listados en tu paquete. La existencia de un spa o restaurante no implica tratamientos ni alimentación incluidos. Las condiciones de temporada y operación del hotel se consultan en su sitio oficial.",
        "Gestiona modificaciones o cancelaciones en tu portal cuando el estado lo permita. Las reservas con pagos requieren conciliación y, cuando corresponda, reembolso del hotel antes de cancelar. La aplicación no procesa pagos con tarjeta.",
      ],
      accion: "Consultar hoteles",
      href: "/hoteles",
    },
  };
export const Route = createFileRoute("/informacion/$pagina")({
  loader: ({ params }) => {
    const pagina = contenido[params.pagina];
    if (!pagina) throw notFound();
    return pagina;
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.titulo ?? "Información"} — Almond Resorts` }],
  }),
  component: Informacion,
});
function Informacion() {
  const pagina = Route.useLoaderData();
  return (
    <div className="min-h-screen bg-paper">
      <main className="mx-auto max-w-3xl px-6 py-20">
        <h1 className="font-display text-5xl font-black tracking-tighter">{pagina.titulo}</h1>
        <div className="mt-8 space-y-6 text-lg text-ink-soft">
          {pagina.texto.map((t) => (
            <p key={t}>{t}</p>
          ))}
        </div>
        <a
          className="mt-10 inline-block rounded-full bg-accent px-8 py-4 font-bold text-cream"
          href={pagina.href}
        >
          {pagina.accion}
        </a>
      </main>
      <SiteFooter />
    </div>
  );
}

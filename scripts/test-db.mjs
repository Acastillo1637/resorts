import { execFileSync, spawn } from "node:child_process";
import { join } from "node:path";
const bin =
  process.env.PG_BIN ?? (process.platform === "win32" ? "C:/Program Files/PostgreSQL/17/bin" : "");
const exe = (name) => join(bin, name + (process.platform === "win32" ? ".exe" : ""));
const host = process.env.PGHOST ?? "127.0.0.1";
if (!["127.0.0.1", "localhost"].includes(host))
  throw new Error("Las pruebas solo permiten PostgreSQL local.");
const args = [
  "-h",
  host,
  "-p",
  process.env.PGPORT ?? "55439",
  "-U",
  process.env.PGUSER ?? "postgres",
];
const database = "maremoto_test_" + Date.now();
execFileSync(exe("createdb"), [...args, database], { stdio: "inherit" });
const psql = [...args, "-d", database, "-v", "ON_ERROR_STOP=1", "-P", "pager=off"];
function sql(text) {
  return execFileSync(exe("psql"), [...psql, "-At", "-c", text], { encoding: "utf8" }).trim();
}
function concurrent(text) {
  return new Promise((resolve) => {
    const p = spawn(exe("psql"), [...psql, "-c", text]);
    let err = "";
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => resolve({ code, err }));
  });
}
try {
  const files = [
    "tests/bootstrap.sql",
    "supabase/01_schema.sql",
    "supabase/02_seguridad_rls.sql",
    "supabase/03_funciones.sql",
    "supabase/04_datos_ejemplo_maremoto.sql",
    "supabase/05_parche_seguridad_funciones.sql",
    "supabase/06_realtime.sql",
    "supabase/07_gestion_hotelera.sql",
    "tests/integration.sql",
    "supabase/08_datos_demo.sql",
    "supabase/08_datos_demo.sql",
  ];
  execFileSync(exe("psql"), [...psql, ...files.flatMap((f) => ["-f", f])], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  sql(
    'insert into auth.users(id,raw_user_meta_data) values(\'40000000-0000-0000-0000-000000000001\',\'{"rut":"44444444-4","nombre":"Prueba concurrente"}\');',
  );
  const query =
    "begin; set local role authenticated; select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000001',true); select fn_guardar_reserva((select id from habitaciones where numero='C01'),current_date+30,current_date+32); select pg_sleep(0.3); commit;";
  const results = await Promise.all([concurrent(query), concurrent(query)]);
  if (
    results.filter((r) => r.code === 0).length !== 1 ||
    !results.some((r) => r.err.includes("reservas_sin_solapamiento"))
  )
    throw new Error("Falló la protección concurrente: " + JSON.stringify(results));
  console.log(
    "OK: migraciones 01–07, integración/RLS, registro Auth, semilla idempotente y dos reservas concurrentes.",
  );
} finally {
  // Solo elimina la base efímera cuyo nombre se generó en este proceso.
  execFileSync(exe("dropdb"), [...args, database], { stdio: "inherit" });
}

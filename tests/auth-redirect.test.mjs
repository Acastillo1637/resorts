import { test } from "node:test";
import assert from "node:assert/strict";
import { authRedirect } from "../src/lib/auth-redirect.ts";

test("los enlaces Auth conservan exactamente el origen y puerto de la aplicación", () => {
  for (const origin of [
    "http://localhost:5173",
    "http://192.168.1.42:5174",
    "https://almond.example",
  ])
    for (const path of ["/nueva-clave", "/mi-cuenta", "/mis-reservas"])
      assert.equal(authRedirect(origin, path), origin + path);
});
test("redirects rechazan protocolos y credenciales inapropiados", () => {
  for (const origin of [
    "javascript:alert(1)",
    "file:///tmp/app",
    "https://user:secret@example.org",
    "invalid",
  ])
    assert.throws(() => authRedirect(origin, "/nueva-clave"));
});

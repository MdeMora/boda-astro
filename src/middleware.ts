// Auth gate for the internal seating planner.
//
// Protects `/internal/seating` (page) and `/api/internal/*` (data endpoints)
// with a single hardcoded password (`miguel`) stored in a cookie. Everything
// else — the public wedding site — passes through untouched.
//
// Flow: an unauthenticated GET on the page renders a small password form that
// POSTs back to the same URL; a correct password sets the cookie. API requests
// just get a 401 JSON.
//
// The form submits as JSON via fetch, not as a native form POST: Chrome omits
// the `Origin` header on same-origin form navigations, and Astro's built-in
// CSRF middleware rejects form-content-type POSTs without it with a 403 before
// this middleware ever runs. JSON bodies are not form-like, so they pass.
import type { MiddlewareHandler } from "astro";

const PROTECTED_PAGE_PATH = "/internal/seating";
const PROTECTED_API_PATH = "/api/internal";

export const PASSWORD = "miguel";
export const COOKIE_NAME = "seating_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

const PRIVATE_HEADERS: ReadonlyArray<readonly [string, string]> = [
  ["Cache-Control", "no-store"],
  ["X-Robots-Tag", "noindex"],
  ["Referrer-Policy", "no-referrer"],
];

type Next = () => Promise<Response | undefined> | Response | undefined;
type ContextLike = { request: Request };

export const onRequest: MiddlewareHandler = (context, next) =>
  handleSeatingAuth(context, next);

/** Shared implementation so the decision table is unit-testable without Astro. */
export async function handleSeatingAuth(
  context: ContextLike,
  next: Next,
): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);
  if (!isProtectedPath(url.pathname)) {
    return toResponse(await next());
  }

  if (hasValidCookie(request)) {
    return withPrivateHeaders(toResponse(await next()));
  }

  if (request.method === "POST" && !isApiPath(url.pathname)) {
    const submitted = await readSubmittedPassword(request);
    const json = wantsJson(request);
    if (submitted === PASSWORD) {
      return withPrivateHeaders(loginSuccessResponse(url, json));
    }
    return withPrivateHeaders(
      json
        ? jsonResponse(401, { error: "Contraseña incorrecta" })
        : loginFormResponse(401, true),
    );
  }

  if (isApiPath(url.pathname)) {
    return withPrivateHeaders(
      jsonResponse(401, {
        error: "Unauthorized",
        hint: `Send the cookie ${COOKIE_NAME}=<password>, or log in at ${PROTECTED_PAGE_PATH}.`,
      }),
    );
  }

  return withPrivateHeaders(loginFormResponse(401, false));
}

/* ------------------------------------------------------------------ */
/* Path matching                                                       */
/* ------------------------------------------------------------------ */

function isProtectedPath(pathname: string): boolean {
  const path = pathname !== "/" ? pathname.replace(/\/+$/, "") : pathname;
  return (
    path === PROTECTED_PAGE_PATH ||
    path.startsWith(`${PROTECTED_PAGE_PATH}/`) ||
    path === PROTECTED_API_PATH ||
    path.startsWith(`${PROTECTED_API_PATH}/`)
  );
}

function isApiPath(pathname: string): boolean {
  return (
    pathname === PROTECTED_API_PATH ||
    pathname.startsWith(`${PROTECTED_API_PATH}/`)
  );
}

/* ------------------------------------------------------------------ */
/* Credentials                                                         */
/* ------------------------------------------------------------------ */

function hasValidCookie(request: Request): boolean {
  const cookies = request.headers.get("cookie");
  if (!cookies) return false;
  for (const part of cookies.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== COOKIE_NAME) continue;
    const value = part.slice(separator + 1).trim();
    if (decodeCookieValue(value) === PASSWORD) return true;
  }
  return false;
}

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function wantsJson(request: Request): boolean {
  return (request.headers.get("content-type") ?? "").includes(
    "application/json",
  );
}

async function readSubmittedPassword(
  request: Request,
): Promise<string | undefined> {
  try {
    if (wantsJson(request)) {
      const body: unknown = await request.json();
      const value = (body as { password?: unknown } | null)?.password;
      return typeof value === "string" ? value : undefined;
    }
    const value = (await request.formData()).get("password");
    return typeof value === "string" ? value : undefined;
  } catch {
    return undefined;
  }
}

/* ------------------------------------------------------------------ */
/* Responses                                                           */
/* ------------------------------------------------------------------ */

function withPrivateHeaders(response: Response): Response {
  for (const [name, value] of PRIVATE_HEADERS)
    response.headers.set(name, value);
  return response;
}

function toResponse(result: Response | undefined): Response {
  return result ?? new Response(null, { status: 404 });
}

function loginSuccessResponse(url: URL, json: boolean): Response {
  const secure = url.protocol === "https:" ? "; Secure" : "";
  const headers = new Headers({
    "Set-Cookie": `${COOKIE_NAME}=${encodeURIComponent(PASSWORD)}; Path=/; Max-Age=${COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax${secure}`,
  });
  // fetch login: 204, the page reloads itself. Native form post: redirect back.
  if (json) return new Response(null, { status: 204, headers });
  headers.set("Location", url.pathname + url.search);
  return new Response(null, { status: 303, headers });
}

function loginFormResponse(status: number, failed: boolean): Response {
  const errorText = failed ? "Contraseña incorrecta." : "";
  const body = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Acceso · Plan de mesa</title><style>
body{font-family:system-ui,sans-serif;background:#faf7f2;color:#33302b;display:grid;place-items:center;min-height:100vh;margin:0}
form{display:grid;gap:.75rem;width:min(20rem,90vw)}
h1{font-size:1.15rem;margin:0}
label{font-size:.9rem}
input,button{font:inherit;padding:.6rem .7rem;border-radius:.5rem;border:1px solid #d6cdbf}
button{background:#6b7d5a;color:#fff;border-color:#6b7d5a;cursor:pointer}
button[disabled]{opacity:.6;cursor:progress}
#error,noscript{color:#a2422f;margin:0;font-size:.9rem}
#error{min-height:1.2em}
</style></head><body>
<form id="login" method="post" autocomplete="on">
<h1>Plan de mesa · acceso</h1>
<noscript>Este acceso necesita JavaScript activado.</noscript>
<p id="error" role="alert">${errorText}</p>
<label for="password">Contraseña</label>
<input id="password" name="password" type="password" autocomplete="current-password" autofocus required>
<button type="submit">Entrar</button>
</form>
<script>
const form = document.getElementById("login");
const error = document.getElementById("error");
const input = document.getElementById("password");
const button = form.querySelector("button");
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.textContent = "";
  button.disabled = true;
  try {
    const response = await fetch(location.pathname + location.search, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ password: input.value }),
    });
    if (response.ok) {
      location.replace(location.pathname + location.search);
      return;
    }
    error.textContent =
      response.status === 401
        ? "Contraseña incorrecta."
        : "No se pudo iniciar sesión (" + response.status + ").";
  } catch {
    error.textContent = "No se pudo conectar con el servidor.";
  }
  button.disabled = false;
  input.select();
});
</script>
</body></html>`;
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function jsonResponse(status: number, payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

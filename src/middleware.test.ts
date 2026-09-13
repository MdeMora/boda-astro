import { describe, expect, test } from "bun:test";
import { COOKIE_NAME, PASSWORD, handleSeatingAuth } from "./middleware";

const PAGE = "/internal/seating";
const API = "/api/internal/guests";
const PUBLIC = "/rsvp";

const nextOk = () => new Response("NEXT", { status: 200 });

const run = (
  path: string,
  {
    cookie,
    method = "GET",
    body,
    contentType,
  }: {
    cookie?: string;
    method?: string;
    body?: BodyInit;
    contentType?: string;
  } = {},
) => {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  if (contentType) headers["content-type"] = contentType;
  const request = new Request(`https://wedding.example${path}`, {
    method,
    headers,
    body,
  });
  return handleSeatingAuth({ request }, nextOk);
};

const json = (password: unknown) => ({
  method: "POST",
  body: JSON.stringify({ password }),
  contentType: "application/json",
});

const authCookie = `${COOKIE_NAME}=${PASSWORD}`;

const form = (password: string) => {
  const data = new FormData();
  data.set("password", password);
  return data;
};

describe("unprotected paths", () => {
  test("public pages pass through untouched", async () => {
    const response = await run(PUBLIC);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("NEXT");
    expect(response.headers.get("cache-control")).toBeNull();
  });

  test("lookalike paths are not protected", async () => {
    const response = await run("/internal/seating-admin");
    expect(response.status).toBe(200);
  });

  test("trailing slash is still protected", async () => {
    const response = await run(`${PAGE}/`);
    expect(response.status).toBe(401);
  });
});

describe("page without a cookie", () => {
  test("renders the login form", async () => {
    const response = await run(PAGE);
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain('name="password"');
  });

  test("private headers are set", async () => {
    const response = await run(PAGE);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
});

describe("login (JSON, what the form actually sends)", () => {
  test("correct password sets the cookie and returns 204", async () => {
    const response = await run(PAGE, json(PASSWORD));
    expect(response.status).toBe(204);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${COOKIE_NAME}=${PASSWORD}`);
    expect(cookie).toContain("HttpOnly");
  });

  test("wrong password returns 401 JSON without a cookie", async () => {
    const response = await run(PAGE, json("nope"));
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(await response.json()).toMatchObject({
      error: "Contraseña incorrecta",
    });
  });

  test("a malformed JSON body does not log anyone in", async () => {
    const response = await run(PAGE, {
      method: "POST",
      body: "{not json",
      contentType: "application/json",
    });
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  test("a non-string password does not log anyone in", async () => {
    const response = await run(PAGE, json(true));
    expect(response.status).toBe(401);
  });
});

describe("login (native form fallback)", () => {
  test("correct password sets the cookie and redirects back", async () => {
    const response = await run(PAGE, { method: "POST", body: form(PASSWORD) });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(PAGE);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${COOKIE_NAME}=${PASSWORD}`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Secure");
  });

  test("wrong password re-renders the form with an error", async () => {
    const response = await run(PAGE, { method: "POST", body: form("nope") });
    expect(response.status).toBe(401);
    expect(await response.text()).toContain("incorrecta");
  });

  test("no Secure flag over plain http", async () => {
    const request = new Request(`http://localhost:4321${PAGE}`, {
      method: "POST",
      body: form(PASSWORD),
    });
    const response = await handleSeatingAuth({ request }, nextOk);
    expect(response.headers.get("set-cookie")).not.toContain("Secure");
  });
});

describe("with a valid cookie", () => {
  test("page passes through", async () => {
    const response = await run(PAGE, { cookie: authCookie });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("NEXT");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  test("api passes through", async () => {
    const response = await run(API, { cookie: authCookie });
    expect(response.status).toBe(200);
  });

  test("cookie is found among other cookies", async () => {
    const response = await run(PAGE, {
      cookie: `foo=bar; ${authCookie}; baz=qux`,
    });
    expect(response.status).toBe(200);
  });

  test("url-encoded cookie value is accepted", async () => {
    const response = await run(PAGE, {
      cookie: `${COOKIE_NAME}=${encodeURIComponent(PASSWORD)}`,
    });
    expect(response.status).toBe(200);
  });

  test("wrong cookie value is rejected", async () => {
    const response = await run(PAGE, { cookie: `${COOKIE_NAME}=nope` });
    expect(response.status).toBe(401);
  });
});

describe("api without a cookie", () => {
  test("returns 401 JSON, never HTML", async () => {
    const response = await run(API);
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toMatchObject({ error: "Unauthorized" });
  });

  test("POST to the api is not treated as a login", async () => {
    const response = await run(API, { method: "POST", body: form(PASSWORD) });
    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});

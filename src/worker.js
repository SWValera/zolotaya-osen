import { objects as catalog } from "../public/assets/js/objects.js";

const enc = new TextEncoder();
const cookieName = "zolotaya_osen_admin";
const sessionAge = 8 * 60 * 60;
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow",
    ...headers,
  },
});
const hex = (bytes) => [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
const randomHex = (size = 16) => hex(crypto.getRandomValues(new Uint8Array(size)));
const now = () => Math.floor(Date.now() / 1000);

async function readJson(request, maxBytes = 160_000) {
  if (!request.headers.get("Content-Type")?.startsWith("application/json")) throw new Error("Ожидаются данные формы.");
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > maxBytes) throw new Error("Слишком большой запрос.");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error("Слишком большой запрос.");
  return JSON.parse(text);
}

function normalizeSettings(input) {
  if (!input || typeof input !== "object" || !input.contact || !input.objects) throw new Error("Некорректные настройки сайта.");
  const phone = String(input.contact.phone || "").trim();
  const digits = phone.replace(/\D/g, "");
  if (!/^[+\d() .-]{10,32}$/.test(phone) || digits.length < 10 || digits.length > 15) throw new Error("Проверьте номер телефона.");
  const entries = {};
  for (const object of catalog) {
    const source = input.objects[object.id] || { price: null, priceUnit: object.priceUnit || "сутки", photos: object.photos || [] };
    if (!Array.isArray(source.photos) || source.photos.length > 50) throw new Error(`Проверьте фотографии объекта «${object.name}».`);
    let price = null;
    if (source.price !== null && source.price !== undefined) {
      const amount = Number(source.price.amount);
      if (!Number.isSafeInteger(amount) || amount < 0 || amount > 100_000_000 || source.price.currency !== "KZT") throw new Error(`Проверьте цену объекта «${object.name}».`);
      price = { amount, currency: "KZT" };
    }
    const priceUnit = ["сутки", "час", "посещение"].includes(source.priceUnit) ? source.priceUnit : "сутки";
    const photos = source.photos.map((photo) => {
      if (!photo || typeof photo.src !== "string" || photo.src.length > 500) throw new Error(`Проверьте фотографии объекта «${object.name}».`);
      if (!photo.src.startsWith("./assets/") && !/^\/api\/media\/[a-f0-9]{32}$/.test(photo.src)) throw new Error("Недопустимый адрес фотографии.");
      return { src: photo.src, alt: String(photo.alt || object.name).slice(0, 180) };
    });
    entries[object.id] = { price, priceUnit, photos };
  }
  return { version: 1, contact: { phone }, objects: entries, updatedAt: new Date().toISOString() };
}

async function settings(env, request) {
  const stored = await env.SITE_DATA.get("site-settings");
  if (stored) return JSON.parse(stored);
  const response = await env.ASSETS.fetch(new Request(new URL("/data/site-settings.json", request.url)));
  if (!response.ok) throw new Error("Initial settings file is unavailable.");
  return normalizeSettings(await response.json());
}

async function verifyPassword(password, encoded) {
  if (typeof password !== "string" || password.length > 256 || !encoded) return false;
  const [algorithm, count, salt, expected] = encoded.split("$");
  const iterations = Number(count);
  if (algorithm !== "pbkdf2" || !Number.isInteger(iterations) || iterations < 100_000 || iterations > 500_000 || !/^([a-f0-9]{2}){16,64}$/.test(salt || "") || !/^[a-f0-9]{64}$/.test(expected || "")) return false;
  const material = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const actual = hex(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: Uint8Array.from(salt.match(/../g), (byte) => parseInt(byte, 16)), iterations, hash: "SHA-256" }, material, 256));
  let diff = 0;
  for (let index = 0; index < actual.length; index++) diff |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return diff === 0;
}

async function signature(secret, value) {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(value)));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function session(request, env) {
  const value = request.headers.get("Cookie")?.match(new RegExp(`(?:^|;\\s*)${cookieName}=([a-zA-Z0-9._-]+)(?:;|$)`))?.[1];
  if (!value || !env.ADMIN_PASSWORD_HASH) return null;
  const [expires, nonce, csrf, signed] = value.split(".");
  if (!/^\d{10}$/.test(expires || "") || !/^[a-f0-9]{32}$/.test(nonce || "") || !/^[a-f0-9]{32}$/.test(csrf || "") || !signed || Number(expires) <= now()) return null;
  const expected = await signature(env.ADMIN_PASSWORD_HASH, `${expires}.${nonce}.${csrf}`);
  let diff = expected.length ^ signed.length;
  for (let index = 0; index < Math.min(expected.length, signed.length); index++) diff |= expected.charCodeAt(index) ^ signed.charCodeAt(index);
  return diff === 0 ? { csrf } : null;
}

function setSessionCookie(request, value, maxAge = sessionAge) {
  return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${new URL(request.url).protocol === "https:" ? "; Secure" : ""}`;
}

function sameOrigin(request) {
  return request.headers.get("Origin") === new URL(request.url).origin;
}

async function rateLimited(request, env) {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const digest = hex(await crypto.subtle.digest("SHA-256", enc.encode(ip)));
  const key = `login-attempts:${digest}`;
  const attempts = Number(await env.SITE_DATA.get(key) || 0);
  if (attempts >= 8) return true;
  await env.SITE_DATA.put(key, String(attempts + 1), { expirationTtl: 900 });
  return false;
}

async function api(request, env, url) {
  const path = url.pathname;
  if (path === "/api/settings" && request.method === "GET") return json(await settings(env, request));
  if (path === "/api/admin/login" && request.method === "POST") {
    if (!sameOrigin(request)) return json({ error: "Недопустимый источник запроса." }, 403);
    if (!env.ADMIN_PASSWORD_HASH) return json({ error: "Вход ещё не настроен." }, 503);
    if (await rateLimited(request, env)) return json({ error: "Слишком много попыток. Попробуйте через 15 минут." }, 429, { "Retry-After": "900" });
    const input = await readJson(request, 2_000);
    if (!await verifyPassword(input.password, env.ADMIN_PASSWORD_HASH)) return json({ error: "Неверный пароль." }, 401);
    await env.SITE_DATA.delete(`login-attempts:${hex(await crypto.subtle.digest("SHA-256", enc.encode(request.headers.get("CF-Connecting-IP") || "unknown")))}`);
    const expires = String(now() + sessionAge), nonce = randomHex(), csrf = randomHex();
    const value = `${expires}.${nonce}.${csrf}.${await signature(env.ADMIN_PASSWORD_HASH, `${expires}.${nonce}.${csrf}`)}`;
    return json({ ok: true, csrf }, 200, { "Set-Cookie": setSessionCookie(request, value) });
  }

  const auth = await session(request, env);
  if (!auth) return json({ error: "Войдите в админку." }, 401);
  if (request.method !== "GET" && (!sameOrigin(request) || request.headers.get("X-CSRF-Token") !== auth.csrf)) return json({ error: "Обновите страницу и повторите действие." }, 403);

  if (path === "/api/admin/session" && request.method === "GET") return json({ ok: true, csrf: auth.csrf });
  if (path === "/api/admin/settings" && request.method === "GET") return json({ data: await settings(env, request), csrf: auth.csrf });
  if (path === "/api/admin/settings" && request.method === "PUT") {
    const data = normalizeSettings(await readJson(request));
    await env.SITE_DATA.put("site-settings", JSON.stringify(data));
    return json({ ok: true, data });
  }
  if (path === "/api/admin/logout" && request.method === "POST") {
    return json({ ok: true }, 200, { "Set-Cookie": setSessionCookie(request, "", 0) });
  }
  if (path === "/api/admin/photos" && request.method === "POST") {
    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > 5_500_000) return json({ error: "Фото слишком большое после сжатия." }, 413);
    const form = await request.formData();
    const file = form.get("file"), objectId = String(form.get("objectId") || ""), alt = String(form.get("alt") || "").slice(0, 180);
    if (!(file instanceof File) || file.size < 1 || file.size > 5_000_000 || file.type !== "image/webp") return json({ error: "Загрузите фото WebP до 5 МБ." }, 400);
    if (!catalog.some((item) => item.id === objectId)) return json({ error: "Объект не найден." }, 400);
    const id = randomHex();
    await env.SITE_DATA.put(`media:${id}`, await file.arrayBuffer(), { metadata: { contentType: "image/webp" } });
    return json({ photo: { src: `/api/media/${id}`, alt } });
  }
  const mediaDelete = path.match(/^\/api\/admin\/photos\/([a-f0-9]{32})$/);
  if (mediaDelete && request.method === "DELETE") {
    await env.SITE_DATA.delete(`media:${mediaDelete[1]}`);
    return json({ ok: true });
  }
  return json({ error: "Страница не найдена." }, 404);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/admin") return Response.redirect(`${url.origin}/admin/`, 308);
      const media = url.pathname.match(/^\/api\/media\/([a-f0-9]{32})$/);
      if (media && ["GET", "HEAD"].includes(request.method)) {
        const result = await env.SITE_DATA.getWithMetadata(`media:${media[1]}`, "arrayBuffer");
        if (!result.value) return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
        return new Response(request.method === "HEAD" ? null : result.value, { headers: { "Content-Type": result.metadata?.contentType || "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
      }
      if (url.pathname.startsWith("/api/")) {
        if (!(["GET", "POST", "PUT", "DELETE"].includes(request.method))) return json({ error: "Метод не поддерживается." }, 405, { Allow: "GET, POST, PUT, DELETE" });
        try { return await api(request, env, url); }
        catch (error) {
          const badRequest = error instanceof SyntaxError || ["Ожидаются данные формы.", "Слишком большой запрос."].includes(error.message) || error.message.startsWith("Проверьте") || error.message.startsWith("Цена ") || error.message.startsWith("Недопустимый") || error.message.startsWith("Некорректные") || error.message.startsWith("Загрузите");
          return json({ error: badRequest ? (error instanceof SyntaxError ? "Некорректные данные." : error.message) : "Не удалось выполнить действие. Повторите попытку." }, badRequest ? 400 : 503);
        }
      }
      return env.ASSETS.fetch(request);
    } catch {
      return new Response("Сайт временно недоступен. Пожалуйста, обновите страницу.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "30" } });
    }
  },
};

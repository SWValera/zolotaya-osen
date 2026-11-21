import { objects as catalog, types } from "../assets/js/objects.js";

const $ = (id) => document.getElementById(id);
let data = null, csrf = "", dirty = false, busy = false;
const removedMedia = new Set();
const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function status(message = "", kind = "") { $("status").textContent = message; $("status").className = `status ${kind}`; }
function showLogin() { csrf = ""; data = null; $("password").value = ""; $("login").hidden = false; $("editor").hidden = true; }
function markDirty() { dirty = true; $("save").disabled = busy; $("save-state").textContent = "Есть несохранённые изменения"; status(); }
async function api(path, { method = "GET", body } = {}) {
  const form = body instanceof FormData;
  const headers = { ...(body && !form ? { "Content-Type": "application/json" } : {}), ...(method !== "GET" && csrf ? { "X-CSRF-Token": csrf } : {}) };
  let response;
  try { response = await fetch(path, { method, headers, ...(body ? { body: form ? body : JSON.stringify(body) } : {}), credentials: "same-origin", cache: "no-store", signal: AbortSignal.timeout(30000) }); }
  catch { throw new Error("Связь прервалась. Проверьте подключение и повторите попытку."); }
  let result;
  try { result = await response.json(); } catch { throw new Error("Не удалось прочитать ответ сайта. Обновите страницу."); }
  if (!response.ok) { const error = new Error(result.error || "Не удалось выполнить действие."); error.status = response.status; throw error; }
  return result;
}
function photosFor(id) { return data.objects[id].photos; }
function renderObjects() {
  const rentables = catalog.filter((item) => ["house", "bath", "gazebo"].includes(item.type));
  const other = catalog.filter((item) => item.type === "place");
  const renderCard = (item, includePrice) => {
    const entry = data.objects[item.id];
    const amount = entry.price && Number.isFinite(entry.price.amount) ? entry.price.amount : "";
    const photos = entry.photos.map((photo, index) => `<figure class="photo-item" data-object="${item.id}" data-index="${index}">
      <img src="${escapeHTML(photo.preview || (photo.src.startsWith("http") || photo.src.startsWith("/") ? photo.src : new URL(photo.src, location.origin + "/").href))}" alt="" loading="lazy" />
      <label>Описание фото<input data-photo-alt="${index}" value="${escapeHTML(photo.alt)}" maxlength="180" aria-label="Описание фотографии" /></label>
      <div class="photo-actions"><button type="button" data-move="-1" aria-label="Переместить фото выше">↑ Выше</button><button type="button" data-move="1" aria-label="Переместить фото ниже">↓ Ниже</button><button class="delete" type="button" data-delete="${index}">Удалить</button></div>
    </figure>`).join("");
    return `<details class="object-card"><summary><span class="object-name">${escapeHTML(item.name)}</span><span class="object-type">${escapeHTML(types[item.type] || "Объект")}</span></summary><div class="object-content">
      ${includePrice ? `<div class="price-row"><label>Цена, ₸<input data-price="${item.id}" type="number" min="0" max="100000000" step="100" inputmode="numeric" value="${amount}" placeholder="Уточняется" /></label><label>Единица<select data-unit="${item.id}"><option value="сутки" ${entry.priceUnit === "сутки" ? "selected" : ""}>За сутки</option><option value="час" ${entry.priceUnit === "час" ? "selected" : ""}>За час</option><option value="посещение" ${entry.priceUnit === "посещение" ? "selected" : ""}>За посещение</option></select></label><p class="hint">Оставьте поле пустым, если цена уточняется.</p></div>` : ""}
      <div class="gallery-heading"><h3>Фотографии (${entry.photos.length})</h3><label class="add-photo">＋ Добавить фото<input data-add="${item.id}" type="file" accept="image/*" multiple hidden /></label></div>
      ${entry.photos.length ? `<div class="photo-grid">${photos}</div>` : `<p class="empty-gallery">Пока нет фотографий. Добавьте их с телефона или компьютера.</p>`}
    </div></details>`;
  };
  $("objects").innerHTML = `<section class="object-section"><h3>Домики, бани и беседки</h3><div class="object-groups">${rentables.map((item) => renderCard(item, true)).join("")}</div></section>
    <section class="object-section"><h3>Другие объекты</h3><div class="object-groups">${other.map((item) => renderCard(item, false)).join("")}</div></section>`;
}
function populate() {
  $("phone").value = data.contact.phone;
  renderObjects(); dirty = false; $("save").disabled = true; $("save-state").textContent = "Все изменения сохранены";
  $("updated").textContent = data.updatedAt ? `Обновлено: ${new Date(data.updatedAt).toLocaleString("ru-RU")}` : "";
}
function normalize(settings) {
  if (!settings?.contact || !settings?.objects) throw new Error("Настройки сайта пока не загружены.");
  for (const item of catalog) settings.objects[item.id] ||= { price: null, priceUnit: item.priceUnit || "сутки", photos: item.photos || [] };
  for (const item of catalog) settings.objects[item.id].photos ||= [];
  return settings;
}
async function loadSettings() {
  const result = await api("/api/admin/settings");
  csrf = result.csrf; data = normalize(result.data); populate(); $("login").hidden = true; $("editor").hidden = false; status();
}
async function compress(file) {
  if (file.size > 25 * 1024 * 1024) throw new Error(`Фото «${file.name}» больше 25 МБ.`);
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d", { alpha: false }); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close();
  const blob = await new Promise((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error(`Не удалось обработать фото «${file.name}».`)), "image/webp", 0.84));
  return new File([blob], `${crypto.randomUUID()}.webp`, { type: "image/webp" });
}
function validate() {
  const phone = $("phone").value.trim(), digits = phone.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) throw new Error("Проверьте номер телефона: нужно от 10 до 15 цифр.");
  for (const item of catalog) if (["house", "bath", "gazebo"].includes(item.type)) {
    const raw = $(`[data-price="${item.id}"]`).value.trim();
    const amount = raw === "" ? null : Number(raw);
    if (amount !== null && (!Number.isSafeInteger(amount) || amount < 0 || amount > 100_000_000)) throw new Error(`Проверьте цену объекта «${item.name}».`);
    data.objects[item.id].price = amount === null ? null : { amount, currency: "KZT" };
    data.objects[item.id].priceUnit = $(`[data-unit="${item.id}"]`).value;
  }
  data.contact.phone = phone; data.updatedAt = new Date().toISOString();
}
$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault(); const button = event.submitter; button.disabled = true; status("Входим…");
  try {
    const result = await api("/api/admin/login", { method: "POST", body: { password: $("password").value } });
    csrf = result.csrf; $("password").value = ""; await loadSettings();
  } catch (error) { showLogin(); status(error.message, "error"); }
  finally { button.disabled = false; }
});
$("settings-form").addEventListener("input", (event) => {
  if (event.target.matches("[data-photo-alt]")) {
    const figure = event.target.closest(".photo-item");
    const photo = photosFor(figure.dataset.object)[Number(figure.dataset.index)];
    photo.alt = event.target.value;
  }
  markDirty();
});
$("settings-form").addEventListener("change", async (event) => {
  const input = event.target;
  if (!input.matches("[data-add]")) return;
  const id = input.dataset.add, object = catalog.find((item) => item.id === id); input.disabled = true;
  try {
    for (const file of [...input.files]) {
      const optimized = await compress(file), preview = URL.createObjectURL(optimized);
      photosFor(id).push({ src: "", preview, alt: `${object.name} — фото ${photosFor(id).length + 1}`, pending: optimized });
    }
    markDirty(); renderObjects();
    $("objects").querySelectorAll("details").forEach((details) => { if (details.querySelector(`[data-add="${id}"]`)) details.open = true; });
  } catch (error) { status(error.message, "error"); }
  finally { input.disabled = false; }
});
$("objects").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-delete],button[data-move]"); if (!button) return;
  const figure = button.closest(".photo-item"), id = figure.dataset.object, photos = photosFor(id), index = Number(figure.dataset.index);
  if (button.hasAttribute("data-delete")) {
    const source = photos[index].src, mediaId = source.match(/^\/api\/media\/([a-f0-9]{32})$/)?.[1];
    if (mediaId) removedMedia.add(mediaId);
    photos.splice(index, 1);
  } else {
    const next = index + Number(button.dataset.move); if (next < 0 || next >= photos.length) return;
    const [photo] = photos.splice(index, 1); photos.splice(next, 0, photo);
  }
  markDirty(); renderObjects();
  $("objects").querySelectorAll("details").forEach((details) => { if (details.querySelector(`[data-add="${id}"]`)) details.open = true; });
});
$("settings-form").addEventListener("submit", async (event) => {
  event.preventDefault(); if (busy || !dirty) return;
  try { validate(); } catch (error) { status(error.message, "error"); return; }
  busy = true; $("save").disabled = true; $("save").textContent = "Сохраняем…"; status("Сохраняем настройки и фотографии…");
  try {
    for (const item of catalog) for (const photo of data.objects[item.id].photos) if (photo.pending) {
      const form = new FormData(); form.append("objectId", item.id); form.append("alt", photo.alt); form.append("file", photo.pending, photo.pending.name);
      const uploaded = await api("/api/admin/photos", { method: "POST", body: form });
      photo.src = uploaded.photo.src; photo.preview = ""; photo.pending = null;
    }
    const payload = { version: 1, contact: { phone: data.contact.phone }, updatedAt: data.updatedAt, objects: {} };
    for (const item of catalog) {
      const entry = data.objects[item.id];
      payload.objects[item.id] = { price: entry.price, priceUnit: entry.priceUnit, photos: entry.photos.map(({ src, alt }) => ({ src, alt })) };
    }
    const saved = await api("/api/admin/settings", { method: "PUT", body: payload }); data = normalize(saved.data);
    for (const id of removedMedia) {
      const stillUsed = Object.values(data.objects).some((entry) => entry.photos.some((photo) => photo.src === `/api/media/${id}`));
      if (!stillUsed) await api(`/api/admin/photos/${id}`, { method: "DELETE" });
    }
    removedMedia.clear(); populate(); status("Сохранено. Изменения опубликованы на сайте.", "success");
  } catch (error) { status(error.message, "error"); if (error.status === 401) showLogin(); }
  finally { busy = false; $("save").disabled = !dirty; $("save").textContent = "Сохранить изменения"; }
});
$("logout").addEventListener("click", async () => {
  if (dirty && !confirm("Выйти без сохранения изменений?")) return;
  try { await api("/api/admin/logout", { method: "POST", body: {} }); showLogin(); status("Вы вышли из админки."); }
  catch (error) { status(error.message, "error"); }
});
window.addEventListener("beforeunload", (event) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });
showLogin();
api("/api/admin/session").then((result) => { csrf = result.csrf; return loadSettings(); }).catch((error) => {
  if (error.status === 401) status("Введите пароль администратора."); else status(error.message, "error");
});

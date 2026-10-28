import { objects, types, statuses, mapConfig, contact } from "./objects.js";

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [
  ...parent.querySelectorAll(selector),
];
const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const icon = (id) => `<svg aria-hidden="true"><use href="#${id}"/></svg>`;
const statusOf = (object) => statuses[object.status] || statuses.unconfirmed;
const viewport = $("#map-viewport");
const map = $("#territory-map");
const shell = $("#map-shell");
const detailDialog = $("#object-dialog");
const tooltip = $("#map-tooltip");
let currentFilter = "house";
let selected = null;
let returnFocus = null;
let zoom = 1,
  x = 0,
  y = 0,
  baseScale = 1;
let fullscreen = false;
let fullscreenFocus = null;
let inertElements = [];
let movedUntil = 0;
const pointers = new Map();

function priceText(object) {
  if (object.price === null || object.price === undefined)
    return "Уточнить стоимость";
  // Валюта всегда задаётся явно вместе с ценой: числовая цена без валюты не публикуется.
  if (!object.price.currency || !Number.isFinite(object.price.amount))
    return "Уточнить стоимость";
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: object.price.currency,
      maximumFractionDigits: 0,
    }).format(object.price.amount);
  } catch {
    return "Уточнить стоимость";
  }
}

function renderList() {
  const mapPosition = (object) => {
    const points = (object.points || "").split(" ").map((point) => point.split(",").map(Number));
    if (!points.length || points.some((point) => point.length !== 2 || point.some(Number.isNaN)))
      return { x: 0, y: 0 };
    return {
      x: points.reduce((sum, point) => sum + point[0], 0) / points.length,
      y: points.reduce((sum, point) => sum + point[1], 0) / points.length,
    };
  };
  const items = objects
    .filter((o) => o.type === currentFilter)
    .sort((a, b) => {
      const first = mapPosition(a);
      const second = mapPosition(b);
      return second.y - first.y || first.x - second.x;
    });
  $("#list-caption").textContent =
    `${types[currentFilter]} на генплане · ${items.length}`;
  $("#object-list").innerHTML = items
    .map(
      (o, index) =>
        `<button class="object-row${selected === o.id ? " selected" : ""}" data-object="${escapeHTML(o.id)}"><span class="row-number">${String(index + 1).padStart(2, "0")}</span><span class="row-copy"><strong>${escapeHTML(o.name)}</strong><small>${escapeHTML(priceText(o))}</small></span>${icon("arrow")}</button>`,
    )
    .join("");
  $$(".map-area").forEach((area) =>
    area.classList.toggle("dimmed", area.dataset.type !== currentFilter),
  );
}

function buildMap() {
  const ns = "http://www.w3.org/2000/svg";
  map.setAttribute("viewBox", `0 0 ${mapConfig.width} ${mapConfig.height}`);
  const image = $("image", map);
  image.setAttribute("href", mapConfig.image);
  image.setAttribute("width", mapConfig.width);
  image.setAttribute("height", mapConfig.height);
  for (const o of objects) {
    if (!o.points) continue;
    const polygon = document.createElementNS(ns, "polygon");
    polygon.setAttribute("points", o.points);
    polygon.setAttribute("id", o.mapAreaId);
    polygon.setAttribute("role", "button");
    polygon.setAttribute("tabindex", "0");
    polygon.setAttribute(
      "aria-label",
      `${o.name}. ${statusOf(o).label}. Открыть карточку`,
    );
    polygon.setAttribute("aria-haspopup", "dialog");
    polygon.setAttribute("aria-pressed", "false");
    polygon.classList.add("map-area");
    polygon.dataset.object = o.id;
    polygon.dataset.type = o.type;
    polygon.addEventListener("pointerenter", (event) => {
      if (event.pointerType !== "touch") showTooltip(o, polygon);
    });
    polygon.addEventListener("pointerleave", hideTooltip);
    polygon.addEventListener("focus", () => showTooltip(o, polygon));
    polygon.addEventListener("blur", hideTooltip);
    polygon.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openObject(o.id, polygon);
      }
    });
    $("#map-areas").append(polygon);
  }
}
function showTooltip(o, area) {
  const rect = area.getBoundingClientRect(),
    bounds = viewport.getBoundingClientRect();
  tooltip.textContent = o.name;
  tooltip.hidden = false;
  tooltip.style.left = `${Math.max(8, Math.min(bounds.width - tooltip.offsetWidth - 8, rect.x - bounds.x + rect.width / 2 - tooltip.offsetWidth / 2))}px`;
  tooltip.style.top = `${Math.max(65, Math.min(bounds.height - 50, rect.y - bounds.y - 35))}px`;
}
function hideTooltip() {
  tooltip.hidden = true;
}
function clampPosition() {
  const w = mapConfig.width * baseScale * zoom,
    h = mapConfig.height * baseScale * zoom;
  x =
    w <= viewport.clientWidth
      ? (viewport.clientWidth - w) / 2
      : Math.min(0, Math.max(viewport.clientWidth - w, x));
  y =
    h <= viewport.clientHeight
      ? (viewport.clientHeight - h) / 2
      : Math.min(0, Math.max(viewport.clientHeight - h, y));
}
function transform() {
  clampPosition();
  map.style.transform = `translate(${x}px,${y}px) scale(${baseScale * zoom})`;
  viewport.classList.toggle("can-drag", zoom > 1);
  $("#zoom-level").textContent = `${Math.round(zoom * 100)}%`;
  $("#zoom-in").disabled = zoom >= 4;
  $("#zoom-out").disabled = zoom <= 1;
  hideTooltip();
}
function resizeMap() {
  baseScale = Math.min(
    viewport.clientWidth / mapConfig.width,
    viewport.clientHeight / mapConfig.height,
  );
  map.style.width = `${mapConfig.width}px`;
  map.style.height = `${mapConfig.height}px`;
  if (selected) focusObject(objects.find((o) => o.id === selected));
  else resetMap();
}
function resetMap() {
  zoom = 1;
  x = 0;
  y = 0;
  transform();
}
function setZoom(
  value,
  cx = viewport.clientWidth / 2,
  cy = viewport.clientHeight / 2,
) {
  const next = Math.min(4, Math.max(1, value));
  const ratio = next / zoom;
  x = cx - (cx - x) * ratio;
  y = cy - (cy - y) * ratio;
  zoom = next;
  transform();
}
function focusObject(o) {
  if (!o?.points) return resetMap();
  const coordinates = o.points.split(" ").map((p) => p.split(",").map(Number));
  const xs = coordinates.map((p) => p[0]),
    ys = coordinates.map((p) => p[1]);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  zoom = 2.1;
  x = viewport.clientWidth / 2 - cx * baseScale * zoom;
  y = viewport.clientHeight / 2 - cy * baseScale * zoom;
  transform();
}

function openObject(id, trigger) {
  const object = objects.find((o) => o.id === id);
  if (!object) return;
  returnFocus = trigger || document.activeElement;
  selected = id;
  currentFilter = object.type;
  $$("[data-filter]").forEach((b) => {
    const active = b.dataset.filter === currentFilter;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", active);
  });
  renderList();
  $$(".map-area").forEach((area) => {
    const active = area.dataset.object === id;
    area.classList.toggle("is-selected", active);
    area.setAttribute("aria-pressed", active);
  });
  if (!fullscreen)
    shell.scrollIntoView({ behavior: "instant", block: "center" });
  focusObject(object);
  const status = statusOf(object);
  const facts = [
    object.capacity != null && ["Вместимость", object.capacityLabel || `${object.capacity} гостей`],
    object.beds != null && ["Спальные места", object.beds],
  ].filter(Boolean);
  const factsMarkup = facts.length
    ? `<dl class="detail-facts">${facts.map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join("")}</dl>`
    : `<p class="detail-note">Вместимость и комплектацию уточните у администрации.</p>`;
  const amenitiesMarkup = object.amenities.length
    ? `<h3>Удобства</h3><ul class="amenities">${object.amenities.map((a) => `<li>${escapeHTML(a)}</li>`).join("")}</ul>`
    : "";
  $("#object-detail").innerHTML = `
    <div class="detail-visual" id="detail-visual"></div>
    <div class="detail-body">
      <p class="eyebrow">${escapeHTML(types[object.type] || "Объект территории")}</p>
      <h2 id="object-title">${escapeHTML(object.name)}</h2>
      <span class="status-badge" data-status="${escapeHTML(object.status)}">${escapeHTML(status.label)}</span>
      <p class="detail-description">${escapeHTML(object.description)}</p>
      ${factsMarkup}
      ${amenitiesMarkup}
      <h3>Готовность и посещение</h3>
      <p class="detail-note">${escapeHTML(status.note)}${object.opening && ["building", "planned"].includes(object.status) ? ` ${escapeHTML(object.opening)}` : ""}</p>
      <div class="price-block">
        <strong>${escapeHTML(priceText(object))}</strong>
        <span>${object.price?.currency && Number.isFinite(object.price.amount) ? `за ${escapeHTML(object.priceUnit)}` : "Стоимость зависит от объекта и даты"}</span>
      </div>
      <a class="button button-green detail-contact" href="tel:${escapeHTML(contact.phone)}">
        Позвонить администрации ${icon("arrow")}
      </a>
    </div>`;
  renderGallery(object);
  if (!detailDialog.open) detailDialog.showModal();
  updateBodyLock();
}
function renderGallery(object) {
  const root = $("#detail-visual");
  const photos = object.photos || [];
  const placeholder = (message) => {
    root.innerHTML = `${icon(object.type === "house" ? "house" : "leaf")}<span>${escapeHTML(message)}</span>`;
  };
  if (!photos.length) return placeholder("Реальные фотографии объекта пока не добавлены");
  let index = 0;
  const img = document.createElement("img");
  img.decoding = "async";
  img.width = 900;
  img.height = 600;
  root.append(img);
  const controls = document.createElement("div");
  controls.className = "gallery-controls";
  controls.innerHTML =
    '<button aria-label="Предыдущее фото">‹</button><button aria-label="Следующее фото">›</button>';
  if (photos.length > 1) root.append(controls);
  const update = () => {
    const photo = photos[index];
    img.alt =
      typeof photo === "string"
        ? `${object.name} — фото ${index + 1}`
        : photo.alt || `${object.name} — фото ${index + 1}`;
    img.hidden = false;
    $(".photo-error", root)?.remove();
    img.src = typeof photo === "string" ? photo : photo.src;
  };
  img.addEventListener("error", () => {
    img.hidden = true;
    $(".photo-error", root)?.remove();
    const note = document.createElement("span");
    note.className = "photo-error";
    note.textContent = "Фотография пока недоступна";
    root.prepend(note);
  });
  const buttons = $$("button", controls);
  buttons[0].onclick = () => {
    index = (index + photos.length - 1) % photos.length;
    update();
  };
  buttons[1].onclick = () => {
    index = (index + 1) % photos.length;
    update();
  };
  attachGallerySwipe(root, buttons[0].onclick, buttons[1].onclick);
  update();
}
function attachGallerySwipe(element, previous, next) {
  let start = null;
  element.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" || event.target.closest("button")) return;
    start = { x: event.clientX, y: event.clientY };
  }, { passive: true });
  element.addEventListener("pointerup", (event) => {
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.abs(dx) < 42 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    (dx < 0 ? next : previous)();
  }, { passive: true });
  element.addEventListener("pointercancel", () => { start = null; }, { passive: true });
}
function initHomeGalleries() {
  const groups = {
    "a-frame": objects.filter((o) => o.id === "a-frame"),
    river: objects.filter((o) => o.id.startsWith("river-")),
    upper: objects.filter((o) => o.id.startsWith("upper-")),
    bath: objects.filter((o) => o.id.startsWith("bath-")),
    gazebo: objects.filter((o) => o.id.startsWith("gazebo-")),
  };
  $$('[data-home-gallery]').forEach((gallery) => {
    const objectPhotos = (groups[gallery.dataset.homeGallery] || [])
      .flatMap((o) => o.photos || []);
    const fallback = $("img", gallery);
    const photos = objectPhotos.length ? objectPhotos : fallback ? [{ src: fallback.src, alt: fallback.alt }] : [];
    if (!photos.length) return;

    let index = 0;
    let image = fallback;
    if (!image) {
      image = document.createElement("img");
      gallery.prepend(image);
    }
    image.classList.add("home-gallery-image");
    image.draggable = false;
    const update = () => {
      const photo = photos[index];
      image.src = typeof photo === "string" ? photo : photo.src;
      image.alt = typeof photo === "string" ? `Фото ${index + 1}` : photo.alt || `Фото ${index + 1}`;
      image.dataset.galleryIndex = String(index);
      gallery.dataset.galleryCount = String(photos.length);
    };
    if (photos.length > 1) {
      const controls = document.createElement("div");
      controls.className = "home-gallery-controls";
      controls.innerHTML = '<button type="button" aria-label="Предыдущее фото">‹</button><button type="button" aria-label="Следующее фото">›</button>';
      gallery.append(controls);
      const buttons = $$('button', controls);
      buttons[0].onclick = () => { index = (index + photos.length - 1) % photos.length; update(); };
      buttons[1].onclick = () => { index = (index + 1) % photos.length; update(); };
      attachGallerySwipe(gallery, buttons[0].onclick, buttons[1].onclick);
    }
    update();
  });
}
function updateBodyLock() {
  document.body.classList.toggle("locked", fullscreen || detailDialog.open);
}
function phoneLabel(phone) {
  return phone === "+77763055000" ? "+7 (776) 305-50-00" : phone;
}

function toggleFullscreen(force) {
  fullscreen = force ?? !fullscreen;
  shell.classList.toggle("is-fullscreen", fullscreen);
  $("#fullscreen").innerHTML = fullscreen
    ? "Закрыть карту <span>×</span>"
    : "На весь экран <span>⛶</span>";
  $("#fullscreen").setAttribute(
    "aria-label",
    fullscreen ? "Закрыть полноэкранную карту" : "Открыть карту на весь экран",
  );
  $("#fullscreen").setAttribute("aria-pressed", fullscreen);
  $("#map-help").textContent = fullscreen
    ? "Два пальца — масштаб · Перетаскивание — перемещение"
    : "Нажмите на объект, чтобы узнать больше";
  if (fullscreen) {
    fullscreenFocus = document.activeElement;
    shell.setAttribute("role", "dialog");
    shell.setAttribute("aria-modal", "true");
    shell.setAttribute("aria-label", "Карта территории на весь экран");
    // Изолируем карту для клавиатуры и скринридеров, оставляя нативные диалоги работоспособными.
    let branch = shell;
    while (branch.parentElement && branch !== document.body) {
      for (const sibling of branch.parentElement.children)
        if (
          sibling !== branch &&
          sibling.tagName !== "DIALOG" &&
          !sibling.inert
        ) {
          sibling.inert = true;
          inertElements.push(sibling);
        }
      branch = branch.parentElement;
    }
    $("#fullscreen").focus();
  } else {
    shell.removeAttribute("role");
    shell.removeAttribute("aria-modal");
    shell.removeAttribute("aria-label");
    inertElements.forEach((el) => {
      el.inert = false;
    });
    inertElements = [];
    fullscreenFocus?.focus({ preventScroll: true });
  }
  pointers.clear();
  viewport.classList.remove("dragging");
  updateBodyLock();
  requestAnimationFrame(resizeMap);
}

$("#fullscreen").onclick = () => toggleFullscreen();
$("#zoom-in").onclick = () => setZoom(zoom * 1.35);
$("#zoom-out").onclick = () => setZoom(zoom / 1.35);
$("#zoom-reset").onclick = resetMap;
$$(".dialog-close").forEach(
  (b) => (b.onclick = () => b.closest("dialog").close()),
);
for (const dialog of [detailDialog]) {
  dialog.addEventListener("click", (e) => {
    if (performance.now() <= movedUntil) return;
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        dialog.close();
    }
  });
  dialog.addEventListener("close", updateBodyLock);
}
detailDialog.addEventListener("close", () => {
  selected = null;
  $$(".map-area").forEach((a) => {
    a.classList.remove("is-selected");
    a.setAttribute("aria-pressed", "false");
  });
  renderList();
  resetMap();
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  else $("#object-list button")?.focus({ preventScroll: true });
});
$$("[data-filter]").forEach(
  (button) =>
    (button.onclick = () => {
      currentFilter = button.dataset.filter;
      $$("[data-filter]").forEach((b) => {
        b.classList.toggle("active", b === button);
        b.setAttribute("aria-pressed", b === button);
      });
      renderList();
    }),
);
document.addEventListener("click", (e) => {
  const target = e.target.closest("[data-object], [data-select]");
  if (target && performance.now() > movedUntil)
    openObject(target.dataset.object || target.dataset.select, target);
});
const menu = $(".menu-toggle");
menu.onclick = () => {
  const open = menu.getAttribute("aria-expanded") !== "true";
  menu.setAttribute("aria-expanded", open);
  menu.setAttribute("aria-label", open ? "Закрыть меню" : "Открыть меню");
  $("#mobile-nav").hidden = !open;
};
$$("#mobile-nav a").forEach(
  (a) =>
    (a.onclick = () => {
      menu.setAttribute("aria-expanded", "false");
      menu.setAttribute("aria-label", "Открыть меню");
      $("#mobile-nav").hidden = true;
    }),
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !detailDialog.open) {
    if (fullscreen) toggleFullscreen(false);
    else {
      $("#mobile-nav").hidden = true;
      menu.setAttribute("aria-expanded", "false");
    }
  }
  if (!fullscreen || detailDialog.open) return;
  if (e.key === "Tab") {
    const focusables = $$('button:not(:disabled),[tabindex="0"]', shell);
    const first = focusables[0],
      last = focusables.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    }
    if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
    e.preventDefault();
    x += e.key === "ArrowLeft" ? 45 : e.key === "ArrowRight" ? -45 : 0;
    y += e.key === "ArrowUp" ? 45 : e.key === "ArrowDown" ? -45 : 0;
    transform();
  }
});

// Встроенная карта сохраняет вертикальную прокрутку страницы. Собственные touch-жесты — только в полном экране.
viewport.addEventListener("pointerdown", (e) => {
  if (e.pointerType === "touch" && !fullscreen) return;
  if (e.button !== 0) return;
  pointers.set(e.pointerId, {
    x: e.clientX,
    y: e.clientY,
    target: e.target.closest("[data-object]"),
    startX: e.clientX,
    startY: e.clientY,
    moved: false,
  });
  if (fullscreen || zoom > 1) viewport.setPointerCapture(e.pointerId);
});
viewport.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  const old = pointers.get(e.pointerId),
    next = { ...old, x: e.clientX, y: e.clientY };
  next.moved ||= Math.hypot(next.x - next.startX, next.y - next.startY) > 6;
  const before = [...pointers.values()];
  pointers.set(e.pointerId, next);
  if (pointers.size >= 2) {
    for (const point of pointers.values()) point.moved = true;
    const after = [...pointers.values()];
    const distance = (points) =>
      Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    const previous = distance(before);
    if (previous < 1) return;
    viewport.classList.add("dragging");
    const bounds = viewport.getBoundingClientRect();
    const oldCx = (before[0].x + before[1].x) / 2 - bounds.x,
      oldCy = (before[0].y + before[1].y) / 2 - bounds.y;
    const cx = (after[0].x + after[1].x) / 2 - bounds.x,
      cy = (after[0].y + after[1].y) / 2 - bounds.y;
    const nextZoom = Math.min(
      4,
      Math.max(1, (zoom * distance(after)) / previous),
    );
    x = cx - ((oldCx - x) * nextZoom) / zoom;
    y = cy - ((oldCy - y) * nextZoom) / zoom;
    zoom = nextZoom;
    movedUntil = performance.now() + 400;
    transform();
  } else if (
    zoom > 1 &&
    Math.abs(next.x - old.x) + Math.abs(next.y - old.y) > 2
  ) {
    viewport.classList.add("dragging");
    x += next.x - old.x;
    y += next.y - old.y;
    movedUntil = performance.now() + 400;
    transform();
  }
});
function releasePointer(e) {
  pointers.delete(e.pointerId);
  if (!pointers.size) viewport.classList.remove("dragging");
}
viewport.addEventListener("pointerup", (e) => {
  const point = pointers.get(e.pointerId);
  if (
    point &&
    !point.moved &&
    point.target &&
    viewport.hasPointerCapture(e.pointerId) &&
    performance.now() > movedUntil
  ) {
    openObject(point.target.dataset.object, point.target);
    movedUntil = performance.now() + 400;
  }
  releasePointer(e);
});
viewport.addEventListener("pointercancel", releasePointer);
viewport.addEventListener("lostpointercapture", releasePointer);
viewport.addEventListener("pointerleave", (e) => {
  if (!viewport.hasPointerCapture(e.pointerId)) releasePointer(e);
});
viewport.addEventListener(
  "wheel",
  (e) => {
    if (!fullscreen) return;
    e.preventDefault();
    const r = viewport.getBoundingClientRect();
    setZoom(
      zoom * (e.deltaY > 0 ? 0.9 : 1.1),
      e.clientX - r.x,
      e.clientY - r.y,
    );
  },
  { passive: false },
);

function initPremiumMotion() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealItems = $$(
    ".intro > div, .about-photo, .nature-strip > span, .section-heading, .stay-card, .steps-list > li, .contact-section > div",
  );

  if (!reduceMotion && "IntersectionObserver" in window) {
    revealItems.forEach((element, index) => {
      element.dataset.reveal = "";
      element.style.setProperty("--reveal-delay", `${(index % 4) * 90}ms`);
    });
    document.documentElement.classList.add("motion-ready");
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -36px 0px" },
    );
    revealItems.forEach((element) => observer.observe(element));
  }

}

initPremiumMotion();
initHomeGalleries();
buildMap();
renderList();
new ResizeObserver(resizeMap).observe(viewport);
$("#year").textContent = new Date().getFullYear();
if (contact.phone) {
  $("#contact-caption").textContent = `Телефон администрации: ${phoneLabel(contact.phone)}`;
}

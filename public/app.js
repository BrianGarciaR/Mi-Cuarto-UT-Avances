const $ = (selector, root = document) => root.querySelector(selector);
const API_ORIGIN = window.MCUT_API_ORIGIN || "";
const privatePhotoUrls = new Map();
const apiToken = () => sessionStorage.getItem("mcut-session") || "";
const randomCode = () =>
  crypto.randomUUID().replaceAll("-", "") +
  crypto.randomUUID().replaceAll("-", "");
async function sha256(value) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
async function hydratePrivatePhotos() {
  if (!apiToken()) return;
  for (const img of document.querySelectorAll("img[data-private-photo]")) {
    const path = img.dataset.privatePhoto;
    try {
      if (!privatePhotoUrls.has(path)) {
        const response = await fetch(API_ORIGIN + path, {
          headers: { Authorization: "Bearer " + apiToken() },
          credentials: "omit",
        });
        if (!response.ok) continue;
        privatePhotoUrls.set(path, URL.createObjectURL(await response.blob()));
      }
      img.src = privatePhotoUrls.get(path);
    } catch {
      
    }
  }
}
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const money = (value) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
const icon = (name) =>
  `<svg class="icon" aria-hidden="true"><use href="#i-${name}"></use></svg>`;
const state = {
  listings: [],
  user: null,
  profile: null,
  favorites: new Set(),
  filters: { type: "", max: "", min: "", area: "", q: "", amenities: [] },
  sort: "recent",
  map: false,
  photos: [],
  edit: null,
  step: 1,
  nav: 0,
};
const amenityNames = [
  "Wi-Fi",
  "Amueblado",
  "Cocina",
  "Mascotas",
  "Baño privado",
  "Área de estudio",
  "Escritorio",
];
const roles = {
  estudiante: "Estudiante",
  maestro: "Maestro",
  rentador: "Rentador",
};
const routePath = () =>
  location.hash.startsWith("#/") ? location.hash.slice(1).split("?")[0] : "/";
const btn = (text, href, kind = "", ic = "") =>
  `<a class="btn ${kind}" href="${esc(href)}">${ic ? icon(ic) : ""}${esc(text)}</a>`;
const brand = () =>
  `<a class="brand" href="#/" aria-label="Mi Cuarto UT, inicio"><svg class="brand-symbol" viewBox="370 280 520 390" aria-hidden="true"><image width="1254" height="1254" href="/assets/logo_original.jpg"/></svg><span><strong>Mi Cuarto <span>UT</span></strong><small>Tu espacio, más cerca de la universidad.</small></span></a>`;
function photo(value, alt = "", cls = "") {
  if (typeof value === "string")
    return `<img class="photo ${cls}" src="${esc(privatePhotoUrls.get(value) || (value.startsWith("/api/media/") ? API_ORIGIN + value : value))}" ${value.startsWith("/api/media/") ? `data-private-photo="${esc(value)}"` : ""} alt="${esc(alt)}" loading="lazy" decoding="async">`;
  const idx = Number(value?.demo ?? value ?? 0) % 4,
    sx = (idx % 2) * 768 + 2,
    sy = Math.floor(idx / 2) * 512 + 2;
  return `<svg class="demo-photo ${cls}" viewBox="${sx} ${sy} 764 508" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${esc(alt || "Habitación ilustrativa del catálogo de ejemplo")}"><image width="1536" height="1024" href="/assets/fotografias_ilustrativas.jpg"/></svg>`;
}
function mainPhoto(l) {
  return l.photos?.[0] ?? { demo: 0 };
}
function toast(text, error = false) {
  const el = $("#toast");
  el.textContent = text;
  el.hidden = false;
  el.style.background = error ? "#8e1b1b" : "";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (el.hidden = true), 6000);
}
async function api(path, options = {}) {
  const response = await fetch(API_ORIGIN + "/api/" + path, {
    signal: AbortSignal.timeout(15000),
    credentials: API_ORIGIN ? "omit" : "same-origin",
    ...options,
    headers: {
      ...(apiToken() ? { Authorization: "Bearer " + apiToken() } : {}),
      ...(options.body instanceof Blob
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });
  const data = await response
    .json()
    .catch(() => ({ error: "No se pudo leer la respuesta del servidor." }));
  if (!response.ok) {
    const err = new Error(data.error || "No se pudo completar la solicitud.");
    err.status = response.status;
    throw err;
  }
  return data;
}
const post = (path, data, method = "POST") =>
  api(path, { method, body: JSON.stringify(data) });
function renderHeader() {
  const path = routePath();
  $("#cabecera").innerHTML =
    `<div class="container header-inner">${brand()}<nav class="nav-links" id="menu-principal" aria-label="Navegación principal">${[
      ["/", "Inicio"],
      ["/buscar", "Buscar cuartos"],
      ["/publicar", "Publicar"],
      ["/nosotros", "Nosotros"],
    ]
      .map(
        ([p, t]) =>
          `<a href="#${p}" class="${path === p ? "active" : ""}" ${path === p ? 'aria-current="page"' : ""}>${t}</a>`,
      )
      .join(
        "",
      )}<a class="mobile-only" href="#/cuenta">${state.user ? "Mi cuenta" : "Iniciar sesión"}</a><a class="mobile-only" href="#/mis-publicaciones">Mis publicaciones</a></nav><div class="header-account"><a class="icon-button" href="#/favoritos" aria-label="Mis favoritos">${icon("heart")}</a><a href="#/cuenta">${state.user ? "Mi cuenta" : "Iniciar sesión"}</a>${btn(state.profile?.role === "rentador" ? "Mi espacio" : state.user ? "Mi perfil" : "Registrarse", state.profile?.role === "rentador" ? "#/mis-publicaciones" : "#/registro", "navy")}<button type="button" class="icon-button menu-toggle" aria-label="Abrir menú" aria-controls="menu-principal" aria-expanded="false" data-action="menu">${icon("menu")}</button></div></div>`;
}
function renderFooter() {
  $("#pie").innerHTML =
    `<div class="container"><div class="footer-grid"><div class="footer-brand">${brand()}<p>Un espacio para comenzar tu siguiente etapa universitaria.</p></div><div class="footer-col"><h3>Explora</h3><a href="#/buscar">Buscar cuartos</a><a href="#/favoritos">Guardar favoritos</a><a href="#/nosotros">Preguntas frecuentes</a></div><div class="footer-col"><h3>Para rentadores</h3><a href="#/publicar">Publicar inmueble</a><a href="#/mis-publicaciones">Mis publicaciones</a><a href="#/registro">Cómo funciona</a></div><div class="footer-col"><h3>Contacto y comunidad</h3><a href="#/contacto">Formulario de contacto</a><a href="https://www.instagram.com/micuartout/" target="_blank" rel="noopener noreferrer" aria-label="Instagram de Mi Cuarto UT">Instagram · @micuartout</a><a href="mailto:micuartout@gmail.com">micuartout@gmail.com</a><a href="#/privacidad">Privacidad y términos</a></div></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} Mi Cuarto UT · Brian Garcia Rueda</span><span>Los anuncios marcados «Ejemplo» contienen datos ilustrativos.</span></div></div>`;
}
function card(l) {
  const saved = state.favorites.has(l.id),
    features = l.amenities.slice(0, 2).join(" · ");
  return `<article class="listing-card"><div class="card-photo"><a href="#/alojamiento/${esc(l.id)}">${photo(mainPhoto(l), l.title)}</a><span class="badge ${l.demo ? "" : "real"}">${l.demo ? "EJEMPLO" : "PUBLICACIÓN"}</span><button type="button" class="favorite ${saved ? "saved" : ""}" data-action="favorite" data-id="${esc(l.id)}" aria-label="${saved ? "Quitar de" : "Guardar en"} favoritos: ${esc(l.title)}" aria-pressed="${saved}">${icon("heart")}</button></div><div class="card-info"><div class="price"><strong>${money(l.price)}</strong><span>MXN / mes</span></div><h3><a href="#/alojamiento/${esc(l.id)}">${esc(l.title)}</a></h3><div class="card-stats"><span>${icon("bed")}${l.rooms} ${l.rooms === 1 ? "habitación" : "habitaciones"}</span><span>${icon("size")}${l.area} m²</span></div><div class="card-bottom"><span>${icon(l.amenities.includes("Wi-Fi") ? "wifi" : "home")}${esc(features || l.type)}</span><a href="#/alojamiento/${esc(l.id)}">Ver detalles ${icon("arrow")}</a></div></div></article>`;
}
function cards(list) {
  return list.length
    ? list.map(card).join("")
    : empty(
        "No encontramos espacios con esos filtros.",
        "Prueba con otro presupuesto o elimina alguna característica.",
        "Limpiar filtros",
        "clear-filters",
      );
}
function empty(title, text, label = "", action = "") {
  return `<div class="empty">${icon("home")}<h2>${esc(title)}</h2><p>${esc(text)}</p>${label ? `<button class="btn outline" type="button" data-action="${esc(action)}">${esc(label)}</button>` : ""}</div>`;
}
function mapPanel(list = state.listings) {
  const positions = [
    [15, 30],
    [72, 20],
    [22, 76],
    [76, 75],
    [7, 55],
    [80, 48],
  ];
  return `<div class="map-panel" aria-label="Mapa ilustrativo, sin geolocalización real"><div class="map-blocks">${"<i></i>".repeat(9)}</div><span class="map-road horizontal"></span><span class="map-road horizontal second"></span><span class="map-road vertical"></span><span class="map-road vertical second"></span><div class="campus">${icon("book")}UTTT</div>${list
    .slice(0, 6)
    .map(
      (l, i) =>
        `<a class="map-pin" style="left:${positions[i][0]}%;top:${positions[i][1]}%" href="#/alojamiento/${esc(l.id)}" aria-label="Ver ${esc(l.title)}, ${money(l.price)}">${money(l.price)}</a>`,
    )
    .join(
      "",
    )}<span class="map-caption">MAPA ILUSTRATIVO · POSICIONES DE EJEMPLO</span></div>`;
}
function field(label, name, content) {
  return `<label class="field"><span>${label}</span>${content || `<input name="${name}" placeholder="${label}" value="${esc(state.filters[name] || "")}">`}</label>`;
}
function priceSelect(name = "max") {
  return `<select name="${name}" aria-label="Renta máxima"><option value="">Presupuesto mensual</option>${[1500, 2000, 2500, 3000, 3500, 5000, 10000].map((n) => `<option value="${n}" ${String(state.filters.max) === String(n) ? "selected" : ""}>Hasta ${money(n)}</option>`).join("")}</select>`;
}
function filterChips() {
  const f = state.filters;
  return `<div class="chips" aria-label="Filtros rápidos">${[
    ["", "Todos"],
    ["Cuarto", "Cuartos"],
    ["Departamento", "Departamentos"],
  ]
    .map(
      ([v, t]) =>
        `<button type="button" class="chip ${f.type === v ? "active" : ""}" aria-pressed="${f.type === v}" data-action="type" data-value="${v}">${t}</button>`,
    )
    .join("")}${[
    ["Amueblado", "bed"],
    ["Mascotas", "paw"],
  ]
    .map(
      ([v, i]) =>
        `<button type="button" class="chip ${f.amenities.includes(v) ? "active" : ""}" aria-pressed="${f.amenities.includes(v)}" data-action="amenity" data-value="${v}">${icon(i)}${v === "Mascotas" ? "Acepta mascotas" : v}</button>`,
    )
    .join(
      "",
    )}<button type="button" class="chip" data-action="filters">${icon("filter")}Más filtros</button></div>`;
}
function filtered() {
  let list = state.listings.filter(
    (l) =>
      (!state.filters.type || l.type === state.filters.type) &&
      (!state.filters.max || l.price <= Number(state.filters.max)) &&
      (!state.filters.min || l.price >= Number(state.filters.min)) &&
      (!state.filters.area || l.area >= Number(state.filters.area)) &&
      (!state.filters.q ||
        `${l.title} ${l.zone} ${l.description}`
          .toLocaleLowerCase()
          .includes(state.filters.q.toLocaleLowerCase())) &&
      state.filters.amenities.every((a) => l.amenities.includes(a)),
  );
  if (state.sort === "low") list.sort((a, b) => a.price - b.price);
  if (state.sort === "high") list.sort((a, b) => b.price - a.price);
  return list;
}
function faq() {
  return `<section class="container faq-section" id="preguntas"><div><h2>Antes de empezar</h2><p>Resolvemos tus primeras dudas sobre la plataforma.</p></div><div class="faq-list"><details><summary>¿Quién puede buscar alojamiento?</summary><p>Estudiantes y maestros pueden explorar el catálogo. Elige tu perfil al crear tu cuenta para guardar tus favoritos y consultar el contacto de los anuncios publicados.</p></details><details><summary>¿Cómo veo los datos del rentador?</summary><p>Inicia sesión para consultar el contacto dentro de la ficha de un anuncio. Los ejemplos del catálogo no tienen un rentador real.</p></details><details><summary>¿Qué necesito para publicar mi espacio?</summary><p>Elige el perfil Rentador, completa las características, el precio mensual en MXN y tu contacto, y agrega al menos una fotografía. Podrás editar, pausar o retirar tu publicación desde Mi espacio.</p></details></div></section>`;
}
function contactForm() {
  return `<form data-form="contact" class="contact-form"><div class="contact-inline"><label class="sr-only" for="correo-contacto">Tu correo electrónico</label><input type="email" id="correo-contacto" name="email" required maxlength="254" placeholder="Tu correo electrónico" autocomplete="email"><button class="btn" type="submit">Contactar ${icon("arrow")}</button></div><label class="consent"><input type="checkbox" name="consent" required><span>Acepto el uso de mi correo para atender esta solicitud. <a href="#/privacidad">Aviso de privacidad</a>.</span></label><p class="small-text" data-contact-result aria-live="polite"></p></form>`;
}
function home() {
  const list = filtered();
  return `<section class="hero"><div class="container hero-inner"><div class="hero-copy"><p class="eyebrow">ALOJAMIENTO PARA TU VIDA UNIVERSITARIA</p><h1>Encuentra tu cuarto<br> ideal cerca de la UTTT.</h1><p>Compara cuartos y departamentos según tu presupuesto, ubicación y lo que necesitas para estudiar y vivir.</p><div class="hero-signals"><span>${icon("book")}Estudiantes y maestros</span><span>${icon("home")}Un espacio para cada etapa</span></div></div><div class="hero-photo">${photo({ demo: 0 }, "Habitación ilustrativa con escritorio y luz natural")}<div class="photo-overlay">${icon("pin")}<span><strong>Tu espacio, más cerca.</strong><small>Explora y encuentra lo que va contigo.</small></span></div></div></div></section><form class="container search-card" data-form="search"><p class="eyebrow">¿CÓMO ES TU CUARTO IDEAL?</p><div class="search-fields">${field("Rango de precio", "max", priceSelect())}${field("Tamaño", "area", `<select name="area" aria-label="Superficie mínima"><option value="">Cualquiera</option><option value="15">Desde 15 m²</option><option value="20">Desde 20 m²</option><option value="30">Desde 30 m²</option></select>`)}${field("Ubicación / gustos", "q", `<input name="q" aria-label="Buscar ubicación o característica" placeholder="Cerca de la universidad" value="${esc(state.filters.q)}">`)}${field("Características", "feature", `<select name="feature" aria-label="Características"><option value="">Mascotas / amueblado</option value="Mascotas">Acepta mascotas</option value="Amueblado">Amueblado</option value="Wi-Fi">Wi-Fi</option></select>`)}<button class="btn" type="submit">${icon("search")}Buscar</button></div></form><section class="container catalog" id="catalogo"><div class="section-top"><div><h2>Un lugar que se sienta tuyo</h2><p>Explora el catálogo y compara las opciones que más te interesen.</p></div>${btn("Ver mapa", "#/buscar?mapa=1", "outline", "map")}</div>${filterChips()}<p class="catalog-note">Catálogo de demostración · los precios, fotografías y características marcados «Ejemplo» son ilustrativos.</p><div class="cards">${cards(list.slice(0, 6))}</div><div class="center">${btn("Explorar más espacios", "#/buscar", "outline catalog-more", "arrow")}</div></section><section class="map-intro"><div class="container map-intro-grid"><div class="map-copy"><p class="eyebrow">TU PRÓXIMA ETAPA, MEJOR UBICADA</p><h2>Elige también<br>por ubicación.</h2><p>Consulta el mapa y compara opciones en un mismo lugar. La ubicación y los servicios te ayudan a elegir un espacio que se adapte a tu rutina.</p>${btn("Explorar en el mapa", "#/buscar?mapa=1", "navy", "map")}</div>${mapPanel()}</div></section>${aboutContent()}${faq()}<section class="container cta" id="contacto"><div><h2>¿Tienes un espacio en renta?</h2><p>Preséntalo a estudiantes y maestros. Agrega fotos, características y los datos de tu inmueble.</p>${btn("Quiero publicar", "#/publicar", "", "arrow")}</div><div><h3>¿Necesitas orientación?</h3>${contactForm()}</div></section>`;
}
function aboutContent() {
  return `<section class="container about" id="nosotros"><h2>Mi Cuarto UT, pensado para tu vida universitaria.</h2><p>Nuestro propósito es acercar la búsqueda de alojamiento a estudiantes y maestros, y ofrecer a los rentadores un espacio para presentar sus inmuebles.</p><div class="benefits">${[
    [
      "filter",
      "Encuentra lo que necesitas",
      "Filtra por precio, tamaño, servicios y preferencias.",
    ],
    [
      "heart",
      "Compara a tu ritmo",
      "Revisa fotos, detalles y guarda tus espacios favoritos.",
    ],
    [
      "user",
      "Conecta con el rentador",
      "Regístrate para consultar sus datos de contacto.",
    ],
  ]
    .map(
      ([i, t, p]) =>
        `<article class="benefit">${icon(i)}<div><h3>${t}</h3><p>${p}</p></div></article>`,
    )
    .join("")}</div></section>`;
}
function searchPage() {
  const list = filtered();
  return `<section class="container page-shell"><p class="breadcrumb"><a href="#/">Inicio</a> / Buscar cuartos</p><h1>Encuentra un espacio a tu medida</h1><form data-form="search" class="search-toolbar">${field("Ubicación o palabra clave", "q", `<input name="q" placeholder="Cerca de la universidad" value="${esc(state.filters.q)}">`)}${field("Rango de precio", "max", priceSelect())}${field("Tipo de espacio", "type", `<select name="type"><option value="">Cuarto o departamento</option><option value="Cuarto" ${state.filters.type === "Cuarto" ? "selected" : ""}>Cuarto</option><option value="Departamento" ${state.filters.type === "Departamento" ? "selected" : ""}>Departamento</option></select>`)}<button type="submit" class="btn">${icon("search")}Buscar espacios</button></form>${filterChips()}<div class="results-top"><div><h2>Explora los espacios</h2><p>${list.length} ${list.length === 1 ? "resultado" : "resultados"} · Los anuncios de ejemplo no indican disponibilidad real.</p></div><div class="results-actions"><select class="sort-select" aria-label="Ordenar espacios" data-action="sort"><option value="recent" ${state.sort === "recent" ? "selected" : ""}>Más recientes</option><option value="low" ${state.sort === "low" ? "selected" : ""}>Menor precio</option><option value="high" ${state.sort === "high" ? "selected" : ""}>Mayor precio</option></select><button type="button" class="btn small ${!state.map ? "navy" : "outline"}" data-action="view" data-view="list">Lista</button><button type="button" class="btn small ${state.map ? "navy" : "outline"}" data-action="view" data-view="map">${icon("map")}Mapa</button></div></div>${state.map ? `<div class="map-results"><div class="cards">${cards(list)}</div>${mapPanel(list)}</div><p class="catalog-note">El mapa representa posiciones ilustrativas. La zona exacta de operación sigue por confirmar.</p>` : `<div class="cards">${cards(list)}</div>`}</section>`;
}
async function detailPage(id) {
  const { listing: l, canEdit } = state.offline
    ? { listing: state.listings.find((item) => item.id === id), canEdit: false }
    : await api("listings/" + encodeURIComponent(id));
  if (!l) throw new Error("No se encontró la publicación.");
  state.detail = l;
  const pics = l.photos.length ? l.photos : [{ demo: 0 }];
  return `<section class="container page-shell"><p class="breadcrumb"><a href="#/buscar">Buscar cuartos</a> / ${esc(l.title)}</p><span class="inline-badge">${l.demo ? "ALOJAMIENTO DE DEMOSTRACIÓN" : l.status === "published" ? "ALOJAMIENTO PUBLICADO" : esc(l.status.toUpperCase())}</span><div class="detail-heading"><div><h1>${esc(l.title)}</h1><p class="detail-location">${icon("pin")}${esc(l.zone)}</p></div><button type="button" class="btn outline" data-action="favorite" data-id="${esc(l.id)}">${icon("heart")}${state.favorites.has(l.id) ? "Quitar favorito" : "Guardar favorito"}</button></div><div class="detail-gallery">${[pics[0], pics[1] ?? (l.demo ? { demo: 3 } : pics[0]), pics[2] ?? (l.demo ? { demo: 1 } : pics[0])].map((p, i) => `<button type="button" class="gallery-photo" data-action="photo" data-index="${i}" aria-label="Ampliar fotografía ${i + 1}">${photo(p, l.title)}</button>`).join("")}</div><div class="detail-columns"><div class="detail-main"><h2>Un espacio para estudiar y descansar</h2><p>${esc(l.description)}</p><div class="big-stats"><span>${icon("bed")}${l.rooms} ${l.rooms === 1 ? "habitación" : "habitaciones"}</span><span>${icon("bath")}${l.baths} ${l.baths === 1 ? "baño" : "baños"}</span><span>${icon("size")}${l.area} m²</span></div><section class="detail-section"><h2>Servicios y características</h2><div class="detail-amenities">${l.amenities.map((a) => `<span>${icon(a === "Wi-Fi" ? "wifi" : a === "Amueblado" ? "bed" : a === "Mascotas" ? "paw" : a === "Área de estudio" ? "book" : "home")}${esc(a)}</span>`).join("") || "<p>El rentador no ha indicado servicios adicionales.</p>"}</div></section><section class="detail-section"><h2>Reglas y disponibilidad</h2><p>${esc(l.rules || "Consulta las reglas y la disponibilidad directamente con el rentador.")}</p><p class="small-text muted">Última actualización: ${new Date(l.updated_at.includes("T") ? l.updated_at : l.updated_at + "T12:00:00").toLocaleDateString("es-MX")}. ${l.demo ? "Datos de ejemplo." : "Confirma disponibilidad y costo total antes de comprometerte."}</p></section><section class="detail-section"><h2>Ubicación del alojamiento</h2>${mapPanel([l])}<p class="small-text muted">${l.demo ? "Ubicación ilustrativa." : esc(l.zone) + ". El esquema no representa coordenadas reales."}</p></section><div class="section-space"><button type="button" class="btn outline" data-action="report" data-id="${esc(l.id)}">Reportar publicación</button>${canEdit ? btn("Editar mi publicación", "/#/publicar?editar=" + encodeURIComponent(l.id), "outline") : ""}</div></div><aside class="contact-card"><div class="price"><strong>${money(l.price)}</strong><span>MXN / mes</span></div><p class="small-text muted">${l.demo ? "Precio ilustrativo" : "Precio publicado por el rentador"}</p><hr>${icon("lock")}<h3>Conoce a tu próximo rentador</h3><div id="listing-contact"><p>Regístrate o inicia sesión para consultar los datos de contacto y comunicarte directamente.</p>${state.user ? `<button class="btn full" type="button" data-action="contact-owner" data-id="${esc(l.id)}">Ver contacto del rentador</button>` : btn("Registrarme para ver contacto", "#/registro", "full", "user") + btn("Ya tengo cuenta", "#/cuenta", "outline full")}</div><p class="small-text muted">Consulta todos los detalles antes de elegir. Mi Cuarto UT no procesa pagos de renta.</p></aside></div></section>`;
}
function authPage(login = false) {
  const profile = state.profile,
    role = profile?.role || sessionStorage.getItem("mcut-role") || "estudiante";
  const active = !!state.user;
  return `<div class="auth-layout"><aside class="auth-aside"><p class="eyebrow">TU NUEVA ETAPA EMPIEZA AQUÍ</p><h1>Un espacio para<br>cada perfil.</h1><p>Busca tu próximo cuarto o presenta tu inmueble a la comunidad universitaria.</p><div class="auth-photo">${photo({ demo: 2 }, "Habitación ilustrativa")}</div><h2>Mi Cuarto UT</h2><p class="aside-slogan">Tu espacio, más cerca de la universidad.</p></aside><section class="auth-main"><h2>${active ? "Mi cuenta" : login ? "Bienvenido de nuevo" : "Crea tu cuenta"}</h2><p>${active ? "Actualiza tu perfil." : "Accede con tu correo y una contraseña propia de Mi Cuarto UT."}</p><form data-form="${active ? "profile" : login ? "account-login" : "account-register"}">${
    !login || active
      ? `<div class="role-options">${Object.entries(roles)
          .map(
            ([value, label]) =>
              `<label class="role-option"><input type="radio" name="role" value="${value}" ${role === value ? "checked" : ""}><span>${icon(value === "estudiante" ? "book" : value === "maestro" ? "user" : "home")}${label}</span></label>`,
          )
          .join(
            "",
          )}</div><label class="form-control">Nombre completo<input name="name" required minlength="2" maxlength="100" autocomplete="name" value="${esc(profile?.name || state.user?.name || "")}"></label>`
      : ""
  }<label class="form-control">Correo electrónico<input name="email" type="email" required maxlength="254" autocomplete="email" ${active ? "readonly" : ""} value="${esc(state.user?.email || "")}"></label>${!active ? `<label class="form-control">Contraseña<input name="password" type="password" required minlength="12" maxlength="128" autocomplete="${login ? "current-password" : "new-password"}"><small>Mínimo 12 caracteres. No se guarda como texto legible.</small></label>` : ""}${!login || active ? '<label class="consent"><input name="consent" type="checkbox" required><span>Acepto los <a href="#/privacidad">términos y el aviso de privacidad</a>.</span></label>' : ""}<button class="btn full" type="submit" style="margin-top:24px">${active ? "Guardar mi perfil" : login ? "Iniciar sesión" : "Crear mi cuenta"} ${icon("arrow")}</button></form><p class="auth-center">${active ? '<button class="btn outline" data-action="logout" type="button">Cerrar sesión</button>' : login ? '<a href="#/registro">Crear una cuenta</a>' : '<a href="#/cuenta">Ya tengo cuenta</a>'}</p><p class="small-text muted">El correo de registro no acredita identidad ni verifica al rentador. Por ahora no se envían mensajes automáticos de recuperación de contraseña.</p></section></div>`;
}
function dashboardNav(active) {
  return `<aside class="dashboard-nav"><p class="eyebrow">MI ESPACIO</p>${[
    ["/mis-publicaciones", "home", "Mis publicaciones"],
    ["/publicar", "plus", "Publicar inmueble"],
    ["/cuenta", "user", "Mi perfil"],
  ]
    .map(
      ([p, i, t]) =>
        `<a href="#${p}" class="${active === p ? "active" : ""}">${icon(i)}${t}</a>`,
    )
    .join(
      "",
    )}<p class="role-label">Perfil: ${roles[state.profile?.role] || "sin completar"}</p></aside>`;
}
function requireLandlord() {
  if (!state.user)
    return `<section class="container page-shell">${empty("Publica tu espacio en Mi Cuarto UT", "Inicia sesión y elige el perfil Rentador para agregar tu inmueble.")}<div class="center section-space">${btn("Iniciar sesión y elegir perfil", "#/registro", "", "user")}</div></section>`;
  if (state.profile?.role !== "rentador")
    return `<section class="container page-shell">${empty("Un espacio para quien publica", "Para publicar, selecciona Rentador en tu perfil. Puedes cambiarlo cuando quieras.")}<div class="center section-space">${btn("Cambiar mi perfil", "#/registro", "", "user")}</div></section>`;
  return "";
}
function formControl(label, name, value = "", attrs = "", cls = "") {
  return `<label class="form-control ${cls}">${label}<input name="${name}" value="${esc(value)}" ${attrs}></label>`;
}
async function publishPage() {
  const gate = requireLandlord();
  if (gate) return gate;
  const editId = new URLSearchParams(location.hash.split("?")[1] || "").get(
    "editar",
  );
  let l = null;
  if (editId) {
    const data = await api("listings/" + encodeURIComponent(editId));
    if (!data.canEdit)
      throw new Error("Esta publicación no pertenece a tu cuenta.");
    l = data.listing;
    const c = await api("listings/" + encodeURIComponent(editId) + "/contact");
    l = {
      ...l,
      contactName: c.name,
      contactEmail: c.email,
      contactPhone: c.phone,
    };
  }
  state.edit = l;
  state.photos = l?.photos || [];
  state.step = 1;
  return `<div class="dashboard">${dashboardNav("/publicar")}<section class="dashboard-main"><h1>${l ? "Editar inmueble" : "Publicar inmueble"}</h1><p>Agrega la información que ayudará a la comunidad a conocer tu espacio.</p><div class="wizard-steps">${["Información", "Fotografías", "Revisar y publicar"].map((x, i) => `<div class="wizard-step ${i === 0 ? "active" : ""}" data-wizard-step="${i + 1}"><span>${i + 1}</span>${x}</div>`).join("")}</div><form class="wizard-form" data-form="publish"><fieldset data-step="1"><h2>Cuéntanos sobre tu inmueble</h2>${formControl("Título de la publicación", "title", l?.title || "", 'placeholder="Ej. Cuarto amueblado con escritorio" required minlength="5" maxlength="100"')}<div class="form-grid"><label class="form-control">Tipo de alojamiento<select name="type" required><option value="">Selecciona una opción</option>${["Cuarto", "Departamento"].map((x) => `<option ${l?.type === x ? "selected" : ""}>${x}</option>`).join("")}</select></label>${formControl("Renta mensual (MXN)", "price", l?.price || "", 'type="number" min="1" max="1000000" required placeholder="Ingresa el precio"')}${formControl("Habitaciones", "rooms", l?.rooms || 1, 'type="number" min="1" max="100" required')}${formControl("Baños", "baths", l?.baths ?? 1, 'type="number" min="0" max="100" required')}${formControl("Superficie (m²)", "area", l?.area || "", 'type="number" min="1" max="100000" required placeholder="Tamaño aproximado"')}${formControl("Zona o localidad", "zone", l?.zone || "", 'required maxlength="160" placeholder="Indica la zona del inmueble"')}</div><h2>Servicios y preferencias</h2><div class="amenity-checks">${amenityNames.map((a) => `<label class="check-option"><input type="checkbox" name="amenities" value="${esc(a)}" ${l?.amenities.includes(a) ? "checked" : ""}>${a === "Mascotas" ? "Acepta mascotas" : a}</label>`).join("")}</div><label class="form-control">Descripción del espacio<textarea name="description" minlength="20" maxlength="2500" required placeholder="Describe el alojamiento, sus servicios y lo que incluye la renta.">${esc(l?.description || "")}</textarea></label><label class="form-control">Reglas y disponibilidad<textarea name="rules" maxlength="1000" placeholder="Indica reglas, cargos adicionales y disponibilidad.">${esc(l?.rules || "")}</textarea></label><h2>Datos de contacto</h2><div class="form-grid">${formControl("Nombre de contacto", "contactName", l?.contactName || state.profile.name, 'required minlength="2" maxlength="100"')}${formControl("Correo del rentador", "contactEmail", l?.contactEmail || state.user.email, 'type="email" required maxlength="254"')}${formControl("Teléfono (opcional)", "contactPhone", l?.contactPhone || "", 'type="tel" maxlength="30" placeholder="Número de contacto"')}</div><div class="privacy-note">${icon("lock")}Tus datos de contacto se mostrarán únicamente a usuarios que hayan iniciado sesión.</div><label class="check-option"><input name="consentContact" type="checkbox" required ${l ? "checked" : ""}>Acepto mostrar estos datos a usuarios registrados para atender consultas sobre mi inmueble.</label></fieldset><fieldset data-step="2" hidden><h2>Fotografías de tu espacio</h2><p>Agrega hasta ocho imágenes JPG, PNG o WebP, de máximo 5 MB cada una. Usa fotografías que tengas derecho a publicar.</p><div class="upload-area section-space">${icon("upload")}<h3>Agrega fotografías</h3><p class="small-text muted">La primera imagen será la portada del anuncio.</p><input type="file" id="photo-files" accept="image/jpeg,image/png,image/webp" multiple aria-label="Seleccionar fotografías del inmueble"><p id="upload-status" role="status"></p></div><div class="photo-previews" id="photo-previews">${photoPreviews()}</div></fieldset><fieldset data-step="3" hidden><h2>Revisa antes de publicar</h2><div id="review-summary" class="review-summary"></div><div class="notice">Confirma que el precio mensual, los servicios, las fotografías y la disponibilidad estén actualizados. Esta publicación aparecerá en el catálogo con tus datos de contacto protegidos.</div></fieldset><p class="error-text" id="publish-error" role="alert"></p><div class="form-actions"><button type="button" class="btn outline" data-action="draft">Guardar borrador</button><button type="button" class="btn outline" data-action="previous-step" hidden>Anterior</button><button type="button" class="btn" data-action="next-step">Continuar a fotografías ${icon("arrow")}</button><button type="submit" class="btn" data-action="publish-submit" hidden>${l ? "Guardar cambios" : "Publicar inmueble"} ${icon("arrow")}</button></div></form></section></div>`;
}
function photoPreviews() {
  return state.photos
    .map(
      (p, i) =>
        `<div class="photo-preview"><img src="${esc(p)}" alt="Fotografía ${i + 1} del anuncio"><button type="button" data-action="remove-photo" data-index="${i}" aria-label="Quitar fotografía ${i + 1}">×</button></div>`,
    )
    .join("");
}
async function managePage() {
  const gate = requireLandlord();
  if (gate) return gate;
  const { listings } = await api("listings?mine=1");
  return `<div class="dashboard">${dashboardNav("/mis-publicaciones")}<section class="dashboard-main"><div class="section-top"><div><h1>Mis publicaciones</h1><p>Actualiza, pausa o retira tus anuncios cuando lo necesites.</p></div>${btn("Publicar inmueble", "#/publicar", "", "plus")}</div><div class="manage-list">${listings.length ? listings.map((l) => `<article class="manage-row"><div class="manage-photo">${photo(mainPhoto(l), l.title)}</div><div><h2>${esc(l.title)}</h2><div class="price"><strong>${money(l.price)}</strong><span>MXN / mes</span></div><span class="chip">${{ published: "Publicada", paused: "En pausa", draft: "Borrador" }[l.status] || esc(l.status)}</span></div><div class="manage-actions">${btn("Editar", "#/publicar?editar=" + encodeURIComponent(l.id), "outline small")}<button type="button" class="btn small ${l.status === "published" ? "outline" : ""}" data-action="listing-status" data-id="${esc(l.id)}" data-status="${l.status === "published" ? "paused" : "published"}">${l.status === "published" ? "Pausar" : "Publicar"}</button><button type="button" class="btn small outline" data-action="delete-listing" data-id="${esc(l.id)}">Retirar</button></div></article>`).join("") : empty("Tu primer anuncio empieza aquí", "Publica un espacio con información clara y fotografías para que puedan conocerlo.", "Publicar inmueble", "go-publish")}</div></section></div>`;
}
function favoritesPage() {
  if (!state.user)
    return `<section class="container page-shell">${empty("Guarda los espacios que te interesan", "Inicia sesión para conservar tus favoritos y consultarlos desde tu cuenta.")}<div class="center section-space">${btn("Iniciar sesión", "#/cuenta", "", "heart")}</div></section>`;
  const list = state.listings.filter((x) => state.favorites.has(x.id));
  return `<section class="container page-shell"><p class="breadcrumb"><a href="#/">Inicio</a> / Favoritos</p><h1>Los espacios que van contigo</h1><p class="page-description">Compara tus favoritos y vuelve a ellos cuando quieras.</p><div class="cards">${list.length ? list.map(card).join("") : empty("Todavía no tienes favoritos", "Toca el corazón de un anuncio para guardarlo.", "Explorar espacios", "go-search")}</div></section>`;
}
function privacyPage() {
  return `<article class="container page-shell narrow page-prose"><p class="breadcrumb"><a href="#/">Inicio</a> / Privacidad y términos</p><h1>Privacidad y uso de Mi Cuarto UT</h1><p>Mi Cuarto UT es un proyecto de Brian Garcia Rueda para facilitar la búsqueda y publicación de alojamiento universitario. Contacto del proyecto: <a href="https://www.instagram.com/micuartout/" target="_blank" rel="noopener noreferrer" aria-label="Instagram de Mi Cuarto UT">Instagram · @micuartout</a><a href="mailto:micuartout@gmail.com">micuartout@gmail.com</a>.</p><h2>Datos que se guardan</h2><p>Al completar tu perfil se guardan tu identificador de acceso, nombre, correo y perfil elegido. También se almacenan tus favoritos, publicaciones y las fotografías que subas. Los datos de contacto del rentador solo se entregan a usuarios que han iniciado sesión. Tu identificador de acceso permite separar tus registros de los de otras cuentas.</p><p>El formulario de orientación guarda tu correo, mensaje y un folio para atender tu solicitud. Para limitar envíos repetidos se guarda temporalmente una huella del origen y la fecha, sin mostrar tu dirección IP a otros usuarios. Los reportes de anuncios se asocian a tu cuenta para su revisión.</p><h2>Acceso y corrección</h2><p>Puedes editar tu perfil y publicaciones, quitar favoritos o retirar anuncios desde tu cuenta. Para solicitar acceso, corrección o eliminación de otros datos, escribe al correo del proyecto indicando tu solicitud. Retirar un anuncio lo oculta del catálogo; no borra automáticamente su registro de la base de datos.</p><h2>Uso del catálogo</h2><p>Los anuncios marcados «Ejemplo» contienen precios, fotografías y ubicaciones ilustrativos: no son ofertas reales. Las demás publicaciones son información proporcionada por sus rentadores; Mi Cuarto UT no ha verificado su identidad ni el inmueble. Confirma personalmente condiciones, disponibilidad, costo total y documentos antes de llegar a un acuerdo. La plataforma no cobra rentas ni administra contratos.</p><h2>Publicaciones y fotografías</h2><p>Publica únicamente espacios que tengas autorización para ofrecer y fotografías con derechos de uso. Mantén precio y disponibilidad actualizados. No publiques documentos de identidad, contraseñas, datos bancarios o información personal de terceros. Puedes reportar contenido inexacto desde la ficha.</p><h2>Almacenamiento y acceso</h2><p>Los registros se guardan en una base SQLite del servidor y las fotografías en sus archivos. Las contraseñas se conservan mediante una función criptográfica con una sal individual; no se guardan como texto legible. La sesión del navegador caduca y puede cerrarse desde tu cuenta. La conexión pública actual del servidor es temporal y necesita que el equipo permanezca encendido.</p><p class="small-text muted">Información del proyecto actualizada el 20 de octubre de 2026. Campus, localidades y cobertura definitiva de operación siguen por confirmar.</p></article>`;
}
async function render() {
  const version = ++state.nav,
    path = routePath();
  renderHeader();
  renderFooter();
  $("#contenido").innerHTML =
    '<div class="container initial-loading"><span class="spinner"></span><p>Cargando espacios…</p></div>';
  let html;
  try {
    if (path === "/") html = home();
    else if (path === "/buscar") {
      if (
        new URLSearchParams(location.hash.split("?")[1] || "").get("mapa") ===
        "1"
      )
        state.map = true;
      html = searchPage();
    } else if (path.startsWith("/alojamiento/"))
      html = await detailPage(decodeURIComponent(path.split("/")[2] || ""));
    else if (path === "/registro" || path === "/cuenta")
      html = authPage(path === "/cuenta");
    else if (path === "/publicar") html = await publishPage();
    else if (path === "/mis-publicaciones") html = await managePage();
    else if (path === "/favoritos") html = favoritesPage();
    else if (path === "/nosotros") html = aboutContent() + faq();
    else if (path === "/contacto")
      html = `<section class="container page-shell narrow"><h1>Hablemos de tu próxima etapa</h1><p class="page-description">Déjanos tu correo para solicitar orientación sobre Mi Cuarto UT.</p><div class="cta" style="display:block;width:100%;margin-inline:0">${contactForm()}</div></section>`;
    else if (path === "/privacidad") html = privacyPage();
    else
      html = `<section class="container page-shell">${empty("Esta página no está disponible", "Puedes volver al catálogo para seguir explorando.", "Ir al catálogo", "go-search")}</section>`;
  } catch (err) {
    html = `<section class="container page-shell"><h1>No pudimos cargar esta página</h1><div class="notice error">${esc(err.message)}</div>${btn("Volver al catálogo", "#/buscar", "outline")}</section>`;
  }
  if (version !== state.nav) return;
  $("#contenido").innerHTML =
    (state.offline
      ? '<div class="container notice" role="status">Catálogo de ejemplo sin conexión al servidor. Para crear una cuenta, guardar datos o contactar, vuelve cuando el servicio esté disponible.</div>'
      : "") + html;
  void hydratePrivatePhotos();
  document.title =
    {
      "/": "Mi Cuarto UT | Tu espacio, más cerca de la universidad",
      "/buscar": "Buscar cuartos | Mi Cuarto UT",
      "/publicar": "Publicar inmueble | Mi Cuarto UT",
      "/favoritos": "Mis favoritos | Mi Cuarto UT",
      "/cuenta": "Mi cuenta | Mi Cuarto UT",
      "/registro": "Crea tu perfil | Mi Cuarto UT",
      "/mis-publicaciones": "Mis publicaciones | Mi Cuarto UT",
    }[path] || "Mi Cuarto UT";
}
function modal(html) {
  $("#dialog-content").innerHTML = html;
  if (!$("#dialogo").open) $("#dialogo").showModal();
}
function closeModal() {
  $("#dialogo").close();
}
function filtersModal() {
  modal(
    `<h2 id="dialog-title">Encuentra lo que necesitas</h2><form data-form="filters" class="filters-dialog">${formControl("Precio mínimo (MXN)", "min", state.filters.min, 'type="number" min="0" max="1000000"')}${formControl("Precio máximo (MXN)", "max", state.filters.max, 'type="number" min="0" max="1000000"')}${formControl("Superficie mínima (m²)", "area", state.filters.area, 'type="number" min="1" max="100000"')}<div class="amenity-checks">${amenityNames.map((a) => `<label class="check-option"><input type="checkbox" name="amenities" value="${esc(a)}" ${state.filters.amenities.includes(a) ? "checked" : ""}>${a === "Mascotas" ? "Acepta mascotas" : a}</label>`).join("")}</div><button type="button" class="btn outline" data-action="clear-filters">Limpiar</button><button type="submit" class="btn">Aplicar filtros</button></form>`,
  );
}
function updateStep(next) {
  const form = $('[data-form="publish"]');
  if (!form) return;
  if (next > state.step) {
    for (const el of form.querySelectorAll(
      `[data-step="${state.step}"] input,[data-step="${state.step}"] select,[data-step="${state.step}"] textarea`,
    )) {
      if (!el.checkValidity()) {
        el.reportValidity();
        return;
      }
    }
    if (state.step === 2 && !state.photos.length) {
      toast("Agrega al menos una fotografía o guarda un borrador.", true);
      return;
    }
  }
  state.step = next;
  form
    .querySelectorAll("[data-step]")
    .forEach((x) => (x.hidden = Number(x.dataset.step) !== next));
  document
    .querySelectorAll("[data-wizard-step]")
    .forEach((x) =>
      x.classList.toggle("active", Number(x.dataset.wizardStep) === next),
    );
  $('[data-action="previous-step"]').hidden = next === 1;
  $('[data-action="next-step"]').hidden = next === 3;
  $('[data-action="publish-submit"]').hidden = next !== 3;
  $('[data-action="next-step"]').innerHTML =
    (next === 1 ? "Continuar a fotografías" : "Revisar publicación") +
    icon("arrow");
  if (next === 3) {
    const f = new FormData(form);
    $("#review-summary").innerHTML =
      `<h3>${esc(f.get("title"))}</h3><dl><dt>Tipo</dt><dd>${esc(f.get("type"))}</dd><dt>Renta mensual</dt><dd>${money(f.get("price"))} MXN</dd><dt>Superficie</dt><dd>${esc(f.get("area"))} m²</dd><dt>Zona</dt><dd>${esc(f.get("zone"))}</dd><dt>Fotografías</dt><dd>${state.photos.length}</dd><dt>Servicios</dt><dd>${f.getAll("amenities").map(esc).join(", ") || "Sin servicios adicionales"}</dd><dt>Contacto</dt><dd>${esc(f.get("contactName"))} · ${esc(f.get("contactEmail"))}</dd></dl>`;
  }
  $(".wizard-steps").scrollIntoView({ block: "start", behavior: "smooth" });
}
async function saveListing(draft = false) {
  const form = $('[data-form="publish"]');
  if (!form) return;
  const data = Object.fromEntries(new FormData(form));
  data.amenities = new FormData(form).getAll("amenities");
  data.photos = state.photos;
  data.status = draft ? "draft" : "published";
  data.consentContact = Boolean(form.elements.consentContact.checked);
  if (!data.consentContact) {
    toast(
      "Confirma la autorización para mostrar tu contacto a usuarios registrados.",
      true,
    );
    return;
  }
  const controls = form.querySelectorAll("button");
  controls.forEach((x) => (x.disabled = true));
  $("#publish-error").textContent = "";
  try {
    const result = await post(
      "listings" + (state.edit ? "/" + encodeURIComponent(state.edit.id) : ""),
      data,
      state.edit ? "PATCH" : "POST",
    );
    toast(
      draft
        ? "Borrador guardado en tu cuenta."
        : "Tu publicación quedó guardada.",
    );
    state.listings = (await api("listings")).listings;
    location.hash = draft
      ? "#/mis-publicaciones"
      : "#/alojamiento/" + result.id;
  } catch (err) {
    $("#publish-error").textContent = err.message;
    toast(err.message, true);
  } finally {
    controls.forEach((x) => (x.disabled = false));
  }
}

document.addEventListener("click", async (event) => {
  if (event.target.closest(".skip")) {
    event.preventDefault();
    $("#contenido").focus();
    $("#contenido").scrollIntoView();
    return;
  }
  const el = event.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action;
  if (action === "logout") {
    event.preventDefault();
    try {
      await post("auth/logout", {});
    } finally {
      sessionStorage.removeItem("mcut-session");
      state.user = null;
      state.profile = null;
      state.favorites = new Set();
      location.hash = "#/";
      await render();
    }
    return;
  }
  if (["sort"].includes(action)) return;
  event.preventDefault();
  try {
    if (action === "menu") {
      const open = $("#menu-principal").classList.toggle("open");
      el.setAttribute("aria-expanded", String(open));
    } else if (action === "close-dialog") closeModal();
    else if (action === "filters") filtersModal();
    else if (action === "clear-filters") {
      state.filters = {
        type: "",
        max: "",
        min: "",
        area: "",
        q: "",
        amenities: [],
      };
      if ($("#dialogo").open) closeModal();
      await render();
    } else if (action === "type") {
      state.filters.type = el.dataset.value;
      await render();
    } else if (action === "amenity") {
      const a = el.dataset.value;
      state.filters.amenities = state.filters.amenities.includes(a)
        ? state.filters.amenities.filter((x) => x !== a)
        : [...state.filters.amenities, a];
      await render();
    } else if (action === "view") {
      state.map = el.dataset.view === "map";
      history.replaceState(
        null,
        "",
        state.map ? "#/buscar?mapa=1" : "#/buscar",
      );
      await render();
    } else if (action === "favorite") {
      if (!state.user) {
        toast("Inicia sesión para guardar tus favoritos.");
        location.hash = "#/registro";
        return;
      }
      const id = el.dataset.id,
        saved = !state.favorites.has(id);
      await post("favorites", { id, saved });
      if (saved) state.favorites.add(id);
      else state.favorites.delete(id);
      toast(
        saved
          ? "Espacio guardado en tus favoritos."
          : "Espacio eliminado de favoritos.",
      );
      await render();
    } else if (action === "contact-owner") {
      el.disabled = true;
      const c = await api(
        "listings/" + encodeURIComponent(el.dataset.id) + "/contact",
      );
      $("#listing-contact").innerHTML = c.demo
        ? `<div class="notice">${esc(c.message)}</div>`
        : `<div class="contact-data"><div><strong>${esc(c.name)}</strong></div><div><a href="mailto:${encodeURIComponent(c.email)}">${esc(c.email)}</a></div>${c.phone ? `<div><a href="tel:${esc(c.phone.replace(/[^+\d]/g, ""))}">${esc(c.phone)}</a></div>` : ""}</div><p class="small-text">Usa estos datos únicamente para consultar este alojamiento.</p>`;
    } else if (action === "photo") {
      const l = state.detail,
        ps = l.photos.length ? l.photos : [{ demo: 0 }],
        p =
          ps[Number(el.dataset.index)] ??
          (l.demo ? { demo: Number(el.dataset.index) === 1 ? 3 : 1 } : ps[0]);
      modal(
        `<h2 id="dialog-title">${esc(l.title)}</h2><div class="lightbox">${photo(p, l.title)}</div>`,
      );
    } else if (action === "report") {
      if (!state.user) {
        toast("Inicia sesión para enviar un reporte.");
        location.hash = "#/cuenta";
        return;
      }
      modal(
        `<h2 id="dialog-title">Reportar publicación</h2><form data-form="report" data-id="${esc(el.dataset.id)}"><label class="form-control">Cuéntanos qué ocurre<textarea name="reason" required minlength="10" maxlength="1000" placeholder="Describe información inexacta o contenido que deba revisarse."></textarea></label><p class="small-text muted">No incluyas documentos personales ni datos bancarios.</p><button class="btn full" type="submit">Enviar reporte</button></form>`,
      );
    } else if (action === "next-step") updateStep(Math.min(3, state.step + 1));
    else if (action === "previous-step")
      updateStep(Math.max(1, state.step - 1));
    else if (action === "draft") await saveListing(true);
    else if (action === "remove-photo") {
      state.photos.splice(Number(el.dataset.index), 1);
      $("#photo-previews").innerHTML = photoPreviews();
    } else if (action === "listing-status") {
      await post(
        "listings/" + encodeURIComponent(el.dataset.id),
        { onlyStatus: true, status: el.dataset.status },
        "PATCH",
      );
      state.listings = (await api("listings")).listings;
      toast("Estado de la publicación actualizado.");
      await render();
    } else if (action === "delete-listing") {
      if (
        confirm(
          "¿Retirar este anuncio del catálogo? Podrás consultar el registro desde el proyecto.",
        )
      ) {
        await api("listings/" + encodeURIComponent(el.dataset.id), {
          method: "DELETE",
        });
        state.listings = (await api("listings")).listings;
        toast("Publicación retirada del catálogo.");
        await render();
      }
    } else if (action === "go-publish") {
      sessionStorage.setItem("mcut-role", "rentador");
      location.hash = "#/publicar";
    } else if (action === "go-search") location.hash = "#/buscar";
  } catch (err) {
    toast(err.message, true);
    el.disabled = false;
  }
});
document.addEventListener("change", async (event) => {
  const el = event.target;
  if (el.matches('[data-action="sort"]')) {
    state.sort = el.value;
    await render();
  }
  if (el.matches('input[name="role"]'))
    sessionStorage.setItem("mcut-role", el.value);
  if (el.id === "photo-files") {
    const files = [...el.files];
    if (state.photos.length + files.length > 8) {
      toast("Puedes agregar hasta ocho fotografías.", true);
      el.value = "";
      return;
    }
    el.disabled = true;
    const status = $("#upload-status");
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 5 * 1024 * 1024
        )
          throw new Error("Usa fotografías JPG, PNG o WebP de hasta 5 MB.");
        status.textContent = `Guardando fotografía ${i + 1} de ${files.length}…`;
        const result = await api("uploads", {
          method: "POST",
          body: file,
          headers: { "Content-Type": file.type },
        });
        state.photos.push(result.url);
        privatePhotoUrls.set(result.url, URL.createObjectURL(file));
        $("#photo-previews").innerHTML = photoPreviews();
      }
      status.textContent = "Fotografías guardadas en tu cuenta.";
    } catch (err) {
      toast(err.message, true);
      status.textContent = err.message;
    } finally {
      el.disabled = false;
      el.value = "";
    }
  }
});
document.addEventListener("submit", async (event) => {
  const form = event.target.closest("form[data-form]");
  if (!form) return;
  event.preventDefault();
  const kind = form.dataset.form,
    data = new FormData(form);
  const submit = $('button[type="submit"]', form);
  if (submit) submit.disabled = true;
  try {
    if (kind === "search") {
      for (const name of ["q", "max", "area", "type"])
        if (data.has(name)) state.filters[name] = String(data.get(name) || "");
      if (
        data.get("feature") &&
        !state.filters.amenities.includes(data.get("feature"))
      )
        state.filters.amenities.push(String(data.get("feature")));
      if (routePath() === "/buscar") await render();
      else location.hash = "#/buscar";
    } else if (kind === "filters") {
      state.filters.min = String(data.get("min") || "");
      state.filters.max = String(data.get("max") || "");
      state.filters.area = String(data.get("area") || "");
      if (
        state.filters.min &&
        state.filters.max &&
        Number(state.filters.min) > Number(state.filters.max)
      )
        throw new Error("El precio mínimo debe ser menor que el máximo.");
      state.filters.amenities = data.getAll("amenities").map(String);
      closeModal();
      await render();
    } else if (kind === "contact") {
      const result = await post("inquiries", {
        email: data.get("email"),
        consent: data.get("consent") === "on",
      });
      $("[data-contact-result]", form).textContent =
        `Solicitud registrada. Tu folio: ${result.folio}.`;
      toast("Tu solicitud quedó guardada.");
      form.reset();
    } else if (kind === "account-register" || kind === "account-login") {
      const result = await post(
        kind === "account-register" ? "auth/register" : "auth/login",
        {
          email: data.get("email"),
          password: data.get("password"),
          name: data.get("name"),
          role: data.get("role"),
          consent: data.get("consent") === "on",
        },
      );
      sessionStorage.setItem("mcut-session", result.token);
      state.user = result.user;
      state.profile = result.profile;
      state.favorites = new Set((await api("favorites")).ids);
      location.hash =
        state.profile?.role === "rentador"
          ? "#/mis-publicaciones"
          : "#/favoritos";
      await render();
      toast("Tu cuenta está lista.");
    } else if (kind === "profile") {
      const result = await post("profile", {
        name: data.get("name"),
        role: data.get("role"),
      });
      state.profile = result.profile;
      renderHeader();
      toast("Tu perfil quedó guardado.");
      location.hash =
        result.profile.role === "rentador"
          ? "#/mis-publicaciones"
          : "#/favoritos";
    } else if (kind === "publish") await saveListing(false);
    else if (kind === "report") {
      await post("reports", {
        id: form.dataset.id,
        reason: data.get("reason"),
      });
      closeModal();
      toast("Tu reporte quedó registrado para revisión.");
    }
  } catch (err) {
    toast(err.message, true);
  } finally {
    if (submit) submit.disabled = false;
  }
});
window.addEventListener("hashchange", () => {
  if ($("#dialogo").open) closeModal();
  render();
  window.scrollTo(0, 0);
});
async function boot() {
  try {
    const [session, catalog] = await Promise.all([api("me"), api("listings")]);
    state.user = session.user;
    state.profile = session.profile;
    state.listings = catalog.listings;
    if (state.user) state.favorites = new Set((await api("favorites")).ids);
    await render();
  } catch (err) {
    try {
      const response = await fetch("/catalogo-ejemplo.json");
      if (!response.ok) throw err;
      state.listings = await response.json();
      state.offline = true;
      state.user = null;
      state.profile = null;
      await render();
      return;
    } catch {
      
    }
    renderHeader();
    renderFooter();
    $("#contenido").innerHTML =
      `<section class="container page-shell"><h1>Mi Cuarto UT</h1><div class="notice error">${esc(err.message)}</div><p>Recarga la página para intentar de nuevo.</p><p class="small-text">Si estás abriendo los archivos en tu equipo, inicia el servidor con <code>npm run dev</code> como se indica en LEEME.md.</p></section>`;
  }
}
boot();

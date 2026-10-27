import { env, requestUser, FRONTEND_ORIGIN } from "./runtime.mjs";
import { seedCatalog } from "./catalog.mjs";
export const dynamic = "force-dynamic";
const validAmenities = [
  "Wi-Fi",
  "Amueblado",
  "Cocina",
  "Mascotas",
  "Baño privado",
  "Área de estudio",
  "Escritorio",
];
const safeColumns =
  "id,title,type,price,area,rooms,baths,zone,description,rules,amenities,photos,status,demo,created_at,updated_at";
function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
function clean(v, max = 200) {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}
function email(v) {
  const s = clean(v, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
    fail("Escribe un correo electrónico válido.");
  return s;
}
function num(v, min, max, name) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) fail(`Revisa ${name}.`);
  return n;
}
function publicListing(row) {
  return {
    ...row,
    amenities: JSON.parse(row.amenities),
    photos: JSON.parse(row.photos),
    demo: Boolean(row.demo),
  };
}
async function boundedBytes(req, max) {
  if (Number(req.headers.get("content-length") || 0) > max)
    fail("El archivo o solicitud excede el tamaño permitido.", 413);
  const reader = req.body?.getReader();
  if (!reader) fail("La solicitud no contiene datos.");
  const chunks = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > max) {
      await reader.cancel();
      fail("El archivo o solicitud excede el tamaño permitido.", 413);
    }
    chunks.push(value);
  }
  const result = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
async function body(req) {
  let data;
  const bytes = await boundedBytes(req, 50000);
  try {
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    fail("La solicitud no contiene datos válidos.");
  }
  if (!data || typeof data !== "object" || Array.isArray(data))
    fail("La solicitud no contiene un objeto válido.");
  return data;
}
async function sha(s) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
async function handle(req) {
  try {
    const db = env.DB;
    if (!db) fail("La base de datos no está disponible temporalmente.", 503);
    const url = new URL(req.url),
      route = url.pathname.replace(/^\/api\/?/, "").split("/"),
      method = req.method;
    const crossOrigin = req.headers.get("origin") === FRONTEND_ORIGIN;
    if (method !== "GET" && method !== "HEAD") {
      const origin = req.headers.get("origin");
      if (origin && origin !== url.origin && !crossOrigin)
        fail("Solicitud de origen no permitida.", 403);
      if (req.headers.get("sec-fetch-site") === "cross-site" && !crossOrigin)
        fail("Solicitud no permitida.", 403);
    }
    const user = await requestUser(req);
    const mustUser = () => {
      if (!user) fail("Inicia sesión para continuar.", 401);
      return user;
    };
    const profile = user
      ? await db
          .prepare("SELECT id,name,email,role FROM profiles WHERE id=?")
          .bind(user.userId)
          .first()
      : null;
    const mustLandlord = () => {
      const u = mustUser();
      if (profile?.role !== "rentador")
        fail("Elige el perfil Rentador en Mi cuenta para publicar.", 403);
      return u;
    };
    const now = new Date().toISOString();
    if (route[0] === "health")
      return json({
        ok: true,
        database: Boolean(await db.prepare("SELECT 1 AS ready").first()),
        service: "Mi Cuarto UT",
      });
    if (route[0] === "me" && method === "GET")
      return json({
        user: user ? { name: user.displayName, email: user.email } : null,
        profile,
      });
    if (route[0] === "profile" && method === "POST") {
      const u = mustUser(),
        b = await body(req),
        name = clean(b.name, 100),
        role = clean(b.role, 20);
      if (
        name.length < 2 ||
        !["estudiante", "maestro", "rentador"].includes(role)
      )
        fail("Revisa tu nombre y el perfil seleccionado.");
      await db
        .prepare(
          "INSERT INTO profiles(id,name,email,role,created_at) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,role=excluded.role,email=excluded.email",
        )
        .bind(u.userId, name, u.email, role, now)
        .run();
      return json({ ok: true, profile: { name, email: u.email, role } });
    }
    if (route[0] === "listings" && method === "GET") {
      await seedCatalog(db);
      if (route[1] && route[2] === "contact") {
        mustUser();
        const row = await db
          .prepare(
            "SELECT contact_name,contact_email,contact_phone,demo,status,owner FROM listings WHERE id=?",
          )
          .bind(route[1])
          .first();
        if (!row || (row.status !== "published" && row.owner !== user?.userId))
          fail("No se encontró la publicación.", 404);
        if (row.demo)
          return json({
            demo: true,
            message: "Este anuncio es ilustrativo y no tiene un rentador real.",
          });
        return json({
          name: row.contact_name,
          email: row.contact_email,
          phone: row.contact_phone,
        });
      }
      if (route[1]) {
        const row = await db
          .prepare(`SELECT ${safeColumns},owner FROM listings WHERE id=?`)
          .bind(route[1])
          .first();
        if (!row || (row.status !== "published" && row.owner !== user?.userId))
          fail("No se encontró la publicación.", 404);
        const { owner, ...rest } = row;
        return json({
          listing: publicListing(rest),
          canEdit: !!user && owner === user.userId,
        });
      }
      const mine = url.searchParams.get("mine") === "1";
      if (mine) mustUser();
      const rows = await db
        .prepare(
          `SELECT ${safeColumns} FROM listings WHERE ${mine ? "owner = ? AND status != ?" : "status = ?"} ORDER BY demo ASC,created_at DESC LIMIT 200`,
        )
        .bind(...(mine ? [user.userId, "deleted"] : ["published"]))
        .all();
      return json({ listings: rows.results.map(publicListing) });
    }
    if (
      route[0] === "listings" &&
      ["POST", "PATCH", "DELETE"].includes(method)
    ) {
      const u = mustLandlord();
      if (route[1]) {
        const row = await db
          .prepare("SELECT owner,demo FROM listings WHERE id=?")
          .bind(route[1])
          .first();
        if (!row || row.owner !== u.userId || row.demo)
          fail("No puedes modificar esta publicación.", 403);
      }
      if (method === "DELETE") {
        await db
          .prepare(
            "UPDATE listings SET status=?, updated_at=? WHERE id=? AND owner=?",
          )
          .bind("deleted", now, route[1], u.userId)
          .run();
        return json({ ok: true });
      }
      const b = await body(req);
      if (method === "PATCH" && b.onlyStatus) {
        if (!["published", "paused", "draft"].includes(b.status))
          fail("Estado inválido.");
        if (b.status === "published") {
          const current = await db
            .prepare("SELECT photos FROM listings WHERE id=? AND owner=?")
            .bind(route[1], u.userId)
            .first();
          if (!current || !JSON.parse(current.photos).length)
            fail("Agrega al menos una fotografía antes de publicar.");
        }
        await db
          .prepare(
            "UPDATE listings SET status=?,updated_at=? WHERE id=? AND owner=?",
          )
          .bind(b.status, now, route[1], u.userId)
          .run();
        return json({ ok: true });
      }
      if (b.consentContact !== true)
        fail(
          "Confirma la autorización para mostrar tus datos a usuarios registrados.",
        );
      const title = clean(b.title, 100),
        type = clean(b.type),
        zone = clean(b.zone, 160),
        description = clean(b.description, 2500),
        rules = clean(b.rules, 1000),
        contactName = clean(b.contactName, 100),
        contactEmail = email(b.contactEmail),
        phone = clean(b.contactPhone, 30);
      if (
        title.length < 5 ||
        zone.length < 3 ||
        description.length < 20 ||
        !["Cuarto", "Departamento"].includes(type) ||
        contactName.length < 2
      )
        fail("Completa el título, tipo, zona, descripción y contacto.");
      if (phone && !/^[+()\d\s-]{7,30}$/.test(phone))
        fail("Revisa el número de contacto.");
      const price = num(b.price, 1, 1000000, "la renta mensual"),
        area = num(b.area, 1, 100000, "la superficie"),
        rooms = num(b.rooms, 1, 100, "las habitaciones"),
        baths = num(b.baths, 0, 100, "los baños");
      const amenities = Array.isArray(b.amenities)
        ? b.amenities.filter((s) => validAmenities.includes(s))
        : [];
      const photos = Array.isArray(b.photos) ? b.photos.slice(0, 8) : [];
      for (const p of photos) {
        if (typeof p !== "string" || !p.startsWith("/api/media/"))
          fail("La fotografía no es válida.");
        const record = await db
          .prepare("SELECT owner FROM uploads WHERE id=?")
          .bind(p.slice("/api/media/".length))
          .first();
        if (record?.owner !== u.userId)
          fail("La fotografía no pertenece a tu cuenta.", 403);
      }
      const status = b.status === "draft" ? "draft" : "published";
      if (status === "published" && !photos.length)
        fail("Agrega al menos una fotografía para publicar.");
      const id = route[1] || crypto.randomUUID();
      if (method === "PATCH")
        await db
          .prepare(
            "UPDATE listings SET title=?,type=?,price=?,area=?,rooms=?,baths=?,zone=?,description=?,rules=?,amenities=?,photos=?,contact_name=?,contact_email=?,contact_phone=?,status=?,updated_at=? WHERE id=? AND owner=?",
          )
          .bind(
            title,
            type,
            price,
            area,
            rooms,
            baths,
            zone,
            description,
            rules,
            JSON.stringify(amenities),
            JSON.stringify(photos),
            contactName,
            contactEmail,
            phone,
            status,
            now,
            id,
            u.userId,
          )
          .run();
      else
        await db
          .prepare(
            "INSERT INTO listings(id,owner,title,type,price,area,rooms,baths,zone,description,rules,amenities,photos,contact_name,contact_email,contact_phone,status,demo,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
          )
          .bind(
            id,
            u.userId,
            title,
            type,
            price,
            area,
            rooms,
            baths,
            zone,
            description,
            rules,
            JSON.stringify(amenities),
            JSON.stringify(photos),
            contactName,
            contactEmail,
            phone,
            status,
            0,
            now,
            now,
          )
          .run();
      return json({ ok: true, id, status }, method === "POST" ? 201 : 200);
    }
    if (route[0] === "favorites") {
      const u = mustUser();
      if (method === "GET") {
        const rows = await db
          .prepare("SELECT listing_id FROM favorites WHERE user_id=?")
          .bind(u.userId)
          .all();
        return json({ ids: rows.results.map((r) => r.listing_id) });
      }
      if (method === "POST") {
        const b = await body(req),
          id = clean(b.id, 80);
        const row = await db
          .prepare("SELECT id FROM listings WHERE id=? AND status=?")
          .bind(id, "published")
          .first();
        if (!row) fail("El alojamiento ya no está disponible.", 404);
        if (b.saved)
          await db
            .prepare(
              "INSERT OR IGNORE INTO favorites(user_id,listing_id,created_at) VALUES(?,?,?)",
            )
            .bind(u.userId, id, now)
            .run();
        else
          await db
            .prepare("DELETE FROM favorites WHERE user_id=? AND listing_id=?")
            .bind(u.userId, id)
            .run();
        return json({ ok: true, saved: !!b.saved });
      }
    }
    if (route[0] === "inquiries" && method === "POST") {
      const b = await body(req),
        mail = email(b.email),
        message = clean(
          b.message || "Solicito información sobre Mi Cuarto UT.",
          1500,
        );
      if (b.consent !== true)
        fail("Acepta el uso de tu correo para responder tu solicitud.");
      const ip = req.headers.get("cf-connecting-ip") || "local",
        source = await sha(ip + new Date().toISOString().slice(0, 10));
      const rate = await db
        .prepare(
          "SELECT COUNT(*) AS n FROM inquiries WHERE source_key=? AND created_at>?",
        )
        .bind(source, new Date(Date.now() - 3600000).toISOString())
        .first();
      if (rate.n >= 5)
        fail("Ya recibimos varias solicitudes. Inténtalo más tarde.", 429);
      const id = crypto.randomUUID();
      await db
        .prepare(
          "INSERT INTO inquiries(id,email,message,created_at,source_key) VALUES(?,?,?,?,?)",
        )
        .bind(id, mail, message, now, source)
        .run();
      return json(
        {
          ok: true,
          folio: id.slice(0, 8),
          message: "Tu solicitud quedó registrada. Conserva tu folio.",
        },
        201,
      );
    }
    if (route[0] === "reports" && method === "POST") {
      const u = mustUser(),
        b = await body(req),
        reason = clean(b.reason, 1000),
        id = clean(b.id, 80);
      if (reason.length < 10)
        fail("Describe el motivo con al menos 10 caracteres.");
      if (
        !(await db
          .prepare("SELECT id FROM listings WHERE id=? AND status=?")
          .bind(id, "published")
          .first())
      )
        fail("Publicación no encontrada.", 404);
      const rate = await db
        .prepare(
          "SELECT COUNT(*) AS n FROM reports WHERE user_id=? AND created_at>?",
        )
        .bind(u.userId, new Date(Date.now() - 3600000).toISOString())
        .first();
      if (rate.n >= 5) fail("Ya recibimos tus reportes recientes.", 429);
      await db
        .prepare(
          "INSERT INTO reports(id,user_id,listing_id,reason,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(crypto.randomUUID(), u.userId, id, reason, now)
        .run();
      return json({ ok: true }, 201);
    }
    if (route[0] === "uploads" && method === "POST") {
      const u = mustLandlord();
      if (!env.BUCKET)
        fail("El almacenamiento de fotografías no está disponible.", 503);
      const rate = await db
        .prepare(
          "SELECT COUNT(*) AS n FROM uploads WHERE owner=? AND created_at>?",
        )
        .bind(u.userId, new Date(Date.now() - 3600000).toISOString())
        .first();
      if (rate.n >= 30)
        fail("Límite de 30 fotografías por hora. Inténtalo más tarde.", 429);
      if (Number(req.headers.get("content-length") || 0) > 5 * 1024 * 1024)
        fail("La fotografía debe pesar menos de 5 MB.", 413);
      const bytes = await boundedBytes(req, 5 * 1024 * 1024);
      if (bytes.byteLength < 12)
        fail("El archivo no es una imagen válida.", 413);
      let mime = "";
      if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
        mime = "image/jpeg";
      else if (
        bytes[0] === 137 &&
        bytes[1] === 80 &&
        bytes[2] === 78 &&
        bytes[3] === 71
      )
        mime = "image/png";
      else if (
        new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
        new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
      )
        mime = "image/webp";
      else fail("Usa una imagen JPG, PNG o WebP.");
      const id = crypto.randomUUID();
      await env.BUCKET.put(id, bytes, {
        httpMetadata: { contentType: mime },
        customMetadata: { owner: u.userId },
      });
      await db
        .prepare(
          "INSERT INTO uploads(id,owner,mime,created_at) VALUES(?,?,?,?)",
        )
        .bind(id, u.userId, mime, now)
        .run();
      return json({ ok: true, url: "/api/media/" + id }, 201);
    }
    if (route[0] === "media" && route[1] && method === "GET") {
      if (!env.BUCKET) fail("Imagen no disponible.", 404);
      const photo = await env.BUCKET.get(route[1]);
      if (!photo) fail("Imagen no encontrada.", 404);
      if (photo.customMetadata?.owner !== user?.userId) {
        const row = await db
          .prepare(
            "SELECT id FROM listings WHERE status='published' AND photos LIKE ?",
          )
          .bind("%/api/media/" + route[1] + "%")
          .first();
        if (!row) fail("Imagen no encontrada.", 404);
      }
      return new Response(photo.body, {
        headers: {
          "Content-Type": photo.httpMetadata?.contentType || "image/jpeg",
          "Cache-Control": "private, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    return json({ error: "Ruta no encontrada." }, 404);
  } catch (error) {
    if (error.status) return json({ error: error.message }, error.status);
    console.error("Mi Cuarto UT API:", error.message);
    return json(
      {
        error:
          "Ocurrió un problema al guardar o consultar los datos. Inténtalo de nuevo.",
      },
      500,
    );
  }
}
async function cors(req) {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS" && origin !== FRONTEND_ORIGIN)
    return new Response(null, { status: 403 });
  const response =
    req.method === "OPTIONS"
      ? new Response(null, { status: 204 })
      : await handle(req);
  if (origin === FRONTEND_ORIGIN) {
    response.headers.set("Access-Control-Allow-Origin", FRONTEND_ORIGIN);
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET,POST,PATCH,DELETE,OPTIONS",
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type,Authorization",
    );
    response.headers.append("Vary", "Origin");
  }
  return response;
}
export {
  cors as GET,
  cors as POST,
  cors as PATCH,
  cors as DELETE,
  cors as OPTIONS,
};

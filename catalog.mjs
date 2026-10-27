export const demoListings = [
  [
    "demo-1",
    "Cuarto con área de estudio",
    2800,
    0,
    18,
    "Cuarto",
    ["Amueblado", "Wi-Fi", "Área de estudio", "Cocina"],
  ],
  [
    "demo-2",
    "Estudio con cocina propia",
    3500,
    1,
    28,
    "Departamento",
    ["Cocina", "Baño privado", "Amueblado"],
  ],
  [
    "demo-3",
    "Habitación compartida",
    2200,
    2,
    24,
    "Cuarto",
    ["Wi-Fi", "Amueblado"],
  ],
  [
    "demo-4",
    "Cuarto luminoso amueblado",
    3000,
    3,
    20,
    "Cuarto",
    ["Escritorio", "Wi-Fi", "Amueblado"],
  ],
  [
    "demo-5",
    "Estudio para tu día a día",
    3800,
    1,
    30,
    "Departamento",
    ["Cocina", "Mascotas", "Wi-Fi"],
  ],
  [
    "demo-6",
    "Habitación con escritorio",
    2600,
    0,
    17,
    "Cuarto",
    ["Amueblado", "Wi-Fi", "Área de estudio"],
  ],
].map(([id, title, price, photo, area, type, amenities]) => ({
  id,
  title,
  price,
  photo,
  area,
  type,
  amenities,
  rooms: id === "demo-3" ? 2 : 1,
  baths: 1,
  zone: "Zona universitaria · ubicación de ejemplo",
  description:
    "Habitación con iluminación natural y espacio para estudiar y descansar. Este anuncio es una demostración del catálogo de Mi Cuarto UT; no representa un inmueble disponible para renta.",
  rules:
    "Ejemplo ilustrativo. Consulta las reglas, el importe total y la disponibilidad directamente con el rentador antes de elegir.",
  demo: 1,
  photos: [],
  status: "published",
  updated_at: "2026-10-19",
}));
export async function seedCatalog(db) {
  const hasDemo = await db
    .prepare("SELECT id FROM listings WHERE id = ?")
    .bind("demo-1")
    .first();
  if (hasDemo) return;
  await db.batch(
    demoListings.map((x) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO listings (id,owner,title,type,price,area,rooms,baths,zone,description,rules,amenities,photos,contact_name,contact_email,contact_phone,status,demo,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          x.id,
          "demo",
          x.title,
          x.type,
          x.price,
          x.area,
          x.rooms,
          x.baths,
          x.zone,
          x.description,
          x.rules,
          JSON.stringify(x.amenities),
          JSON.stringify([{ demo: x.photo }]),
          "",
          "",
          "",
          "published",
          1,
          "2026-10-19",
          "2026-10-19",
        ),
    ),
  );
}

BEGIN TRANSACTION;
CREATE TABLE `favorites` (
	`user_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `listing_id`)
);
CREATE TABLE `inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text NOT NULL,
	`source_key` text NOT NULL
);
CREATE TABLE `listings` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`price` integer NOT NULL,
	`area` integer NOT NULL,
	`rooms` integer NOT NULL,
	`baths` integer NOT NULL,
	`zone` text NOT NULL,
	`description` text NOT NULL,
	`rules` text NOT NULL,
	`amenities` text NOT NULL,
	`photos` text NOT NULL,
	`contact_name` text NOT NULL,
	`contact_email` text NOT NULL,
	`contact_phone` text NOT NULL,
	`status` text NOT NULL,
	`demo` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
INSERT INTO "listings" VALUES('demo-1','demo','Cuarto con área de estudio','Cuarto',2800,18,1,1,'Zona universitaria · ubicación de ejemplo','Anuncio ilustrativo del catálogo de demostración. No es una oferta de renta.','Consulta las condiciones directamente con el rentador.','["Amueblado", "Wi-Fi", "Área de estudio", "Cocina"]','[{"demo": 0}]','','','','published',1,'2026-10-19','2026-10-19');
INSERT INTO "listings" VALUES('demo-2','demo','Estudio con cocina propia','Departamento',3500,28,1,1,'Zona universitaria · ubicación de ejemplo','Anuncio ilustrativo del catálogo de demostración. No es una oferta de renta.','Consulta las condiciones directamente con el rentador.','["Cocina", "Baño privado", "Amueblado"]','[{"demo": 1}]','','','','published',1,'2026-10-19','2026-10-19');
INSERT INTO "listings" VALUES('demo-3','demo','Habitación compartida','Cuarto',2200,24,2,1,'Zona universitaria · ubicación de ejemplo','Anuncio ilustrativo del catálogo de demostración. No es una oferta de renta.','Consulta las condiciones directamente con el rentador.','["Wi-Fi", "Amueblado"]','[{"demo": 2}]','','','','published',1,'2026-10-19','2026-10-19');
INSERT INTO "listings" VALUES('demo-4','demo','Cuarto luminoso amueblado','Cuarto',3000,20,1,1,'Zona universitaria · ubicación de ejemplo','Anuncio ilustrativo del catálogo de demostración. No es una oferta de renta.','Consulta las condiciones directamente con el rentador.','["Escritorio", "Wi-Fi", "Amueblado"]','[{"demo": 3}]','','','','published',1,'2026-10-19','2026-10-19');
INSERT INTO "listings" VALUES('demo-5','demo','Estudio para tu día a día','Departamento',3800,30,1,1,'Zona universitaria · ubicación de ejemplo','Anuncio ilustrativo del catálogo de demostración. No es una oferta de renta.','Consulta las condiciones directamente con el rentador.','["Cocina", "Mascotas", "Wi-Fi"]','[{"demo": 1}]','','','','published',1,'2026-10-19','2026-10-19');
INSERT INTO "listings" VALUES('demo-6','demo','Habitación con escritorio','Cuarto',2600,17,1,1,'Zona universitaria · ubicación de ejemplo','Anuncio ilustrativo del catálogo de demostración. No es una oferta de renta.','Consulta las condiciones directamente con el rentador.','["Amueblado", "Wi-Fi", "Área de estudio"]','[{"demo": 0}]','','','','published',1,'2026-10-19','2026-10-19');
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL
);
CREATE TABLE `reports` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL
);
CREATE TABLE `uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`mime` text NOT NULL,
	`created_at` text NOT NULL
);
COMMIT;
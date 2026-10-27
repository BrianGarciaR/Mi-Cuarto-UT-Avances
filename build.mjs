import {readFile, writeFile} from "node:fs/promises";
import vm from "node:vm";

const catalog = JSON.parse(await readFile("public/catalogo-ejemplo.json", "utf8"));
const template = await readFile("page.template.html", "utf8");
const source = await readFile("public/app.js", "utf8");
const pages = [
  ["index", "/", "Tu espacio, más cerca de la universidad", "Compara cuartos y departamentos para tu vida universitaria.", "home()"],
  ["buscar", "/buscar", "Buscar cuartos", "Filtra alojamientos por precio, superficie y servicios.", "searchPage()"],
  ["nosotros", "/nosotros", "Nosotros", "Conoce Mi Cuarto UT y encuentra respuestas a tus dudas.", "aboutContent(true) + faq()"],
  ["contacto", "/contacto", "Contacto", "Prepara tu solicitud de orientación sobre alojamiento universitario.", "contactPage()"],
  ["favoritos", "/favoritos", "Mis favoritos", "Compara los alojamientos que guardaste.", "favoritesPage()"],
  ["publicar", "/publicar", "Publicar inmueble", "Presenta tu alojamiento a la comunidad universitaria.", "publishPage()"],
  ["cuenta", "/cuenta", "Mi cuenta", "Accede a tu perfil de Mi Cuarto UT.", "authPage(true)"],
  ["registro", "/registro", "Crea tu perfil", "Elige tu perfil de estudiante, maestro o rentador.", "authPage(false)"],
  ["mis-publicaciones", "/mis-publicaciones", "Mis publicaciones", "Gestiona los alojamientos de tu cuenta.", "managePage()"],
  ["privacidad", "/privacidad", "Privacidad y términos", "Consulta el tratamiento de datos y las condiciones del catálogo.", "privacyPage()"],
  ["alojamiento", "/alojamiento", "Detalle del alojamiento", "Consulta características, fotografías y precio del alojamiento.", 'detailPage("demo-1")']
];
for (const [file, route, title, description, expression] of pages) {
  const nodes = new Map();
  const storage = {getItem: () => null, setItem() {}};
  const context = vm.createContext({
    window: {}, location: {search: "", hash: ""}, URLSearchParams, Intl, Date,
    sessionStorage: storage, localStorage: storage,
    document: {body: {dataset: {route}}, addEventListener() {},
      querySelector(selector) {
        if (!nodes.has(selector)) nodes.set(selector, {innerHTML: ""});
        return nodes.get(selector);
      }},
    setTimeout, clearTimeout
  });
  const program = source.slice(0, source.lastIndexOf('if (location.hash.startsWith'));
  vm.runInContext(program, context);
  context.catalog = catalog;
  vm.runInContext('state.listings = catalog; state.offline = true; renderHeader(); renderFooter();', context);
  const content = await vm.runInContext(expression, context);
  context.content = content;
  const html = template.replaceAll("{{route}}", route)
    .replaceAll("{{title}}", `${title} | Mi Cuarto UT`)
    .replaceAll("{{description}}", description)
    .replace("{{header}}", vm.runInContext('pageLinks(document.querySelector("#cabecera").innerHTML)', context))
    .replace("{{footer}}", vm.runInContext('pageLinks(document.querySelector("#pie").innerHTML)', context))
    .replace("{{content}}", vm.runInContext('pageLinks(content)', context));
  await writeFile(`public/${file}.html`, html);
}
console.log(`${pages.length} páginas generadas.`);

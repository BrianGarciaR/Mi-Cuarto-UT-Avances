import assert from "node:assert/strict";
import {readFile, readdir, stat} from "node:fs/promises";
import {resolve, join, sep} from "node:path";

const root = resolve("public");
const files = (await readdir(root)).filter(file => file.endsWith(".html"));
assert.ok(files.length >= 5);
let links = 0;
const titles = new Set();
for (const file of files) {
  const html = await readFile(join(root, file), "utf8");
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<meta charset="UTF-8"/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /<header[\s>]/);
  assert.match(html, /<nav[\s>]/);
  assert.match(html, /<main[\s>]/);
  assert.match(html, /<footer[\s>]/);
  assert.match(html, /<h1[\s>]/);
  assert.doesNotMatch(html, /\{\{(?:route|content|title|header|footer|description)\}\}/);
  const title = html.match(/<title>(.*?)<\/title>/)?.[1];
  assert.ok(title && !titles.has(title), file);
  titles.add(title);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length, file + " contiene identificadores duplicados.");
  for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    const url = match[1].replaceAll("&amp;", "&");
    if (/^(?:https?:|mailto:|tel:|#|data:)/.test(url)) continue;
    assert.ok(!url.startsWith("/") && !url.startsWith("\\"), file + ": " + url);
    const target = resolve(root, decodeURIComponent(url.split(/[?#]/)[0]));
    assert.ok(target.startsWith(root + sep));
    assert.ok((await stat(target)).isFile(), file + ": " + url);
    links++;
  }
  for (const image of html.matchAll(/<img\b[^>]*>/g)) assert.match(image[0], /\balt="[^"]*"/);
}
console.log(JSON.stringify({pages: files.length, localLinks: links, status: "aprobado"}));

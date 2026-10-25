import { writeFile, readFile } from "node:fs/promises";
const input = process.argv[2];
if (!input)
  throw new Error(
    "Укажите рабочий домен: npm run seo -- https://your-domain.kz",
  );
const url = new URL(input);
if (
  url.protocol !== "https:" ||
  url.username ||
  url.password ||
  url.pathname !== "/" ||
  url.search ||
  url.hash
)
  throw new Error("Нужен только HTTPS-домен, без пути, пароля и параметров.");
const origin = url.origin;
const root = new URL("../public/", import.meta.url);
await writeFile(
  new URL("robots.txt", root),
  `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`,
);
await writeFile(
  new URL("sitemap.xml", root),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>\n`,
);
const file = new URL("index.html", root);
let html = await readFile(file, "utf8");
html = html
  .replace(/\n[ \t]*<link\s+rel="canonical"[^>]*>/g, "")
  .replace(/\n[ \t]*<meta\s+property="og:url"[^>]*>/g, "");
html = html.replace(
  /\n[ \t]*<\/head>/,
  `\n    <link rel="canonical" href="${origin}/" />\n    <meta property="og:url" content="${origin}/" />\n  </head>`,
);
await writeFile(file, html);
console.log("Созданы robots.txt, sitemap.xml, canonical и og:url для", origin);

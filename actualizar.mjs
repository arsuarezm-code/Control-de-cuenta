// Busca el último valor liquidativo de cada fondo de fondos.json y lo guarda en precios.json.
// Se ejecuta en GitHub Actions (Node 20, sin dependencias).
import { readFile, writeFile } from "node:fs/promises";

const UA = "Mozilla/5.0 (compatible; panel-patrimonio/1.0)";
const cfg = JSON.parse(await readFile("fondos.json", "utf8"));
let prev = {};
try { prev = JSON.parse(await readFile("precios.json", "utf8")); } catch {}

const hoy = () => new Date().toISOString().slice(0, 10);
const iso = (d) => d.toISOString().slice(0, 10);

export function num(s) {
  s = String(s).replace(/[\s ]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

async function get(url, json = false) {
  const r = await fetch(url, {
    headers: { "user-agent": UA, "accept-language": "es-ES,es;q=0.9,en;q=0.8" },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error("HTTP " + r.status + " en " + new URL(url).hostname);
  return json ? r.json() : r.text();
}

// Fuente 1: Yahoo Finance (busca el símbolo por ISIN y lee el último cierre en euros)
async function yahoo(f) {
  const symbols = [];
  if (f.yahoo) symbols.push(f.yahoo);
  else {
    const s = await get(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(f.isin)}&quotesCount=6&newsCount=0`, true);
    for (const q of s.quotes || []) if (q.symbol) symbols.push(q.symbol);
  }
  if (!symbols.length) throw new Error("Yahoo no conoce este ISIN");
  for (const sym of symbols) {
    try {
      const c = await get(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=10d&interval=1d`, true);
      const res = c.chart?.result?.[0];
      if (!res || res.meta?.currency !== "EUR") continue;
      const ts = res.timestamp || [], cl = res.indicators?.quote?.[0]?.close || [];
      for (let i = cl.length - 1; i >= 0; i--) {
        if (cl[i] > 0) return { nav: cl[i], date: iso(new Date(ts[i] * 1000)), fuente: "yahoo:" + sym };
      }
    } catch {}
  }
  throw new Error("Yahoo sin cierre en EUR");
}

// Fuente 2: páginas web. Busca "valor liquidativo" (o "valeur liquidative") y el primer número que sigue.
export function leerPagina(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/\s+/g, " ");
  const re = /(\bvalor\s+liquidativ[oa]|\bvaleur\s+liquidative|\bv\.?\s?l(?:\.|\b))\D{0,60}?(\d{1,3}(?:[.\s]\d{3})*,\d+|\d+[.,]\d+)/i;
  const m = text.match(re);
  if (!m) throw new Error("no se encontró el valor liquidativo");
  const nav = num(m[2]);
  if (!(nav > 0)) throw new Error("número no válido");
  const cerca = text.slice(m.index, m.index + 220);
  const d = cerca.match(/(\d{2})[\/.\-](\d{2})[\/.\-](\d{4})/);
  return { nav, date: d ? `${d[3]}-${d[2]}-${d[1]}` : hoy() };
}

function urlsPorDefecto(isin) {
  if (isin.startsWith("FR")) return [`https://www.abcbourse.com/opcvm/display/${isin}`];
  return [`https://www.quefondos.com/es/fondos/ficha/index.html?isin=${isin}`];
}

const out = { actualizado: hoy(), precios: { ...(prev.precios || {}) }, errores: [] };
let ok = 0;

for (const f of cfg.fondos) {
  const motivos = [];
  const fuentes = [() => yahoo(f)];
  for (const u of f.urls || urlsPorDefecto(f.isin)) {
    fuentes.push(async () => ({ ...leerPagina(await get(u)), fuente: new URL(u).hostname }));
  }
  let got = null;
  for (const intento of fuentes) {
    try {
      const r = await intento();
      const antes = out.precios[f.isin]?.nav;
      if (antes > 0 && Math.abs(r.nav / antes - 1) > 0.25) throw new Error(`cambio sospechoso (${antes} → ${r.nav})`);
      got = r; break;
    } catch (e) { motivos.push(e.message); }
  }
  if (got) {
    out.precios[f.isin] = { nav: Math.round(got.nav * 1e6) / 1e6, date: got.date, fuente: got.fuente };
    ok++;
    console.log(`OK   ${f.isin}  ${got.nav}  ${got.date}  (${got.fuente})`);
  } else {
    out.errores.push({ isin: f.isin, motivos });
    console.log(`::warning::${f.isin} sin actualizar: ${motivos.join(" | ")}`);
  }
}

await writeFile("precios.json", JSON.stringify(out, null, 2) + "\n");
if (!ok) { console.error("No se pudo actualizar ningún fondo."); process.exit(1); }

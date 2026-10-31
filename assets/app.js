/* CoolPro HVAC demo shop
 * NOTE: prices and SEER values are illustrative demo data only.
 * Verify against the current Samsung price list / spec sheets before quoting.
 */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const fmt = (n) => Math.round(n).toLocaleString("th-TH");
  const baht = (n) => "฿" + fmt(n);

  const STD_SIZES = [9000, 12000, 18000, 24000, 30000, 36000, 48000];
  const GRID_EF = 0.5; // kgCO2/kWh, approx. Thai grid emission factor

  const CFG = Object.assign({ vatRate: 0.07, volumeDiscount: { minUnits: 3, rate: 0.05 } }, window.COOLPRO_CONFIG || {});
  let PRODUCTS = window.COOLPRO_PRODUCTS || [];
  let dataSource = "demo"; // "demo" | "sheet"

  const ICONS = {
    wall: `<svg viewBox="0 0 200 90"><rect x="10" y="15" width="180" height="50" rx="14" fill="#fff" stroke="#c9d4ea"/><g fill="#b9c6de">${dots(22, 26, 156, 26, 3.2)}</g><rect x="30" y="56" width="140" height="4" rx="2" fill="#c9d4ea"/><circle cx="176" cy="26" r="3" fill="#3ad29f"/></svg>`,
    cassette: `<svg viewBox="0 0 200 120"><rect x="40" y="10" width="120" height="100" rx="10" fill="#fff" stroke="#c9d4ea"/><rect x="62" y="32" width="76" height="56" rx="6" fill="#f2f6ff" stroke="#d6dff0"/><g fill="#b9c6de">${dots(66, 36, 68, 48, 2.6)}</g><g fill="#d6dff0"><rect x="48" y="18" width="104" height="6" rx="3"/><rect x="48" y="96" width="104" height="6" rx="3"/><rect x="48" y="28" width="6" height="64" rx="3"/><rect x="146" y="28" width="6" height="64" rx="3"/></g></svg>`,
    ceiling: `<svg viewBox="0 0 200 90"><rect x="10" y="20" width="180" height="44" rx="10" fill="#fff" stroke="#c9d4ea"/><rect x="24" y="52" width="152" height="6" rx="3" fill="#c9d4ea"/><g fill="#b9c6de">${dots(26, 28, 148, 18, 3)}</g></svg>`,
  };

  function dots(x, y, w, h, gap) {
    let s = "";
    for (let yy = y; yy < y + h; yy += gap * 2) for (let xx = x; xx < x + w; xx += gap * 2) s += `<circle cx="${xx}" cy="${yy}" r=".9"/>`;
    return s;
  }

  // hero micro-holes
  $("#microholes").innerHTML = dots(64, 66, 290, 54, 4.5).replace(/r="\.9"/g, 'r="1.3"');

  // ---------- state ----------
  const selected = {}; // productId -> size
  let cart = load();
  let filter = "all";
  let recommended = 0;

  function load() {
    try { return JSON.parse(localStorage.getItem("coolpro-cart")) || []; } catch { return []; }
  }
  function save() { localStorage.setItem("coolpro-cart", JSON.stringify(cart)); }

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- product data loading (Google Sheet CSV → fallback demo) ----------
  // Minimal RFC 4180 CSV parser (handles quotes, escaped quotes, CRLF, newlines in quotes)
  function parseCSV(text) {
    const rows = []; let row = [], field = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; }
        else field += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += c;
    }
    if (field !== "" || row.length) { row.push(field); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim() !== ""));
  }

  // One CSV row = one model at one capacity. Rows with the same `id` are grouped into one card.
  // Columns: id,type,name,tag,desc,feats,model,btu,price,seer,active
  function rowsToProducts(rows) {
    const head = rows.shift().map((h) => h.trim().toLowerCase().replace(/^﻿/, ""));
    const need = ["id", "type", "name", "btu", "price", "seer"];
    const missing = need.filter((n) => !head.includes(n));
    if (missing.length) throw new Error("CSV missing columns: " + missing.join(", "));
    const map = new Map();
    for (const r of rows) {
      const o = Object.fromEntries(head.map((h, i) => [h, (r[i] ?? "").trim()]));
      if (/^(0|false|no|n|ไม่)$/i.test(o.active || "")) continue;
      const btu = parseInt(o.btu.replace(/[^\d]/g, ""), 10);
      const price = parseFloat(o.price.replace(/[^\d.]/g, ""));
      const seer = parseFloat(o.seer);
      if (!o.id || !btu || !price || !seer) continue;
      if (!map.has(o.id)) map.set(o.id, {
        id: o.id, type: (o.type || "wall").toLowerCase(), name: o.name, tag: o.tag || "", desc: o.desc || "",
        feats: (o.feats || "").split("|").map((s) => s.trim()).filter(Boolean), sizes: {},
      });
      map.get(o.id).sizes[btu] = { p: price, seer, model: o.model || "" };
    }
    const list = [...map.values()].filter((p) => Object.keys(p.sizes).length);
    if (!list.length) throw new Error("CSV contains no valid product rows");
    return list;
  }

  async function loadProducts() {
    if (!CFG.productsCsvUrl) return;
    try {
      const res = await fetch(CFG.productsCsvUrl, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      PRODUCTS = rowsToProducts(parseCSV(await res.text()));
      dataSource = "sheet";
    } catch (err) {
      console.warn("[CoolPro] Could not load product sheet, using demo data:", err);
    }
  }

  function initSelection() {
    PRODUCTS.forEach((p) => { if (!p.sizes[selected[p.id]]) selected[p.id] = +Object.keys(p.sizes)[0]; });
    // sync saved cart with current prices; drop items that no longer exist
    cart = cart.filter((i) => {
      const p = PRODUCTS.find((x) => x.id === i.id);
      if (!p || !p.sizes[i.size]) return false;
      i.price = p.sizes[i.size].p; i.name = p.name; i.model = p.sizes[i.size].model || "";
      return true;
    });
    save();
  }

  function renderDataNote() {
    $("#dataNote").innerHTML = dataSource === "sheet"
      ? "* ราคารวมติดตั้งมาตรฐาน ราคาสุดท้ายยืนยันหลังสำรวจหน้างาน · ค่า SEER ตามข้อมูลผู้ผลิต (มอก. 2134)"
      : "* ราคาและค่า SEER บนหน้านี้เป็นข้อมูลตัวอย่างสำหรับสาธิต ก่อนออกใบเสนอราคาจริงต้องตรวจสอบกับ price list และ spec sheet ล่าสุด";
    document.body.classList.toggle("demo", dataSource !== "sheet");
  }

  // ---------- products ----------
  function renderProducts() {
    const grid = $("#productGrid");
    const list = PRODUCTS.filter((p) => filter === "all" || p.type === filter);
    grid.innerHTML = list.length ? list.map((p) => {
      const size = selected[p.id];
      const s = p.sizes[size];
      const fits = recommended && p.sizes[recommended];
      return `<article class="card product ${fits ? "highlight" : ""}" data-id="${esc(p.id)}">
        <div class="thumb">${p.tag ? `<span class="tag">${esc(p.tag)}</span>` : ""}${ICONS[p.type] || ICONS.wall}</div>
        <h3>${esc(p.name)}</h3>
        ${s.model ? `<p class="model">${esc(s.model)}</p>` : ""}
        <p class="muted small">${esc(p.desc)}</p>
        <div class="specs">${p.feats.map((f) => `<span>${esc(f)}</span>`).join("")}<span>SEER ${esc(s.seer)}</span></div>
        <div class="size-select">${Object.keys(p.sizes).map((k) => `<button data-size="${k}" class="${+k === size ? "on" : ""}">${(+k / 1000)}k BTU</button>`).join("")}</div>
        <div class="price-row">
          <div class="price">${baht(s.p)} <small>รวมติดตั้งมาตรฐาน</small></div>
          <button class="add" aria-label="เพิ่ม ${esc(p.name)} ลงใบเสนอราคา">+</button>
        </div>
      </article>`;
    }).join("") : `<p class="muted">ไม่มีสินค้าในหมวดนี้</p>`;
  }

  $("#productGrid").addEventListener("click", (e) => {
    const card = e.target.closest(".product");
    if (!card) return;
    const p = PRODUCTS.find((x) => x.id === card.dataset.id);
    if (e.target.dataset.size) {
      selected[p.id] = +e.target.dataset.size;
      renderProducts();
    } else if (e.target.classList.contains("add")) {
      addToCart(p, selected[p.id]);
    }
  });

  $("#filters").addEventListener("click", (e) => {
    if (!e.target.dataset.f) return;
    filter = e.target.dataset.f;
    $$(".chip").forEach((c) => c.classList.toggle("active", c === e.target));
    renderProducts();
  });

  // ---------- cart / quote ----------
  function addToCart(p, size) {
    const key = p.id + "-" + size;
    const item = cart.find((i) => i.key === key);
    if (item) item.qty++;
    else cart.push({ key, id: p.id, name: p.name, model: p.sizes[size].model || "", size, price: p.sizes[size].p, qty: 1 });
    save(); renderCart();
    const b = $("#cartCount"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
    toast(`เพิ่ม ${p.name} ${fmt(size)} BTU แล้ว`);
  }

  const VD = CFG.volumeDiscount || { minUnits: Infinity, rate: 0 };
  const pct = (r) => Math.round(r * 100) + "%";

  function totals() {
    const sub = cart.reduce((a, i) => a + i.price * i.qty, 0);
    const units = cart.reduce((a, i) => a + i.qty, 0);
    const disc = units >= VD.minUnits ? sub * VD.rate : 0;
    const net = sub - disc;
    const vat = net * CFG.vatRate;
    return { sub, disc, net, vat, grand: net + vat, units };
  }

  function renderCart() {
    const t = totals();
    $("#cartCount").textContent = t.units;
    $("#cartItems").innerHTML = cart.length ? cart.map((i, idx) => `
      <div class="ci">
        <div><div class="name">${esc(i.name)}</div><div class="meta">${i.model ? esc(i.model) + " · " : ""}${fmt(i.size)} BTU · ${baht(i.price)} / ชุด</div></div>
        <div class="qty"><button data-dec="${idx}" aria-label="ลด">−</button><b>${i.qty}</b><button data-inc="${idx}" aria-label="เพิ่ม">+</button></div>
      </div>`).join("") : `<p class="empty">ยังไม่มีรายการ<br>เลือกสินค้าแล้วกด + เพื่อเพิ่มลงใบเสนอราคา</p>`;
    $("#totals").innerHTML = cart.length ? `
      <div><span>รวม (${t.units} ชุด)</span><span>${baht(t.sub)}</span></div>
      ${t.disc ? `<div style="color:var(--good)"><span>ส่วนลดโครงการ ${VD.minUnits} ชุดขึ้นไป ${pct(VD.rate)}</span><span>−${baht(t.disc)}</span></div>` : VD.rate ? `<div class="muted small"><span>ซื้อ ${VD.minUnits} ชุดขึ้นไป ลด ${pct(VD.rate)}</span><span></span></div>` : ""}
      <div><span>VAT ${pct(CFG.vatRate)}</span><span>${baht(t.vat)}</span></div>
      <div class="grand"><span>รวมสุทธิ</span><span>${baht(t.grand)}</span></div>` : "";
    $("#quoteForm").hidden = !cart.length;
  }

  $("#cartItems").addEventListener("click", (e) => {
    const inc = e.target.dataset.inc, dec = e.target.dataset.dec;
    if (inc !== undefined) cart[inc].qty++;
    else if (dec !== undefined) { cart[dec].qty--; if (!cart[dec].qty) cart.splice(dec, 1); }
    else return;
    save(); renderCart();
  });

  const openDrawer = () => document.body.classList.add("open");
  const closeDrawer = () => document.body.classList.remove("open");
  $("#cartBtn").onclick = openDrawer;
  $("#closeDrawer").onclick = closeDrawer;
  $("#overlay").onclick = closeDrawer;
  document.addEventListener("keydown", (e) => e.key === "Escape" && closeDrawer());
  $("#clearCart").onclick = () => { cart = []; save(); renderCart(); };

  function quoteText() {
    const t = totals();
    const date = new Date().toLocaleDateString("th-TH", { dateStyle: "long" });
    return [
      `ใบเสนอราคาเบื้องต้น — CoolPro HVAC (${date})`,
      "",
      ...cart.map((i, n) => `${n + 1}. Samsung ${i.name}${i.model ? " (" + i.model + ")" : ""} ${fmt(i.size)} BTU × ${i.qty} = ${baht(i.price * i.qty)}`),
      "",
      `รวม ${baht(t.sub)}`,
      t.disc ? `ส่วนลด ${pct(VD.rate)} −${baht(t.disc)}` : null,
      `VAT ${pct(CFG.vatRate)} ${baht(t.vat)}`,
      `รวมสุทธิ ${baht(t.grand)}`,
      "",
      CFG.quoteFooter || "",
      CFG.phone ? `โทร ${CFG.phone}` : null,
    ].filter((x) => x !== null).join("\n");
  }

  async function copyText(text, okMsg) {
    try { await navigator.clipboard.writeText(text); toast(okMsg); return true; }
    catch { prompt("คัดลอกข้อความนี้:", text); return false; }
  }

  $("#copyQuote").onclick = () => {
    if (!cart.length) return toast("ยังไม่มีรายการในใบเสนอราคา");
    copyText(quoteText(), "คัดลอกแล้ว นำไปวางใน LINE หรืออีเมลได้เลย");
  };

  // ---------- lead submission (Google Apps Script → Sheet + LINE OA push) ----------
  const PHONE_RE = /^(0[689]\d{8}|0[2-7]\d{7})$/; // Thai mobile (10 digits) or landline (9 digits)
  const cleanPhone = (v) => String(v || "").replace(/[\s\-()+]/g, "").replace(/^66/, "0");

  async function sendLead(payload) {
    if (!CFG.leadEndpoint) throw Object.assign(new Error("no-endpoint"), { code: "no-endpoint" });
    const res = await fetch(CFG.leadEndpoint, {
      method: "POST",
      // text/plain keeps this a CORS "simple request" (no preflight), which Apps Script requires
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, page: location.href, ua: navigator.userAgent, ts: new Date().toISOString() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || "HTTP " + res.status);
    return data;
  }

  function leadFailMessage(err) {
    if (err.code === "no-endpoint") {
      return CFG.lineOaUrl
        ? `ระบบส่งข้อมูลยังไม่ได้ตั้งค่า ใบเสนอราคาถูกคัดลอกแล้ว <a href="${esc(CFG.lineOaUrl)}" target="_blank" rel="noopener">กดเพื่อส่งทาง LINE</a>`
        : "ระบบส่งข้อมูลยังไม่ได้ตั้งค่า (โหมดสาธิต) ใบเสนอราคาถูกคัดลอกแล้ว";
    }
    return `ส่งไม่สำเร็จ (${esc(err.message)}) ใบเสนอราคาถูกคัดลอกแล้ว${CFG.lineOaUrl ? ` <a href="${esc(CFG.lineOaUrl)}" target="_blank" rel="noopener">ส่งทาง LINE แทน</a>` : ""}`;
  }

  async function handleForm(form, msgEl, buildPayload, onSuccess) {
    const btn = form.querySelector("button[type=submit]");
    msgEl.className = "form-msg";
    if (form.querySelector("[name=website]").value) return; // honeypot: bots fill hidden field
    const phone = cleanPhone(form.querySelector("[name=phone]").value);
    if (!PHONE_RE.test(phone)) { msgEl.textContent = "กรุณากรอกเบอร์โทร ให้ครบ เช่น 0812345678 หรือ 021234567"; msgEl.classList.add("err"); return; }
    btn.disabled = true; const label = btn.textContent; btn.textContent = "กำลังส่ง…";
    try {
      const r = await sendLead({ ...buildPayload(), phone });
      msgEl.textContent = `ส่งเรียบร้อย เลขที่อ้างอิง ${r.ref || "-"} ทีมงานจะติดต่อกลับภายใน 1 วันทำการ`;
      msgEl.classList.add("ok");
      onSuccess && onSuccess(r);
    } catch (err) {
      console.warn("[CoolPro] lead submit failed:", err);
      if (buildPayload().type === "quote") await navigator.clipboard?.writeText(quoteText()).catch(() => {});
      msgEl.innerHTML = leadFailMessage(err);
      msgEl.classList.add("err");
    } finally { btn.disabled = false; btn.textContent = label; }
  }

  $("#quoteForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    handleForm(f, $("#quoteMsg"), () => {
      const t = totals();
      return {
        type: "quote",
        name: f.elements.fullname.value.trim(), contact: f.elements.contact.value.trim(), note: f.elements.note.value.trim(),
        items: cart.map(({ id, name, model, size, price, qty }) => ({ id, name, model, btu: size, price, qty })),
        totals: { subtotal: Math.round(t.sub), discount: Math.round(t.disc), vat: Math.round(t.vat), grand: Math.round(t.grand), units: t.units },
        priceSource: dataSource,
      };
    }, () => { cart = []; save(); renderCart(); $("#quoteForm").hidden = false; });
  });

  // ---------- BTU calculator ----------
  const ROOM_FACTOR = { bed: 700, living: 800, office: 850, shop: 950 }; // BTU/h per m²
  const SUN_ADD = [0, 0.1, 0.2];

  function calcBTU() {
    const w = +$("#w").value || 0, l = +$("#l").value || 0, h = +$("#h").value || 2.7;
    const ppl = Math.max(1, +$("#ppl").value || 1);
    const room = $("#room").value;
    const sun = +$("input[name=sun]:checked").value;
    const area = w * l;
    let btu = area * ROOM_FACTOR[room];
    btu *= 1 + SUN_ADD[sun];
    btu *= Math.max(1, h / 2.7);           // high ceiling = more air volume
    btu += Math.max(0, ppl - 2) * 600;      // ~600 BTU/h sensible+latent per extra person
    const size = STD_SIZES.find((s) => s >= btu * 0.95) || STD_SIZES.at(-1);
    recommended = size;

    $("#btuVal").textContent = fmt(btu);
    $("#areaVal").textContent = area.toFixed(1) + " ตร.ม.";
    $("#sizeVal").textContent = fmt(size) + " BTU";
    $("#trVal").textContent = (btu / 12000).toFixed(2) + " TR";
    $("#btuBar").style.width = Math.min(100, (btu / 48000) * 100) + "%";

    const fit = PRODUCTS.filter((p) => p.sizes[size]);
    const multi = btu > 48000;
    $("#recBox").innerHTML = multi
      ? `ภาระความเย็นเกิน 48,000 BTU แนะนำ <b>แบ่งเป็น 2 เครื่อง</b> หรือใช้ระบบ <b>DVM S2</b> ดูหัวข้องานโครงการด้านล่าง`
      : `รุ่นที่มีขนาด <b>${fmt(size)} BTU</b>: ${fit.map((p) => p.name).join(", ") || "-"}<br><span class="muted small">กรอบสีน้ำเงินในหน้าสินค้าคือรุ่นที่ตรงขนาดนี้</span>`;
    renderProducts();
  }
  $("#btuForm").addEventListener("input", calcBTU);
  $("#useSize").onclick = () => {
    $("#cap").value = recommended;
    // use cheapest matching model's price + SEER so payback stays realistic
    const fits = PRODUCTS.filter((p) => p.sizes[recommended]).map((p) => p.sizes[recommended]).sort((a, b) => a.p - b.p);
    if (fits.length) { $("#price").value = fits[0].p; $("#seerNew").value = fits[0].seer; }
    calcROI();
    $("#roi").scrollIntoView({ behavior: "smooth" });
  };

  // ---------- ROI calculator ----------
  function calcROI() {
    const cap = +$("#cap").value || 0, hrs = +$("#hrs").value || 0, days = +$("#days").value;
    const so = +$("#seerOld").value || 10, sn = +$("#seerNew").value || 20;
    const tariff = +$("#tariff").value || 4.2, price = +$("#price").value || 0;
    $("#daysLbl").textContent = days;

    // SEER [BTU/Wh] → kWh/yr = BTU/h × h/yr ÷ SEER ÷ 1000
    // (simplified: assumes rated capacity at average part-load; real usage varies)
    const hYr = hrs * days;
    const kOld = (cap * hYr) / so / 1000, kNew = (cap * hYr) / sn / 1000;
    const cOld = kOld * tariff, cNew = kNew * tariff, save = cOld - cNew;
    const pb = save > 0 ? price / save : Infinity;

    $("#saveYr").textContent = baht(save);
    $("#payback").textContent = isFinite(pb) ? pb.toFixed(1) + " ปี" : "–";
    $("#co2").textContent = fmt((kOld - kNew) * GRID_EF) + " kg";
    $("#costOld").textContent = baht(cOld);
    $("#costNew").textContent = baht(cNew);
    $("#barOld").style.width = "100%";
    $("#barNew").style.width = (cOld ? (cNew / cOld) * 100 : 0) + "%";

    const pct = cOld ? (save / cOld) * 100 : 0;
    $("#pitch").innerHTML = save > 0
      ? `ค่าไฟลดลง <b>${pct.toFixed(0)}%</b> คิดเป็นเงิน <b>${baht(save / 12)}/เดือน</b>${isFinite(pb) && pb <= 10 ? ` เงินที่ประหยัดได้ใน 10 ปีคือ <b>${baht(save * 10)}</b> มากกว่าราคาเครื่อง ${(save * 10 / price).toFixed(1)} เท่า` : ""}`
      : "SEER ของเครื่องใหม่ต้องสูงกว่าเครื่องเดิมจึงจะประหยัดค่าไฟได้";
    drawChart(cOld, cNew, price);
  }

  function drawChart(cOld, cNew, price) {
    const W = 400, H = 180, P = { l: 44, r: 10, t: 30, b: 22 };
    const yrs = [...Array(11).keys()];
    const old = yrs.map((y) => cOld * y);
    const neu = yrs.map((y) => price + cNew * y);
    const max = Math.max(...old, ...neu) || 1;
    const x = (i) => P.l + (i / 10) * (W - P.l - P.r);
    const y = (v) => H - P.b - (v / max) * (H - P.t - P.b);
    const path = (arr) => arr.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
    // break-even point
    let be = "";
    const pb = price / (cOld - cNew);
    if (cOld > cNew && pb <= 10) {
      const bx = P.l + (pb / 10) * (W - P.l - P.r), by = y(cOld * pb);
      be = `<line x1="${bx}" x2="${bx}" y1="${P.t}" y2="${H - P.b}" stroke="#0e9f6e" stroke-dasharray="3 3"/><circle cx="${bx}" cy="${by}" r="4" fill="#0e9f6e"/><text x="${bx + 6}" y="${P.t + 10}" style="fill:#0e9f6e;font-weight:600">คืนทุน ${pb.toFixed(1)} ปี</text>`;
    }
    const ticks = [0, 0.5, 1].map((f) => `<text x="${P.l - 6}" y="${y(max * f) + 3}" text-anchor="end">${fmt(max * f / 1000)}k</text><line x1="${P.l}" x2="${W - P.r}" y1="${y(max * f)}" y2="${y(max * f)}" stroke="#edf1fa"/>`).join("");
    const xt = [0, 2, 4, 6, 8, 10].map((i) => `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">ปี ${i}</text>`).join("");
    $("#cumChart").innerHTML = `${ticks}${xt}
      <path d="${path(old)}" fill="none" stroke="#e0662b" stroke-width="2.5"/>
      <path d="${path(neu)}" fill="none" stroke="#0e9f6e" stroke-width="2.5"/>
      ${be}
      <g transform="translate(${P.l},4)"><rect width="10" height="3" y="4" fill="#e0662b"/><text x="14" y="9">ใช้เครื่องเดิมต่อ</text><rect x="110" width="10" height="3" y="4" fill="#0e9f6e"/><text x="124" y="9">เปลี่ยนเป็น Inverter (รวมค่าเครื่อง)</text></g>`;
  }
  $("#roiForm").addEventListener("input", calcROI);

  // ---------- project lead ----------
  const BLD = { office: 900, hotel: 800, retail: 1000, resi: 750 }; // BTU/h per m², preliminary
  function calcProject() {
    const a = +$("#pArea").value || 0;
    const btu = a * BLD[$("#pType").value];
    const tr = btu / 12000;
    $("#pEst").innerHTML = `ภาระความเย็นเบื้องต้นประมาณ <b>${fmt(tr)} TR</b> (${fmt(btu)} BTU/h)<br><span class="small">ตัวเลขนี้ใช้คุยเบื้องต้นเท่านั้น ขนาด outdoor/indoor ต้องยืนยันด้วย heat load calculation และ selection software ของ Samsung</span>`;
  }
  $("#leadForm").addEventListener("input", calcProject);
  $("#leadForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    handleForm(f, $("#leadMsg"), () => {
      const a = +$("#pArea").value || 0, type = $("#pType").value;
      return {
        type: "project",
        name: f.elements.fullname.value.trim(), contact: f.elements.contact.value.trim(), note: "",
        project: { company: $("#pName").value.trim(), areaM2: a, buildingType: type, estTR: +(a * BLD[type] / 12000).toFixed(1) },
      };
    });
  });

  // ---------- toast ----------
  let tt;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // ---------- LINE OA button ----------
  if (CFG.lineOaUrl) {
    $$("[data-line]").forEach((a) => { a.href = CFG.lineOaUrl; a.hidden = false; });
  }
  if (CFG.phone) $$("[data-phone]").forEach((el) => { el.textContent = CFG.phone; el.closest("[hidden]")?.removeAttribute("hidden"); });

  // ---------- init ----------
  (async () => {
    initSelection(); renderDataNote(); renderCart(); calcBTU(); calcROI(); calcProject();
    await loadProducts();       // may swap in live prices from the Google Sheet
    initSelection(); renderDataNote(); renderCart(); calcBTU();
  })();
})();

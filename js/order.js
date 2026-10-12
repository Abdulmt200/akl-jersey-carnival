(function () {
  "use strict";
  var A = window.AKL, C = A.C;
  var PRICE = Number(C.PRICE_PER_JERSEY) || 6000;
  var FEE = Number(C.DELIVERY_FEE) || 0;
  var MAX_QTY = 50, MAX_LINES = 20;
  var VERSIONS = ["Home", "Away", "Third"];
  var SIZES = ["M", "L", "XL", "2XL", "3XL"];
  var OTHER = { club: "Other Club", country: "Other Country" };
  var LISTS = {
    club: ["Real Madrid", "Barcelona", "Manchester United", "Manchester City", "Arsenal", "Chelsea", "Liverpool", "Paris Saint-Germain", "Bayern Munich", "Juventus", "Inter Milan", "AC Milan", "Tottenham Hotspur", OTHER.club],
    country: ["Nigeria", "Argentina", "Brazil", "Portugal", "France", "England", "Spain", "Germany", "USA", OTHER.country]
  };
  var OTHER_RE = /^[\p{L}\p{N}][\p{L}\p{N}\s&.'\u2019-]{1,59}$/u;
  var lines = [], uid = 0;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

  // ---------- Jersey lines ----------
  function newLine(cat, team) { return { id: ++uid, cat: cat || "club", team: team || "", other: "", ver: "Home", size: "", qty: 1, show: false }; }
  function teamName(l) { return l.team === OTHER[l.cat] ? l.other.trim().replace(/\s+/g, " ") : l.team; }
  function lineError(l) {
    var kind = l.cat === "club" ? "club" : "national team";
    if (!l.team) return "Choose a " + kind + ".";
    if (l.team === OTHER[l.cat] && !OTHER_RE.test(teamName(l))) return "Type the " + (l.cat === "club" ? "club" : "country") + " name (2 to 60 letters or numbers).";
    if (!l.size) return "Choose a size.";
    if (!(l.qty >= 1 && l.qty <= MAX_QTY)) return "Quantity must be 1 to " + MAX_QTY + ".";
    return "";
  }
  function complete(l) { return lineError(l) === ""; }
  function totals() {
    var q = 0; lines.forEach(function (l) { if (complete(l)) q += l.qty; });
    return { qty: q, amount: q > 0 ? q * PRICE + FEE : 0 };
  }
  function mergedItems(onlyComplete) {
    var map = {}, out = [];
    lines.forEach(function (l) {
      if (onlyComplete && !complete(l)) return;
      var name = teamName(l), key = l.cat + "|" + name.toLowerCase() + "|" + l.ver + "|" + l.size;
      if (map[key]) map[key].qty += l.qty;
      else { map[key] = { cat: l.cat, name: name, ver: l.ver, size: l.size, qty: l.qty }; out.push(map[key]); }
    });
    return out;
  }

  // Keep the chosen jerseys if the page is refreshed (never personal details)
  function save() {
    try {
      sessionStorage.setItem("akl_lines", JSON.stringify(lines.map(function (l) { return { cat: l.cat, team: l.team, other: l.other, ver: l.ver, size: l.size, qty: l.qty }; })));
    } catch (e) {}
  }
  function load() {
    try {
      var raw = JSON.parse(sessionStorage.getItem("akl_lines") || "[]");
      if (!Array.isArray(raw)) return [];
      return raw.slice(0, MAX_LINES).filter(function (r) {
        return r && (r.cat === "club" || r.cat === "country") && typeof r.team === "string" && (r.team === "" || LISTS[r.cat].indexOf(r.team) !== -1) &&
          typeof r.other === "string" && r.other.length <= 60 && VERSIONS.indexOf(r.ver) !== -1 && (r.size === "" || SIZES.indexOf(r.size) !== -1) &&
          Number.isInteger(r.qty) && r.qty >= 1 && r.qty <= MAX_QTY;
      }).map(function (r) { var l = newLine(r.cat, r.team); l.other = r.other; l.ver = r.ver; l.size = r.size; l.qty = r.qty; return l; });
    } catch (e) { return []; }
  }

  function buildLine(l, idx) {
    var box = el("div", "line");
    var head = el("div", "line-head");
    head.appendChild(el("b", null, "Jersey " + (idx + 1)));
    if (lines.length > 1) {
      var rm = el("button", "link-btn", "Remove"); rm.type = "button"; rm.setAttribute("aria-label", "Remove jersey " + (idx + 1));
      rm.addEventListener("click", function () { lines = lines.filter(function (x) { return x !== l; }); renderLines(); refreshAll(); });
      head.appendChild(rm);
    }
    box.appendChild(head);

    // Category
    var f1 = el("div", "field"); f1.appendChild(el("span", "lbl", "Category"));
    var seg = el("div", "seg"); seg.setAttribute("role", "group"); seg.setAttribute("aria-label", "Category");
    [["club", "Football Club"], ["country", "National Team"]].forEach(function (p) {
      var b = el("button", null, p[1]); b.type = "button"; b.setAttribute("aria-pressed", l.cat === p[0] ? "true" : "false");
      b.addEventListener("click", function () { if (l.cat === p[0]) return; l.cat = p[0]; l.team = ""; l.other = ""; renderLines(); refreshAll(); });
      seg.appendChild(b);
    });
    f1.appendChild(seg); box.appendChild(f1);

    // Team
    var f2 = el("div", "field");
    var lt = el("label", "lbl", l.cat === "club" ? "Club" : "National team"); lt.htmlFor = "team" + l.id; f2.appendChild(lt);
    var sel = el("select", "input"); sel.id = "team" + l.id;
    var ph = el("option", null, l.cat === "club" ? "Choose a club" : "Choose a national team"); ph.value = ""; sel.appendChild(ph);
    LISTS[l.cat].forEach(function (n) { var op = el("option", null, n); op.value = n; if (l.team === n) op.selected = true; sel.appendChild(op); });
    f2.appendChild(sel); box.appendChild(f2);

    var fo = el("div", "field"); fo.hidden = l.team !== OTHER[l.cat];
    var oi = el("input", "input"); oi.maxLength = 60; oi.value = l.other; oi.autocomplete = "off";
    oi.placeholder = l.cat === "club" ? "Type the club name" : "Type the country name"; oi.setAttribute("aria-label", l.cat === "club" ? "Club name" : "Country name");
    fo.appendChild(oi); box.appendChild(fo);
    sel.addEventListener("change", function () { l.team = sel.value; fo.hidden = l.team !== OTHER[l.cat]; if (!fo.hidden) oi.focus(); l.refresh(); refreshAll(); });
    oi.addEventListener("input", function () { l.other = oi.value; l.refresh(); refreshAll(); });

    // Version
    var f3 = el("div", "field"); f3.appendChild(el("span", "lbl", "Version"));
    var vseg = el("div", "seg"); vseg.setAttribute("role", "group"); vseg.setAttribute("aria-label", "Jersey version");
    var vbtns = [];
    VERSIONS.forEach(function (v) {
      var b = el("button", null, v); b.type = "button"; b.setAttribute("aria-pressed", l.ver === v ? "true" : "false");
      b.addEventListener("click", function () { l.ver = v; vbtns.forEach(function (x) { x.setAttribute("aria-pressed", x.textContent === v ? "true" : "false"); }); l.refresh(); refreshAll(); });
      vbtns.push(b); vseg.appendChild(b);
    });
    f3.appendChild(vseg); box.appendChild(f3);

    // Size
    var f4 = el("div", "field"); f4.appendChild(el("span", "lbl", "Size"));
    var chips = el("div", "chips"); chips.setAttribute("role", "group"); chips.setAttribute("aria-label", "Size");
    var sbtns = [];
    SIZES.forEach(function (s) {
      var b = el("button", "size-chip", s); b.type = "button"; b.setAttribute("aria-pressed", l.size === s ? "true" : "false");
      b.addEventListener("click", function () { l.size = s; sbtns.forEach(function (x) { x.setAttribute("aria-pressed", x.textContent === s ? "true" : "false"); }); l.refresh(); refreshAll(); });
      sbtns.push(b); chips.appendChild(b);
    });
    f4.appendChild(chips); box.appendChild(f4);

    // Quantity + price
    var foot = el("div", "line-foot");
    var qty = el("div", "qty");
    var minus = el("button", null, "\u2212"); minus.type = "button"; minus.setAttribute("aria-label", "Decrease quantity");
    var out = el("output", null, String(l.qty));
    var plus = el("button", null, "+"); plus.type = "button"; plus.setAttribute("aria-label", "Increase quantity");
    minus.addEventListener("click", function () { if (l.qty > 1) { l.qty--; out.textContent = l.qty; l.refresh(); refreshAll(); } });
    plus.addEventListener("click", function () { if (l.qty < MAX_QTY) { l.qty++; out.textContent = l.qty; l.refresh(); refreshAll(); } });
    qty.appendChild(minus); qty.appendChild(out); qty.appendChild(plus);
    var price = el("span", "line-price");
    foot.appendChild(qty); foot.appendChild(price); box.appendChild(foot);
    var err = el("p", "err"); err.setAttribute("role", "alert"); box.appendChild(err);

    l.refresh = function () {
      var e = lineError(l);
      price.textContent = e === "" ? A.naira(l.qty * PRICE) : "\u2014";
      err.textContent = l.show ? e : "";
      box.classList.toggle("has-error", !!(l.show && e));
    };
    l.refresh();
    return box;
  }
  function renderLines() {
    var box = $("lines"); box.textContent = "";
    lines.forEach(function (l, i) { box.appendChild(buildLine(l, i)); });
    $("addLine").disabled = lines.length >= MAX_LINES || A.isClosed();
  }
  $("addLine").addEventListener("click", function () {
    if (lines.length >= MAX_LINES) return;
    lines.push(newLine()); renderLines(); refreshAll();
    var last = lines[lines.length - 1]; var s = $("team" + last.id); if (s) s.focus();
  });

  // ---------- Customer details (checked again on the server) ----------
  var NAME_RE = /^[\p{L}][\p{L}\s.'\u2019-]{2,79}$/u;
  var PHONE_RE = /^0[789][01]\d{8}$/;
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  function normPhone(v) {
    v = String(v).replace(/[\s()-]/g, "");
    if (/^\+?234/.test(v)) v = "0" + v.replace(/^\+?234/, "");
    return v;
  }
  var checks = {
    fName: function (v) { v = v.trim().replace(/\s+/g, " "); return NAME_RE.test(v) ? "" : "Enter your full name (letters only, at least 3 characters)."; },
    fPhone: function (v) { return PHONE_RE.test(normPhone(v)) ? "" : "Enter a valid Nigerian phone number, e.g. 08012345678."; },
    fEmail: function (v) { v = v.trim(); return v === "" || (v.length <= 120 && EMAIL_RE.test(v)) ? "" : "Enter a valid email or leave it empty."; },
    fNotes: function (v) { return v.length <= 300 ? "" : "Notes must be 300 characters or less."; }
  };
  var errIds = { fName: "eName", fPhone: "ePhone", fEmail: "eEmail", fNotes: "eNotes" };
  function checkField(id, show) {
    var msg = checks[id]($(id).value);
    if (show) { $(errIds[id]).textContent = msg; if (msg) $(id).setAttribute("aria-invalid", "true"); else $(id).removeAttribute("aria-invalid"); }
    return msg === "";
  }
  function detailsValid(show) {
    var ok = true;
    Object.keys(checks).forEach(function (id) { if (!checkField(id, show)) ok = false; });
    return ok;
  }
  Object.keys(checks).forEach(function (id) {
    $(id).addEventListener("blur", function () { checkField(id, true); });
    $(id).addEventListener("input", function () { if ($(id).getAttribute("aria-invalid")) checkField(id, true); renderSummary(); });
  });

  // ---------- Review ----------
  function block(title) { var b = el("div", "sum-block"); b.appendChild(el("h3", null, title)); return b; }
  function row(a, b) { var r = el("div", "sum-row"); r.appendChild(el("span", null, a)); r.appendChild(el("b", null, b)); return r; }
  function renderSummary() {
    var box = $("summary"); box.textContent = "";
    var items = mergedItems(true), t = totals();
    if (items.length === 0) { box.appendChild(el("p", "empty", "Choose a jersey above to see your summary.")); return; }
    var cust = block("Customer");
    cust.appendChild(row("Name", $("fName").value.trim() || "-"));
    cust.appendChild(row("Phone", normPhone($("fPhone").value) || "-"));
    if ($("fEmail").value.trim()) cust.appendChild(row("Email", $("fEmail").value.trim()));
    if ($("fNotes").value.trim()) cust.appendChild(row("Notes", $("fNotes").value.trim()));
    box.appendChild(cust);

    var jb = block("Jerseys");
    items.forEach(function (it) { jb.appendChild(row(it.name + " \u00B7 " + it.ver + " \u00B7 " + it.size + " \u00D7 " + it.qty, A.naira(it.qty * PRICE))); });
    if (lines.some(function (l) { return !complete(l); })) jb.appendChild(el("p", "err", "Some jerseys are not complete yet and are not counted."));
    box.appendChild(jb);

    var sum = block("Totals");
    sum.appendChild(row("Unit price", A.naira(PRICE)));
    sum.appendChild(row("Total jerseys", String(t.qty)));
    sum.appendChild(row("Delivery date", C.DELIVERY_DATE || ""));
    sum.appendChild(row("Delivery", A.deliveryText));
    var tot = el("div", "sum-row"); tot.appendChild(el("span", null, "Total")); tot.appendChild(el("span", "sum-total", A.naira(t.amount)));
    sum.appendChild(tot); box.appendChild(sum);
  }
  function updateSubmit() {
    var ticked = $("confirm").checked;
    $("submitBtn").disabled = !ticked || A.isClosed();
    $("reviewHint").textContent = ticked ? "" : "Tick the box above, then confirm your order.";
  }
  function refreshAll() {
    var t = totals();
    $("cQty").textContent = String(t.qty); $("cTotal").textContent = A.naira(t.amount);
    $("tbQty").textContent = t.qty + (t.qty === 1 ? " jersey" : " jerseys"); $("tbTotal").textContent = A.naira(t.amount);
    renderSummary(); updateSubmit(); save();
  }
  $("confirm").addEventListener("change", updateSubmit);

  $("submitBtn").addEventListener("click", function () {
    var msg = $("submitMsg"); msg.hidden = true;
    if (A.isClosed()) { msg.textContent = "Orders are closed."; msg.hidden = false; return; }
    lines.forEach(function (l) { l.show = true; if (l.refresh) l.refresh(); });
    if (lines.length === 0 || lines.some(function (l) { return !complete(l); })) {
      var bad = document.querySelector(".line.has-error");
      if (bad) bad.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!detailsValid(true)) {
      var first = ["fName", "fPhone", "fEmail", "fNotes"].filter(function (id) { return !checkField(id, false); })[0];
      if (first) $(first).focus();
      return;
    }
    var items = mergedItems(false);
    if (items.some(function (i) { return i.qty > MAX_QTY; })) {
      msg.textContent = "Maximum " + MAX_QTY + " of the same jersey (same team, version and size) per order."; msg.hidden = false; return;
    }
    // Prices are NOT sent: the server calculates them.
    var payload = {
      customer_name: $("fName").value.trim().replace(/\s+/g, " "),
      customer_phone: normPhone($("fPhone").value),
      customer_email: $("fEmail").value.trim() || null,
      notes: $("fNotes").value.trim() || null,
      items: items.map(function (i) { return { category: i.cat === "club" ? "Football Club" : "National Team", club_or_country: i.name, jersey_version: i.ver, size: i.size, quantity: i.qty }; })
    };
    if (typeof window.AKL_submitOrder === "function") { window.AKL_submitOrder(payload); return; }
    msg.textContent = "Saving orders is not connected."; msg.hidden = false;
  });

  // ---------- Start ----------
  lines = load();
  if (lines.length === 0) lines = [newLine()];
  var qs = new URLSearchParams(location.search), qType = qs.get("type"), qName = qs.get("name");
  if ((qType === "club" || qType === "country") && !lines[0].team) {
    lines[0].cat = qType;
    if (qName === "other") lines[0].team = OTHER[qType];
    else if (LISTS[qType].indexOf(qName) !== -1) lines[0].team = qName;
  }
  renderLines(); refreshAll();
  if (A.isClosed()) { $("closedNote").hidden = false; $("addLine").disabled = true; }
})();

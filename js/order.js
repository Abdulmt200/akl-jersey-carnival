(function () {
  "use strict";
  var A = window.AKL, C = A.C;
  var PRICE = Number(C.PRICE_PER_JERSEY) || 6000;
  var MAX_QTY = 50;
  var VERSIONS = ["Home", "Away", "Third"];
  var SIZES = ["M", "L", "XL", "2XL", "3XL"];
  var OTHER = { club: "Other Club", country: "Other Country" };
  var LISTS = {
    club: ["Real Madrid", "Barcelona", "Manchester United", "Manchester City", "Arsenal", "Chelsea", "Liverpool", "Paris Saint-Germain", "Bayern Munich", "Juventus", "Inter Milan", "AC Milan", "Tottenham Hotspur", OTHER.club],
    country: ["Nigeria", "Argentina", "Brazil", "Portugal", "France", "England", "Spain", "Germany", "USA", OTHER.country]
  };
  var state = { cat: "club", team: "", ver: "Home", size: "", qty: 1, items: [] };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function lower(s) { return String(s).toLowerCase(); }

  // ---------- Saved cart (jerseys only, never personal details) ----------
  function saveCart() { try { sessionStorage.setItem("akl_cart", JSON.stringify(state.items)); } catch (e) {} }
  function loadCart() {
    try {
      var raw = JSON.parse(sessionStorage.getItem("akl_cart") || "[]");
      if (!Array.isArray(raw)) return [];
      return raw.filter(function (i) {
        return i && (i.cat === "club" || i.cat === "country") && typeof i.name === "string" && i.name.length >= 2 && i.name.length <= 60 &&
          VERSIONS.indexOf(i.ver) !== -1 && SIZES.indexOf(i.size) !== -1 && Number.isInteger(i.qty) && i.qty >= 1 && i.qty <= MAX_QTY;
      }).map(function (i) { return { id: String(Math.random()), cat: i.cat, name: i.name, ver: i.ver, size: i.size, qty: i.qty }; });
    } catch (e) { return []; }
  }

  // ---------- Selection UI ----------
  function isOther() { return state.team === OTHER[state.cat]; }

  function syncSeg(id, value) {
    $(id).querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-v") === value ? "true" : "false"); });
  }
  function renderTeams() {
    var grid = $("teamGrid");
    grid.textContent = "";
    LISTS[state.cat].forEach(function (name) {
      var b = el("button", "team-opt", name);
      b.type = "button";
      b.setAttribute("aria-pressed", state.team === name ? "true" : "false");
      b.addEventListener("click", function () { state.team = name; renderTeams(); refreshOther(); $("addErr").textContent = ""; });
      grid.appendChild(b);
    });
    $("teamLbl").textContent = state.cat === "club" ? "Club" : "National team";
  }
  function refreshOther() {
    $("otherWrap").hidden = !isOther();
    $("otherLbl").textContent = state.cat === "club" ? "Club name" : "Country name";
    $("otherName").placeholder = state.cat === "club" ? "Type the club name" : "Type the country name";
    if (isOther()) $("otherName").focus({ preventScroll: true });
  }
  function renderSizes() {
    var row = $("sizeRow");
    row.textContent = "";
    SIZES.forEach(function (s) {
      var b = el("button", "size-chip", s);
      b.type = "button";
      b.setAttribute("aria-pressed", state.size === s ? "true" : "false");
      b.addEventListener("click", function () { state.size = s; renderSizes(); $("addErr").textContent = ""; });
      row.appendChild(b);
    });
  }
  function refreshAddBtn() { $("addBtn").textContent = "Add to order \u00B7 " + A.naira(state.qty * PRICE); }

  $("catSeg").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    state.cat = b.getAttribute("data-v"); state.team = ""; $("otherName").value = ""; $("otherErr").textContent = "";
    syncSeg("catSeg", state.cat); renderTeams(); refreshOther();
  });
  $("verSeg").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    state.ver = b.getAttribute("data-v"); syncSeg("verSeg", state.ver);
  });
  $("qMinus").addEventListener("click", function () { state.qty = Math.max(1, state.qty - 1); $("qVal").textContent = state.qty; refreshAddBtn(); });
  $("qPlus").addEventListener("click", function () { state.qty = Math.min(MAX_QTY, state.qty + 1); $("qVal").textContent = state.qty; refreshAddBtn(); });

  // ---------- Add to order ----------
  var OTHER_RE = /^[\p{L}\p{N}][\p{L}\p{N}\s&.'\u2019-]{1,59}$/u;
  function addItem() {
    $("addErr").textContent = ""; $("addOk").textContent = ""; $("otherErr").textContent = "";
    if (A.isClosed()) { $("addErr").textContent = "Orders are closed."; return; }
    if (!state.team) { $("addErr").textContent = "Please choose a " + (state.cat === "club" ? "club" : "national team") + "."; return; }
    var name = state.team;
    if (isOther()) {
      name = $("otherName").value.trim().replace(/\s+/g, " ");
      if (!OTHER_RE.test(name)) { $("otherErr").textContent = "Enter a valid name (2 to 60 letters or numbers)."; $("otherName").setAttribute("aria-invalid", "true"); $("otherName").focus(); return; }
      $("otherName").removeAttribute("aria-invalid");
    }
    if (!state.size) { $("addErr").textContent = "Please choose a size."; return; }

    var existing = state.items.filter(function (i) { return i.cat === state.cat && lower(i.name) === lower(name) && i.ver === state.ver && i.size === state.size; })[0];
    if (existing) { existing.qty = Math.min(MAX_QTY, existing.qty + state.qty); }
    else { state.items.push({ id: String(Math.random()), cat: state.cat, name: name, ver: state.ver, size: state.size, qty: state.qty }); }

    state.qty = 1; $("qVal").textContent = 1; refreshAddBtn();
    $("addOk").textContent = "Added to your order.";
    setTimeout(function () { $("addOk").textContent = ""; }, 2500);
    renderAll();
  }
  $("addBtn").addEventListener("click", addItem);

  // ---------- Cart ----------
  function totals() {
    var q = state.items.reduce(function (s, i) { return s + i.qty; }, 0);
    return { qty: q, amount: q * PRICE };
  }
  function renderCart() {
    var box = $("cart");
    box.textContent = "";
    state.items.forEach(function (it) {
      var row = el("div", "cart-item");
      var main = el("div");
      main.appendChild(el("div", "ci-title", it.name));
      main.appendChild(el("div", "ci-sub", (it.cat === "club" ? "Club" : "National team") + " \u00B7 " + it.ver + " \u00B7 Size " + it.size + " \u00B7 " + A.naira(PRICE) + " each"));
      row.appendChild(main);
      row.appendChild(el("div", "ci-price", A.naira(it.qty * PRICE)));

      var actions = el("div", "ci-actions");
      var qty = el("div", "qty");
      var minus = el("button", null, "\u2212"); minus.type = "button"; minus.setAttribute("aria-label", "Decrease quantity of " + it.name);
      var out = el("output", null, String(it.qty));
      var plus = el("button", null, "+"); plus.type = "button"; plus.setAttribute("aria-label", "Increase quantity of " + it.name);
      minus.addEventListener("click", function () { if (it.qty > 1) { it.qty--; renderAll(); } });
      plus.addEventListener("click", function () { if (it.qty < MAX_QTY) { it.qty++; renderAll(); } });
      qty.appendChild(minus); qty.appendChild(out); qty.appendChild(plus);
      var rm = el("button", "link-btn", "Remove"); rm.type = "button"; rm.setAttribute("aria-label", "Remove " + it.name);
      rm.addEventListener("click", function () { state.items = state.items.filter(function (x) { return x !== it; }); renderAll(); });
      actions.appendChild(qty); actions.appendChild(rm);
      row.appendChild(actions);
      box.appendChild(row);
    });
    var t = totals();
    $("cartEmpty").hidden = state.items.length > 0;
    $("cartTotals").hidden = state.items.length === 0;
    $("cQty").textContent = String(t.qty);
    $("cTotal").textContent = A.naira(t.amount);
    $("tbQty").textContent = t.qty + (t.qty === 1 ? " jersey" : " jerseys");
    $("tbTotal").textContent = A.naira(t.amount);
  }

  // ---------- Customer details (validated again on the server later) ----------
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
    $(id).addEventListener("blur", function () { checkField(id, true); updateSubmit(); });
    $(id).addEventListener("input", function () { if ($(id).getAttribute("aria-invalid")) checkField(id, true); renderSummary(); updateSubmit(); });
  });

  // ---------- Review ----------
  function block(title) { var b = el("div", "sum-block"); b.appendChild(el("h3", null, title)); return b; }
  function row(a, b) { var r = el("div", "sum-row"); r.appendChild(el("span", null, a)); r.appendChild(el("b", null, b)); return r; }
  function renderSummary() {
    var box = $("summary");
    box.textContent = "";
    if (state.items.length === 0) { box.appendChild(el("p", "empty", "Add at least one jersey to see your summary.")); return; }
    var cust = block("Customer");
    cust.appendChild(row("Name", $("fName").value.trim() || "-"));
    cust.appendChild(row("Phone", normPhone($("fPhone").value) || "-"));
    if ($("fEmail").value.trim()) cust.appendChild(row("Email", $("fEmail").value.trim()));
    if ($("fNotes").value.trim()) cust.appendChild(row("Notes", $("fNotes").value.trim()));
    box.appendChild(cust);

    var items = block("Jerseys");
    state.items.forEach(function (it) {
      items.appendChild(row(it.name + " \u00B7 " + it.ver + " \u00B7 " + it.size + " \u00D7 " + it.qty, A.naira(it.qty * PRICE)));
    });
    box.appendChild(items);

    var t = totals();
    var sum = block("Totals");
    sum.appendChild(row("Unit price", A.naira(PRICE)));
    sum.appendChild(row("Total jerseys", String(t.qty)));
    sum.appendChild(row("Delivery date", C.DELIVERY_DATE || ""));
    sum.appendChild(row("Delivery", A.deliveryText));
    var tot = el("div", "sum-row"); tot.appendChild(el("span", null, "Total")); tot.appendChild(el("span", "sum-total", A.naira(t.amount)));
    sum.appendChild(tot);
    box.appendChild(sum);
  }

  function updateSubmit() {
    $("submitBtn").disabled = !(state.items.length > 0 && detailsValid(false) && $("confirm").checked && !A.isClosed());
  }
  $("confirm").addEventListener("change", updateSubmit);

  $("submitBtn").addEventListener("click", function () {
    var msg = $("submitMsg");
    msg.hidden = true;
    if (A.isClosed()) { msg.textContent = "Orders are closed."; msg.hidden = false; return; }
    if (state.items.length === 0) { msg.textContent = "Add at least one jersey first."; msg.hidden = false; return; }
    if (!detailsValid(true)) { var bad = ["fName", "fPhone", "fEmail", "fNotes"].filter(function (id) { return !checkField(id, false); })[0]; if (bad) $(bad).focus(); return; }

    // Prices are NOT sent: the server will calculate them (Phase 8).
    var payload = {
      customer_name: $("fName").value.trim().replace(/\s+/g, " "),
      customer_phone: normPhone($("fPhone").value),
      customer_email: $("fEmail").value.trim() || null,
      notes: $("fNotes").value.trim() || null,
      items: state.items.map(function (i) { return { category: i.cat === "club" ? "Football Club" : "National Team", club_or_country: i.name, jersey_version: i.ver, size: i.size, quantity: i.qty }; })
    };

    if (typeof window.AKL_submitOrder === "function") { window.AKL_submitOrder(payload); return; }
    msg.textContent = "Your order is ready, but saving orders is not connected yet (database comes next). Nothing has been saved or sent.";
    msg.hidden = false;
  });

  // ---------- Start ----------
  function renderAll() { saveCart(); renderCart(); renderSummary(); updateSubmit(); }

  state.items = loadCart();
  var qs = new URLSearchParams(location.search);
  var qType = qs.get("type"), qName = qs.get("name");
  if (qType === "club" || qType === "country") {
    state.cat = qType; syncSeg("catSeg", qType);
    if (qName === "other") state.team = OTHER[qType];
    else if (LISTS[qType].indexOf(qName) !== -1) state.team = qName;
  }
  renderTeams(); renderSizes(); refreshOther(); refreshAddBtn(); renderAll();
  if (A.isClosed()) { $("closedNote").hidden = false; $("addBtn").disabled = true; }
})();

(function () {
  "use strict";
  var A = window.AKL, C = A.C, naira = A.naira;
  var BASE = C.SUPABASE_URL, KEY = C.SUPABASE_PUBLISHABLE_KEY;
  var PAGE_SIZE = 15;
  var SIZE_ORDER = ["M", "L", "XL", "2XL", "3XL"];
  var VERSION_ORDER = ["Home", "Away", "Third"];
  var ERRORS = {
    PAYMENT_EXCEEDS_TOTAL: "That payment is more than the outstanding balance.",
    ORDER_CANCELLED: "Cancelled orders cannot receive payments.",
    HAS_PAYMENTS: "This order has confirmed payments. Void the payments first.",
    NOT_ALLOWED: "You are not allowed to do this.",
    NOT_FOUND: "Order not found."
  };
  var S = { session: null, orders: [], filtered: [], page: 1, openId: null };

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }
  function fmtDate(iso) {
    try { return new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return String(iso); }
  }
  function friendly(err) {
    if (err && err.name === "TypeError") return "Network problem. Check your connection.";
    return ERRORS[err && err.message] || (err && err.message) || "Something went wrong.";
  }
  function pill(text) { return el("span", "pill pill-" + String(text).toLowerCase(), text); }
  function select(options, value) {
    var s = el("select", "input");
    options.forEach(function (o) { var op = el("option", null, o); op.value = o; if (o === value) op.selected = true; s.appendChild(op); });
    return s;
  }

  // ---------- Session (kept only while this tab is open) ----------
  function loadSession() {
    try { var s = JSON.parse(sessionStorage.getItem("akl_admin") || "null"); return s && s.access_token ? s : null; } catch (e) { return null; }
  }
  function saveSession(s) {
    S.session = s;
    try { if (s) sessionStorage.setItem("akl_admin", JSON.stringify(s)); else sessionStorage.removeItem("akl_admin"); } catch (e) {}
  }
  function authCall(path, body) {
    return fetch(BASE + "/auth/v1/" + path, {
      method: "POST", headers: { "Content-Type": "application/json", "apikey": KEY }, body: JSON.stringify(body)
    }).then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); });
  }
  function toSession(j, email) {
    return { access_token: j.access_token, refresh_token: j.refresh_token, email: (j.user && j.user.email) || email || "" };
  }
  function refresh() {
    if (!S.session || !S.session.refresh_token) return Promise.reject(new Error("no session"));
    return authCall("token?grant_type=refresh_token", { refresh_token: S.session.refresh_token }).then(function (res) {
      if (!res.ok) throw new Error("expired");
      saveSession(toSession(res.body, S.session.email));
    });
  }
  function api(path, opts, retried) {
    opts = opts || {};
    if (!S.session) return Promise.reject(new Error("no session"));
    var headers = { "apikey": KEY, "Authorization": "Bearer " + S.session.access_token, "Content-Type": "application/json" };
    if (opts.prefer) headers["Prefer"] = opts.prefer;
    return fetch(BASE + "/rest/v1/" + path, {
      method: opts.method || "GET", headers: headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined
    }).then(function (r) {
      if (r.status === 401 && !retried) return refresh().then(function () { return api(path, opts, true); });
      return r.text().then(function (t) {
        var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
        if (!r.ok) { var err = new Error((j && j.message) || ("HTTP " + r.status)); err.code = r.status; throw err; }
        return j;
      });
    });
  }

  // ---------- Views ----------
  function showLogin(msg) {
    $("appView").hidden = true; $("loginView").hidden = false;
    $("loginErr").textContent = msg || ""; $("lpass").value = "";
  }
  function showApp() {
    $("loginView").hidden = true; $("appView").hidden = false;
    $("who").textContent = (S.session && S.session.email) || "";
    loadOrders(false);
  }
  function signOut(msg) {
    var tok = S.session && S.session.access_token;
    saveSession(null); S.orders = []; S.filtered = [];
    if (tok) fetch(BASE + "/auth/v1/logout", { method: "POST", headers: { apikey: KEY, Authorization: "Bearer " + tok } }).catch(function () {});
    if ($("detail").open) $("detail").close();
    showLogin(msg);
  }
  function setState(text, retry) {
    $("state").hidden = !text; $("stateText").textContent = text || ""; $("retry").hidden = !retry;
  }
  function onError(err) {
    var m = String((err && err.message) || "");
    if (m === "no session" || m === "expired") { signOut("Session expired. Please sign in again."); return; }
    setState("Could not load orders: " + friendly(err), true);
  }

  $("loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("lemail").value.trim(), pw = $("lpass").value, btn = $("loginBtn");
    $("loginErr").textContent = "";
    if (!email || !pw) { $("loginErr").textContent = "Enter your email and password."; return; }
    btn.disabled = true; btn.textContent = "Signing in...";
    authCall("token?grant_type=password", { email: email, password: pw }).then(function (res) {
      if (!res.ok) throw new Error("Wrong email or password.");
      saveSession(toSession(res.body, email));
      return api("rpc/is_admin", { method: "POST", body: {} });
    }).then(function (isAdmin) {
      if (isAdmin !== true) { signOut("This account is not an administrator."); return; }
      showApp();
    }).catch(function (err) {
      saveSession(null);
      $("loginErr").textContent = err.name === "TypeError" ? "Network problem. Check your connection." : err.message;
    }).then(function () { btn.disabled = false; btn.textContent = "Sign in"; });
  });
  $("btnOut").addEventListener("click", function () { signOut(""); });

  // ---------- Data ----------
  function normalize(o) {
    o.total_amount = Number(o.total_amount); o.amount_paid = Number(o.amount_paid); o.total_quantity = Number(o.total_quantity);
    o.items = (o.order_items || []).slice();
    o.payments = (o.payment_records || []).slice().sort(function (a, b) { return new Date(a.paid_at) - new Date(b.paid_at); });
    o.balance = Math.max(0, o.total_amount - o.amount_paid);
    o.itemsText = o.items.map(function (i) { return i.club_or_country + " " + i.jersey_version + " " + i.size + "\u00D7" + i.quantity; }).join(", ");
    o.teams = o.items.map(function (i) { return i.club_or_country.toLowerCase(); });
    o.search = [o.order_number, o.customer_name, o.customer_phone, o.customer_email || ""].join(" ").toLowerCase();
    return o;}
  function loadOrders(silent) {
    if (!silent) setState("Loading orders...", false);
    return api("orders?select=*,order_items(*),payment_records(*)&order=created_at.desc&limit=1000").then(function (rows) {
      S.orders = (rows || []).map(normalize);
      setState("", false);
      fillTeamFilter(); renderCards(); renderInsights(); applyFilters(true);
    }).catch(onError);
  }
  $("retry").addEventListener("click", function () { loadOrders(false); });
  $("btnRefresh").addEventListener("click", function () { loadOrders(false); });

  function stats() {
    var act = S.orders.filter(function (o) { return o.order_status !== "Cancelled"; });
    var can = S.orders.filter(function (o) { return o.order_status === "Cancelled"; });
    function sum(list, f) { return list.reduce(function (s, o) { return s + f(o); }, 0); }
    return {
      act: act, can: can, orders: act.length,
      jerseys: sum(act, function (o) { return o.total_quantity; }),
      sales: sum(act, function (o) { return o.total_amount; }),
      paid: sum(act, function (o) { return o.amount_paid; }),
      outstanding: sum(act, function (o) { return o.balance; }),
      awaiting: act.filter(function (o) { return o.delivery_status !== "Delivered"; }).length,
      cancelledValue: sum(can, function (o) { return o.total_amount; }),
      cancelledPaid: sum(can, function (o) { return o.amount_paid; })
    };
  }

  // ---------- Summary cards ----------
  function renderCards() {
    var s = stats(), box = $("cards"); box.textContent = "";
    var list = [
      ["Total orders", String(s.orders), s.can.length ? "+" + s.can.length + " cancelled (excluded)" : "excluding cancelled", ""],
      ["Total jerseys", String(s.jerseys), "excluding cancelled", ""],
      ["Total sales value", naira(s.sales), "excluding cancelled", ""],
      ["Amount collected", naira(s.paid), s.cancelledPaid > 0 ? naira(s.cancelledPaid) + " on cancelled orders" : "confirmed payments", ""],
      ["Outstanding balance", naira(s.outstanding), "sales minus payments", s.outstanding > 0 ? "warn" : ""],
      ["Awaiting delivery", String(s.awaiting), "not yet delivered", s.awaiting > 0 ? "warn" : ""]
    ];
    list.forEach(function (c) {
      var d = el("div", "card " + c[3]);
      d.appendChild(el("span", "card-label", c[0])); d.appendChild(el("span", "card-value", c[1])); d.appendChild(el("span", "card-sub", c[2]));
      box.appendChild(d);
    });
  }

  // ---------- Filters + table ----------
  function fillTeamFilter() {
    var sel = $("fTeam"), keep = sel.value, seen = {}, names = [];
    S.orders.forEach(function (o) { o.items.forEach(function (i) { var k = i.club_or_country.toLowerCase(); if (!seen[k]) { seen[k] = true; names.push([k, i.club_or_country]); } }); });
    names.sort(function (a, b) { return a[1].localeCompare(b[1]); });
    sel.textContent = "";
    var first = el("option", null, "All clubs and countries"); first.value = ""; sel.appendChild(first);
    names.forEach(function (n) { var op = el("option", null, n[1]); op.value = n[0]; sel.appendChild(op); });
    sel.value = keep;
  }
  function applyFilters(keepPage) {
    var q = $("fSearch").value.trim().toLowerCase(), pay = $("fPay").value, del = $("fDel").value, st = $("fStatus").value, team = $("fTeam").value;
    S.filtered = S.orders.filter(function (o) {
      if (q && o.search.indexOf(q) === -1) return false;
      if (pay && o.payment_status !== pay) return false;
      if (del && o.delivery_status !== del) return false;
      if (st && o.order_status !== st) return false;
      if (team && o.teams.indexOf(team) === -1) return false;
      return true;
    });
    if (!keepPage) S.page = 1;
    renderTable();
  }
  ["fSearch"].forEach(function (id) { $(id).addEventListener("input", function () { applyFilters(false); }); });
  ["fPay", "fDel", "fStatus", "fTeam"].forEach(function (id) { $(id).addEventListener("change", function () { applyFilters(false); }); });
  $("fClear").addEventListener("click", function () {
    $("fSearch").value = ""; $("fPay").value = ""; $("fDel").value = ""; $("fStatus").value = ""; $("fTeam").value = ""; applyFilters(false);
  });

  function cell(label, content, cls) {
    var td = el("td", cls || ""); td.setAttribute("data-label", label);
    if (content instanceof Node) td.appendChild(content); else td.textContent = content;
    return td;
  }
  function renderTable() {
    var body = $("tbody"); body.textContent = "";
    var total = S.filtered.length, pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (S.page > pages) S.page = pages;
    var rows = S.filtered.slice((S.page - 1) * PAGE_SIZE, S.page * PAGE_SIZE);
    $("count").textContent = total + (total === 1 ? " order" : " orders");
    $("empty").hidden = total !== 0; $("tableWrap").hidden = total === 0;
    $("empty").textContent = S.orders.length === 0 ? "No orders yet. They will appear here as customers order." : "No orders match your search.";
    rows.forEach(function (o) {
      var tr = el("tr", o.order_status === "Cancelled" ? "is-cancelled" : "");
      tr.appendChild(cell("Order", el("strong", null, o.order_number)));
      tr.appendChild(cell("Customer", o.customer_name));
      tr.appendChild(cell("Phone", o.customer_phone));
      tr.appendChild(cell("Date", fmtDate(o.created_at)));
      tr.appendChild(cell("Jerseys", o.itemsText, "wide items"));
      tr.appendChild(cell("Qty", String(o.total_quantity)));
      tr.appendChild(cell("Total", naira(o.total_amount)));
      tr.appendChild(cell("Paid", naira(o.amount_paid)));
      tr.appendChild(cell("Balance", naira(o.balance)));
      tr.appendChild(cell("Payment", pill(o.payment_status)));
      tr.appendChild(cell("Delivery", pill(o.delivery_status)));
      tr.appendChild(cell("Status", pill(o.order_status)));
      var b = el("button", "btn btn-outline btn-sm", "Open"); b.type = "button";
      b.addEventListener("click", function () { openDetail(o.id); });
      tr.appendChild(cell("", b, "wide"));
      body.appendChild(tr);
    });
    $("pageInfo").textContent = "Page " + S.page + " of " + pages;
    $("prev").disabled = S.page <= 1; $("next").disabled = S.page >= pages;
  }
  $("prev").addEventListener("click", function () { if (S.page > 1) { S.page--; renderTable(); window.scrollTo({ top: 0, behavior: "smooth" }); } });
  $("next").addEventListener("click", function () { S.page++; renderTable(); window.scrollTo({ top: 0, behavior: "smooth" }); });

  // ---------- Demand ----------
  function tally(key) {
    var m = {};
    S.orders.forEach(function (o) {
      if (o.order_status === "Cancelled") return;
      o.items.forEach(function (i) {
        var k = String(i[key]), lk = k.toLowerCase();
        if (!m[lk]) m[lk] = { label: k, qty: 0 };
        m[lk].qty += Number(i.quantity);
      });
    });
    return Object.keys(m).map(function (k) { return m[k]; });
  }
  function ordered(list, order) {
    return list.slice().sort(function (a, b) { return order.indexOf(a.label) - order.indexOf(b.label); });
  }
  function bars(title, list) {
    var wrap = el("div", "bars"); wrap.appendChild(el("h3", null, title));
    if (list.length === 0) { wrap.appendChild(el("p", "muted small", "No data yet.")); return wrap; }
    var max = Math.max.apply(null, list.map(function (x) { return x.qty; }));
    list.forEach(function (x) {
      var row = el("div", "bar-row");
      row.appendChild(el("span", "bn", x.label));
      var track = el("span", "bar-track"), fill = el("span", "bar-fill"); fill.style.width = Math.max(4, Math.round(x.qty / max * 100)) + "%";
      track.appendChild(fill); row.appendChild(track); row.appendChild(el("b", null, String(x.qty)));
      wrap.appendChild(row);
    });
    return wrap;
  }
  function teamList() { return tally("club_or_country").sort(function (a, b) { return b.qty - a.qty; }); }
  function renderInsights() {
    var box = $("insights"); box.textContent = "";
    box.appendChild(bars("By club or country", teamList().slice(0, 12)));
    box.appendChild(bars("By jersey version", ordered(tally("jersey_version"), VERSION_ORDER)));
    box.appendChild(bars("By size", ordered(tally("size"), SIZE_ORDER)));
  }

  // ---------- Order details ----------
  function sec(title) { var s = el("div", "d-sec"); if (title) s.appendChild(el("h3", null, title)); return s; }
  function drow(a, b) { var r = el("div", "d-row"); r.appendChild(el("span", "muted", a)); r.appendChild(el("b", null, b)); return r; }
  function setMsg(text, ok) { var m = $("dMsg"); if (m) { m.textContent = text || ""; m.className = "d-msg" + (ok ? "" : " bad"); } }
  function refreshAfter(id, okText) {
    return loadOrders(true).then(function () { openDetail(id); if (okText) setMsg(okText, true); });
  }

  function openDetail(id) {
    var o = S.orders.filter(function (x) { return x.id === id; })[0];
    if (!o) return;
    S.openId = id;
    $("dTitle").textContent = o.order_number;
    var b = $("detailBody"); b.textContent = "";

    var top = sec("");
    var pills = el("div", "d-pills");
    pills.appendChild(pill(o.payment_status)); pills.appendChild(pill(o.delivery_status)); pills.appendChild(pill(o.order_status));
    top.appendChild(pills);
    top.appendChild(el("p", "muted small", "Placed " + fmtDate(o.created_at)));
    var msg = el("p", "d-msg"); msg.id = "dMsg"; msg.setAttribute("role", "status"); top.appendChild(msg);
    b.appendChild(top);

    var cust = sec("Customer");
    cust.appendChild(drow("Name", o.customer_name));
    cust.appendChild(drow("Phone", o.customer_phone));
    if (o.customer_email) cust.appendChild(drow("Email", o.customer_email));
    if (o.notes) cust.appendChild(drow("Notes", o.notes));
    var wa = el("a", "btn btn-wa btn-sm", "WhatsApp customer");
    wa.href = "https://wa.me/234" + o.customer_phone.slice(1) + "?text=" + encodeURIComponent("Hello " + o.customer_name + ", this is AKL Jersey Carnival about your order " + o.order_number + ".");
    wa.target = "_blank"; wa.rel = "noopener";
    var wr = el("div", "d-actions"); wr.appendChild(wa); cust.appendChild(wr);
    b.appendChild(cust);

    var items = sec("Jerseys");
    o.items.forEach(function (i) {
      var r = el("div", "d-row");
      var l = el("span"); l.appendChild(el("b", null, i.club_or_country));
      l.appendChild(el("div", "muted small", i.category + " \u00B7 " + i.jersey_version + " \u00B7 Size " + i.size));
      r.appendChild(l); r.appendChild(el("b", null, "\u00D7" + i.quantity + " \u00B7 " + naira(Number(i.subtotal))));
      items.appendChild(r);
    });
    b.appendChild(items);

    var tot = sec("Totals");
    tot.appendChild(drow("Total jerseys", String(o.total_quantity)));
    tot.appendChild(drow("Total amount", naira(o.total_amount)));
    tot.appendChild(drow("Amount paid", naira(o.amount_paid)));
    var bal = el("div", "d-row"); bal.appendChild(el("span", "muted", "Outstanding balance")); bal.appendChild(el("span", "total-line", naira(o.balance)));
    tot.appendChild(bal);
    b.appendChild(tot);

    var pay = sec("Payments");
    if (o.payments.length === 0) pay.appendChild(el("p", "muted small", "No payments recorded yet."));
    o.payments.forEach(function (p) {
      var r = el("div", "d-row pay-row" + (p.confirmed ? "" : " voided"));
      var left = el("span");
      left.appendChild(el("b", null, naira(Number(p.amount))));
      left.appendChild(el("div", "muted small", p.method + (p.reference ? " \u00B7 " + p.reference : "") + " \u00B7 " + fmtDate(p.paid_at) + (p.confirmed ? "" : " \u00B7 VOIDED")));
      var btn = el("button", "btn btn-ghost btn-sm", p.confirmed ? "Void" : "Restore"); btn.type = "button";
      btn.addEventListener("click", function () {
        if (p.confirmed && !confirm("Void this payment of " + naira(Number(p.amount)) + "?")) return;
        btn.disabled = true;api("payment_records?id=eq." + encodeURIComponent(p.id), { method: "PATCH", prefer: "return=minimal", body: { confirmed: !p.confirmed } })
          .then(function () { return refreshAfter(id, p.confirmed ? "Payment voided." : "Payment restored."); })
          .catch(function (e) { setMsg(friendly(e)); btn.disabled = false; });
      });
      r.appendChild(left); r.appendChild(btn); pay.appendChild(r);
    });
    if (o.order_status === "Cancelled") {
      pay.appendChild(el("p", "muted small", "Cancelled orders cannot receive payments."));
    } else if (o.balance <= 0) {
      pay.appendChild(el("p", "muted small", "This order is fully paid."));
    } else {
      var form = el("div", "pay-form");
      var amt = el("input", "input"); amt.type = "number"; amt.inputMode = "decimal"; amt.min = "1"; amt.step = "1"; amt.value = String(o.balance); amt.setAttribute("aria-label", "Amount");
      var meth = select(["Transfer", "Cash", "Other"], "Transfer"); meth.setAttribute("aria-label", "Method");
      var ref = el("input", "input"); ref.type = "text"; ref.maxLength = 100; ref.placeholder = "Reference (optional)"; ref.setAttribute("aria-label", "Reference");
      var go = el("button", "btn btn-lime btn-sm", "Record payment"); go.type = "button";
      go.addEventListener("click", function () {
        var v = Number(amt.value);
        if (!(v > 0)) { setMsg("Enter a valid amount."); return; }
        if (v > o.balance) { setMsg("Amount is more than the balance (" + naira(o.balance) + ")."); return; }
        go.disabled = true;
        api("payment_records", { method: "POST", prefer: "return=minimal", body: { order_id: o.id, amount: v, method: meth.value, reference: ref.value.trim() || null, confirmed: true } })
          .then(function () { return refreshAfter(id, "Payment recorded."); })
          .catch(function (e) { setMsg(friendly(e)); go.disabled = false; });
      });
      form.appendChild(amt); form.appendChild(meth); form.appendChild(ref); form.appendChild(go);
      pay.appendChild(form);
    }
    b.appendChild(pay);

    var st = sec("Status");
    var sf = el("div", "status-form");
    var w1 = el("div"); w1.appendChild(el("label", "lbl", "Order status")); var os = select(["Pending", "Confirmed", "Cancelled"], o.order_status); w1.appendChild(os);
    var w2 = el("div"); w2.appendChild(el("label", "lbl", "Delivery status")); var ds = select(["Pending", "Ready", "Delivered"], o.delivery_status); w2.appendChild(ds);
    var save = el("button", "btn btn-lime btn-sm", "Save status"); save.type = "button";
    save.addEventListener("click", function () {
      if (os.value === "Cancelled" && o.order_status !== "Cancelled" &&
        !confirm("Cancel order " + o.order_number + "?" + (o.amount_paid > 0 ? " It has " + naira(o.amount_paid) + " in payments." : ""))) return;
      if (ds.value === "Delivered" && o.delivery_status !== "Delivered" && o.payment_status !== "Paid" &&
        !confirm("This order is not fully paid. Mark as Delivered anyway?")) return;
      save.disabled = true;
      api("orders?id=eq." + encodeURIComponent(o.id), { method: "PATCH", prefer: "return=minimal", body: { order_status: os.value, delivery_status: ds.value } })
        .then(function () { return refreshAfter(id, "Status saved."); })
        .catch(function (e) { setMsg(friendly(e)); save.disabled = false; });
    });
    sf.appendChild(w1); sf.appendChild(w2); sf.appendChild(save); st.appendChild(sf);
    b.appendChild(st);

    var danger = sec("Danger zone");
    danger.appendChild(el("p", "muted small", "Deleting removes the order and its items for good. Orders with confirmed payments cannot be deleted: void the payments first, or cancel the order instead."));
    var del = el("button", "btn btn-danger btn-sm", "Delete order permanently"); del.type = "button";
    del.addEventListener("click", function () {
      var t = prompt("This cannot be undone. Type the order number (" + o.order_number + ") to delete it:");
      if (t === null) return;
      if (t.trim().toUpperCase() !== o.order_number.toUpperCase()) { setMsg("Order number did not match. Nothing was deleted."); return; }
      del.disabled = true;
      api("rpc/admin_delete_order", { method: "POST", body: { p_order_id: o.id } })
        .then(function () { $("detail").close(); return loadOrders(true); })
        .catch(function (e) { setMsg(friendly(e)); del.disabled = false; });
    });
    var dr = el("div", "d-actions"); dr.appendChild(del); danger.appendChild(dr);
    b.appendChild(danger);

    if (!$("detail").open) $("detail").showModal();
  }
  $("dClose").addEventListener("click", function () { $("detail").close(); });
  $("detail").addEventListener("click", function (e) { if (e.target === $("detail")) $("detail").close(); });
  $("detail").addEventListener("close", function () { S.openId = null; });

  // ---------- CSV export (current filtered list) ----------
  function csvCell(v) {
    var s = String(v == null ? "" : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  $("btnCsv").addEventListener("click", function () {
    var head = ["Order Number", "Customer", "Phone", "Email", "Order Date", "Jerseys", "Total Qty", "Total Amount", "Amount Paid", "Balance", "Payment Status", "Delivery Status", "Order Status", "Notes"];
    var rows = S.filtered.map(function (o) {
      return [o.order_number, o.customer_name, o.customer_phone, o.customer_email || "", fmtDate(o.created_at), o.itemsText, o.total_quantity, o.total_amount, o.amount_paid, o.balance, o.payment_status, o.delivery_status, o.order_status, o.notes || ""];
    });
    var csv = "\uFEFF" + [head].concat(rows).map(function (r) { return r.map(csvCell).join(","); }).join("\r\n");
    var url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    var a = document.createElement("a");
    a.href = url; a.download = "akl-orders-" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  });

  // ---------- Printable sales report ----------
  function tbl(headers, rows) {
    var t = el("table", "rtable"), th = el("thead"), tr = el("tr");
    headers.forEach(function (h) { tr.appendChild(el("th", null, h)); });
    th.appendChild(tr); t.appendChild(th);
    var tb = el("tbody");
    rows.forEach(function (r) { var x = el("tr"); r.forEach(function (c) { x.appendChild(el("td", null, String(c))); }); tb.appendChild(x); });
    t.appendChild(tb); return t;
  }
  function demandRows(list) { return list.map(function (x) { return [x.label, x.qty]; }); }
  function buildReport() {
    var s = stats(), r = $("reportBody"); r.textContent = "";
    r.appendChild(el("h1", null, "AKL JERSEY CARNIVAL ORDER - Sales Report"));
    r.appendChild(el("p", null, "Generated " + fmtDate(new Date().toISOString()) + ". Cancelled orders are excluded from the totals and listed separately."));
    r.appendChild(el("h2", null, "Summary"));
    r.appendChild(tbl(["Measure", "Value"], [
      ["Total orders", s.orders], ["Total jerseys", s.jerseys], ["Total sales value", naira(s.sales)],
      ["Amount collected", naira(s.paid)], ["Outstanding balance", naira(s.outstanding)], ["Orders awaiting delivery", s.awaiting],
      ["Cancelled orders", s.can.length + " (value " + naira(s.cancelledValue) + ", payments held " + naira(s.cancelledPaid) + ")"]
    ]));
    r.appendChild(el("h2", null, "Demand by club or country"));
    r.appendChild(tbl(["Club or country", "Jerseys"], demandRows(teamList())));
    r.appendChild(el("h2", null, "Demand by version"));
    r.appendChild(tbl(["Version", "Jerseys"], demandRows(ordered(tally("jersey_version"), VERSION_ORDER))));
    r.appendChild(el("h2", null, "Demand by size"));
    r.appendChild(tbl(["Size", "Jerseys"], demandRows(ordered(tally("size"), SIZE_ORDER))));
    r.appendChild(el("h2", null, "Orders"));
    r.appendChild(tbl(["Order", "Customer", "Phone", "Jerseys", "Qty", "Total", "Paid", "Balance", "Payment", "Delivery", "Status"],
      s.act.map(function (o) { return [o.order_number, o.customer_name, o.customer_phone, o.itemsText, o.total_quantity, naira(o.total_amount), naira(o.amount_paid), naira(o.balance), o.payment_status, o.delivery_status, o.order_status]; })));
    if (s.can.length) {
      r.appendChild(el("h2", null, "Cancelled orders"));
      r.appendChild(tbl(["Order", "Customer", "Phone", "Qty", "Total", "Paid"],
        s.can.map(function (o) { return [o.order_number, o.customer_name, o.customer_phone, o.total_quantity, naira(o.total_amount), naira(o.amount_paid)]; })));
    }
  }
  $("btnReport").addEventListener("click", function () { buildReport(); $("reportView").hidden = false; });
  $("rClose").addEventListener("click", function () { $("reportView").hidden = true; });
  $("rPrint").addEventListener("click", function () { window.print(); });

  // ---------- Start ----------
  S.session = loadSession();
  if (S.session) {
    api("rpc/is_admin", { method: "POST", body: {} }).then(function (ok) {
      if (ok === true) showApp(); else signOut("This account is not an administrator.");
    }).catch(function () { saveSession(null); showLogin(); });
  } else {
    showLogin();
  }
})();

(function () {
  "use strict";
  var A = window.AKL, C = A.C, naira = A.naira;
  var ORDER_RE = /^AKL-\d{5,8}$/, PHONE_RE = /^0[789][01]\d{8}$/;
  var busy = false;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function pill(t) { return el("span", "pill pill-" + String(t).toLowerCase(), t); }
  function row(a, b) { var r = el("div", "sum-row"); r.appendChild(el("span", null, a)); r.appendChild(el("b", null, b)); return r; }
  function block(title) { var b = el("div", "sum-block"); b.appendChild(el("h3", null, title)); return b; }
  function normPhone(v) {
    v = String(v).replace(/[\s()-]/g, "");
    if (/^\+?234/.test(v)) v = "0" + v.replace(/^\+?234/, "");
    return v;
  }
  function fmtDate(iso) { try { return new Date(iso).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" }); } catch (e) { return String(iso); } }
  function showErr(t) { $("tErr").textContent = t; }

  // Prefill the order number (it is not a secret; the phone number is never saved)
  var qs = new URLSearchParams(location.search), pre = (qs.get("o") || "").toUpperCase();
  if (!ORDER_RE.test(pre)) {
    pre = "";
    try { var last = localStorage.getItem("akl_last_order") || ""; if (ORDER_RE.test(last)) pre = last; } catch (e) {}
  }
  $("tOrder").value = pre;

  function render(o) {
    var box = $("result"); box.textContent = "";
    var cancelled = o.order_status === "Cancelled";
    var panel = el("section", "panel");

    var head = el("div", "success-head");
    head.appendChild(el("p", "ci-sub", "Order number"));
    head.appendChild(el("div", "ordno", o.order_number));
    var pills = el("div", "d-pills"); pills.style.justifyContent = "center"; pills.style.marginTop = "8px";
    pills.appendChild(pill(o.order_status)); pills.appendChild(pill(o.payment_status)); pills.appendChild(pill(o.delivery_status));
    head.appendChild(pills);
    panel.appendChild(head);

    if (cancelled) {
      panel.appendChild(el("p", "closed-note", "This order was cancelled. If you think this is a mistake, please contact the business on WhatsApp."));
    }

    var steps = [
      { t: "Order received", d: true, s: "We have your order." },
      { t: "Payment", d: o.payment_status === "Paid", s: o.payment_status === "Paid" ? "Fully paid. Thank you." : (o.payment_status === "Part-paid" ? "Part paid. Balance " + naira(o.balance) + "." : "Waiting for payment. Balance " + naira(o.balance) + ".") },
      { t: "Order confirmed", d: o.order_status === "Confirmed", s: o.order_status === "Confirmed" ? "Your order is confirmed." : "We confirm your order after payment is verified." },
      { t: "Ready for delivery", d: o.delivery_status === "Ready" || o.delivery_status === "Delivered", s: "Your jerseys are packed and ready." },
      { t: "Delivered", d: o.delivery_status === "Delivered", s: "Delivery date: " + o.delivery_date + "." }
    ];
    var ul = el("ul", "tl"), nowSet = false;
    steps.forEach(function (st, i) {
      var cls = cancelled && i > 0 ? "" : (st.d ? "done" : (!nowSet ? "now" : ""));
      if (!st.d && !nowSet && !(cancelled && i > 0)) nowSet = true;
      var li = el("li", cls);
      li.appendChild(el("span", "dot2", st.d && !(cancelled && i > 0) ? "\u2713" : String(i + 1)));
      var tx = el("div"); tx.appendChild(el("b", null, st.t)); tx.appendChild(el("div", "muted small", st.s));
      li.appendChild(tx); ul.appendChild(li);
    });
    panel.appendChild(ul);

    var items = block("Jerseys");
    o.items.forEach(function (it) { items.appendChild(row(it.club_or_country + " \u00B7 " + it.jersey_version + " \u00B7 " + it.size + " \u00D7 " + it.quantity, "")); });
    panel.appendChild(items);

    var sum = block("Payment and delivery");
    sum.appendChild(row("Placed", fmtDate(o.created_at)));
    sum.appendChild(row("Total jerseys", String(o.total_quantity)));
    sum.appendChild(row("Total amount", naira(o.total_amount)));
    sum.appendChild(row("Amount paid", naira(o.amount_paid)));
    sum.appendChild(row("Outstanding balance", naira(o.balance)));
    sum.appendChild(row("Delivery date", o.delivery_date));
    sum.appendChild(row("Delivery", A.deliveryText));
    panel.appendChild(sum);

    var actions = el("div", "success-actions");
    if (!cancelled && o.balance > 0) {
      var msg = "Hello, I want to pay for my AKL Jersey Carnival order " + o.order_number + ". My outstanding balance is " + naira(o.balance) + ". Please provide the payment details.";
      var pay = el("a", "btn btn-wa btn-lg", "PAY VIA WHATSAPP");
      pay.href = "https://wa.me/" + C.BUSINESS_WHATSAPP + "?text=" + encodeURIComponent(msg); pay.target = "_blank"; pay.rel = "noopener";
      actions.appendChild(pay);
    }
    var again = el("button", "btn btn-outline", "Check again"); again.type = "button"; again.addEventListener("click", check);
    var more = el("a", "btn btn-ghost", "Place another order"); more.href = "order.html";
    actions.appendChild(again); actions.appendChild(more);
    panel.appendChild(actions);
    box.appendChild(panel);
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function check() {
    if (busy) return;
    var no = $("tOrder").value.trim().toUpperCase().replace(/\s+/g, ""), ph = normPhone($("tPhone").value);
    showErr(""); $("result").textContent = "";
    if (!ORDER_RE.test(no)) { showErr("Enter your order number, like AKL-01001."); return; }
    if (!PHONE_RE.test(ph)) { showErr("Enter the phone number you used when you ordered."); return; }
    busy = true;
    var btn = $("tBtn"); btn.disabled = true; btn.textContent = "Checking...";
    fetch(C.SUPABASE_URL + "/rest/v1/rpc/track_order", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": C.SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({ p_order_number: no, p_phone: ph })
    })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
    .then(function (res) {
      if (!res.ok) throw new Error("failed");
      var b = res.body;
      if (b && b.ok) render(b.order);
      else if (b && b.error === "LOCKED") showErr("Too many wrong tries. Please wait 15 minutes, or contact the business on WhatsApp.");
      else showErr("We could not find an order with that number and phone. Check both and try again.");
    })
    .catch(function (e) { showErr(e.name === "TypeError" ? "Network problem. Check your connection and try again." : "Something went wrong. Please try again."); })
    .then(function () { busy = false; btn.disabled = false; btn.textContent = "CHECK ORDER STATUS"; });
  }
  $("tBtn").addEventListener("click", check);
  $("tPhone").addEventListener("keydown", function (e) { if (e.key === "Enter") check(); });
  $("tOrder").addEventListener("keydown", function (e) { if (e.key === "Enter") check(); });
})();

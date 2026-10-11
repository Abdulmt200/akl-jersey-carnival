(function () {
  "use strict";
  var A = window.AKL, C = A.C;
  var busy = false;
  var MESSAGES = {
    ORDERS_CLOSED: "Orders are closed.",
    INVALID_NAME: "Please check your name.",
    INVALID_PHONE: "Please check your phone number.",
    INVALID_EMAIL: "Please check your email address.",
    INVALID_NOTES: "Please check your notes.",
    INVALID_ITEMS: "Please check your jersey selections.",
    RATE_LIMITED: "Too many orders from this phone number. Please wait a few minutes.",
    BUSY: "The system is busy. Please try again in a minute."
  };

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }
  function row(a, b) { var r = el("div", "sum-row"); r.appendChild(el("span", null, a)); r.appendChild(el("b", null, b)); return r; }
  function block(title) { var b = el("div", "sum-block"); b.appendChild(el("h3", null, title)); return b; }

  function showSuccess(o) {
    try { sessionStorage.removeItem("akl_cart"); } catch (e) {}
    document.querySelector(".total-bar").hidden = true;
    var main = document.querySelector("main");
    main.textContent = "";

    var panel = el("section", "panel");
    var head = el("div", "success-head");
    head.appendChild(el("div", "tick", "\u2713"));
    head.appendChild(el("h1", "page-title", "ORDER SUBMITTED SUCCESSFULLY"));
    head.appendChild(el("p", "ci-sub", "Your order number"));
    head.appendChild(el("div", "ordno", o.order_number));
    panel.appendChild(head);

    var cust = block("Customer");
    cust.appendChild(row("Name", o.customer_name));
    cust.appendChild(row("Order date", new Date(o.created_at).toLocaleString("en-NG")));
    panel.appendChild(cust);

    var items = block("Jerseys");
    o.items.forEach(function (it) {
      items.appendChild(row(it.club_or_country + " \u00B7 " + it.jersey_version + " \u00B7 " + it.size + " \u00D7 " + it.quantity, A.naira(it.quantity * o.unit_price)));
    });
    panel.appendChild(items);

    var sum = block("Payment and delivery");
    sum.appendChild(row("Unit price", A.naira(o.unit_price)));
    sum.appendChild(row("Total jerseys", String(o.total_quantity)));
    sum.appendChild(row("Total amount", A.naira(o.total_amount)));
    sum.appendChild(row("Amount paid", A.naira(o.amount_paid)));
    sum.appendChild(row("Outstanding balance", A.naira(o.balance)));
    sum.appendChild(row("Payment status", o.payment_status));
    sum.appendChild(row("Delivery date", o.delivery_date));
    sum.appendChild(row("Delivery", A.deliveryText));
    panel.appendChild(sum);

    panel.appendChild(el("p", "notice", "Your order is saved, but it is NOT paid yet. Tap the button below to message the business on WhatsApp and get the payment details. Please screenshot this page and keep your order number. Receipt download is coming next."));

    var actions = el("div", "success-actions");
    var msg = "Hello, I have placed an order with AKL Jersey Carnival. My Order Number is " + o.order_number +
      ". My total is " + A.naira(o.total_amount) + ". Please provide the payment details.";
    var pay = el("a", "btn btn-wa btn-lg", "PAY VIA WHATSAPP");
    pay.href = "https://wa.me/" + C.BUSINESS_WHATSAPP + "?text=" + encodeURIComponent(msg);
    pay.target = "_blank"; pay.rel = "noopener";
    actions.appendChild(pay);

    if (/^https:\/\/chat\.whatsapp\.com\//.test(C.WHATSAPP_GROUP_LINK || "")) {
      var grp = el("a", "btn btn-outline btn-lg", "JOIN THE WHATSAPP GROUP");
      grp.href = C.WHATSAPP_GROUP_LINK; grp.target = "_blank"; grp.rel = "noopener";
      actions.appendChild(grp);
    }
    var home = el("a", "btn btn-ghost", "Back to home"); home.href = "index.html";
    actions.appendChild(home);
    panel.appendChild(actions);

    main.appendChild(panel);
    window.scrollTo({ top: 0 });
  }

  window.AKL_submitOrder = function (payload) {
    if (busy) return;
    busy = true;
    var btn = document.getElementById("submitBtn");
    var msg = document.getElementById("submitMsg");
    btn.disabled = true; btn.textContent = "Submitting...";
    msg.hidden = true;

    fetch(C.SUPABASE_URL + "/rest/v1/rpc/create_order", {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": C.SUPABASE_PUBLISHABLE_KEY },
      body: JSON.stringify({
        p_customer_name: payload.customer_name,
        p_customer_phone: payload.customer_phone,
        p_customer_email: payload.customer_email,
        p_notes: payload.notes,
        p_items: payload.items
      })
    })
    .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
    .then(function (res) {
      if (!res.ok) {
        var code = (res.body && res.body.message) || "";
        throw new Error(MESSAGES[code] || "Could not submit your order. Please try again.");
      }
      showSuccess(res.body);
    })
    .catch(function (e) {
      msg.textContent = e.name === "TypeError" ? "Network problem. Check your connection and try again." : e.message;
      msg.hidden = false;
      btn.disabled = false; btn.textContent = "CONFIRM ORDER";
      busy = false;
    });
  };
})();

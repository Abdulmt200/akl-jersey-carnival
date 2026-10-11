(function () {
  "use strict";
  var C = window.AKL_CONFIG || {};

  function naira(n) { return "\u20A6" + Number(n || 0).toLocaleString("en-NG"); }
  function localPhone(n) { return "0" + String(n || "").replace(/^234/, ""); }
  function pad(n) { return String(n).padStart(2, "0"); }

  var free = Number(C.DELIVERY_FEE) === 0;
  var values = {
    PRICE: naira(C.PRICE_PER_JERSEY),
    DELIVERY_DATE: C.DELIVERY_DATE || "",
    DELIVERY_DATE_UP: String(C.DELIVERY_DATE || "").toUpperCase(),
    DELIVERY_TEXT: free ? "100% FREE DELIVERY" : "DELIVERY FEE: " + naira(C.DELIVERY_FEE),
    ORDER_OPENS_TEXT: C.ORDER_OPENS_TEXT || "",
    ORDER_CLOSES_TEXT: C.ORDER_CLOSES_TEXT || "",
    CARNIVAL_DATE: C.CARNIVAL_DATE || "",
    OWNER_NAME: C.OWNER_NAME || "",
    OWNER_PHONE: localPhone(C.BUSINESS_WHATSAPP),
    PHONE_CALL: localPhone(C.BUSINESS_PHONE_CALL),
    INSTAGRAM_TAG: "@" + (C.INSTAGRAM || ""),
    MEETING_POINT: C.MEETING_POINT || "",
    DEVELOPER_NAME: C.DEVELOPER_NAME || "",
    DEVELOPER_PHONE: localPhone(C.DEVELOPER_WHATSAPP)
  };

  // Fill text with textContent only (safe against XSS)
  document.querySelectorAll("[data-cfg]").forEach(function (el) {
    var k = el.getAttribute("data-cfg");
    if (values[k] !== undefined) el.textContent = values[k];
  });
  document.querySelectorAll("[data-wa]").forEach(function (el) { el.href = "https://wa.me/" + (C[el.getAttribute("data-wa")] || ""); });
  document.querySelectorAll("[data-tel]").forEach(function (el) { el.href = "tel:+" + (C[el.getAttribute("data-tel")] || ""); });
  document.querySelectorAll("[data-ig]").forEach(function (el) { el.href = "https://instagram.com/" + encodeURIComponent(C.INSTAGRAM || ""); });
  document.querySelectorAll("[data-img]").forEach(function (el) { el.src = C[el.getAttribute("data-img")] || ""; });
  var partner = document.getElementById("partnerLink");
  if (partner && /^https:\/\//.test(C.PARTNER_URL || "")) { partner.href = C.PARTNER_URL; partner.target = "_blank"; partner.rel = "noopener"; }
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();

  // Order closing (display only; the server will enforce this later)
  var closes = C.ORDER_CLOSES_ISO ? new Date(C.ORDER_CLOSES_ISO) : null;
  function isClosed() { return !!(closes && !isNaN(closes) && new Date() >= closes); }

  var cd = document.getElementById("countdown");
  function tick() {
    if (!cd || !closes || isNaN(closes)) return false;
    var ms = closes - new Date();
    if (ms <= 0) { cd.textContent = "ORDERS CLOSED"; return false; }
    var s = Math.floor(ms / 1000);
    cd.textContent = Math.floor(s / 86400) + "d " + pad(Math.floor(s % 86400 / 3600)) + "h " + pad(Math.floor(s % 3600 / 60)) + "m " + pad(s % 60) + "s";
    return true;
  }
  if (tick()) { var timer = setInterval(function () { if (!tick()) clearInterval(timer); }, 1000); }

  window.AKL = { C: C, naira: naira, localPhone: localPhone, isClosed: isClosed, deliveryText: values.DELIVERY_TEXT };
})();

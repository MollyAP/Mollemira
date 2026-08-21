function pocketBaseUrl() {
  if (window.NEMESIS_PB_URL) return window.NEMESIS_PB_URL;
  if (location.protocol === "file:") return "http://127.0.0.1:8090";
  if ((location.hostname === "127.0.0.1" || location.hostname === "localhost") && location.port !== "8090") {
    return "http://127.0.0.1:8090";
  }
  return location.origin;
}

const PB_URL = pocketBaseUrl();
const STATIC_PORTFOLIO = true;
const COOKIE_OK = "nemesis_cookie_ok";
const CART = "nemesis_cart";
const ADMIN_TOKEN = "nemesis_admin_token";
const ADMIN_USER = "nemesis_admin_user";
const ADMIN_SESSION_VERSION = "nemesis_admin_session_version";
const CURRENT_ADMIN_SESSION_VERSION = "admin-users-only-2026-06-04";
const ANNOUNCEMENT_CACHE = "nemesis_announcement_cache";
const RIBBON_CACHE = "nemesis_status_ribbons";
const SITE_SETTINGS_CACHE = "nemesis_site_settings_cache";
const EMAIL_DRAFTS = "nemesis_email_drafts";

const PUBLIC_PAGES = [
  { path: "index.html", label: "Home" },
  { path: "catalog.html", label: "Minifigures" },
  { path: "about.html", label: "About" },
  { path: "orders.html", label: "Orders" },
  { path: "preorders.html", label: "Preorders" },
  { path: "updates.html", label: "Updates" },
  { path: "checkout.html", label: "Checkout" },
  { path: "success.html", label: "Success" }
];

let adminRibbonCache = [];
let adminVariantMedia = [];
let queuedFigureImageUrls = [];
let queuedFigureImageFiles = [];
let emailCenterState = {
  mailbox: "inbox",
  messages: [],
  selectedId: "",
  orders: [],
  threads: [],
  linkMessageId: ""
};

const EMAIL_TEMPLATES = [
  {
    id: "shipping_delay",
    name: "Shipping Delay",
    subject: "Shipping update for {{order}}",
    body: "Hi {{name}},\n\nQuick update on {{order}}: shipping is taking a little longer than expected, but your order is still in progress. I will send tracking as soon as it is ready.\n\nThank you for your patience,\nNemesis Minifigures"
  },
  {
    id: "refund_approved",
    name: "Refund Approved",
    subject: "Refund update for {{order}}",
    body: "Hi {{name}},\n\nYour refund for {{order}} has been approved. Depending on your bank or card issuer, it may take a few business days to appear.\n\nThank you,\nNemesis Minifigures"
  },
  {
    id: "preorder_update",
    name: "Preorder Update",
    subject: "Preorder update for {{order}}",
    body: "Hi {{name}},\n\nHere is a quick preorder update for {{order}}: production is still moving forward, and I will send another update as soon as there is shipping news.\n\nThank you for supporting the drop,\nNemesis Minifigures"
  },
  {
    id: "address_confirmation",
    name: "Address Confirmation",
    subject: "Confirming your shipping address",
  body: "Hi {{name}},\n\nBefore I ship {{order}}, could you confirm that this is the correct shipping address?\n\n{{address}}\n\nThank you,\nNemesis Minifigures"
  }
];
let editingEmailDraftId = "";
let composingEmailThreadId = "";
let savedEmailSelection = null;
let selectedEmailAttachments = [];

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

function statusFor(status, quantity) {
  if (status === "preorder") return "preorder";
  if (status === "in_production") return "in_production";
  if (status === "sold_out") return "sold_out";
  if (status === "off_sale") return "off_sale";
  if (Number(quantity) <= 0) return "sold_out";
  return "available";
}

function statusLabel(status) {
  return status === "sold_out"
    ? "Sold Out"
    : status === "preorder"
      ? "Preorder"
      : status === "in_production"
        ? "In Production"
        : status === "off_sale"
          ? "Off Sale"
          : "Available";
}

const STATUS_SORT_ORDER = {
  available: 1,
  preorder: 2,
  in_production: 3,
  sold_out: 4,
  off_sale: 5
};

function compareByStatusThenName(a, b) {
  const statusA = STATUS_SORT_ORDER[statusFor(a.status, a.quantity)] || 999;
  const statusB = STATUS_SORT_ORDER[statusFor(b.status, b.quantity)] || 999;
  if (statusA !== statusB) return statusA - statusB;
  return String(a.name || "").localeCompare(String(b.name || ""));
}

function canOrderFigure(figure) {
  return ["available", "preorder"].includes(statusFor(figure.status, figure.quantity));
}

function orderActionLabel(figure) {
  const status = statusFor(figure.status, figure.quantity);
  if (status === "preorder") return "Preorder";
  if (status === "available" && Number(figure.price || 0) <= 0) return "Reserve";
  return "Add To Cart";
}

function isAdmin() {
  if (STATIC_PORTFOLIO) return false;
  return Boolean(localStorage.getItem(ADMIN_TOKEN));
}

function showAdminToast(message, type = "success") {
  if (!message || document.body.dataset.page !== "admin") return;

  let stack = $("#adminToastStack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "adminToastStack";
    stack.className = "admin-toast-stack";
    document.body.appendChild(stack);
  }

  const toast = document.createElement("div");
  toast.className = `admin-toast ${type}`;
  toast.textContent = message;
  stack.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));
  window.setTimeout(() => {
    toast.classList.remove("show");
    window.setTimeout(() => toast.remove(), 240);
  }, 2600);
}

function enforceAdminSessionVersion() {
  if (localStorage.getItem(ADMIN_SESSION_VERSION) === CURRENT_ADMIN_SESSION_VERSION) return;
  localStorage.removeItem(ADMIN_TOKEN);
  localStorage.removeItem(ADMIN_USER);
  localStorage.setItem(ADMIN_SESSION_VERSION, CURRENT_ADMIN_SESSION_VERSION);
}

function currentAdmin() {
  try {
    return JSON.parse(localStorage.getItem(ADMIN_USER) || "{}");
  } catch {
    return {};
  }
}

function adminAvatarUrl(admin = currentAdmin()) {
  if (!admin?.id || !admin?.avatar) return "";
  return `${PB_URL}/api/files/admin_users/${admin.id}/${admin.avatar}?thumb=100x100f`;
}

function renderAdminAvatarLinks() {
  const admin = currentAdmin();
  const avatar = adminAvatarUrl(admin);
  const initials = (admin.name || admin.email || "A").trim().charAt(0).toUpperCase();

  $all(".admin-avatar-link").forEach(link => {
    link.classList.remove("hidden");
    link.innerHTML = avatar
      ? `<img src="${esc(avatar)}" alt="">`
      : `<span>${esc(initials)}</span>`;
  });
}

function ensureTopChrome() {
  const bar = $(".top-strip");
  const header = $(".site-header");
  if (!header) return null;

  let chrome = $(".top-chrome");
  if (!chrome) {
    chrome = document.createElement("div");
    chrome.className = "top-chrome";
    const first = bar || header;
    first.parentNode.insertBefore(chrome, first);
  }

  if (bar && bar.parentNode !== chrome) chrome.appendChild(bar);
  if (header.parentNode !== chrome) chrome.appendChild(header);
  return chrome;
}

function updateTopChromeHeight() {
  const chrome = ensureTopChrome();
  const header = $(".site-header");
  if (!chrome || !header) return 0;

  const bar = $(".top-strip.show");
  const announcementHeight = bar ? bar.offsetHeight : 0;
  const headerHeight = header.offsetHeight || 78;
  const total = announcementHeight + headerHeight;
  document.body.style.setProperty("--announcement-height", `${announcementHeight}px`);
  document.body.style.setProperty("--top-chrome-height", `${total}px`);
  return total;
}

function authHeaders() {
  const token = localStorage.getItem(ADMIN_TOKEN);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api(path, options = {}) {
  if (STATIC_PORTFOLIO) {
    if (path.includes("/collections/minifigs/records")) return window.NEMESIS_STATIC_CATALOGUE || { items: [] };
    if (path.includes("/collections/site_settings/records")) return { items: [{}] };
    if (path.includes("/collections/announcements/records")) return {
      items: [{ active: true, text: "Full release coming soon!", bg_color: "#000000", text_color: "#ffffff", glow_color: "#48bcff", scroll_enabled: true, scroll_speed: 28, text_glow_enabled: true }]
    };
    if (path.includes("/collections/associates/records")) return {
      items: [{ id: "i8y3ah8d2pl7xa0", name: "Molly", role: "Website Builder and Programmer", socials: [{ label: "Twitter", url: "https://twitter.com/" }], image_url: "assets/associates/molly.png", sort_order: 10, active: true }]
    };
    if (path.includes("/collections/instagram_profile_cache/records")) return {
      items: [{ profile_data: { displayName: "Nemo", username: "Nemesis.Minifigures", profileUrl: "https://www.instagram.com/Nemesis.Minifigures", bio: "", postCount: 42, followerCount: 330, followingCount: 19 } }]
    };
    if (/collections\/(announcements|status_ribbons|associates|instagram_profile_cache|updates_posts)\/records/.test(path)) return { items: [] };
    if (path.includes("/nemesis/waitlist")) return { message: "Thanks for your interest — this portfolio demo does not collect submissions." };
    if (path.includes("/nemesis/order-lookup")) return { order: null };
    return { items: [] };
  }
  const response = await fetch(`${PB_URL}${path}`, options);
  if (!response.ok) {
    let message = "Server call failed.";
    let data = null;
    try {
      data = await response.json();
      message = data.message || message;
      const fieldMessages = Object.entries(data.data || {})
        .map(([field, detail]) => {
          const detailMessage = detail?.message || detail?.code || "";
          return detailMessage ? `${field}: ${detailMessage}` : field;
        })
        .filter(Boolean);
      if (fieldMessages.length) message = `${message} ${fieldMessages.join(" ")}`;
    } catch {}
    const genericPocketBaseError = response.status === 400 && message === "Something went wrong while processing your request.";
    const canRetryAdminAuth = document.body.dataset.page === "admin"
      && genericPocketBaseError
      && localStorage.getItem(ADMIN_TOKEN)
      && !options._skipAuthRetry
      && !path.includes("/auth-refresh")
      && !path.includes("/auth-with-password");

    if (canRetryAdminAuth) {
      const refreshed = await refreshAdminSession({ silent: true });
      if (refreshed) {
        const retryOptions = { ...options, _skipAuthRetry: true };
        retryOptions.headers = { ...(options.headers || {}), ...authHeaders() };
        return api(path, retryOptions);
      }
      const sessionError = new Error("Admin session expired. Please log in again.");
      sessionError.status = response.status;
      throw sessionError;
    }

    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    console.warn("Nemesis API error", { path, status: response.status, message, data });
    throw error;
  }
  return response.status === 204 ? {} : response.json();
}

function fileUrl(record, file) {
  if (!record || !file) return "";
  if (STATIC_PORTFOLIO) return `assets/minifigs/${record.id}/${file}`;
  return `${PB_URL}/api/files/minifigs/${record.id}/${file}`;
}

function collectionFileUrl(collection, record, file, thumb = "") {
  if (!record || !file) return "";
  const suffix = thumb ? `?thumb=${encodeURIComponent(thumb)}` : "";
  return `${PB_URL}/api/files/${collection}/${record.id}/${file}${suffix}`;
}

function localAsset(path) {
  if (!path?.startsWith("/assets/")) return path;
  const nested = location.pathname.includes("/admin/");
  return `${nested ? "../" : ""}${path.slice(1)}`;
}

function imageFor(figure) {
  if (Array.isArray(figure.images) && figure.images.length) return fileUrl(figure, figure.images[0]);
  if (typeof figure.images === "string" && figure.images) return fileUrl(figure, figure.images);
  return "";
}

function parseJsonValue(value, fallback) {
  if (value && typeof value === "object") return value;
  try {
    return JSON.parse(String(value || ""));
  } catch {
    return fallback;
  }
}

function figureMedia(figure) {
  const items = [];
  if (Array.isArray(figure.images)) {
    figure.images.forEach(file => items.push(fileUrl(figure, file)));
  } else if (figure.images) {
    items.push(fileUrl(figure, figure.images));
  }
  return [...new Set(items)];
}

function figureVariantConfig(figure) {
  const variants = figure.variants_json || {};
  return {
    cycle: Array.isArray(variants.cycle) ? variants.cycle : [],
    dots: Array.isArray(variants.dots) ? variants.dots : []
  };
}

function resolveVariantSource(value, media) {
  if (typeof value === "number") return media[value] || "";
  if (/^\d+$/.test(String(value || ""))) return media[Number(value)] || "";
  return "";
}

function variantImageHtml(figure, className = "catalogue-image", overlay = "") {
  const media = figureMedia(figure);
  const config = figureVariantConfig(figure);
  const cycleSources = (config.cycle.length ? config.cycle : [0])
    .map(item => resolveVariantSource(item, media))
    .filter(Boolean);
  const dotButtons = config.dots
    .map((dot, index) => {
      const src = resolveVariantSource(dot.image ?? dot.src ?? dot.image_index ?? dot.index, media);
      if (!src) return "";
      const color = dot.color || "";
      const label = dot.label || `Variant ${index + 1}`;
      const details = {
        name: dot.name || dot.title || "",
        quote: dot.quote || "",
        contents: Array.isArray(dot.contents) ? dot.contents : []
      };
      return `<button class="variant-dot" type="button" data-variant-src="${esc(src)}" data-variant-label="${esc(label)}" data-variant-details="${esc(JSON.stringify(details))}" ${color ? `style="--variant-dot-color:${esc(color)}"` : ""} aria-label="Preview ${esc(label)}"></button>`;
    })
    .join("");

  if (cycleSources.length <= 1 && !dotButtons) {
    return `<div class="${esc(className)}">${overlay}<img src="${esc(imageFor(figure))}" alt="${esc(figure.name)}"></div>`;
  }

  return `
    <div class="catalogue-variant-shell" data-variant-card data-cycle-images="${esc(cycleSources.join("|"))}">
      <div class="${esc(className)}">
        ${overlay}
        <img src="${esc(cycleSources[0] || imageFor(figure))}" alt="${esc(figure.name)}" data-variant-image>
      </div>
      ${dotButtons ? `<div class="variant-dots" aria-label="${esc(figure.name)} variations">${dotButtons}</div>` : ""}
    </div>
  `;
}

function rgbToHex([r, g, b] = []) {
  return `#${[r, g, b].map(value => Number(value || 0).toString(16).padStart(2, "0")).join("")}`;
}

function generateDotColor(src, button) {
  if (button.style.getPropertyValue("--variant-dot-color")) return;
  if (!window.ColorThief) return;

  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    try {
      const thief = new ColorThief();
      button.style.setProperty("--variant-dot-color", rgbToHex(thief.getColor(img)));
    } catch {}
  };
  img.src = src;
}

function setupVariantCards(root = document) {
  $all("[data-variant-card]", root).forEach(card => {
    if (card.dataset.variantReady) return;
    card.dataset.variantReady = "true";

    const entry = card.closest(".catalogue-entry");
    const titleImg = entry?.querySelector(".catalogue-title-img");
    const quote = entry?.querySelector(".quote");
    const contentsList = entry?.querySelector("[data-variant-contents]");
    const image = card.querySelector("[data-variant-image]");
    const buttons = $all("[data-variant-src]", card);
    const cycleImages = (card.dataset.cycleImages || "").split("|").filter(Boolean);
    if (!image || (!buttons.length && !cycleImages.length)) return;

    const fadeDuration = 1350;
    const previewFadeDuration = 620;
    const normalDelay = 5000;
    const lingerDelay = 7200;
    const allSources = [...new Set([...cycleImages, ...buttons.map(button => button.dataset.variantSrc).filter(Boolean)])];
    let activeCycle = [...cycleImages];
    let cycleIndex = image.src.includes(cycleImages[0]) ? 1 : 0;
    let paused = false;
    let timer = null;
    let swapToken = 0;
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const ready = Promise.all(allSources.map(src => new Promise(resolve => {
      const preload = new Image();
      preload.onload = resolve;
      preload.onerror = resolve;
      preload.src = src;
    })));

    const setActive = button => {
      buttons.forEach(item => item.classList.toggle("active", item === button));
    };

    const baseDetails = {
      name: titleImg?.dataset.baseTitle || "",
      quote: quote?.dataset.baseQuote || "",
      contents: parseJsonValue(contentsList?.dataset.baseContents || "[]", [])
    };

    const renderContents = items => {
      if (!contentsList || !Array.isArray(items) || !items.length) return;
      contentsList.innerHTML = items.map(item => `<li>${esc(item)}</li>`).join("");
    };

    const applyDetails = details => {
      if (!details) return;
      if (titleImg && details.name) {
        titleImg.src = metalTitleDataUrl(details.name);
        titleImg.alt = details.name;
      }
      if (quote && details.quote) quote.textContent = details.quote;
      if (Array.isArray(details.contents) && details.contents.length) renderContents(details.contents);
    };

    const restoreDetails = () => {
      if (titleImg && baseDetails.name) {
        titleImg.src = metalTitleDataUrl(baseDetails.name);
        titleImg.alt = baseDetails.name;
      }
      if (quote) quote.textContent = baseDetails.quote;
      renderContents(baseDetails.contents);
    };

    const detailsFor = button => parseJsonValue(button?.dataset.variantDetails || "{}", {});

    const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));

    const swapImage = async (src, duration = fadeDuration) => {
      if (image.src.includes(src)) return;
      const token = ++swapToken;
      await ready;
      if (token !== swapToken) return;
      image.style.transitionDuration = `${duration}ms`;
      image.classList.add("is-fading");
      await wait(duration);
      if (token !== swapToken) return;
      image.src = src;
      await wait(80);
      if (token !== swapToken) return;
      image.classList.remove("is-fading");
    };

    const scheduleCycle = delay => {
      window.clearTimeout(timer);
      timer = window.setTimeout(showCycleImage, delay);
    };

    async function showCycleImage() {
      if (!activeCycle.length || paused) return;
      await swapImage(activeCycle[cycleIndex % activeCycle.length]);
      cycleIndex += 1;
      if (!paused) scheduleCycle(normalDelay);
    }

    const resumeBaseCycle = () => {
      paused = false;
      activeCycle = [...cycleImages];
      setActive(null);
      restoreDetails();
      showCycleImage();
    };

    buttons.forEach(button => {
      generateDotColor(button.dataset.variantSrc, button);

      const showPreview = () => {
        paused = true;
        applyDetails(detailsFor(button));
        swapImage(button.dataset.variantSrc, previewFadeDuration);
        setActive(button);
      };

      const selectMobileVariant = () => {
        paused = false;
        activeCycle = [button.dataset.variantSrc, ...cycleImages];
        cycleIndex = 1;
        applyDetails(detailsFor(button));
        swapImage(button.dataset.variantSrc, previewFadeDuration);
        setActive(button);
        scheduleCycle(lingerDelay);
      };

      if (canHover) {
        button.addEventListener("mouseenter", showPreview);
        button.addEventListener("mouseleave", resumeBaseCycle);
        button.addEventListener("click", showPreview);
        button.addEventListener("blur", resumeBaseCycle);
        button.addEventListener("focus", showPreview);
      } else {
        button.addEventListener("click", selectMobileVariant);
      }
    });

    if (cycleImages.length > 1) ready.then(() => scheduleCycle(normalDelay));
  });
}

function normalizeFigure(figure = {}) {
  return {
    id: figure.id || "",
    name: figure.name || "Missing Minifig",
    slug: figure.slug || "missing-minifig",
    description: figure.description || "This minifig could not be loaded from the server.",
    short_description: figure.short_description || "Missing minifig information.",
    quote: figure.quote || "",
    quantity: Number(figure.quantity || 0),
    price: Number(figure.price ?? 45),
    currency: figure.currency || "usd",
    max_per_customer: Number(figure.max_per_customer || 1),
    cart_count: Number(figure.cart_count || 0),
    status: figure.status || "off_sale",
    category: figure.category || "Missing",
    tags: figure.tags || "",
    images: figure.images || [],
    contents: Array.isArray(figure.contents) ? figure.contents : parseJsonValue(figure.contents, []),
    variants_json: parseJsonValue(figure.variants_json, {}),
    manual_ribbons: Array.isArray(figure.manual_ribbons) ? figure.manual_ribbons : [],
    low_stock_threshold: Number(figure.low_stock_threshold || 0),
    release_date: figure.release_date || "",
    estimated_shipping_start: figure.estimated_shipping_start || "",
    estimated_shipping_end: figure.estimated_shipping_end || "",
    retired: Boolean(figure.retired),
    exclusive: Boolean(figure.exclusive),
    limited_edition: Boolean(figure.limited_edition),
    preorder_enabled: Boolean(figure.preorder_enabled),
    back_in_stock: Boolean(figure.back_in_stock),
    staff_pick: Boolean(figure.staff_pick),
    featured: Boolean(figure.featured),
    visible: figure.visible !== false,
    sale_price: Number(figure.sale_price || 0),
    missing: Boolean(figure.missing)
  };
}

function moneyLabel(value, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: String(currency || "usd").toUpperCase()
  }).format(Number(value || 0));
}

function monthYearLabel(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{4})-(\d{2})/);
  const date = match ? new Date(Number(match[1]), Number(match[2]) - 1, 1) : new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(date);
}

function estimatedShippingLabel(figure) {
  if (statusFor(figure.status, figure.quantity) !== "preorder") return "";
  const start = monthYearLabel(figure.estimated_shipping_start);
  const end = monthYearLabel(figure.estimated_shipping_end);
  if (start && end) return `Estimated Shipping: ${start} - ${end}`;
  if (start) return `Estimated Shipping: ${start}`;
  return "";
}

function missingFigure(slug = "missing-minifig") {
  return normalizeFigure({
    slug,
    missing: true
  });
}

async function getFigures(options = {}) {
  try {
    const filter = options.admin ? "" : "visible=true";
    const query = filter ? `?sort=name&filter=${encodeURIComponent(filter)}` : "?sort=name";
    const data = await api(`/api/collections/minifigs/records${query}`, { headers: authHeaders() });
    return (data.items || []).map(normalizeFigure);
  } catch {
    return [];
  }
}

function navPageFromHref(href) {
  try {
    const url = new URL(href, location.href);
    let path = url.pathname.split("/").filter(Boolean).join("/");
    const publicIndex = path.indexOf("public/");
    if (publicIndex >= 0) path = path.slice(publicIndex + 7);
    if (!path || path.endsWith("/")) return "index.html";
    return path.endsWith(".html") ? path : `${path}.html`;
  } catch {
    return "";
  }
}

function applyPreviewNav(settings = {}) {
  if (!previewModePublic(settings)) return;
  const whitelist = new Set(Array.isArray(settings.preview_whitelist) ? settings.preview_whitelist : ["index.html"]);
  whitelist.add("index.html");

  $all(".site-header .nav-link").forEach(link => {
    if (link.closest(".admin-page")) return;
    const page = navPageFromHref(link.getAttribute("href") || "");
    const allowed = page === "index.html" || whitelist.has(page);
    link.hidden = !allowed;
  });
}

function setupNav(settings = {}) {
  applyPreviewNav(settings);

  if (isAdmin()) {
    renderAdminAvatarLinks();

    $all(".nav-right").forEach(nav => {
      if ($(".admin-avatar-link", nav)) return;
      const nested = location.pathname.includes("/admin/");
      const cart = $("[data-cart-count]", nav)?.closest("a");
      const link = document.createElement("a");
      link.className = "admin-avatar-link admin-nav-link";
      link.href = `${nested ? "../" : ""}admin/panel`;
      link.setAttribute("aria-label", "Admin account");

      if (cart) nav.insertBefore(link, cart);
      else nav.appendChild(link);
    });

    renderAdminAvatarLinks();
  }

  const toggle = $(".nav-toggle");
  const header = $(".site-header");
  if (!toggle || !header) return;
  toggle.addEventListener("click", () => {
    const open = header.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
}

function setupScrollbarActivity() {
  let timer = null;
  let dragging = false;
  let dragStartY = 0;
  let dragStartScroll = 0;
  let scrollbarState = {
    height: 0,
    maxScroll: 0,
    thumbHeight: 34,
    travel: 0
  };
  const root = document.documentElement;
  const header = $(".site-header");
  const track = document.createElement("div");
  const thumb = document.createElement("div");

  track.className = "site-scrollbar";
  thumb.className = "site-scrollbar-thumb";
  track.appendChild(thumb);
  document.body.appendChild(track);

  const metrics = () => {
    const top = 0;
    const height = Math.max(window.innerHeight - top - 8, 80);
    const maxScroll = Math.max(root.scrollHeight - window.innerHeight, 0);
    return { top, height, maxScroll };
  };

  const update = () => {
    const { top, height, maxScroll } = metrics();
    track.style.setProperty("--site-scrollbar-top", `${top}px`);
    track.classList.toggle("is-needed", maxScroll > 0);

    if (!maxScroll) {
      thumb.style.height = "0px";
      thumb.style.transform = "translateY(0)";
      return;
    }

    const thumbHeight = Math.max(height * (window.innerHeight / root.scrollHeight), 34);
    const travel = Math.max(height - thumbHeight, 0);
    const progress = window.scrollY / maxScroll;
    scrollbarState = { height, maxScroll, thumbHeight, travel };
    thumb.style.height = `${thumbHeight}px`;
    thumb.style.transform = `translateY(${travel * progress}px)`;
  };

  const show = () => {
    track.classList.add("is-active");
    window.clearTimeout(timer);
    if (!dragging) timer = window.setTimeout(() => track.classList.remove("is-active"), 900);
  };

  const onScroll = () => {
    update();
    show();
  };

  thumb.addEventListener("pointerdown", event => {
    dragging = true;
    dragStartY = event.clientY;
    dragStartScroll = window.scrollY;
    root.classList.add("scrollbar-dragging");
    track.classList.add("is-active", "is-dragging");
    thumb.setPointerCapture(event.pointerId);
  });

  thumb.addEventListener("pointermove", event => {
    if (!dragging) return;
    event.preventDefault();
    const { maxScroll, travel } = scrollbarState;
    if (!maxScroll || !travel) return;
    const delta = event.clientY - dragStartY;
    const nextScroll = Math.max(0, Math.min(maxScroll, dragStartScroll + (delta / travel) * maxScroll));
    const nextThumb = (nextScroll / maxScroll) * travel;
    thumb.style.transform = `translateY(${nextThumb}px)`;
    root.scrollTop = nextScroll;
    document.body.scrollTop = nextScroll;
  });

  thumb.addEventListener("pointerup", event => {
    dragging = false;
    root.classList.remove("scrollbar-dragging");
    track.classList.remove("is-dragging");
    thumb.releasePointerCapture(event.pointerId);
    show();
  });

  thumb.addEventListener("pointercancel", () => {
    dragging = false;
    root.classList.remove("scrollbar-dragging");
    track.classList.remove("is-dragging");
    show();
  });

  track.addEventListener("mouseenter", () => track.classList.add("is-active"));
  track.addEventListener("mouseleave", show);
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", update);
  update();
}

async function getActiveAnnouncement() {
  try {
    const data = await api(
      `/api/collections/announcements/records?filter=${encodeURIComponent("active = true")}&perPage=1`
    );

    return data.items?.[0] || null;
  } catch {
    return null;
  }
}

function announcementCacheKey() {
  return new Date().toISOString().slice(0, 10);
}

function cachedAnnouncement() {
  try {
    const cached = JSON.parse(sessionStorage.getItem(ANNOUNCEMENT_CACHE) || "{}");
    return cached.date === announcementCacheKey() ? cached.announcement : null;
  } catch {
    return null;
  }
}

function cacheAnnouncement(announcement) {
  sessionStorage.setItem(ANNOUNCEMENT_CACHE, JSON.stringify({
    date: announcementCacheKey(),
    announcement
  }));
}

function applyAnnouncementBar(announcement) {
  const bar = $(".top-strip");
  if (!bar) return;

  if (!announcement) {
    bar.classList.remove("show");
    document.body.classList.remove("announcement-visible", "announcement-passed");
    bar.innerHTML = "";
    bar.style.removeProperty("--announcement-bg");
    updateTopChromeHeight();
    return;
  }

  const text = esc(announcement.text || "");
  const copies = Array.from({ length: 8 }, () => `<span>${text}</span>`).join("");
  bar.innerHTML = `<div class="announcement-track">${copies}</div>`;
  bar.style.setProperty("--announcement-bg", announcement.bg_color || "#000000");
  bar.style.setProperty("--announcement-text", announcement.text_color || "#ffffff");
  bar.style.setProperty("--announcement-glow", announcement.text_glow_enabled === false ? "transparent" : announcement.glow_color || "#48bcff");
  bar.style.setProperty("--announcement-text-glow-1", `${Number(announcement.text_glow_intensity || 6)}px`);
  bar.style.setProperty("--announcement-text-glow-2", `${Number(announcement.text_glow_intensity || 6) * 2}px`);
  bar.style.setProperty("--announcement-speed", `${Number(announcement.scroll_speed || 28)}s`);
  bar.style.setProperty("--announcement-banner-glow", announcement.banner_glow_enabled ? `0 0 ${Number(announcement.banner_glow_intensity || 12)}px ${announcement.glow_color || "#48bcff"}` : "none");
  bar.classList.toggle("no-scroll", announcement.scroll_enabled === false);
  bar.classList.add("show");
  document.body.classList.add("announcement-visible");
  updateTopChromeHeight();
  document.body.classList.toggle("announcement-passed", window.scrollY > bar.offsetHeight);
}

async function initAnnouncementBar() {
  const bar = $(".top-strip");
  if (!bar) return;

  applyAnnouncementBar(cachedAnnouncement());

  const announcement = await getActiveAnnouncement();

  if (!announcement) {
    cacheAnnouncement(null);
    bar.classList.remove("show");
    document.body.classList.remove("announcement-visible", "announcement-passed");
    bar.innerHTML = "";
    updateTopChromeHeight();
    return;
  }

  cacheAnnouncement(announcement);
  applyAnnouncementBar(announcement);
}

function initHeaderScroll() {
  const header = $(".site-header");
  if (!header) return;

  let lastScrollY = window.scrollY;
  let pointerNearTop = false;
  let ticking = false;
  let hideTimer = null;
  let chromeHeight = updateTopChromeHeight() || header.offsetHeight || 78;

  const canAutoHide = () => {
    const currentY = Math.max(window.scrollY, 0);
    return document.body.classList.contains("nav-floating")
      && currentY > chromeHeight
      && !pointerNearTop
      && !header.classList.contains("open");
  };

  const queueIdleHide = () => {
    window.clearTimeout(hideTimer);
    if (!canAutoHide()) return;
    hideTimer = window.setTimeout(() => {
      if (canAutoHide()) header.classList.add("nav-hidden");
    }, 3000);
  };

  const revealHeader = () => {
    header.classList.remove("nav-hidden");
    queueIdleHide();
  };

  const hideHeader = () => {
    window.clearTimeout(hideTimer);
    if (canAutoHide()) header.classList.add("nav-hidden");
  };

  const update = () => {
    const bar = $(".top-strip.show");
    const currentY = Math.max(window.scrollY, 0);
    const announcementHeight = bar ? bar.offsetHeight : 0;
    const isAnnouncementPassed = Boolean(bar) && currentY > announcementHeight;
    chromeHeight = updateTopChromeHeight() || chromeHeight;
    const isFloating = currentY > chromeHeight;
    const delta = currentY - lastScrollY;
    const scrollingUp = delta < -8;
    const scrollingDown = delta > 8;
    const menuOpen = header.classList.contains("open");

    header.classList.toggle("scrolled", currentY > 8);
    document.body.classList.toggle("announcement-passed", isAnnouncementPassed);
    document.body.classList.toggle("nav-floating", isFloating);

    if (!isFloating) {
      window.clearTimeout(hideTimer);
      header.classList.remove("nav-hidden");
      lastScrollY = currentY;
      ticking = false;
      return;
    }

    if (pointerNearTop || scrollingUp || menuOpen) {
      revealHeader();
    } else if (scrollingDown) {
      hideHeader();
    }

    lastScrollY = currentY;
    ticking = false;
  };

  const scheduleUpdate = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(update);
  };

  update();
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", () => {
    chromeHeight = updateTopChromeHeight() || header.offsetHeight || 78;
    scheduleUpdate();
  });
  header.addEventListener("mouseenter", () => {
    pointerNearTop = true;
    window.clearTimeout(hideTimer);
    revealHeader();
  });
  header.addEventListener("mouseleave", () => {
    pointerNearTop = false;
    queueIdleHide();
  });
  window.addEventListener("mousemove", event => {
    const isNearTop = document.body.classList.contains("nav-floating") && event.clientY <= 22;
    if (isNearTop === pointerNearTop) return;
    pointerNearTop = isNearTop;
    if (pointerNearTop) revealHeader();
    else queueIdleHide();
  }, { passive: true });
}

function initHomeScrollReveals() {
  if (document.body.dataset.page !== "home") return;

  const sections = Array.from(document.querySelectorAll("main > section:not(.hero), .site-footer"));
  if (!sections.length) return;

  sections.forEach(section => section.classList.add("scroll-reveal"));

  if (!("IntersectionObserver" in window)) {
    sections.forEach(section => section.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const section = entry.target;
      window.requestAnimationFrame(() => {
        section.classList.toggle("is-visible", entry.isIntersecting);
      });
    });
  }, { threshold: 0.03, rootMargin: "0px 0px -4%" });

  sections.forEach(section => observer.observe(section));
}

function setActive() {
  const page = document.body.dataset.page;
  $all(".nav-link").forEach(link => link.classList.toggle("active", link.dataset.nav === page));
}

function cartItems() {
  try {
    return JSON.parse(localStorage.getItem(CART) || "[]");
  } catch {
    return [];
  }
}

function saveCart(items) {
  localStorage.setItem(CART, JSON.stringify(items));
  updateCartLinks();
}

function addToCart(figure) {
  const items = cartItems();
  const existing = items.find(item => item.slug === figure.slug);
  const max = Number(figure.max_per_customer || 1);

  if (existing) {
    existing.quantity = Math.min(max, Number(existing.quantity || 1) + 1);
  } else {
    items.push({
      id: figure.id,
      slug: figure.slug,
      name: figure.name,
      price: figure.price,
      currency: figure.currency || "usd",
      status: statusFor(figure.status, figure.quantity),
      is_preorder: statusFor(figure.status, figure.quantity) === "preorder",
      quantity: 1,
      image: imageFor(figure)
    });
  }

  saveCart(items);
}

function removeFromCart(slug) {
  saveCart(cartItems().filter(item => item.slug !== slug));
}

function cartCount() {
  return cartItems().reduce((total, item) => total + Number(item.quantity || 1), 0);
}

function updateCartLinks() {
  const count = cartCount();
  $all("[data-cart-count]").forEach(item => {
    item.textContent = count ? String(count) : "";
    item.classList.toggle("show", count > 0);
  });
}

function cookies() {
  const banner = $(".cookie-banner");
  if (!banner || localStorage.getItem(COOKIE_OK)) return;
  banner.classList.add("show");
  $("[data-cookie-accept]")?.addEventListener("click", () => {
    localStorage.setItem(COOKIE_OK, "yes");
    banner.classList.remove("show");
  });
  $("[data-cookie-decline]")?.addEventListener("click", () => {
    localStorage.setItem(COOKIE_OK, "no");
    banner.classList.remove("show");
  });
}

function featuredCard(figure) {
  return `
    <a id="${esc(figure.slug)}" class="featured-card" href="catalog?figure=${encodeURIComponent(figure.slug)}" aria-label="${esc(figure.name)}">
      <img src="${esc(imageFor(figure))}" alt="">
    </a>
  `;
}

async function getStatusRibbons() {
  try {
    const data = await api("/api/collections/status_ribbons/records?filter=enabled=true&sort=-priority&perPage=200");
    sessionStorage.setItem(RIBBON_CACHE, JSON.stringify(data.items || []));
    return data.items || [];
  } catch {
    try {
      return JSON.parse(sessionStorage.getItem(RIBBON_CACHE) || "[]");
    } catch {
      return [];
    }
  }
}

function ribbonConditionMatches(ribbon, figure, settings = {}) {
  if (Array.isArray(figure.manual_ribbons) && figure.manual_ribbons.includes(ribbon.id)) return true;

  const quantity = Number(figure.quantity || 0);
  const threshold = Number(figure.low_stock_threshold || settings.low_stock_threshold || 3);
  const releaseDate = figure.release_date ? new Date(figure.release_date) : null;
  const now = new Date();
  const newDays = Number(settings.new_release_days || 30);

  switch (ribbon.condition_type) {
    case "sold_out": return quantity <= 0 || figure.status === "sold_out";
    case "low_stock": return quantity > 0 && quantity <= threshold;
    case "preorder": return figure.status === "preorder";
    case "coming_soon": return Boolean(releaseDate && releaseDate > now);
    case "retired": return Boolean(figure.retired);
    case "exclusive": return Boolean(figure.exclusive);
    case "limited_edition": return Boolean(figure.limited_edition);
    case "new_release": {
      if (!releaseDate || releaseDate > now) return false;

      const ageDays = (now - releaseDate) / 86400000;
      const newest = Number(settings._newest_release_date || 0);
      const mode = settings.new_release_mode || "time_window";

      if (mode === "newest_only") {
        return releaseDate.getTime() === newest;
      }

      if (mode === "newest_and_window") {
        return releaseDate.getTime() === newest && ageDays <= newDays;
      }

      return ageDays <= newDays;
    }
    case "back_in_stock": return Boolean(figure.back_in_stock);
    case "sale": return Number(figure.sale_price || 0) > 0 && Number(figure.sale_price) < Number(figure.price || 0);
    case "staff_pick": return Boolean(figure.staff_pick);
    case "featured": return Boolean(figure.featured);
    case "hidden_draft": return !figure.visible;
    case "manual_only": return Array.isArray(figure.manual_ribbons) && figure.manual_ribbons.includes(ribbon.id);
    default: return false;
  }
}

function selectFigureRibbons(figure, ribbons, location = "catalogue", settings = {}) {
  const showKey = {
    catalogue: "show_catalogue",
    detail: "show_detail",
    homepage: "show_homepage",
    cart: "show_cart"
  }[location] || "show_catalogue";

  const matches = ribbons
    .filter(ribbon => ribbon[showKey])
    .filter(ribbon => ribbonConditionMatches(ribbon, figure, settings))
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));

  if ((settings.ribbon_display_mode || "highest_priority_only") !== "allow_multiple") return matches.slice(0, 1);
  return matches.slice(0, 3);
}

function ribbonBackgroundCss(type, bg1, bg2) {
  if (type === "glass") {
    return `linear-gradient(180deg, color-mix(in srgb, ${bg1} 45%, transparent), color-mix(in srgb, ${bg2} 35%, transparent))`;
  }

  if (type === "metallic") {
    return `linear-gradient(180deg, #ffffff 0%, ${bg1} 22%, ${bg2} 48%, #ffffff 54%, ${bg1} 72%, ${bg2} 100%)`;
  }

  if (type === "gradient") {
    return `linear-gradient(180deg, ${bg1}, ${bg2})`;
  }

  return bg1;
}

function ribbonHtml(ribbon) {
  if (!ribbon) return "";
  const pos = `ribbon-${String(ribbon.position || "top_right_diagonal").replaceAll("_", "-")}`;
  const backgroundType = ribbon.background_type || "solid";
  const bg1 = ribbon.background_color || "#ff3218";
  const bg2 = ribbon.background_color_2 || bg1;
  const width = Number(ribbon.ribbon_width || 148);
  const height = Number(ribbon.ribbon_height || 26);
  const angle = Number(ribbon.angle || 45);
  const bgCss = ribbonBackgroundCss(backgroundType, bg1, bg2);

  return `
    <span class="status-ribbon ${esc(pos)}"
      style="
        --ribbon-width:${width}px;
        --ribbon-height:${height}px;
        --ribbon-angle:${angle}deg;
        --ribbon-angle-negative:${-angle}deg;
        --ribbon-bg:${esc(bg1)};
        --ribbon-bg-2:${esc(bg2)};
        --ribbon-background:${esc(bgCss)};
        --ribbon-text:${esc(ribbon.text_color || "#fff")};
        --ribbon-border:${esc(ribbon.border_color || "#000")};
        --ribbon-glow:${esc(ribbon.ribbon_glow_enabled ? ribbon.ribbon_glow_color || bg1 || "#72beff" : "transparent")};
        --ribbon-text-glow:${esc(ribbon.text_glow_enabled ? ribbon.text_glow_color || "#000" : "transparent")};
        font-family:${esc(ribbon.font_family || "Share Tech Mono")};
        font-weight:${Number(ribbon.font_weight || 700)};
        font-size:${Number(ribbon.font_size || 13)}px;
        letter-spacing:${Number(ribbon.letter_spacing || 1.2)}px;
        text-transform:${esc(ribbon.text_transform || "uppercase")};
      ">
      ${esc(ribbon.label)}
    </span>
  `;
}

function metalTitleSvg(title) {
  const safe = esc(title);
  return `<img class="catalogue-title-img" src="${metalTitleDataUrl(title)}" alt="${safe}" data-base-title="${safe}">`;
}

function metalTitleDataUrl(title) {
  const rawText = String(title || "").toUpperCase();
  const fontSize = 132;
  const lineHeight = 128;
  const lines = wrapTitleLines(rawText, 16);
  const canvas = document.createElement("canvas");
  canvas.width = 2200;
  canvas.height = 310 + Math.max(0, lines.length - 1) * lineHeight;

  const ctx = canvas.getContext("2d");
  ctx.font = `900 ${fontSize}px "Akira Expanded", Impact, sans-serif`;

  const x = canvas.width / 2;
  const firstY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 1.6;

  function drawLines(drawFn) {
    lines.forEach((line, index) => drawFn(line, firstY + index * lineHeight));
  }

  function drawStroke(width, color, blur = 0, shadow = color) {
    ctx.save();
    ctx.font = `900 ${fontSize}px "Akira Expanded", Impact, sans-serif`;
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.shadowBlur = blur;
    ctx.shadowColor = shadow;
    drawLines((line, lineY) => ctx.strokeText(line, x, lineY));
    ctx.restore();
  }

  function drawFill(fill, alpha = 1) {
    ctx.save();
    ctx.font = `900 ${fontSize}px "Akira Expanded", Impact, sans-serif`;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    drawLines((line, lineY) => ctx.fillText(line, x, lineY));
    ctx.restore();
  }

  function maskFill(fill, alpha = 1) {
    const layer = document.createElement("canvas");
    layer.width = canvas.width;
    layer.height = canvas.height;
    const l = layer.getContext("2d");

    l.textAlign = "center";
    l.textBaseline = "middle";
    l.font = `900 ${fontSize}px "Akira Expanded", Impact, sans-serif`;
    l.fillStyle = "#fff";
    lines.forEach((line, index) => l.fillText(line, x, firstY + index * lineHeight));

    l.globalCompositeOperation = "source-in";
    l.globalAlpha = alpha;
    l.fillStyle = fill;
    l.fillRect(0, 0, layer.width, layer.height);

    ctx.drawImage(layer, 0, 0);
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawStroke(26, "#63a3ff", 10, "#63a3ff");
  drawStroke(20, "#b6dcff", 5, "#b6dcff");

  drawStroke(26, "#000000");
  drawStroke(18, "#63a3ff");
  drawStroke(11, "#000000");

  lines.forEach((line, index) => {
    const lineY = firstY + index * lineHeight;
    const metal = ctx.createLinearGradient(0, lineY - fontSize * .43, 0, lineY + fontSize * .26);
    metal.addColorStop(0.00, "#436c9d");
    metal.addColorStop(0.08, "#436c9d");
    metal.addColorStop(0.29, "#74b5ff");
    metal.addColorStop(0.50, "#c2e3ff");
    metal.addColorStop(0.75, "#ffffff");
    metal.addColorStop(0.90, "#83cbff");
    metal.addColorStop(1.00, "#83cbff");

    ctx.save();
    ctx.font = `900 ${fontSize}px "Akira Expanded", Impact, sans-serif`;
    ctx.fillStyle = metal;
    ctx.fillText(line, x, lineY);
    ctx.restore();
  });

  drawStroke(4.5, "#000000");

  return canvas.toDataURL("image/png");
}

function wrapTitleLines(text, maxChars) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  words.forEach(word => {
    if (!current) {
      current = word;
      return;
    }

    if (`${current} ${word}`.length <= maxChars) {
      current = `${current} ${word}`;
      return;
    }

    lines.push(current);
    current = word;
  });

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function catalogueEntry(figure, ribbons = [], settings = {}) {
  const status = statusFor(figure.status, figure.quantity);
  const preview = previewModePublic(settings);
  const previewButtonLabel = ["sold_out", "in_production", "preorder"].includes(status) ? statusLabel(status) : "Coming Soon";
  const unavailableLabel = statusLabel(status);
  const ribbonMarkup = selectFigureRibbons(figure, ribbons, "catalogue", settings).map(ribbonHtml).join("");
  const shareUrl = `${location.origin}/catalog?figure=${encodeURIComponent(figure.slug)}`;
  const shippingEstimate = estimatedShippingLabel(figure);
  const actionLabel = orderActionLabel(figure);
  const contents = (preview ? ["To Be Determined"] : figure.contents?.length ? figure.contents : [
    `x1 UV Printed ${figure.name}`,
    "x1 Display Card",
    "x1 Display Stand",
    "x1 Sticker"
  ]).map(item => `<li>${esc(item)}</li>`).join("");

  return `
    <section class="catalogue-entry" id="${esc(figure.slug)}">
      <div class="catalogue-media-wrap">
        ${variantImageHtml(figure, "catalogue-image", ribbonMarkup)}
      </div>
      <div class="catalogue-info">
        ${metalTitleSvg(figure.name)}
        ${preview ? "" : `<p class="quote" data-base-quote="${esc(figure.quote || figure.short_description || figure.description || "")}">${esc(figure.quote || figure.short_description || figure.description || "")}</p>`}
        <div class="contents-box">
          <strong>Includes the following:</strong>
          <ul data-variant-contents data-base-contents="${esc(JSON.stringify(preview ? ["To Be Determined"] : figure.contents?.length ? figure.contents : [
            `x1 UV Printed ${figure.name}`,
            "x1 Display Card",
            "x1 Display Stand",
            "x1 Sticker"
          ]))}">${contents}</ul>
        </div>
        ${shippingEstimate ? `<p class="estimated-shipping">${esc(shippingEstimate)}</p>` : ""}
        ${preview ? `<div class="catalogue-action-row">
          <span class="coming-button">${esc(previewButtonLabel)}</span>
          <button class="figure-share-btn" type="button" data-share-figure="${esc(figure.slug)}" data-share-url="${esc(shareUrl)}" aria-label="Share ${esc(figure.name)}">
            <span class="material-symbols-outlined">share</span>
          </button>
        </div>` : `
        <div class="stock ${status}">${moneyLabel(figure.price, figure.currency)} | Stock: ${Number(figure.quantity || 0)}</div>
        <div class="catalogue-action-row">
          ${canOrderFigure(figure)
            ? `<button class="order-button" type="button" data-add-cart="${esc(figure.slug)}" data-action-label="${esc(actionLabel)}">${esc(actionLabel)}</button>`
            : ""}
          <button class="figure-share-btn" type="button" data-share-figure="${esc(figure.slug)}" data-share-url="${esc(shareUrl)}" aria-label="Share ${esc(figure.name)}">
            <span class="material-symbols-outlined">share</span>
          </button>
        </div>
        ${canOrderFigure(figure) ? `<div class="limit">Limit to 1 per customer</div>` : `<div class="limit">${esc(unavailableLabel)}</div>`}
        <div class="shipping">Shipping calculated at checkout</div>`}
      </div>
    </section>
  `;
}

function filterFigures(list) {
  const search = ($("#search")?.value || "").toLowerCase().trim();
  const sort = $("#sort")?.value || "status";
  const status = $("#status")?.value || "all";
  let output = list.slice();
  if (search) output = output.filter(item => [item.name, item.description, item.category, item.tags].join(" ").toLowerCase().includes(search));
  if (status !== "all") output = output.filter(item => statusFor(item.status, item.quantity) === status);
  if (sort === "status") output.sort(compareByStatusThenName);
  if (sort === "az") output.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "za") output.sort((a, b) => b.name.localeCompare(a.name));
  if (sort === "quantity") output.sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0));
  return output;
}

function newestReleaseDate(figures = []) {
  const times = figures
    .map(item => item.release_date ? new Date(item.release_date).getTime() : 0)
    .filter(Boolean);

  return times.length ? Math.max(...times) : 0;
}

async function initHome() {
  const grid = $("#featuredGrid");
  if (!grid) return;
  const figures = await getFigures();
  grid.innerHTML = figures.length ? figures.slice(0, 6).map(featuredCard).join("") : `<div class="notice">No minifigs are available right now.</div>`;
}

async function initCatalog() {
  const list = $("#figureGrid");
  if (!list) return;
  const figures = await getFigures({ admin: isAdmin() });
  const ribbons = await getStatusRibbons();
  const settings = await getSiteSettings();
  settings._newest_release_date = newestReleaseDate(figures);
  const visibleFigures = isAdmin() || settings.show_preorders_in_catalogue !== false
    ? figures
    : figures.filter(figure => statusFor(figure.status, figure.quantity) !== "preorder");
  const sharedFigureSlug = new URLSearchParams(window.location.search).get("figure");
  let sharedFigureHandled = false;

  function scrollToSharedFigure() {
    if (!sharedFigureSlug || sharedFigureHandled) return;
    const target = document.getElementById(sharedFigureSlug);
    if (!target) return;
    sharedFigureHandled = true;
    window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      target.classList.add("shared-figure-highlight");
      window.setTimeout(() => target.classList.remove("shared-figure-highlight"), 2200);
    });
  }

  function setupShareButtons() {
    $all("[data-share-figure]", list).forEach(button => {
      button.addEventListener("click", async () => {
        const figure = visibleFigures.find(item => item.slug === button.dataset.shareFigure);
        const shareUrl = button.dataset.shareUrl || `${location.origin}/catalog?figure=${encodeURIComponent(button.dataset.shareFigure || "")}`;
        try {
          if (navigator.share) {
            await navigator.share({
              title: `${figure?.name || "Nemesis Minifigures"} | Nemesis Minifigures`,
              text: figure?.name ? `Check out ${figure.name} from Nemesis Minifigures.` : "Check out Nemesis Minifigures.",
              url: shareUrl
            });
          } else {
            await navigator.clipboard.writeText(shareUrl);
            button.classList.add("copied");
            window.setTimeout(() => button.classList.remove("copied"), 1200);
          }
        } catch (error) {
          if (error.name === "AbortError") return;
          showAdminToast?.("Share link could not be copied.", "error");
        }
      });
    });
  }

  const render = () => {
    const filtered = filterFigures(visibleFigures);
    list.innerHTML = filtered.length ? filtered.map(item => catalogueEntry(item, ribbons, settings)).join("") : `<div class="notice">No figures match that search.</div>`;
    setupVariantCards(list);
    setupShareButtons();
    $all("[data-add-cart]", list).forEach(button => {
      button.addEventListener("click", () => {
        const figure = visibleFigures.find(item => item.slug === button.dataset.addCart);
        if (!figure) return;
        addToCart(figure);
        button.textContent = "Added";
        setTimeout(() => {
          button.textContent = button.dataset.actionLabel || orderActionLabel(figure);
        }, 900);
      });
    });
    scrollToSharedFigure();
  };
  ["search", "sort", "status"].forEach(id => {
    $(`#${id}`)?.addEventListener("input", render);
    $(`#${id}`)?.addEventListener("change", render);
  });
  render();
}

async function initPreordersPage() {
  const list = $("#preorderGrid");
  if (!list) return;

  const figures = (await getFigures({ admin: isAdmin() }))
    .filter(figure => statusFor(figure.status, figure.quantity) === "preorder")
    .sort(compareByStatusThenName);
  const ribbons = await getStatusRibbons();
  const settings = await getSiteSettings();
  settings._newest_release_date = newestReleaseDate(figures);

  if (!figures.length) {
    list.innerHTML = `<div class="notice">No preorders are open right now.</div>`;
    return;
  }

  list.innerHTML = figures.map(item => catalogueEntry(item, ribbons, settings)).join("");
  setupVariantCards(list);

  $all("[data-share-figure]", list).forEach(button => {
    button.addEventListener("click", async () => {
      const figure = figures.find(item => item.slug === button.dataset.shareFigure);
      const shareUrl = button.dataset.shareUrl || `${location.origin}/catalog?figure=${encodeURIComponent(button.dataset.shareFigure || "")}`;
      try {
        if (navigator.share) {
          await navigator.share({
            title: `${figure?.name || "Nemesis Minifigures"} | Nemesis Minifigures`,
            text: figure?.name ? `Check out ${figure.name} from Nemesis Minifigures.` : "Check out Nemesis Minifigures.",
            url: shareUrl
          });
        } else {
          await navigator.clipboard.writeText(shareUrl);
          button.classList.add("copied");
          window.setTimeout(() => button.classList.remove("copied"), 1200);
        }
      } catch (error) {
        if (error.name === "AbortError") return;
        showAdminToast?.("Share link could not be copied.", "error");
      }
    });
  });

  $all("[data-add-cart]", list).forEach(button => {
    button.addEventListener("click", () => {
      const figure = figures.find(item => item.slug === button.dataset.addCart);
      if (!figure) return;
      addToCart(figure);
      button.textContent = "Added";
      setTimeout(() => {
        button.textContent = button.dataset.actionLabel || orderActionLabel(figure);
      }, 900);
    });
  });
}

function parseAssociateSocials(value) {
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value || "[]");
  } catch {
    return [];
  }
}

function associatePhotoUrl(associate) {
  if (STATIC_PORTFOLIO && associate.image_url) return associate.image_url;
  if (associate.photo) return collectionFileUrl("associates", associate, associate.photo, "160x160f");
  if (associate.image_url?.startsWith("/api/files/")) return `${PB_URL}${associate.image_url}`;
  return associate.image_url || localAsset("/assets/brand/Favicon.png");
}

function normalizeAssociateUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(withProtocol);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function associateLinkHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function associateLinkIcon(url) {
  const host = associateLinkHost(url);
  return host ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32` : localAsset("/assets/brand/Favicon.png");
}

function associateLinkLabel(item) {
  const label = String(item.label || "").trim();
  if (label) return label;
  const host = associateLinkHost(item.url);
  if (!host) return "Link";
  return host.split(".")[0].replace(/\b\w/g, char => char.toUpperCase());
}

function profileCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return new Intl.NumberFormat("en-US", {
    notation: number >= 10000 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(number);
}

async function renderInstagramProfile() {
  const card = $("#instagramProfileCard");
  if (!card) return;

  try {
    const data = await api("/api/collections/instagram_profile_cache/records?perPage=1&filter=cache_key%3D%22nemesis%22");
    const profile = data.items?.[0]?.profile_data || {};
    const profileUrl = profile.profileUrl || profile.url || "https://www.instagram.com/Nemesis.Minifigures";
    const username = profile.username || "";
    const displayName = profile.displayName || username;
    const image = profile.profileImageUrl || profile.imageUrl || "";
    const stats = [
      ["Posts", profile.postCount],
      ["Followers", profile.followerCount],
      ["Following", profile.followingCount]
    ].filter(([, value]) => Number.isFinite(Number(value)));

    card.href = profileUrl;
    card.setAttribute("aria-label", `Open ${username || "Nemesis Minifigures"} on Instagram`);
    if ($("#instagramProfileImage")) {
      $("#instagramProfileImage").classList.toggle("hidden", !image);
      if (image) {
        $("#instagramProfileImage").src = image;
        $("#instagramProfileImage").alt = `${displayName || username || "Nemesis Minifigures"} Instagram profile picture`;
      }
    }
    $("#instagramDisplayName").textContent = displayName;
    $("#instagramUsername").textContent = username ? `@${username.replace(/^@/, "")}` : "";

    const bio = $("#instagramBio");
    if (bio) {
      bio.textContent = profile.bio || "";
      bio.classList.toggle("hidden", !profile.bio);
    }

    const statsEl = $("#instagramStats");
    if (statsEl) {
      statsEl.innerHTML = stats.map(([label, value]) => `
        <span>
          <strong>${esc(profileCount(value))}</strong>
          <em>${esc(label)}</em>
        </span>
      `).join("");
      statsEl.classList.toggle("hidden", !stats.length);
    }
  } catch {
    $("#instagramProfileCard")?.classList.add("instagram-profile-unavailable");
    $("#instagramStats")?.classList.add("hidden");
  }
}

async function getAssociates() {
  try {
    const data = await api("/api/collections/associates/records?sort=sort_order,name&perPage=100", {
      headers: authHeaders()
    });
    return data.items || [];
  } catch {
    return [];
  }
}

function socialsToTextarea(socials = []) {
  return parseAssociateSocials(socials)
    .map(item => `${item.label || ""} | ${item.url || ""}`)
    .join("\n");
}

function textareaToSocials(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split("|").map(part => part.trim());
      const url = normalizeAssociateUrl(parts[1] || parts[0] || "");
      return { label: parts[1] ? parts[0] : "", url };
    })
    .filter(item => item.url);
}

function clearAssociateForm() {
  $("#associateForm")?.reset();
  $("#associateRecordId").value = "";
  $("#associateActive").checked = true;
  $("#associateFormTitle").textContent = "Add Associate";
  $("#associateFormMessage").textContent = "";
}

function openAssociateForm(record = null) {
  clearAssociateForm();
  if (record) {
    $("#associateRecordId").value = record.id;
    $("#associateName").value = record.name || "";
    $("#associateRole").value = record.role || "";
    $("#associateSocials").value = socialsToTextarea(record.socials);
    $("#associateActive").checked = record.active !== false;
    $("#associateFormTitle").textContent = "Edit Associate";
  }
  $("#associateFormPanel")?.classList.remove("hidden");
  document.body.classList.add("modal-open");
}

function closeAssociateForm() {
  $("#associateFormPanel")?.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

async function renderAssociates() {
  const list = $("#associateList");
  if (!list) return;

  const associates = await getAssociates();
  const visible = isAdmin() ? associates : associates.filter(item => item.active !== false);

  $(".about-admin-action")?.classList.toggle("hidden", !isAdmin());

  list.innerHTML = visible.length ? visible.map(item => {
    const socials = parseAssociateSocials(item.socials);
    return `
      <article class="associate-card">
        <img class="associate-photo" src="${esc(associatePhotoUrl(item))}" alt="${esc(item.name)}">
        <div class="associate-copy">
          <h3>${esc(item.name)}</h3>
          <p>${esc(item.role || "")}</p>
          <div class="associate-socials">
            ${socials.map(social => `<a href="${esc(social.url)}" target="_blank" rel="noopener"><img src="${esc(associateLinkIcon(social.url))}" alt="">${esc(associateLinkLabel(social))}</a>`).join("")}
          </div>
        </div>
        ${isAdmin() ? `<button class="btn small associate-edit" type="button" data-edit-associate="${esc(item.id)}">Edit</button>` : ""}
      </article>
    `;
  }).join("") : `<div class="notice">Associates will appear here soon.</div>`;

  $all("[data-edit-associate]").forEach(button => {
    button.addEventListener("click", () => openAssociateForm(associates.find(item => item.id === button.dataset.editAssociate)));
  });
}

async function saveAssociate(event) {
  event.preventDefault();
  const id = $("#associateRecordId").value;
  const payload = {
    name: $("#associateName").value.trim(),
    role: $("#associateRole").value.trim(),
    socials: textareaToSocials($("#associateSocials").value),
    active: $("#associateActive").checked,
    sort_order: 10
  };
  const photo = $("#associatePhoto")?.files?.[0];
  const message = $("#associateFormMessage");

  try {
    const options = {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload)
    };

    if (photo) {
      const formData = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        formData.append(key, typeof value === "object" ? JSON.stringify(value) : value);
      });
      formData.append("photo", photo);
      options.headers = authHeaders();
      options.body = formData;
    }

    await api(id ? `/api/collections/associates/records/${id}` : "/api/collections/associates/records", options);
    closeAssociateForm();
    showAdminToast("Associate saved.");
    renderAssociates();
  } catch (error) {
    message.textContent = error.message || "Associate could not be saved.";
    message.className = "admin-help-text error";
    showAdminToast(error.message || "Associate could not be saved.", "error");
  }
}

function initAboutPage() {
  if (document.body.dataset.page !== "about") return;
  renderInstagramProfile();
  renderAssociates();
  $("#openAssociateForm")?.addEventListener("click", () => openAssociateForm());
  $("#closeAssociateForm")?.addEventListener("click", closeAssociateForm);
  $("#clearAssociateForm")?.addEventListener("click", clearAssociateForm);
  $("#associateForm")?.addEventListener("submit", saveAssociate);
}

function updatePostImageUrl(post, file, thumb = "960x640") {
  return collectionFileUrl("updates_posts", post, file, thumb);
}

function updateAuthorAvatarMarkup(name, url) {
  const label = (name || "Admin").trim();
  if (url) return `<span class="updates-avatar"><img src="${esc(url)}" alt="${esc(label)} profile photo"></span>`;
  return `<span class="updates-avatar" aria-hidden="true">${esc(label.charAt(0).toUpperCase() || "A")}</span>`;
}

function updateDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function sanitizeUpdateHtml(value) {
  const template = document.createElement("template");
  template.innerHTML = String(value || "");
  const allowed = new Set([
    "A", "B", "BLOCKQUOTE", "BR", "CODE", "DIV", "EM", "H1", "H2", "H3", "I",
    "LI", "OL", "P", "PRE", "S", "SPAN", "STRONG", "U", "UL"
  ]);

  template.content.querySelectorAll("*").forEach(node => {
    if (!allowed.has(node.tagName)) {
      node.replaceWith(...Array.from(node.childNodes));
      return;
    }

    const inlineStyle = node.getAttribute("style") || "";
    Array.from(node.attributes).forEach(attr => {
      if (node.tagName === "A" && attr.name === "href") return;
      node.removeAttribute(attr.name);
    });

    const fontSize = inlineStyle.match(/(?:^|;)\s*font-size\s*:\s*(\d{1,3})px\s*(?:;|$)/i);
    if (fontSize) {
      const pixels = Math.max(8, Math.min(999, Number(fontSize[1])));
      node.style.fontSize = `${pixels}px`;
    }

    if (node.tagName === "A") {
      const href = node.getAttribute("href") || "";
      if (!/^(https?:\/\/|mailto:)/i.test(href)) {
        node.removeAttribute("href");
      } else {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener");
      }
    }
  });

  return template.innerHTML.trim();
}

function clearUpdatePostForm() {
  $("#updatePostForm")?.reset();
  if ($("#updatePostBody")) $("#updatePostBody").innerHTML = "";
  if ($("#updateImagePreview")) $("#updateImagePreview").innerHTML = "";
  if ($("#updatePostMessage")) $("#updatePostMessage").textContent = "";
  $("#updateLinkPanel")?.classList.add("hidden");
  updateEditorToolbarState();
}

function renderUpdateImagePreview() {
  const box = $("#updateImagePreview");
  const files = Array.from($("#updatePostImages")?.files || []);
  if (!box) return;

  box.innerHTML = files.slice(0, 8).map(file => `
    <img src="${esc(URL.createObjectURL(file))}" alt="">
  `).join("");
}

async function getUpdatePosts() {
  let data;
  try {
    data = await api("/api/collections/updates_posts/records?sort=-posted_at&perPage=50", {
      headers: authHeaders()
    });
  } catch (error) {
    data = await api("/api/collections/updates_posts/records?sort=-posted_at&perPage=50");
  }
  return data.items || [];
}

async function renderUpdatesFeed() {
  const feed = $("#updatesFeed");
  if (!feed) return;

  let posts = [];
  try {
    posts = await getUpdatePosts();
  } catch {
    feed.innerHTML = `<div class="notice error">Updates could not be loaded.</div>`;
    return;
  }

  feed.innerHTML = posts.length ? posts.map(post => {
    const images = Array.isArray(post.images) ? post.images : (post.images ? [post.images] : []);
    return `
      <article class="update-post">
        <header class="update-post-head">
          <div class="updates-author">
            ${updateAuthorAvatarMarkup(post.author_name, post.author_avatar_url)}
            <div>
              <strong>${esc(post.author_name || "Admin")}</strong>
              <span class="update-post-time">${esc(updateDate(post.posted_at))}</span>
            </div>
          </div>
          ${isAdmin() ? `<button class="btn small update-delete" type="button" data-delete-update="${esc(post.id)}" aria-label="Delete update"><span class="material-symbols-outlined">delete</span></button>` : ""}
        </header>
        <h2 class="update-post-title">${esc(post.title)}</h2>
        <div class="update-post-body">${sanitizeUpdateHtml(post.body_html)}</div>
        ${images.length ? `<div class="update-post-images">${images.map(file => `<img src="${esc(updatePostImageUrl(post, file))}" alt="">`).join("")}</div>` : ""}
      </article>
    `;
  }).join("") : `<div class="notice">No updates have been posted yet.</div>`;

  $all("[data-delete-update]").forEach(button => {
    button.addEventListener("click", async () => {
      if (button.dataset.confirmDelete !== "true") {
        button.dataset.confirmDelete = "true";
        button.classList.add("confirm-delete");
        button.innerHTML = "Confirm";
        setTimeout(() => {
          if (button.dataset.confirmDelete === "true") {
            button.dataset.confirmDelete = "false";
            button.classList.remove("confirm-delete");
            button.innerHTML = `<span class="material-symbols-outlined">delete</span>`;
          }
        }, 3200);
        return;
      }

      await fetch(`${PB_URL}/api/collections/updates_posts/records/${button.dataset.deleteUpdate}`, {
        method: "DELETE",
        headers: authHeaders()
      });
      renderUpdatesFeed();
    });
  });
}

async function saveUpdatePost(event) {
  event.preventDefault();
  const title = $("#updatePostTitle")?.value.trim();
  const body = sanitizeUpdateHtml($("#updatePostBody")?.innerHTML || "");
  const message = $("#updatePostMessage");

  if (!title || !body) {
    if (message) message.textContent = "Add a title and post content.";
    return;
  }

  const admin = currentAdmin();
  const formData = new FormData();
  formData.append("title", title);
  formData.append("body_html", body);
  formData.append("published", "true");
  formData.append("posted_at", new Date().toISOString());
  formData.append("author_name", admin.name || admin.email || "Admin");
  formData.append("author_avatar_url", adminAvatarUrl(admin));
  formData.append("author_id", admin.id || "");
  Array.from($("#updatePostImages")?.files || []).slice(0, 8).forEach(file => formData.append("images", file));

  try {
    await api("/api/collections/updates_posts/records", {
      method: "POST",
      headers: authHeaders(),
      body: formData
    });
    clearUpdatePostForm();
    renderUpdatesFeed();
  } catch (error) {
    if (message) message.textContent = error.message || "Update could not be published.";
  }
}

function saveEditorSelection() {
  const editor = $("#updatePostBody");
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (editor.contains(range.commonAncestorContainer)) {
    editor.dataset.savedRange = "true";
    editor._savedRange = range.cloneRange();
  }
}

function restoreEditorSelection() {
  const editor = $("#updatePostBody");
  const selection = window.getSelection();
  if (!editor?._savedRange || !selection) return;
  selection.removeAllRanges();
  selection.addRange(editor._savedRange);
}

function updateEditorToolbarState() {
  const commands = ["bold", "italic", "underline", "insertUnorderedList", "insertOrderedList"];
  commands.forEach(command => {
    $all(`[data-update-format="${command}"]`).forEach(button => {
      let active = false;
      try {
        active = document.queryCommandState(command);
      } catch {
        active = false;
      }
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  });

  let block = "p";
  try {
    block = document.queryCommandValue("formatBlock").toLowerCase().replace(/[<>]/g, "") || "p";
  } catch {
    block = "p";
  }
  if ($("#updateBlockStyle")) $("#updateBlockStyle").value = block === "h3" ? "h3" : "p";
}

function applyUpdateLink() {
  const input = $("#updateLinkUrl");
  const raw = input?.value.trim();
  if (!raw) return;
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  restoreEditorSelection();
  document.execCommand("createLink", false, url);
  $("#updateLinkPanel")?.classList.add("hidden");
  if (input) input.value = "";
  $("#updatePostBody")?.focus();
  updateEditorToolbarState();
}

function initUpdatesPage() {
  if (document.body.dataset.page !== "updates") return;

  if (isAdmin()) {
    $("#updatesComposer")?.classList.remove("hidden");
    const admin = currentAdmin();
    const avatar = adminAvatarUrl(admin);
    const name = admin.name || admin.email || "Admin";
    $("#updatesComposerName").textContent = name;
    $("#updatesComposerAvatar").innerHTML = avatar ? `<img src="${esc(avatar)}" alt="${esc(name)} profile photo">` : esc(name.charAt(0).toUpperCase() || "A");
  }

  renderUpdatesFeed();
  $("#clearUpdatePost")?.addEventListener("click", clearUpdatePostForm);
  $("#updatePostImages")?.addEventListener("change", renderUpdateImagePreview);
  $("#updatePostForm")?.addEventListener("submit", saveUpdatePost);
  $("#updatePostBody")?.addEventListener("keyup", updateEditorToolbarState);
  $("#updatePostBody")?.addEventListener("mouseup", () => {
    saveEditorSelection();
    updateEditorToolbarState();
  });
  $("#updatePostBody")?.addEventListener("input", updateEditorToolbarState);
  document.addEventListener("selectionchange", () => {
    if (document.activeElement === $("#updatePostBody")) updateEditorToolbarState();
  });
  $("#updateBlockStyle")?.addEventListener("change", event => {
    document.execCommand("formatBlock", false, event.target.value);
    $("#updatePostBody")?.focus();
    updateEditorToolbarState();
  });
  $("#openUpdateLinkPanel")?.addEventListener("click", () => {
    saveEditorSelection();
    $("#updateLinkPanel")?.classList.remove("hidden");
    $("#updateLinkUrl")?.focus();
  });
  $("#applyUpdateLink")?.addEventListener("click", applyUpdateLink);
  $("#cancelUpdateLink")?.addEventListener("click", () => {
    $("#updateLinkPanel")?.classList.add("hidden");
    $("#updatePostBody")?.focus();
  });

  $all("[data-update-format]").forEach(button => {
    button.addEventListener("mousedown", event => event.preventDefault());
    button.addEventListener("click", () => {
      const command = button.dataset.updateFormat;
      document.execCommand(command, false, null);
      $("#updatePostBody")?.focus();
      updateEditorToolbarState();
    });
  });
}

async function getSiteSettings() {
  try {
    const data = await api("/api/collections/site_settings/records?perPage=1");
    const settings = data.items?.[0] || {};
    sessionStorage.setItem(SITE_SETTINGS_CACHE, JSON.stringify(settings));
    return settings;
  } catch {
    try {
      return JSON.parse(sessionStorage.getItem(SITE_SETTINGS_CACHE) || "{}");
    } catch {
      return {};
    }
  }
}

function currentPagePath() {
  const parts = location.pathname.split("/").filter(Boolean);
  if (!parts.length) return "index.html";
  const path = parts.join("/");
  if (path.endsWith(".html")) return path;
  return `${path}.html`;
}

function isAdminPath() {
  const path = location.pathname.replace(/\/+$/g, "");
  return path === "/admin" || path.includes("/admin/");
}

function previewModePublic(settings = {}) {
  return Boolean(settings.preview_enabled) && !isAdmin();
}

function previewModeActive(settings = {}) {
  return Boolean(settings.preview_enabled);
}

function previewAllowsPage(settings = {}) {
  const whitelist = Array.isArray(settings.preview_whitelist) ? settings.preview_whitelist : ["index.html"];
  const page = currentPagePath();
  return page === "index.html" || whitelist.includes(page);
}

async function enforcePreviewMode() {
  if (isAdminPath()) {
    document.documentElement.classList.remove("preview-gate-pending");
    return true;
  }

  const settings = await getSiteSettings();
  document.body.classList.toggle("preview-mode", previewModePublic(settings));
  if (!previewModePublic(settings) || previewAllowsPage(settings)) {
    document.documentElement.classList.remove("preview-gate-pending");
    return true;
  }

  location.replace("/");
  return false;
}

function shippingForCountry(settings, country) {
  const value = String(country || "").trim().toLowerCase();
  if (["us", "usa", "united states", "united states of america"].includes(value)) return Number(settings.domestic_shipping || 0);
  if (["ca", "canada", "mx", "mexico"].includes(value)) return Number(settings.north_america_shipping ?? settings.international_shipping ?? 25);
  if (["united kingdom", "uk", "england", "france", "germany", "italy", "spain", "ireland", "netherlands", "belgium", "sweden", "norway", "denmark", "poland", "portugal", "austria", "switzerland", "finland"].includes(value)) return Number(settings.europe_shipping ?? settings.international_shipping ?? 25);
  return Number(settings.international_shipping || 25);
}

function cartSubtotal(items = cartItems()) {
  return items.reduce((total, item) => total + Number(item.price || 0) * Number(item.quantity || 1), 0);
}

function cartTotals(settings = {}, country = "United States", items = cartItems()) {
  const subtotal = cartSubtotal(items);
  const shipping = items.length ? shippingForCountry(settings, country) : 0;
  const tax = 0;
  return {
    subtotal,
    shipping,
    tax,
    total: Math.max(0, subtotal + shipping + tax)
  };
}

function renderCartSummary(root, settings = {}, country = "United States") {
  const items = cartItems();
  if (!root) return;
  if (!items.length) {
    root.innerHTML = `<div class="notice">Your cart is empty.</div>`;
    return;
  }

  const totals = cartTotals(settings, country, items);
  root.innerHTML = `
    <div class="cart-lines">
      ${items.map(item => `
        <div class="cart-line">
          <strong>${esc(item.name)}${item.is_preorder ? ` <span class="cart-line-tag">Preorder</span>` : ""}</strong>
          <span>${Number(item.quantity || 1)} x ${moneyLabel(item.price, item.currency)}</span>
          <button class="btn small" type="button" data-remove-cart="${esc(item.slug)}">Remove</button>
        </div>
      `).join("")}
      <div class="cart-total"><span>Subtotal</span><strong>${moneyLabel(totals.subtotal)}</strong></div>
      <div class="cart-total"><span>Shipping</span><strong>${moneyLabel(totals.shipping)}</strong></div>
      <div class="cart-total grand"><span>Total</span><strong>${moneyLabel(totals.total)}</strong></div>
    </div>
  `;
  $all("[data-remove-cart]", root).forEach(button => {
    button.addEventListener("click", () => {
      removeFromCart(button.dataset.removeCart);
      renderCartSummary(root, settings, country);
    });
  });
}

async function createOrder(payload) {
  return api("/api/collections/orders/records", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}

async function createPaymentIntent(order) {
  return api("/api/nemesis/create-payment-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: order.id, order_number: order.order_number })
  });
}

async function confirmPaymentIntent(order, paymentIntentId) {
  return api("/api/nemesis/confirm-payment-intent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id: order.id, payment_intent: paymentIntentId })
  });
}

function checkoutPaymentError(error) {
  const raw = String(error?.message || "");
  if (!raw) return "Payment could not be completed. Please try again.";
  if (/stripe|key|secret|configured|server/i.test(raw)) {
    console.warn("Checkout payment setup failed", error);
    return "Secure payment is temporarily unavailable. Please try again soon.";
  }
  return raw;
}

async function mountStripeCardElement(settings) {
  const mount = $("#stripeCheckoutMount");
  if (!mount) return null;

  const publishableKey = String(settings.stripe_test_mode ? settings.stripe_test_publishable_key : settings.stripe_publishable_key).trim();
  if (!publishableKey) {
    console.warn(`Stripe ${settings.stripe_test_mode ? "test" : "live"} publishable key is not configured.`);
    throw new Error("Secure payment is temporarily unavailable. Please try again soon.");
  }

  if (!window.Stripe) {
    throw new Error("Secure payment is temporarily unavailable. Please refresh and try again.");
  }

  mount.innerHTML = "";
  mount.classList.add("active");
  mount.innerHTML = `
    <label class="stripe-card-label" for="stripeCardElement">Card details</label>
    <div id="stripeCardElement" class="stripe-card-element" aria-label="Card details"></div>
    <div id="stripeCardErrors" class="stripe-card-errors" role="alert" aria-live="polite"></div>
  `;

  const stripe = window.Stripe(publishableKey);
  const elements = stripe.elements({
    fonts: [{
      cssSrc: "https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap"
    }]
  });
  const card = elements.create("card", {
    hidePostalCode: false,
    style: {
      base: {
        color: "#f6fbff",
        iconColor: "#7ed7ff",
        fontFamily: '"Share Tech Mono", monospace',
        fontSize: "17px",
        fontSmoothing: "antialiased",
        "::placeholder": {
          color: "#8da5b8"
        }
      },
      invalid: {
        color: "#ff6b8d",
        iconColor: "#ff6b8d"
      }
    }
  });
  card.mount("#stripeCardElement");
  card.on("change", event => {
    const error = $("#stripeCardErrors");
    if (error) error.textContent = event.error ? event.error.message : "";
  });
  return { stripe, card };
}

function initWaitlist(settings = {}) {
  const form = $("#waitlistForm");
  if (!form) return;
  const section = form.closest(".waitlist-band");
  const visible = previewModeActive(settings);
  if (section) section.hidden = !visible;
  if (!visible) return;

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const email = $("#waitlistEmail", form);
    const message = $("#waitlistMessage", form);
    const button = $("button", form);

    message.textContent = "Joining...";
    message.classList.remove("error");
    button.disabled = true;

    try {
      const data = await api("/api/nemesis/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.value,
          company: $("[name='company']", form)?.value || ""
        })
      });
      message.textContent = data.message || "You're on the list.";
      email.value = "";
    } catch (error) {
      message.textContent = error.message || "Could not join right now. Please try again.";
      message.classList.add("error");
    } finally {
      button.disabled = false;
    }
  });
}

async function initCheckout() {
  const form = $("#checkoutForm");
  const summary = $("#checkoutSummary");
  if (!form || !summary) return;
  if (STATIC_PORTFOLIO) {
    const notice = $("#checkoutNotice");
    if (notice) {
      notice.hidden = false;
      notice.textContent = "Portfolio demonstration only — checkout and payments are disabled.";
      notice.className = "notice";
    }
    $("button[type='submit']", form).disabled = true;
  }
  const settings = await getSiteSettings();
  const countryInput = $("#checkoutCountry");
  const submitButton = $("button[type='submit']", form);
  let paymentState = null;
  const syncNotice = () => {
    const notice = $("#checkoutNotice");
    if (!notice) return;
    const hasItems = cartItems().length > 0;
    notice.hidden = !hasItems;
    if (hasItems && !notice.classList.contains("error") && !notice.classList.contains("success")) {
      notice.textContent = "Review your order, then continue to secure payment.";
      notice.className = "notice";
    }
  };
  const render = () => {
    renderCartSummary(summary, settings, countryInput?.value || "United States");
    syncNotice();
  };
  render();
  countryInput?.addEventListener("input", render);
  countryInput?.addEventListener("change", render);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const notice = $("#checkoutNotice");
    const items = cartItems();
    if (!items.length) {
      render();
      return;
    }
    if (paymentState) {
      notice.textContent = "Processing payment...";
      notice.className = "notice";
      submitButton.disabled = true;
      try {
        const { error, paymentIntent } = await paymentState.stripe.confirmCardPayment(paymentState.clientSecret, {
          payment_method: {
            card: paymentState.card,
            billing_details: {
              name: $("#checkoutName").value.trim(),
              email: $("#checkoutEmail").value.trim()
            }
          }
        });

        if (error) {
          throw new Error(error.message || "Payment could not be completed.");
        }

        if (paymentIntent?.status === "succeeded" || paymentIntent?.status === "processing") {
          const confirmed = await confirmPaymentIntent(paymentState.order, paymentIntent.id);
          paymentState.order.status = confirmed.status || paymentState.order.status;
          paymentState.displayOrder.status = paymentState.order.status;
          sessionStorage.setItem("nemesis_last_order", JSON.stringify(paymentState.displayOrder));
          saveCart([]);
          location.href = `success?order=${encodeURIComponent(paymentState.order.order_number)}`;
          return;
        }

        throw new Error("Payment is not complete yet.");
      } catch (error) {
        notice.textContent = checkoutPaymentError(error);
        notice.className = "notice error";
        submitButton.disabled = false;
        submitButton.textContent = `Pay ${moneyLabel(paymentState.order.total)}`;
        return;
      }
    }

    notice.textContent = "Preparing secure payment...";
    notice.className = "notice";
    submitButton.disabled = true;
    try {
      const totals = cartTotals(settings, $("#checkoutCountry").value.trim(), items);
      const order = await createOrder({
        customer_name: $("#checkoutName").value.trim(),
        customer_email: $("#checkoutEmail").value.trim(),
        shipping_address: $("#checkoutAddress").value.trim(),
        country: $("#checkoutCountry").value.trim(),
        items_json: items.map(item => ({ slug: item.slug, quantity: item.quantity || 1 })),
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        tax: 0,
        total: totals.total,
        status: totals.total <= 0 ? "paid" : "pending_payment"
      });
      const displayOrder = {
        ...order,
        items_json: items.map(item => ({
          slug: item.slug,
          name: item.name,
          quantity: item.quantity || 1,
          price: item.price,
          currency: item.currency || "usd",
          image: item.image,
          is_preorder: item.is_preorder
        }))
      };

      if (Number(order.total || 0) > 0) {
        const payment = await createPaymentIntent(order);
        if (payment?.clientSecret) {
          sessionStorage.setItem("nemesis_last_order", JSON.stringify(displayOrder));
          notice.textContent = "Enter payment details below.";
          notice.className = "notice success";
          const mounted = await mountStripeCardElement(settings);
          if (!mounted) {
            throw new Error("Stripe payment form could not be mounted.");
          }
          paymentState = {
            ...mounted,
            order,
            displayOrder,
            paymentIntentId: payment.id,
            clientSecret: payment.clientSecret
          };
          submitButton.disabled = false;
          submitButton.textContent = `Pay ${moneyLabel(order.total)}`;
          return;
        }
        throw new Error("Payment is required, but Stripe could not prepare the payment form.");
      }

      sessionStorage.setItem("nemesis_last_order", JSON.stringify(displayOrder));
      location.href = `success?order=${encodeURIComponent(order.order_number)}`;
    } catch (error) {
      notice.textContent = checkoutPaymentError(error) || "Order could not be created.";
      notice.className = "notice error";
      submitButton.disabled = false;
    }
  });
}

function renderOrderTracking(order, settings) {
  if (order.status !== "shipped" && order.status !== "delivered") return "";
  if (!settings.tracking_enabled) return `<p class="notice">Your order has shipped. Tracking is not currently available for this shipment.</p>`;
  if (!order.tracking_number) return `<p class="notice">Your order has shipped. Tracking information has not been added yet.</p>`;
  const url = order.tracking_url || trackingUrl(order.carrier, order.tracking_number);
  return `
    <div class="order-tracking">
      <strong>Tracking Number</strong>
      <p>${esc(order.tracking_number)}</p>
      ${url ? `<a class="btn primary" href="${esc(url)}" target="_blank" rel="noopener">Track Package</a>` : ""}
    </div>
  `;
}

function trackingUrl(carrier, number) {
  const n = encodeURIComponent(number || "");
  switch ((carrier || "").toLowerCase()) {
    case "usps": return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
    case "ups": return `https://www.ups.com/track?tracknum=${n}`;
    case "fedex": return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
    case "dhl": return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${n}`;
    default: return "";
  }
}

async function initSuccess() {
  const shell = $("#successOrder");
  if (!shell) return;
  const order = JSON.parse(sessionStorage.getItem("nemesis_last_order") || "{}");
  if (!order.order_number) {
    shell.innerHTML = `
      <div class="success-kicker">Nemesis Minifigures</div>
      <h1>Success</h1>
      <p class="success-lede">Your order was created. Confirmation details will appear here after payment is connected.</p>
      <a class="btn primary" href="catalog">Back to Minifigures</a>
    `;
    return;
  }
  saveCart([]);
  const items = order.items_json || [];
  const firstImage = items.find(item => item.image)?.image || "assets/brand/share-card.png";
  const itemCount = items.reduce((total, item) => total + Number(item.quantity || 1), 0);
  shell.innerHTML = `
    <div class="success-kicker">${esc(order.is_preorder ? "Preorder Confirmed" : "Order Confirmed")}</div>
    <h1>Success</h1>
    <p class="success-lede">Your confirmation is locked in. Keep this order number for your records.</p>

    <div class="success-layout">
      <div class="success-details">
        <h2>Confirmation Details</h2>
        <dl class="success-detail-list">
          <div><dt>Order Number</dt><dd>${esc(order.order_number)}</dd></div>
          <div><dt>Status</dt><dd>${esc(statusLabelForOrder(order.status || "paid"))}</dd></div>
          <div><dt>Items</dt><dd>${itemCount}</dd></div>
          <div><dt>Total</dt><dd>${moneyLabel(order.total)}</dd></div>
        </dl>
        <div class="success-actions">
          <a class="btn primary" href="orders">View Orders</a>
          <a class="btn" href="catalog">Continue Browsing</a>
        </div>
      </div>

      <div class="success-item-showcase">
        <img class="success-hero-image" src="${esc(firstImage)}" alt="${esc(items[0]?.name || "Nemesis Minifigures order")}">
        <div class="success-item-list">
          ${items.map(item => `
            <div class="success-item">
              <img src="${esc(item.image || firstImage)}" alt="${esc(item.name || "Ordered minifigure")}">
              <div>
                <strong>${esc(item.name || item.slug || "Minifigure")}</strong>
                <span>${Number(item.quantity || 1)} x ${moneyLabel(item.price, item.currency)}</span>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    </div>
  `;
}

async function initOrderLookup() {
  const form = $("#orderLookupForm");
  if (!form) return;
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const result = $("#orderLookupResult");
    const email = $("#lookupEmail").value.trim().toLowerCase();
    const number = $("#lookupOrderNumber").value.trim();
    result.innerHTML = `<div class="notice">Looking up order...</div>`;
    try {
      const settings = await getSiteSettings();
      const order = await api(`/api/nemesis/order-lookup/${encodeURIComponent(email)}/${encodeURIComponent(number)}`);
      result.innerHTML = `
        <div class="admin-card">
          <h2>Order ${esc(order.order_number)}</h2>
          <p>Type: ${esc(order.is_preorder ? "Preorder" : "Order")}</p>
          <p>Status: ${esc(statusLabelForOrder(order.status))}</p>
          <p>Total: ${moneyLabel(order.total)}</p>
          ${renderOrderTracking(order, settings)}
        </div>
      `;
    } catch (error) {
      result.innerHTML = `<div class="notice error">${esc(error.message || "Order could not be found.")}</div>`;
    }
  });
}

async function adminLogin(email, password) {
  const payload = {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identity: email, password })
  };

  const data = await api("/api/collections/admin_users/auth-with-password", payload);

  localStorage.setItem(ADMIN_TOKEN, data.token);
  localStorage.setItem(ADMIN_USER, JSON.stringify(data.record));
  return data;
}

async function refreshAdminSession(options = {}) {
  if (!isAdmin()) return null;
  const admin = currentAdmin();
  if (admin.collectionName && admin.collectionName !== "admin_users") {
    logout();
    return null;
  }

  try {
    const data = await api("/api/collections/admin_users/auth-refresh", {
      method: "POST",
      headers: authHeaders(),
      _skipAuthRetry: true
    });
    localStorage.setItem(ADMIN_TOKEN, data.token);
    localStorage.setItem(ADMIN_USER, JSON.stringify(data.record));
    return data.record;
  } catch (error) {
    localStorage.removeItem(ADMIN_TOKEN);
    localStorage.removeItem(ADMIN_USER);
    if (!options.silent) window.setTimeout(() => location.reload(), 50);
    return null;
  }
}

function logout() {
  localStorage.removeItem(ADMIN_TOKEN);
  localStorage.removeItem(ADMIN_USER);
  location.reload();
}

function showFigureForm(mode = "add") {
  const panel = $("#figureFormPanel");
  const title = $("#figureFormTitle");
  if (!panel) return;

  panel.classList.remove("hidden");
  document.body.classList.add("modal-open");
  if (title) title.textContent = mode === "edit" ? "Edit Minifig" : "Add Minifig";
}

function hideFigureForm() {
  const panel = $("#figureFormPanel");
  if (!panel) return;
  panel.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function clearQueuedFigureImages() {
  queuedFigureImageUrls.forEach(url => URL.revokeObjectURL(url));
  queuedFigureImageUrls = [];
  queuedFigureImageFiles = [];
  const box = $("#figureQueuedImages");
  if (box) box.innerHTML = "";
  const input = $("#figureImages");
  if (input) input.value = "";
}

function renderQueuedFigureImages() {
  const box = $("#figureQueuedImages");
  if (!box) return;

  queuedFigureImageUrls.forEach(url => URL.revokeObjectURL(url));
  queuedFigureImageUrls = [];
  const files = queuedFigureImageFiles;
  if (!files.length) return;

  box.innerHTML = `
    <div class="figure-upload-queue-head">
      <strong>${files.length} image${files.length === 1 ? "" : "s"} queued</strong>
      <span>Image 1 is added first and becomes the default carousel image for new minifigs.</span>
    </div>
    <div class="figure-upload-preview-grid">
      ${files.map((file, index) => {
        const url = URL.createObjectURL(file);
        queuedFigureImageUrls.push(url);
        return `
          <figure class="figure-upload-preview">
            <span class="figure-upload-order">${index + 1}</span>
            <button class="figure-upload-remove" type="button" data-remove-queued-image="${index}" aria-label="Remove ${esc(file.name)}">
              <span class="material-symbols-outlined">close</span>
            </button>
            <img src="${esc(url)}" alt="">
            <figcaption>${esc(file.name)}</figcaption>
          </figure>
        `;
      }).join("")}
    </div>
  `;
}

function queueFigureImagesFromInput() {
  const input = $("#figureImages");
  if (!input) return;
  queuedFigureImageFiles.push(...Array.from(input.files || []));
  input.value = "";
  renderQueuedFigureImages();
}

function removeQueuedFigureImage(index) {
  queuedFigureImageFiles.splice(index, 1);
  renderQueuedFigureImages();
}

function splitMonthYear(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})/);
  return match ? { year: match[1], month: match[2] } : { year: "", month: "" };
}

function setShippingMonth(prefix, value) {
  const parts = splitMonthYear(value);
  const month = $(`#${prefix}Month`);
  const year = $(`#${prefix}Year`);
  const hidden = $(`#${prefix}`);
  if (month) month.value = parts.month;
  if (year) year.value = parts.year;
  if (hidden) hidden.value = parts.year && parts.month ? `${parts.year}-${parts.month}` : "";
}

function shippingMonthValue(prefix) {
  const month = $(`#${prefix}Month`)?.value || "";
  const year = String($(`#${prefix}Year`)?.value || "").trim();
  const value = month && year ? `${year}-${month}` : "";
  const hidden = $(`#${prefix}`);
  if (hidden) hidden.value = value;
  return value;
}

function showAnnouncementForm(mode = "add") {
  const panel = $("#announcementFormPanel");
  const title = $("#announcementFormTitle");
  if (!panel) return;

  panel.classList.remove("hidden");
  if (title) title.textContent = mode === "edit" ? "Edit Alert Banner" : "Add Alert Banner";
}

function hideAnnouncementForm() {
  const panel = $("#announcementFormPanel");
  if (!panel) return;
  panel.classList.add("hidden");
}

function preventUnsafeAdminFormSubmits() {
  const sensitiveParams = ["password", "adminPassword", "email", "adminEmail"];
  if (sensitiveParams.some(key => new URLSearchParams(window.location.search).has(key))) {
    history.replaceState({}, document.title, `${window.location.pathname}${window.location.hash || ""}`);
  }

  if (document.body.dataset.page !== "admin") return;

  $all("form").forEach(form => {
    form.setAttribute("method", "post");
    if (!form.getAttribute("action")) form.setAttribute("action", "javascript:void(0)");
    form.addEventListener("submit", event => event.preventDefault(), { capture: true });
  });
}

function initAdmin() {
  if (document.body.dataset.page !== "admin") return;

  const login = $("#adminLoginPanel");
  const dashboard = $("#adminDashboard");

  if (isAdmin()) {
    login.classList.add("hidden");
    dashboard.classList.remove("hidden");
    refreshAdminSession().then(() => {
      if (!isAdmin()) return;
      initAccountPanel();
      updateAdminDisplayName();
      renderAdminFigures();
      renderAdminOrders();
      renderAdminCustomers();
      renderAdminWaitlist();
      renderSiteSettings();
      renderStripeSecretStatus();
      renderEmailSmtpStatus();
      renderAnnouncements();
      renderStatusRibbons();
      renderAudit();
    });
  }

  $("#adminOrderFilter")?.addEventListener("change", renderAdminOrders);
  $("#clearTestOrders")?.addEventListener("click", clearTestOrders);

  $("#adminLoginForm")?.addEventListener("submit", async event => {
    event.preventDefault();
    const message = $("#adminLoginMessage");
    message.textContent = "Signing in...";

    try {
      await adminLogin($("#adminEmail").value.trim(), $("#adminPassword").value);
      location.reload();
    } catch (error) {
      message.textContent = "Login failed. Use your site admin email and password.";
      message.className = "admin-help-text error";
    }
  });
  $("#showAdminPassword")?.addEventListener("change", event => {
    const password = $("#adminPassword");
    if (password) password.type = event.currentTarget.checked ? "text" : "password";
  });

  $("#adminLogout")?.addEventListener("click", logout);
  $("#adminLogoutInline")?.addEventListener("click", logout);
  $("#accountForm")?.addEventListener("submit", saveAccount);
  $("#updateStripeServerKey")?.addEventListener("click", saveStripeServerKey);
  $("#updateStripeWebhookSecret")?.addEventListener("click", saveStripeWebhookSecret);
  $("#clearStripeServerKey")?.addEventListener("click", clearStripeServerKey);
  $("#clearStripeWebhookSecret")?.addEventListener("click", clearStripeWebhookSecret);
  $("#updateStripeTestServerKey")?.addEventListener("click", saveStripeTestServerKey);
  $("#updateStripeTestWebhookSecret")?.addEventListener("click", saveStripeTestWebhookSecret);
  $("#clearStripeTestServerKey")?.addEventListener("click", clearStripeTestServerKey);
  $("#clearStripeTestWebhookSecret")?.addEventListener("click", clearStripeTestWebhookSecret);
  $("#saveEmailSmtp")?.addEventListener("click", saveEmailSmtp);
  $("#clearEmailSmtp")?.addEventListener("click", clearEmailSmtp);
  $("#sendTestEmail")?.addEventListener("click", sendTestEmail);
  $("#refreshEmailCenter")?.addEventListener("click", renderEmailCenter);
  $("#composeEmail")?.addEventListener("click", () => openEmailCompose());
  $("#closeEmailCompose")?.addEventListener("click", closeEmailCompose);
  $("#minimizeEmailCompose")?.addEventListener("click", () => $("#emailComposeModal")?.classList.toggle("is-minimized"));
  $("#fullscreenEmailCompose")?.addEventListener("click", () => $("#emailComposeModal")?.classList.toggle("is-fullscreen"));
  $("#discardEmailCompose")?.addEventListener("click", () => {
    if (editingEmailDraftId) {
      saveEmailDrafts(emailDrafts().filter(item => item.id !== editingEmailDraftId));
      editingEmailDraftId = "";
      showAdminToast("Draft discarded.");
      emailCenterState.mailbox = "drafts";
      emailCenterState.selectedId = "";
      renderEmailList();
    }
    clearEmailCompose();
    closeEmailCompose();
  });
  $("#saveEmailDraft")?.addEventListener("click", saveCurrentEmailDraft);
  $("#sendManualEmail")?.addEventListener("click", sendManualEmail);
  $("#chooseEmailAttachments")?.addEventListener("click", () => $("#manualEmailAttachments")?.click());
  $("#manualEmailAttachments")?.addEventListener("change", event => {
    addEmailAttachments(event.currentTarget.files);
    event.currentTarget.value = "";
  });
  $("#closeEmailLinkOrder")?.addEventListener("click", closeEmailLinkOrder);
  $("#saveEmailOrderLink")?.addEventListener("click", saveEmailOrderLink);
  $("#manualEmailOrder")?.addEventListener("change", () => {
    const order = selectedComposeOrder();
    if (!order) return;
    if ($("#manualEmailTo") && order.customer_email) $("#manualEmailTo").value = order.customer_email;
    if ($("#manualEmailSubject") && order.order_number && !$("#manualEmailSubject").value) {
      $("#manualEmailSubject").value = `Update for ${order.order_number}`;
    }
  });
  $all("[data-email-format]").forEach(button => {
    button.addEventListener("click", () => execEmailFormat(button.dataset.emailFormat));
  });
  $("#emailBlockFormat")?.addEventListener("change", event => setEmailBlockFormat(event.currentTarget.value));
  $("#emailFontSizeCustom")?.addEventListener("input", event => {
    event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 3);
  });
  $("#emailFontSizeCustom")?.addEventListener("change", event => {
    if (!/\d/.test(event.currentTarget.value || "")) {
      updateEmailToolbarState();
      return;
    }
    const size = clampEmailFontSize(event.currentTarget.value || 16);
    event.currentTarget.value = size;
    setEmailFontSize(`${size}px`);
  });
  $("#emailFontSizeCustom")?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      if (!/\d/.test(event.currentTarget.value || "")) {
        updateEmailToolbarState();
        return;
      }
      const size = clampEmailFontSize(event.currentTarget.value || 16);
      event.currentTarget.value = size;
      setEmailFontSize(`${size}px`);
    }
  });
  $("#emailFontSizeToggle")?.addEventListener("click", event => {
    event.stopPropagation();
    $("#emailFontSizeMenu")?.classList.toggle("hidden");
  });
  $all("[data-email-size]").forEach(button => {
    button.addEventListener("click", () => {
      const size = clampEmailFontSize(button.dataset.emailSize || 16);
      $("#emailFontSizeCustom").value = size;
      setEmailFontSize(`${size}px`);
      $("#emailFontSizeMenu")?.classList.add("hidden");
    });
  });
  $("[data-email-template-menu]")?.addEventListener("click", event => {
    event.stopPropagation();
    toggleEmailTemplateMenu();
  });
  $("#applyEmailLink")?.addEventListener("click", applyEmailLink);
  $("#cancelEmailLink")?.addEventListener("click", closeEmailPopovers);
  $("#emailLinkUrl")?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyEmailLink();
    }
    if (event.key === "Escape") closeEmailPopovers();
  });
  $("#emailComposeModal")?.addEventListener("click", event => {
    if (!event.target.closest(".inbox-compose-popover") && !event.target.closest(".inbox-size-control") && !event.target.closest("[data-email-template-menu]") && !event.target.closest('[data-email-format="createLink"]')) {
      closeEmailPopovers();
      $("#emailFontSizeMenu")?.classList.add("hidden");
    }
  });
  emailEditor()?.addEventListener("keyup", saveEmailSelection);
  emailEditor()?.addEventListener("mouseup", saveEmailSelection);
  emailEditor()?.addEventListener("input", () => {
    saveEmailSelection();
    updateEmailToolbarState();
  });
  emailEditor()?.addEventListener("paste", event => {
    const html = event.clipboardData?.getData("text/html") || "";
    const text = event.clipboardData?.getData("text/plain") || "";
    if (!html && !text) return;
    event.preventDefault();
    const safe = html ? sanitizeUpdateHtml(html) : esc(text).replace(/\r?\n/g, "<br>");
    document.execCommand("insertHTML", false, safe);
    saveEmailSelection();
    updateEmailToolbarState();
  });
  emailEditor()?.addEventListener("keyup", updateEmailToolbarState);
  emailEditor()?.addEventListener("mouseup", updateEmailToolbarState);
  document.addEventListener("selectionchange", updateEmailToolbarState);
  $all(".inbox-mailbox").forEach(button => {
    button.addEventListener("click", () => {
      emailCenterState.mailbox = button.dataset.mailbox || "inbox";
      emailCenterState.selectedId = "";
      setMobileInboxReading(false);
      renderEmailList();
    });
  });

  $all(".admin-option[data-view]").forEach(tab => {
    tab.addEventListener("click", () => {
      $all(".admin-option[data-view]").forEach(item => item.classList.remove("active"));
      $all(".admin-view").forEach(item => item.classList.remove("active"));

      tab.classList.add("active");
      $(`#${tab.dataset.view}`)?.classList.add("active");
      if (tab.dataset.view === "inboxView") renderEmailCenter();
    });
  });

  $("#openFigureForm")?.addEventListener("click", () => {
    $("#figureForm")?.reset();
    $("#figureRecordId").value = "";
    clearQueuedFigureImages();
    renderFigureRibbonChoices([]);
    fillVariantForm({});
    showFigureForm("add");
  });

  $("#closeFigureForm")?.addEventListener("click", hideFigureForm);
  $("#figureImages")?.addEventListener("change", queueFigureImagesFromInput);
  $("#figureQueuedImages")?.addEventListener("click", event => {
    const remove = event.target.closest("[data-remove-queued-image]");
    if (!remove) return;
    removeQueuedFigureImage(Number(remove.dataset.removeQueuedImage));
  });
  $("#addFigureVariant")?.addEventListener("click", addFigureVariantCard);
  $("#figureVariantList")?.addEventListener("click", event => {
    const remove = event.target.closest("[data-remove-figure-variant]");
    if (!remove) return;
    remove.closest("[data-figure-variant-card]")?.remove();
    if (!$("#figureVariantList")?.querySelector("[data-figure-variant-card]")) renderVariantCards({ variants_json: { dots: [] } });
  });

  $("#figureForm")?.addEventListener("submit", saveFigure);
  $("#refreshWaitlist")?.addEventListener("click", renderAdminWaitlist);
  $("#siteSettingsForm")?.addEventListener("submit", event => event.preventDefault());
  initSettingsSectionTabs();
  $("#saveShippingSettings")?.addEventListener("click", saveShippingSettings);
  $("#saveCatalogueSettings")?.addEventListener("click", saveCatalogueSettings);
  $("#saveStripePublishableKey")?.addEventListener("click", saveStripePublishableKey);
  $("#saveStripeTestPublishableKey")?.addEventListener("click", saveStripeTestPublishableKey);
  $("#stripeTestMode")?.addEventListener("change", saveStripeMode);
  $("#saveRibbonRuleSettings")?.addEventListener("click", saveRibbonRuleSettings);
  $all("[data-reset-site-settings]").forEach(button => button.addEventListener("click", renderSiteSettings));
  $("#previewEnabled")?.addEventListener("change", savePreviewSettings);
  $("#previewWhitelist")?.addEventListener("change", savePreviewSettings);
  $("#announcementForm")?.addEventListener("submit", saveAnnouncement);
  $("#clearAnnouncementForm")?.addEventListener("click", clearAnnouncementForm);
  $("#openAnnouncementForm")?.addEventListener("click", () => {
    clearAnnouncementForm();
    showAnnouncementForm("add");
    updateAnnouncementPreview();
  });
  $("#closeAnnouncementForm")?.addEventListener("click", hideAnnouncementForm);
  $("#openRibbonForm")?.addEventListener("click", () => {
    clearRibbonForm();
    $("#ribbonFormPanel")?.classList.remove("hidden");
    loadRibbonPreviewImage();
    updateRibbonPreview();
  });
  $("#closeRibbonForm")?.addEventListener("click", () => {
    $("#ribbonFormPanel")?.classList.add("hidden");
  });
  $("#clearRibbonForm")?.addEventListener("click", clearRibbonForm);
  $("#ribbonForm")?.addEventListener("submit", saveRibbon);
  setupAdminEditors();

  $("#clearFigureForm")?.addEventListener("click", () => {
    $("#figureForm").reset();
    $("#figureRecordId").value = "";
    $("#figureFormTitle").textContent = "Add Minifig";
    clearQueuedFigureImages();
    fillVariantForm({});
  });
}

function initAccountPanel() {
  const admin = currentAdmin();
  const actualName = admin.name || admin.username || admin.displayName || "";
  const label = actualName || "Account";
  if ($("#adminAccountName")) $("#adminAccountName").textContent = label;
  if ($("#accountName")) $("#accountName").value = actualName;
  if ($("#accountEmail")) $("#accountEmail").value = admin.email || "";
}

async function resolveAdminDisplayName() {
  const admin = currentAdmin();
  const existingName = admin.name || admin.username || admin.displayName || "";
  if (existingName) return existingName;
  if (!admin.email) return "";

  try {
    const data = await api(`/api/collections/admin_users/records?filter=${encodeURIComponent(`email = "${admin.email}"`)}&perPage=1`, {
      headers: authHeaders()
    });
    const namedRecord = data.items?.[0];
    if (!namedRecord?.name) return "";
    localStorage.setItem(ADMIN_USER, JSON.stringify({ ...admin, name: namedRecord.name }));
    return namedRecord.name;
  } catch {
    return "";
  }
}

async function updateAdminDisplayName() {
  const name = await resolveAdminDisplayName();
  if ($("#adminAccountName")) $("#adminAccountName").textContent = name || "Account";
  if ($("#accountName") && name && !$("#accountName").value) $("#accountName").value = name;
  renderAdminAvatarLinks();
}

async function saveAccount(event) {
  event.preventDefault();

  const admin = currentAdmin();
  const message = $("#accountFormMessage");
  const password = $("#accountPassword").value;
  const passwordConfirm = $("#accountPasswordConfirm").value;
  const avatarFile = $("#accountAvatar")?.files?.[0];

  if (password || passwordConfirm) {
    if (password !== passwordConfirm) {
      message.textContent = "Passwords do not match.";
      message.className = "admin-help-text error";
      return;
    }
  }

  const formData = new FormData();
  formData.append("name", $("#accountName").value.trim());
  formData.append("email", $("#accountEmail").value.trim());

  if (password) {
    formData.append("password", password);
    formData.append("passwordConfirm", passwordConfirm);
  }

  if (avatarFile) {
    formData.append("avatar", avatarFile);
  }

  try {
    const updated = await api(`/api/collections/admin_users/records/${admin.id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: formData
    });
    localStorage.setItem(ADMIN_USER, JSON.stringify(updated));
    $("#accountPassword").value = "";
    $("#accountPasswordConfirm").value = "";
    if ($("#accountAvatar")) $("#accountAvatar").value = "";
    initAccountPanel();
    renderAdminAvatarLinks();
    message.textContent = "Account updated.";
    message.className = "admin-help-text";
    showAdminToast("Account updated.");
  } catch (error) {
    message.textContent = error.message || "Account could not be updated.";
    message.className = "admin-help-text error";
    showAdminToast(error.message || "Account could not be updated.", "error");
  }
}

async function renderAdminFigures() {
  const list = $("#adminFigureList");
  if (!list) return;
  const figures = await getFigures({ admin: true });
  list.innerHTML = figures.map(figure => `
    <div class="admin-row">
      <div class="admin-row-head"><strong>${esc(figure.name)}</strong><span>${statusLabel(statusFor(figure.status, figure.quantity))}</span></div>
      <span>${moneyLabel(figure.price, figure.currency)} | ${Number(figure.quantity || 0)} remaining</span>
      <div class="inline-actions">
        <button class="btn small" data-edit="${esc(figure.id)}">Edit</button>
        <button class="btn small danger" data-delete="${esc(figure.id)}">Delete</button>
      </div>
    </div>
  `).join("");
  $all("[data-edit]").forEach(button => button.addEventListener("click", () => fillFigure(figures.find(figure => figure.id === button.dataset.edit))));
  $all("[data-delete]").forEach(button => button.addEventListener("click", () => deleteFigure(button.dataset.delete)));
}

function fillFigure(figure) {
  if (!figure) return;

  showFigureForm("edit");

  $("#figureRecordId").value = figure.id;
  $("#figureName").value = figure.name || "";
  $("#figureSlug").value = figure.slug || "";
  $("#figureQuote").value = figure.quote || "";
  $("#figureShortDescription").value = figure.short_description || "";
  $("#figureContents").value = Array.isArray(figure.contents) ? figure.contents.join("\n") : "";
  $("#figureQuantity").value = figure.quantity ?? 0;
  $("#figurePrice").value = figure.price ?? 45;
  $("#figureCurrency").value = figure.currency || "usd";
  $("#figureStatus").value = figure.status || "available";
  $("#figureCategory").value = figure.category || "";
  $("#figureTags").value = figure.tags || "";
  setShippingMonth("figureEstimatedShippingStart", figure.estimated_shipping_start);
  setShippingMonth("figureEstimatedShippingEnd", figure.estimated_shipping_end);
  clearQueuedFigureImages();
  renderFigureRibbonChoices(figure.manual_ribbons || []);
  fillVariantForm(figure);
}

async function saveFigure(event) {
  event.preventDefault();
  const id = $("#figureRecordId").value;
  const imageFiles = queuedFigureImageFiles.slice();
  const variants = variantFormToJson();
  if (!id && imageFiles.length && !variants.cycle.length) variants.cycle = [0];
  const payload = {
    name: $("#figureName").value.trim(),
    slug: $("#figureSlug").value.trim(),
    quote: $("#figureQuote").value.trim(),
    description: $("#figureQuote").value.trim() || $("#figureShortDescription").value.trim() || "Custom UV printed minifigure release.",
    short_description: $("#figureShortDescription").value.trim(),
    contents: $("#figureContents").value.split(/\r?\n/).map(line => line.trim()).filter(Boolean),
    variants_json: variants,
    quantity: Number($("#figureQuantity").value || 0),
    price: Number($("#figurePrice").value || 0),
    currency: $("#figureCurrency").value || "usd",
    status: $("#figureStatus").value,
    estimated_shipping_start: shippingMonthValue("figureEstimatedShippingStart"),
    estimated_shipping_end: shippingMonthValue("figureEstimatedShippingEnd"),
    visible: true,
    manual_ribbons: selectedFigureRibbons(),
    category: $("#figureCategory").value.trim(),
    tags: $("#figureTags").value.trim()
  };
  const message = $("#figureFormMessage");
  try {
    const options = {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload)
    };

    if (imageFiles.length) {
      const formData = new FormData();
      Object.entries(payload).forEach(([key, value]) => {
        formData.append(key, typeof value === "object" ? JSON.stringify(value) : value);
      });
      imageFiles.forEach(file => formData.append(id ? "images+" : "images", file));
      options.headers = authHeaders();
      options.body = formData;
    }

    await api(id ? `/api/collections/minifigs/records/${id}` : "/api/collections/minifigs/records", {
      ...options
    });
    message.textContent = "Figure saved.";
    message.className = "notice success";
    $("#figureForm").reset();
    $("#figureRecordId").value = "";
    $("#figureFormTitle").textContent = "Add Minifig";
    clearQueuedFigureImages();
    hideFigureForm();
    showAdminToast("Figure saved.");
    renderAdminFigures();
  } catch (error) {
    message.textContent = error.message || "Figure could not be saved.";
    message.className = "notice error";
    showAdminToast(error.message || "Figure could not be saved.", "error");
  }
}

async function getAnnouncements() {
  const data = await api("/api/collections/announcements/records", { headers: authHeaders() });
  return data.items || [];
}

function clearAnnouncementForm() {
  $("#announcementForm")?.reset();
  $("#announcementRecordId").value = "";
  $("#announcementBgColor").value = "#000000";
  $("#announcementTextColor").value = "#ffffff";
  $("#announcementGlowColor").value = "#48bcff";
  $("#announcementScrollEnabled").checked = true;
  $("#announcementScrollSpeed").value = 28;
  $("#announcementTextGlowEnabled").checked = true;
  $("#announcementBannerGlowEnabled").checked = false;
  $("#announcementTextGlowIntensity").value = 6;
  $("#announcementBannerGlowIntensity").value = 0;
  $("#announcementFormTitle").textContent = "Add Alert Banner";
  $("#announcementFormMessage").textContent = "";
  $("#announcementFormMessage").className = "admin-help-text";
  updateAnnouncementPreview();
}

function fillAnnouncement(record) {
  $("#announcementRecordId").value = record.id;
  $("#announcementText").value = record.text || "";
  $("#announcementBgColor").value = record.bg_color || "#000000";
  $("#announcementTextColor").value = record.text_color || "#ffffff";
  $("#announcementGlowColor").value = record.glow_color || "#48bcff";
  $("#announcementScrollEnabled").checked = record.scroll_enabled !== false;
  $("#announcementScrollSpeed").value = record.scroll_speed || 28;
  $("#announcementTextGlowEnabled").checked = record.text_glow_enabled !== false;
  $("#announcementBannerGlowEnabled").checked = Boolean(record.banner_glow_enabled);
  $("#announcementTextGlowIntensity").value = record.text_glow_intensity ?? 6;
  $("#announcementBannerGlowIntensity").value = record.banner_glow_intensity ?? 0;
  $("#announcementActive").checked = Boolean(record.active);
  showAnnouncementForm("edit");
  updateAnnouncementPreview();
}

async function saveAnnouncement(event) {
  event.preventDefault();
  const id = $("#announcementRecordId").value;
  const active = $("#announcementActive").checked;
  const payload = {
    text: $("#announcementText").value.trim(),
    bg_color: $("#announcementBgColor").value || "#000000",
    text_color: $("#announcementTextColor").value || "#ffffff",
    glow_color: $("#announcementGlowColor").value || "#48bcff",
    scroll_enabled: $("#announcementScrollEnabled").checked,
    scroll_speed: Number($("#announcementScrollSpeed").value || 28),
    text_glow_enabled: $("#announcementTextGlowEnabled").checked,
    banner_glow_enabled: $("#announcementBannerGlowEnabled").checked,
    text_glow_intensity: Number($("#announcementTextGlowIntensity").value || 6),
    banner_glow_intensity: Number($("#announcementBannerGlowIntensity").value || 0),
    active
  };
  const message = $("#announcementFormMessage");

  try {
    if (active) {
      const announcements = await getAnnouncements();
      await Promise.all(announcements
        .filter(item => item.id !== id && item.active)
        .map(item => api(`/api/collections/announcements/records/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ active: false })
        })));
    }

    await api(id ? `/api/collections/announcements/records/${id}` : "/api/collections/announcements/records", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload)
    });

    clearAnnouncementForm();
    hideAnnouncementForm();
    message.textContent = "Alert banner saved.";
    showAdminToast("Alert banner saved.");
    renderAnnouncements();
    initAnnouncementBar();
  } catch (error) {
    message.textContent = error.message || "Alert banner could not be saved.";
    message.className = "admin-help-text error";
    showAdminToast(error.message || "Alert banner could not be saved.", "error");
  }
}

async function deleteAnnouncement(id) {
  if (!id || !confirm("Delete this alert banner?")) return;
  await fetch(`${PB_URL}/api/collections/announcements/records/${id}`, { method: "DELETE", headers: authHeaders() });
  showAdminToast("Alert banner deleted.");
  renderAnnouncements();
  initAnnouncementBar();
}

function setupAdminEditors() {
  setupEditorTabs();

  ["ribbonForm", "announcementForm"].forEach(formId => {
    const form = $(`#${formId}`);
    if (!form || form.dataset.previewReady) return;

    form.dataset.previewReady = "true";
    form.addEventListener("input", () => {
      updateColorValueLabels(form);
      if (formId === "ribbonForm") updateRibbonPreview();
      if (formId === "announcementForm") updateAnnouncementPreview();
    });
    form.addEventListener("change", () => {
      updateColorValueLabels(form);
      if (formId === "ribbonForm") updateRibbonPreview();
      if (formId === "announcementForm") updateAnnouncementPreview();
    });
  });

  updateColorValueLabels(document);
  loadRibbonPreviewImage();
  updateRibbonPreview();
  updateAnnouncementPreview();
}

function setupEditorTabs() {
  $all(".admin-editor-layout").forEach(layout => {
    if (layout.dataset.tabsReady) return;
    layout.dataset.tabsReady = "true";

    const tabs = $all(".admin-editor-tab", layout);
    const sections = $all(".editor-section-card", layout);
    const content = $(".admin-editor-content", layout);
    if (!tabs.length || !sections.length || !content) return;

    const setActive = index => {
      tabs.forEach((item, itemIndex) => {
        item.classList.toggle("active", itemIndex === index);
      });
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => {
        const section = sections[index];
        if (!section) return;

        content.scrollTo({
          top: section.offsetTop - content.offsetTop,
          behavior: "smooth"
        });

        setActive(index);
      });
    });

    let scrollFrame = null;

    content.addEventListener("scroll", () => {
      if (scrollFrame) cancelAnimationFrame(scrollFrame);

      scrollFrame = requestAnimationFrame(() => {
        const contentTop = content.getBoundingClientRect().top;
        let activeIndex = 0;
        let bestDistance = Infinity;

        sections.forEach((section, index) => {
          const distance = Math.abs(section.getBoundingClientRect().top - contentTop - 8);
          if (distance < bestDistance) {
            bestDistance = distance;
            activeIndex = index;
          }
        });

        setActive(activeIndex);
      });
    }, { passive: true });
  });
}

function updateColorValueLabels(root = document) {
  $all("[data-color-value-for]", root).forEach(label => {
    const input = $(`#${label.dataset.colorValueFor}`);
    if (input) label.textContent = String(input.value || "").toUpperCase();
  });
}

async function loadRibbonPreviewImage() {
  const image = $("#ribbonPreviewImage");
  if (!image || image.dataset.loaded) return;

  image.dataset.loaded = "true";

  try {
    const data = await api(`/api/collections/minifigs/records?perPage=50`, { headers: authHeaders() });
    const newest = [...(data.items || [])].sort((a, b) => String(b.created || "").localeCompare(String(a.created || "")))[0];
    const figure = newest ? normalizeFigure(newest) : null;
    image.src = figure ? imageFor(figure) : localAsset(MISSING_IMAGE);
  } catch {
    image.src = localAsset(MISSING_IMAGE);
  }
}

function updateRibbonPreview() {
  updateColorValueLabels($("#ribbonForm") || document);

  const previewFigure = $(".ribbon-preview-figure");
  const ribbon = $(".ribbon-preview-figure .status-ribbon");
  if (!ribbon || !previewFigure) return;

  const label = $("#ribbonLabel")?.value.trim() || "SOLD OUT";
  const position = $("#ribbonPosition")?.value || "top_right_diagonal";
  const backgroundType = $("#ribbonBackgroundType")?.value || "solid";

  const bgTransparent = $("#ribbonBgTransparent")?.checked;
  const borderTransparent = $("#ribbonBorderTransparent")?.checked;

  const bg1 = bgTransparent ? "transparent" : ($("#ribbonBg1")?.value || "#ff3218");
  const bg2 = bgTransparent ? "transparent" : ($("#ribbonBg2")?.value || bg1);
  const border = borderTransparent ? "transparent" : ($("#ribbonBorderColor")?.value || "#000000");

  const ribbonGlow = $("#ribbonGlowEnabled")?.checked ? ($("#ribbonGlowColor")?.value || "#ff3218") : "transparent";
  const textGlow = $("#ribbonTextGlowEnabled")?.checked ? ($("#ribbonTextGlowColor")?.value || "#000000") : "transparent";

  const angle = Number($("#ribbonAngle")?.value || 45);
  const width = Number($("#ribbonWidth")?.value || 148);
  const height = Number($("#ribbonHeight")?.value || 26);

  const overlayEnabled = $("#ribbonOverlayEnabled")?.checked;
  const overlayColor = $("#ribbonOverlayColor")?.value || "#808080";
  const overlayOpacity = Number($("#ribbonOverlayOpacity")?.value || 0.35);

  ribbon.className = `status-ribbon ribbon-${position.replaceAll("_", "-")}`;
  ribbon.textContent = label;

  ribbon.style.setProperty("--ribbon-width", `${width}px`);
  ribbon.style.setProperty("--ribbon-height", `${height}px`);
  ribbon.style.setProperty("--ribbon-angle", `${angle}deg`);
  ribbon.style.setProperty("--ribbon-angle-negative", `${-angle}deg`);
  ribbon.style.setProperty("--ribbon-bg", bg1);
  ribbon.style.setProperty("--ribbon-bg-2", bg2);
  ribbon.style.setProperty("--ribbon-background", ribbonBackgroundCss(backgroundType, bg1, bg2));
  ribbon.style.setProperty("--ribbon-text", $("#ribbonTextColor")?.value || "#ffffff");
  ribbon.style.setProperty("--ribbon-border", border);
  ribbon.style.setProperty("--ribbon-glow", ribbonGlow);
  ribbon.style.setProperty("--ribbon-text-glow", textGlow);

  ribbon.style.fontFamily = $("#ribbonFontFamily")?.value.trim() || "Share Tech Mono";
  ribbon.style.fontWeight = String(Number($("#ribbonFontWeight")?.value || 700));
  ribbon.style.fontSize = `${Number($("#ribbonFontSize")?.value || 13)}px`;
  ribbon.style.letterSpacing = `${Number($("#ribbonLetterSpacing")?.value || 1.2)}px`;

  previewFigure.style.setProperty("--preview-overlay-color", overlayColor);
  previewFigure.style.setProperty("--preview-overlay-opacity", overlayEnabled ? overlayOpacity : 0);
}

function updateAnnouncementPreview() {
  updateColorValueLabels($("#announcementForm") || document);

  const preview = $(".alert-preview-banner");
  const textEl = $("#alertPreviewText");
  if (!preview || !textEl) return;

  const text = $("#announcementText")?.value.trim() || "Test text for the scrolling alert banner!";
  const bg = $("#announcementBgColor")?.value || "#000000";
  const color = $("#announcementTextColor")?.value || "#ffffff";
  const glow = $("#announcementGlowColor")?.value || "#48bcff";
  const textGlow = $("#announcementTextGlowEnabled")?.checked;
  const bannerGlow = $("#announcementBannerGlowEnabled")?.checked;
  const textGlowIntensity = Number($("#announcementTextGlowIntensity")?.value || 6);
  const bannerGlowIntensity = Number($("#announcementBannerGlowIntensity")?.value || 0);
  const scrollEnabled = $("#announcementScrollEnabled")?.checked;
  const scrollSpeed = Number($("#announcementScrollSpeed")?.value || 28);

  textEl.textContent = text;

  preview.style.background = bg;
  preview.style.color = color;
  preview.style.boxShadow = bannerGlow ? `0 0 ${bannerGlowIntensity || 10}px ${glow}` : "none";

  textEl.style.textShadow = textGlow ? `0 0 ${textGlowIntensity}px ${glow}, 0 0 ${textGlowIntensity * 2}px ${glow}` : "none";
  textEl.classList.toggle("scrolling", Boolean(scrollEnabled));
  textEl.style.animationDuration = `${scrollSpeed}s`;
}

async function renderAnnouncements() {
  const list = $("#announcementList");
  if (!list) return;

  try {
    const announcements = await getAnnouncements();
    list.innerHTML = announcements.map(item => `
      <div class="admin-row">
        <div class="admin-row-head">
          <strong>${esc(item.text)}</strong>
          <span>${item.active ? "Active" : "Inactive"} · ${esc(item.updated || "")}</span>
        </div>
        <div class="inline-actions">
          <button class="btn small" data-edit-announcement="${esc(item.id)}">Edit</button>
          <button class="btn small danger" data-delete-announcement="${esc(item.id)}">Delete</button>
        </div>
      </div>
    `).join("") || `<div class="notice">No alert banners yet.</div>`;
    $all("[data-edit-announcement]").forEach(button => {
      button.addEventListener("click", () => fillAnnouncement(announcements.find(item => item.id === button.dataset.editAnnouncement)));
    });
    $all("[data-delete-announcement]").forEach(button => {
      button.addEventListener("click", () => deleteAnnouncement(button.dataset.deleteAnnouncement));
    });
  } catch {
    list.innerHTML = `<div class="notice">Alert banners will appear here once permissions are ready.</div>`;
  }
}

async function getStatusRibbonsAdmin() {
  const data = await api("/api/collections/status_ribbons/records?sort=-priority&perPage=200", { headers: authHeaders() });
  return data.items || [];
}

async function ensureAdminRibbonCache() {
  if (adminRibbonCache.length) return adminRibbonCache;
  adminRibbonCache = await getStatusRibbonsAdmin();
  return adminRibbonCache;
}

async function renderFigureRibbonChoices(selected = []) {
  const box = $("#figureManualRibbons");
  if (!box) return;

  const ribbons = await ensureAdminRibbonCache();
  const selectedSet = new Set(Array.isArray(selected) ? selected : []);

  box.innerHTML = ribbons.length ? ribbons.map(ribbon => `
    <label class="check-row">
      <input type="checkbox" value="${esc(ribbon.id)}" ${selectedSet.has(ribbon.id) ? "checked" : ""}>
      ${esc(ribbon.label)}
    </label>
  `).join("") : `<span class="admin-muted">No ribbons have been created yet.</span>`;
}

function selectedFigureRibbons() {
  return $all("#figureManualRibbons input:checked").map(input => input.value);
}

function renderImageIndexList(figure = {}) {
  const box = $("#figureImageList");
  if (!box) return;
  const media = figureMedia(figure);
  adminVariantMedia = media;
  box.innerHTML = media.map((src, index) => {
    const name = src.split("/").pop() || src;
    const checked = figureVariantConfig(figure).cycle.includes(index) ? " checked" : "";
    return `
      <label class="figure-image-option">
        <input class="figure-cycle-checkbox" type="checkbox" data-image-index="${index}"${checked}>
        <img src="${esc(src)}" alt="">
        <span>
          <strong>Carousel</strong>
          <small>${esc(name)}</small>
        </span>
      </label>
    `;
  }).join("") || `<p class="admin-help-text">Upload images, save the minifig, then reopen it to assign carousel images and dot variants.</p>`;
}

function imageSelectOptions(media, selected) {
  return media.map((src, index) => {
    const name = src.split("/").pop() || `Image ${index + 1}`;
    return `<option value="${index}"${Number(selected) === index ? " selected" : ""}>Image ${index + 1}: ${esc(name)}</option>`;
  }).join("");
}

function variantCardHtml(dot = {}, media = [], index = 0) {
  const image = dot.image ?? dot.src ?? dot.image_index ?? dot.index ?? 0;
  return `
    <article class="figure-variant-card" data-figure-variant-card>
      <div class="figure-variant-card-head">
        <strong>Variant ${index + 1}</strong>
        <button class="admin-icon-btn" type="button" data-remove-figure-variant aria-label="Remove variant">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="figure-variant-grid">
        <label>Dot Label <input class="field" data-variant-field="label" value="${esc(dot.label || "Variant")}"></label>
        <label>Dot Color <input class="color-field" type="color" data-variant-field="color" value="${esc(dot.color || "#7ed7ff")}"></label>
        <label class="span-2">Variant Image
          <select data-variant-field="image">${imageSelectOptions(media, image)}</select>
        </label>
        <label class="span-2">Display Name <input class="field" data-variant-field="name" value="${esc(dot.name || dot.title || "")}" placeholder="Optional name shown on the card"></label>
        <label class="span-2">Quote <textarea data-variant-field="quote" placeholder="Optional quote for this variant">${esc(dot.quote || "")}</textarea></label>
        <label class="span-2">Includes <textarea data-variant-field="contents" placeholder="One included item per line">${esc(Array.isArray(dot.contents) ? dot.contents.join("\n") : "")}</textarea></label>
      </div>
    </article>
  `;
}

function renderVariantCards(figure = {}) {
  const list = $("#figureVariantList");
  if (!list) return;
  const media = figureMedia(figure);
  const variants = figureVariantConfig(figure);
  list.innerHTML = variants.dots.length
    ? variants.dots.map((dot, index) => variantCardHtml(dot, media, index)).join("")
    : `<p class="admin-help-text">No dot variants yet. Add one when a minifig has alternate images, names, or included items.</p>`;
}

function addFigureVariantCard() {
  const list = $("#figureVariantList");
  if (!list) return;
  const media = adminVariantMedia.length ? adminVariantMedia : [localAsset(MISSING_IMAGE)];
  if (list.querySelector(".admin-help-text")) list.innerHTML = "";
  list.insertAdjacentHTML("beforeend", variantCardHtml({ label: "Variant", image: 0, color: "#7ed7ff" }, media, list.querySelectorAll("[data-figure-variant-card]").length));
}

function variantFormToJson() {
  const cycle = $all(".figure-cycle-checkbox")
    .filter(input => input.checked)
    .map(input => Number(input.dataset.imageIndex));

  const dots = $all("[data-figure-variant-card]").map(card => {
    const field = name => card.querySelector(`[data-variant-field="${name}"]`);
    const contents = (field("contents")?.value || "").split(/\r?\n/).map(line => line.trim()).filter(Boolean);
    const item = {
      label: field("label")?.value.trim() || "Variant",
      image: Number(field("image")?.value || 0),
      color: field("color")?.value || ""
    };
    const name = field("name")?.value.trim();
    const quote = field("quote")?.value.trim();
    if (name) item.name = name;
    if (quote) item.quote = quote;
    if (contents.length) item.contents = contents;
    return item;
  });

  return { cycle, dots };
}

function fillVariantForm(figure = {}) {
  const variants = figureVariantConfig(figure);
  if ($("#figureCycleImages")) $("#figureCycleImages").value = variants.cycle.join("\n");
  if ($("#figureDotVariants")) {
    $("#figureDotVariants").value = variants.dots.map(dot => [
      dot.label || "Variant",
      dot.image ?? dot.src ?? dot.image_index ?? dot.index ?? "",
      dot.color || "",
      dot.name || dot.title || "",
      Array.isArray(dot.contents) ? dot.contents.join("; ") : ""
    ].join(" | ")).join("\n");
  }
  renderImageIndexList(figure);
  renderVariantCards(figure);
}

async function getDetectedPublicPages() {
  try {
    const data = await api("/api/nemesis/public-pages");
    const paths = Array.isArray(data.items) ? data.items : [];
    if (!paths.length) return PUBLIC_PAGES;

    return paths.map(path => {
      const known = PUBLIC_PAGES.find(page => page.path === path);
      return known || {
        path,
        label: path
          .replace(/\.html$/i, "")
          .replace(/(^|\/)index$/i, "$1Home")
          .replace(/[/-]/g, " ")
          .replace(/\b\w/g, char => char.toUpperCase())
      };
    });
  } catch {
    return PUBLIC_PAGES;
  }
}

async function renderPreviewWhitelist(selected = []) {
  const box = $("#previewWhitelist");
  if (!box) return;
  const selectedSet = new Set(Array.isArray(selected) ? selected : ["index.html"]);
  const pages = await getDetectedPublicPages();
  box.innerHTML = pages.map(page => `
    <label class="check-row">
      <input type="checkbox" value="${esc(page.path)}" ${page.path === "index.html" ? "checked disabled" : selectedSet.has(page.path) ? "checked" : ""}>
      ${esc(page.label)}
    </label>
  `).join("");
}

function selectedPreviewWhitelist() {
  return [...new Set(["index.html", ...$all("#previewWhitelist input:checked").map(input => input.value)])];
}

function clearRibbonForm() {
  $("#ribbonForm")?.reset();
  $("#ribbonRecordId").value = "";
  $("#ribbonWidth").value = 148;
  $("#ribbonHeight").value = 26;
  $("#ribbonBg1").value = "#ff3218";
  $("#ribbonBg2").value = "#000000";
  $("#ribbonTextColor").value = "#ffffff";
  $("#ribbonBorderColor").value = "#000000";
  $("#ribbonGlowColor").value = "#ff3218";
  $("#ribbonTextGlowColor").value = "#000000";
  $("#ribbonOverlayColor").value = "#808080";
  $("#ribbonOverlayOpacity").value = 0.35;
  $("#ribbonBgTransparent").checked = false;
  $("#ribbonBorderTransparent").checked = false;
  $("#ribbonOverlayEnabled").checked = true;
  $("#ribbonEnabled").checked = true;
  $("#ribbonShowCatalogue").checked = true;
  $("#ribbonShowDetail").checked = true;
  $("#ribbonShowHomepage").checked = true;
  $("#ribbonGlowEnabled").checked = true;
  $("#ribbonTextGlowEnabled").checked = true;
  $("#ribbonFormTitle").textContent = "New Ribbon";
  updateRibbonPreview();
}

function fillRibbon(record) {
  $("#ribbonRecordId").value = record.id;
  $("#ribbonLabel").value = record.label || "";
  $("#ribbonSlug").value = record.slug || "";
  $("#ribbonCondition").value = record.condition_type || "manual_only";
  $("#ribbonPriority").value = record.priority ?? 10;
  $("#ribbonPosition").value = record.position || "top_right_diagonal";
  $("#ribbonBackgroundType").value = record.background_type || "solid";
  $("#ribbonWidth").value = record.ribbon_width || 148;
  $("#ribbonHeight").value = record.ribbon_height || 26;
  $("#ribbonBg1").value = record.background_color === "transparent" ? "#ff3218" : record.background_color || "#ff3218";
  $("#ribbonBg2").value = record.background_color_2 === "transparent" ? "#000000" : record.background_color_2 || "#000000";
  $("#ribbonTextColor").value = record.text_color || "#ffffff";
  $("#ribbonBorderColor").value = record.border_color === "transparent" ? "#000000" : record.border_color || "#000000";
  $("#ribbonGlowColor").value = record.ribbon_glow_color || "#ff3218";
  $("#ribbonTextGlowColor").value = record.text_glow_color || "#000000";
  $("#ribbonOverlayColor").value = record.overlay_color || "#808080";
  $("#ribbonOverlayOpacity").value = record.overlay_opacity ?? 0.35;
  $("#ribbonBgTransparent").checked = record.background_color === "transparent";
  $("#ribbonBorderTransparent").checked = record.border_color === "transparent";
  $("#ribbonOverlayEnabled").checked = record.overlay_enabled !== false;
  $("#ribbonFontFamily").value = record.font_family || "Share Tech Mono";
  $("#ribbonFontUrl").value = record.font_url || "";
  $("#ribbonFontWeight").value = record.font_weight || 700;
  $("#ribbonFontSize").value = record.font_size || 13;
  $("#ribbonLetterSpacing").value = record.letter_spacing || 1.2;
  $("#ribbonAngle").value = record.angle || 45;
  $("#ribbonEnabled").checked = Boolean(record.enabled);
  $("#ribbonManual").checked = Boolean(record.allow_manual_assignment);
  $("#ribbonShowCatalogue").checked = Boolean(record.show_catalogue);
  $("#ribbonShowDetail").checked = Boolean(record.show_detail);
  $("#ribbonShowHomepage").checked = Boolean(record.show_homepage);
  $("#ribbonShowCart").checked = Boolean(record.show_cart);
  $("#ribbonTextGlowEnabled").checked = Boolean(record.text_glow_enabled);
  $("#ribbonGlowEnabled").checked = Boolean(record.ribbon_glow_enabled);
  $("#ribbonFormTitle").textContent = "Edit Ribbon";
  $("#ribbonFormPanel").classList.remove("hidden");
  loadRibbonPreviewImage();
  updateRibbonPreview();
}

async function saveRibbon(event) {
  event.preventDefault();
  const id = $("#ribbonRecordId").value;
  const payload = {
    label: $("#ribbonLabel").value.trim(),
    slug: $("#ribbonSlug").value.trim(),
    enabled: $("#ribbonEnabled").checked,
    condition_type: $("#ribbonCondition").value,
    priority: Number($("#ribbonPriority").value || 10),
    allow_manual_assignment: $("#ribbonManual").checked,
    show_catalogue: $("#ribbonShowCatalogue").checked,
    show_detail: $("#ribbonShowDetail").checked,
    show_homepage: $("#ribbonShowHomepage").checked,
    show_cart: $("#ribbonShowCart").checked,
    position: $("#ribbonPosition").value,
    background_type: $("#ribbonBackgroundType").value,
    ribbon_width: Number($("#ribbonWidth").value || 148),
    ribbon_height: Number($("#ribbonHeight").value || 26),
    background_color: $("#ribbonBgTransparent").checked ? "transparent" : $("#ribbonBg1").value,
    background_color_2: $("#ribbonBgTransparent").checked ? "transparent" : $("#ribbonBg2").value,
    text_color: $("#ribbonTextColor").value,
    border_color: $("#ribbonBorderTransparent").checked ? "transparent" : $("#ribbonBorderColor").value,
    ribbon_glow_color: $("#ribbonGlowColor").value,
    text_glow_color: $("#ribbonTextGlowColor").value,
    overlay_color: $("#ribbonOverlayColor").value,
    overlay_opacity: Number($("#ribbonOverlayOpacity").value || 0.35),
    overlay_enabled: $("#ribbonOverlayEnabled").checked,
    ribbon_glow_enabled: $("#ribbonGlowEnabled").checked,
    text_glow_enabled: $("#ribbonTextGlowEnabled").checked,
    font_family: $("#ribbonFontFamily").value.trim(),
    font_url: $("#ribbonFontUrl").value.trim(),
    font_weight: Number($("#ribbonFontWeight").value || 700),
    font_size: Number($("#ribbonFontSize").value || 13),
    letter_spacing: Number($("#ribbonLetterSpacing").value || 1.2),
    angle: Number($("#ribbonAngle").value || 45),
    text_transform: "uppercase"
  };

  try {
    await api(id ? `/api/collections/status_ribbons/records/${id}` : "/api/collections/status_ribbons/records", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload)
    });
    adminRibbonCache = [];
    $("#ribbonFormPanel").classList.add("hidden");
    clearRibbonForm();
    showAdminToast("Ribbon saved.");
    renderStatusRibbons();
    renderFigureRibbonChoices(selectedFigureRibbons());
  } catch (error) {
    $("#ribbonFormMessage").textContent = error.message || "Ribbon could not be saved.";
    $("#ribbonFormMessage").className = "admin-help-text error";
    showAdminToast(error.message || "Ribbon could not be saved.", "error");
  }
}

async function renderStatusRibbons() {
  const list = $("#statusRibbonList");
  if (!list) return;

  try {
    const ribbons = await getStatusRibbonsAdmin();
  list.innerHTML = ribbons.map(item => `
    <div class="admin-row">
      <div class="admin-row-head">
        <strong>${esc(item.label)}</strong>
        <span>${esc(item.condition_type)} · Priority ${Number(item.priority || 0)} · ${item.enabled ? "Enabled" : "Disabled"} · ${esc(item.position || "")}</span>
      </div>
      <div class="inline-actions">
        <button class="btn small" data-edit-ribbon="${esc(item.id)}">Edit</button>
      </div>
      </div>
    `).join("") || `<div class="notice">No status ribbons yet.</div>`;
    $all("[data-edit-ribbon]").forEach(button => {
      button.addEventListener("click", () => fillRibbon(ribbons.find(item => item.id === button.dataset.editRibbon)));
    });
  } catch {
    list.innerHTML = `<div class="notice">Status ribbons will appear here once the migration is applied.</div>`;
  }
}

async function deleteFigure(id) {
  if (!id || !confirm("Delete this figure?")) return;
  await fetch(`${PB_URL}/api/collections/minifigs/records/${id}`, { method: "DELETE", headers: authHeaders() });
  showAdminToast("Figure deleted.");
  renderAdminFigures();
}

async function renderAdminOrders() {
  const list = $("#adminOrderList");
  if (!list) return;
  try {
    const data = await api("/api/collections/orders/records?perPage=200", { headers: authHeaders() });
    const filter = $("#adminOrderFilter")?.value || "all";
    const clearButton = $("#clearTestOrders");
    if (clearButton) clearButton.classList.toggle("hidden", filter !== "test");
    const orders = [...(data.items || [])].sort((a, b) => String(b.created || "").localeCompare(String(a.created || ""))).filter(order => {
      const isTest = Boolean(order.is_test_order);
      if (filter === "test") return isTest;
      if (isTest) return false;
      if (filter === "all") return true;
      if (filter === "preorder") return Boolean(order.is_preorder);
      return order.status === filter;
    });

    list.innerHTML = orders.map(order => {
      const items = parseOrderItems(order.items_json);
      const orderType = order.is_preorder ? "Preorder" : "Order";
      const status = order.status || "pending_payment";
      const address = order.shipping_address || "";
      const country = order.country || "";
      const email = order.customer_email || "";
      const created = adminDateLabel(order.created || order.updated || "");
      return `
        <div class="admin-row admin-order-card" data-order-card="${esc(order.id)}">
          <div class="admin-order-card-head">
            <div class="admin-row-head">
              <strong>${esc(order.order_number)}${order.is_test_order ? ` <span class="admin-badge test">Test</span>` : ""}</strong>
              <span>${esc(orderType)} | ${esc(statusLabelForOrder(status))}${order.stripe_mode ? ` | ${esc(order.stripe_mode)} mode` : ""}</span>
            </div>
            <div class="admin-order-total">
              <span>Total</span>
              <strong>${moneyLabel(order.total)}</strong>
            </div>
          </div>
          <div class="admin-order-sections">
            <section class="admin-order-section">
              <h4>Customer</h4>
              <dl>
                <div><dt>Name</dt><dd>${esc(order.customer_name || "Not provided")}</dd></div>
                <div><dt>Email</dt><dd>${email ? `<a href="mailto:${esc(email)}">${esc(email)}</a>` : "Not provided"}</dd></div>
              </dl>
            </section>
            <section class="admin-order-section">
              <h4>Shipping</h4>
              <dl>
                <div><dt>Address</dt><dd class="admin-order-address">${esc(address || "Not provided")}</dd></div>
                <div><dt>Country</dt><dd>${esc(country || "Not provided")}</dd></div>
              </dl>
            </section>
            <section class="admin-order-section admin-order-items">
              <h4>Items</h4>
              <div class="admin-order-item-list">
                ${items.map(item => `
                  <div class="admin-order-item-row">
                    <span>${esc(item.name || item.slug || "Item")}</span>
                    <span>x ${Number(item.quantity || 1)}</span>
                    <span>${moneyLabel((Number(item.price || 0) * Number(item.quantity || 1)).toFixed(2))}</span>
                  </div>
                `).join("") || `<span class="admin-muted">No item details saved.</span>`}
              </div>
            </section>
            <section class="admin-order-section">
              <h4>Record</h4>
              <dl>
                <div><dt>Created</dt><dd>${esc(created || "Not available")}</dd></div>
                <div><dt>Payment</dt><dd>${esc(order.stripe_payment_intent || order.stripe_checkout_id || "Not recorded")}</dd></div>
              </dl>
            </section>
          </div>
          <div class="admin-order-editor">
            <label>Status
              <select data-order-field="status">
                ${["pending_payment", "paid", "preordered", "completed", "fulfilled", "shipped", "delivered", "refunded", "partial_refunded", "cancelled", "expired"].map(status => `<option value="${status}" ${order.status === status ? "selected" : ""}>${statusLabelForOrder(status)}</option>`).join("")}
              </select>
            </label>
            <label>Carrier
              <select data-order-field="carrier">
                ${["", "usps", "ups", "fedex", "dhl", "other"].map(carrier => `<option value="${carrier}" ${order.carrier === carrier ? "selected" : ""}>${carrier ? carrier.toUpperCase() : "None"}</option>`).join("")}
              </select>
            </label>
            <label>Tracking <input class="field" data-order-field="tracking_number" value="${esc(order.tracking_number || "")}"></label>
            <label class="span-2">Admin Notes <textarea data-order-field="admin_notes">${esc(order.admin_notes || "")}</textarea></label>
          </div>
          <div class="inline-actions admin-order-actions">
            <button class="btn small primary" data-save-order="${esc(order.id)}">Save Order</button>
            <button class="btn small" data-order-status="${esc(order.id)}" data-status="shipped">Mark Shipped</button>
            <button class="btn small danger" data-order-status="${esc(order.id)}" data-status="cancelled">Cancel</button>
            <button class="btn small danger" data-order-status="${esc(order.id)}" data-status="refunded">Refund</button>
          </div>
        </div>
      `;
    }).join("") || `<div class="notice">No orders match this filter.</div>`;
    $all("[data-order-status]").forEach(button => button.addEventListener("click", () => updateOrderStatus(button.dataset.orderStatus, button.dataset.status)));
    $all("[data-save-order]").forEach(button => button.addEventListener("click", () => saveOrderEdits(button.dataset.saveOrder)));
  } catch {
    list.innerHTML = `<div class="notice">Orders will appear here once the store is connected.</div>`;
  }
}

async function clearTestOrders() {
  if (!confirm("Clear all test orders? Live orders and inventory will not be touched.")) return;
  const button = $("#clearTestOrders");
  if (button) button.disabled = true;
  try {
    const result = await api("/api/nemesis/test-orders", {
      method: "DELETE",
      headers: authHeaders()
    });
    const deleted = Number(result.deleted || 0);
    showAdminToast(`${deleted} test order${deleted === 1 ? "" : "s"} cleared.`);
    renderAdminOrders();
    renderAudit();
  } catch (error) {
    showAdminToast(error.message || "Test orders could not be cleared.", "error");
  } finally {
    if (button) button.disabled = false;
  }
}

function statusLabelForOrder(status) {
  return String(status || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function parseOrderItems(value) {
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value || "[]");
  } catch {
    return [];
  }
}

async function updateOrderStatus(id, status) {
  if (!id || !status) return;
  const payload = { status };
  if (status === "shipped") payload.shipped_at = new Date().toISOString();
  await api(`/api/collections/orders/records/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload)
  });
  showAdminToast("Order status updated.");
  renderAdminOrders();
  renderAdminFigures();
  renderAudit();
}

async function saveOrderEdits(id) {
  const card = $(`[data-order-card="${CSS.escape(id)}"]`);
  if (!card) return;
  const status = $('[data-order-field="status"]', card)?.value || "pending_payment";
  const carrier = $('[data-order-field="carrier"]', card)?.value || "";
  const trackingNumber = $('[data-order-field="tracking_number"]', card)?.value.trim() || "";
  const adminNotes = $('[data-order-field="admin_notes"]', card)?.value.trim() || "";
  const payload = {
    status,
    carrier,
    tracking_number: trackingNumber,
    admin_notes: adminNotes
  };
  if (status === "shipped" && trackingNumber) payload.shipped_at = new Date().toISOString();

  await api(`/api/collections/orders/records/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload)
  });
  showAdminToast("Order saved.");
  renderAdminOrders();
  renderAdminFigures();
  renderAudit();
}

function emailDrafts() {
  try {
    return JSON.parse(localStorage.getItem(EMAIL_DRAFTS) || "[]");
  } catch {
    return [];
  }
}

function saveEmailDrafts(drafts) {
  localStorage.setItem(EMAIL_DRAFTS, JSON.stringify(drafts || []));
}

function orderOptionHtml(orders, selected = "") {
  return `<option value="">No order</option>` + orders.map(order => (
    `<option value="${esc(order.id)}" ${order.id === selected ? "selected" : ""} data-email="${esc(order.customer_email || "")}" data-name="${esc(order.customer_name || "")}" data-number="${esc(order.order_number || "")}" data-address="${esc(order.shipping_address || "")}">${esc(order.order_number || "Order")} - ${esc(order.customer_email || "")}</option>`
  )).join("");
}

function emailOrder(orderId) {
  return emailCenterState.orders.find(order => order.id === orderId) || null;
}

function hydrateTemplate(template, order = null) {
  const name = order?.customer_name || "there";
  const number = order?.order_number || "your order";
  const address = order?.shipping_address || "";
  const replace = value => String(value || "")
    .replaceAll("{{name}}", name)
    .replaceAll("{{order}}", number)
    .replaceAll("{{address}}", address);
  return {
    subject: replace(template.subject),
    body: replace(template.body)
  };
}

function emailEditor() {
  return $("#manualEmailBody");
}

function emailEditorText() {
  return (emailEditor()?.innerText || "").trim();
}

function emailEditorHtml() {
  const html = (emailEditor()?.innerHTML || "").trim();
  return html === "<br>" ? "" : html;
}

function emailAttachmentSizeLabel(size = 0) {
  const bytes = Number(size || 0);
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  if (bytes >= 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function renderSelectedEmailAttachments() {
  const list = $("#manualEmailAttachmentList");
  if (!list) return;
  list.classList.toggle("has-files", selectedEmailAttachments.length > 0);
  list.innerHTML = selectedEmailAttachments.map((file, index) => `
    <span class="inbox-compose-attachment-chip">
      <span>${esc(file.name || "attachment")}</span>
      <em>${esc(emailAttachmentSizeLabel(file.size))}</em>
      <button type="button" data-remove-email-attachment="${index}" aria-label="Remove ${esc(file.name || "attachment")}">
        <span class="material-symbols-outlined">close</span>
      </button>
    </span>
  `).join("");
  $all("[data-remove-email-attachment]", list).forEach(button => {
    button.addEventListener("click", () => {
      selectedEmailAttachments.splice(Number(button.dataset.removeEmailAttachment), 1);
      renderSelectedEmailAttachments();
    });
  });
}

function addEmailAttachments(files = []) {
  const incoming = Array.from(files || []).filter(Boolean);
  if (!incoming.length) return;
  const combined = [...selectedEmailAttachments, ...incoming].slice(0, 10);
  const total = combined.reduce((sum, file) => sum + Number(file.size || 0), 0);
  if (selectedEmailAttachments.length + incoming.length > 10) {
    showAdminToast("Only 10 attachments can be sent at once.", "error");
  }
  if (total > 15 * 1024 * 1024) {
    showAdminToast("Attachments must be 15 MB total or less.", "error");
    return;
  }
  selectedEmailAttachments = combined;
  renderSelectedEmailAttachments();
}

function clearEmailAttachments() {
  selectedEmailAttachments = [];
  const input = $("#manualEmailAttachments");
  if (input) input.value = "";
  renderSelectedEmailAttachments();
}

function saveEmailSelection() {
  const editor = emailEditor();
  const selection = window.getSelection();
  if (!editor || !selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;
  savedEmailSelection = range.cloneRange();
}

function activeEmailRange() {
  const editor = emailEditor();
  const selection = window.getSelection();
  if (editor && selection?.rangeCount) {
    const range = selection.getRangeAt(0);
    if (editor.contains(range.commonAncestorContainer)) return range;
  }
  return savedEmailSelection || null;
}

function restoreEmailSelection() {
  const editor = emailEditor();
  const selection = window.getSelection();
  if (!editor || !selection) return false;
  if (savedEmailSelection) {
    selection.removeAllRanges();
    selection.addRange(savedEmailSelection);
    editor.focus();
    return true;
  }
  editor.focus();
  return false;
}

function setEmailEditor(value = "", isHtml = false) {
  const editor = emailEditor();
  if (!editor) return;
  if (isHtml) {
    editor.innerHTML = value || "";
  } else {
    editor.textContent = value || "";
  }
}

function focusEmailEditor() {
  const editor = emailEditor();
  if (!editor) return;
  if (restoreEmailSelection()) return;
  editor.focus();
  const range = document.createRange();
  range.selectNodeContents(editor);
  range.collapse(false);
  const selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

function wrapEmailSelection(style = {}) {
  const editor = emailEditor();
  if (!editor) return;
  restoreEmailSelection();
  const selection = window.getSelection();
  if (!selection || !selection.rangeCount) return;
  const range = selection.getRangeAt(0);
  if (!editor.contains(range.commonAncestorContainer)) return;
  if (range.collapsed) {
    focusEmailEditor();
    return;
  }

  const contents = range.extractContents();
  if (style.fontSize) {
    contents.querySelectorAll("*").forEach(node => {
      node.style.fontSize = style.fontSize;
      if (node.tagName === "FONT") node.removeAttribute("size");
    });
  }

  const span = document.createElement("span");
  Object.assign(span.style, style);
  span.appendChild(contents);
  range.insertNode(span);
  selection.removeAllRanges();
  const nextRange = document.createRange();
  nextRange.selectNodeContents(span);
  selection.addRange(nextRange);
  saveEmailSelection();
  updateEmailToolbarState();
}

function execEmailFormat(command) {
  restoreEmailSelection();
  if (command === "createLink") {
    showEmailLinkPopover();
    return;
  }
  document.execCommand(command, false, null);
  saveEmailSelection();
}

function setEmailBlockFormat(value) {
  restoreEmailSelection();
  document.execCommand("formatBlock", false, `<${value || "P"}>`);
  saveEmailSelection();
}

function setEmailFontSize(value) {
  wrapEmailSelection({ fontSize: value || "16px" });
}

function clampEmailFontSize(value) {
  const number = Number(String(value || "").replace(/\D/g, "").slice(0, 3));
  if (!Number.isFinite(number)) return 16;
  return Math.max(8, Math.min(999, number));
}

function fontSizeLabelFromPixels(value) {
  const number = parseFloat(String(value || ""));
  if (!Number.isFinite(number)) return "";
  return String(Math.round(number));
}

function emailNodeForRange(range) {
  let node = range?.startContainer || null;
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  return node?.nodeType === Node.ELEMENT_NODE ? node : null;
}

function selectedEmailFontSizes(range) {
  const editor = emailEditor();
  if (!editor || !range) return [];
  if (range.collapsed) {
    const node = emailNodeForRange(range);
    return node ? [fontSizeLabelFromPixels(getComputedStyle(node).fontSize)] : [];
  }

  const sizes = new Set();
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
      try {
        return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      } catch {
        return NodeFilter.FILTER_REJECT;
      }
    }
  });

  while (walker.nextNode()) {
    const parent = walker.currentNode.parentElement;
    if (parent) sizes.add(fontSizeLabelFromPixels(getComputedStyle(parent).fontSize));
  }

  return [...sizes].filter(Boolean);
}

function updateEmailToolbarState() {
  const editor = emailEditor();
  const active = document.activeElement;
  if (!editor || (active && active.closest?.(".inbox-size-control, .inbox-compose-popover"))) return;

  const range = activeEmailRange();
  if (!range || !editor.contains(range.commonAncestorContainer)) return;

  const sizeInput = $("#emailFontSizeCustom");
  if (sizeInput && active !== sizeInput) {
    const sizes = selectedEmailFontSizes(range);
    sizeInput.value = sizes.length > 1 ? "--" : (sizes[0] || "16");
    sizeInput.classList.toggle("is-mixed", sizes.length > 1);
  }

  $all("[data-email-format]").forEach(button => {
    const command = button.dataset.emailFormat;
    const canQuery = ["bold", "italic", "underline", "insertUnorderedList"].includes(command);
    button.classList.toggle("is-active", canQuery && document.queryCommandState(command));
  });

  const block = String(document.queryCommandValue("formatBlock") || "P").replace(/[<>]/g, "").toUpperCase();
  const blockSelect = $("#emailBlockFormat");
  if (blockSelect && ["P", "H1", "H2", "H3"].includes(block)) blockSelect.value = block;
}

function closeEmailPopovers() {
  $("#emailLinkPopover")?.classList.add("hidden");
  $("#emailTemplateMenu")?.classList.add("hidden");
  $("#emailFontSizeMenu")?.classList.add("hidden");
}

function showEmailLinkPopover() {
  saveEmailSelection();
  $("#emailTemplateMenu")?.classList.add("hidden");
  const popover = $("#emailLinkPopover");
  if (!popover) return;
  $("#emailLinkUrl").value = "";
  popover.classList.remove("hidden");
  window.setTimeout(() => $("#emailLinkUrl")?.focus(), 30);
}

function applyEmailLink() {
  const input = $("#emailLinkUrl");
  const raw = input?.value.trim() || "";
  if (!raw) return;
  const url = /^https?:\/\//i.test(raw) || /^mailto:/i.test(raw) ? raw : `https://${raw}`;
  restoreEmailSelection();
  document.execCommand("createLink", false, url);
  saveEmailSelection();
  closeEmailPopovers();
  focusEmailEditor();
}

function renderEmailTemplateMenu() {
  const menu = $("#emailTemplateMenu");
  if (!menu) return;
  menu.innerHTML = `
    <strong>Templates</strong>
    ${EMAIL_TEMPLATES.map(template => `
      <button type="button" data-email-template-choice="${esc(template.id)}">
        <span>${esc(template.name)}</span>
        <small>${esc(template.subject)}</small>
      </button>
    `).join("")}
  `;
  $all("[data-email-template-choice]", menu).forEach(button => {
    button.addEventListener("click", () => {
      applyEmailTemplate(button.dataset.emailTemplateChoice);
      closeEmailPopovers();
    });
  });
}

function setMobileInboxReading(reading) {
  $("#inboxView")?.classList.toggle("inbox-mobile-reading", Boolean(reading));
}

function toggleEmailTemplateMenu() {
  renderEmailTemplateMenu();
  $("#emailLinkPopover")?.classList.add("hidden");
  $("#emailTemplateMenu")?.classList.toggle("hidden");
}

function applyEmailTemplate(templateId) {
  const template = EMAIL_TEMPLATES.find(item => item.id === templateId);
  if (!template) return;
  const hydrated = hydrateTemplate(template, selectedComposeOrder());
  $("#manualEmailSubject").value = hydrated.subject;
  setEmailEditor(hydrated.body);
  focusEmailEditor();
}

function renderEmailBodyHtml(message) {
  if (message.bodyHtml) return sanitizeUpdateHtml(message.bodyHtml);
  return esc(message.body || message.preview || "").replace(/\n/g, "<br>");
}

function renderEmailAttachments(message) {
  if (!message.recordId || !Array.isArray(message.attachments) || !message.attachments.length) return "";
  return `<div class="inbox-attachments">${message.attachments.map((filename, index) => {
    const meta = message.attachmentMeta?.[index] || {};
    const label = meta.filename || filename;
    const url = `${PB_URL}/api/files/email_messages/${encodeURIComponent(message.recordId)}/${encodeURIComponent(filename)}`;
    return `<a href="${esc(url)}" target="_blank" rel="noopener"><span class="material-symbols-outlined">attachment</span>${esc(label)}</a>`;
  }).join("")}</div>`;
}

function normalizeEmailEvent(item) {
  const values = item.new_values || {};
  const eventType = item.event_type || "";
  const failed = /failed|error/i.test(eventType) || Boolean(values.error);
  const inbound = /inbound_email_received/i.test(eventType);
  const manual = /admin_manual_email_sent/i.test(eventType);
  const sent = !inbound && /email/i.test(eventType);
  const orderId = values.order_id || item.target_id || "";
  const order = emailOrder(orderId);
  const subject = values.subject || item.target_label || (inbound ? "(No subject)" : eventType.replace(/_/g, " "));
  const body = values.text || values.message || values.body || values.error || "";
  const bodyHtml = values.html || values.message_html || "";
  const recipient = values.to || order?.customer_email || "";
  const sender = values.from || (sent ? "orders@nemesisminifigures.com" : "");
  const participant = inbound ? sender : recipient;
  const direction = inbound ? "inbound" : "outbound";
  return {
    id: `audit:${item.id}`,
    auditId: item.id,
    mailbox: inbound ? "inbox" : "sent",
    type: failed ? "failed" : manual ? "manual" : inbound ? "inbound" : "transactional",
    direction,
    failed,
    unread: inbound,
    participant,
    sender: sender || "orders@nemesisminifigures.com",
    recipient,
    subject,
    preview: body || eventType.replace(/_/g, " "),
    body: body || `${eventType.replace(/_/g, " ")}${recipient ? `\n\nTo: ${recipient}` : ""}`,
    bodyHtml,
    orderId,
    orderNumber: order?.order_number || item.target_label || "",
    created: item.created || item.updated || "",
    eventLabel: eventType.replace(/_/g, " "),
    threadKey: orderId ? `order:${orderId}` : `email:${String(participant || subject).toLowerCase()}|${String(subject).toLowerCase().replace(/^(re|fw):\s*/i, "")}`
  };
}

function normalizeStoredEmailMessage(item) {
  const thread = emailCenterState.threads.find(entry => entry.id === item.thread) || {};
  const orderId = item.order || thread.order || "";
  const order = emailOrder(orderId);
  const to = Array.isArray(item.to_json) ? item.to_json : [];
  const recipient = to[0]?.address || "";
  const inbound = item.direction === "inbound";
  return {
    id: `message:${item.id}`,
    recordId: item.id,
    threadId: item.thread || "",
    mailbox: inbound ? "inbox" : "sent",
    type: inbound ? "inbound" : "manual",
    direction: inbound ? "inbound" : "outbound",
    failed: ["failed", "sent_unconfirmed"].includes(item.delivery_status),
    unread: inbound && !item.is_read,
    participant: inbound ? (item.from_name || item.from_email) : recipient,
    sender: item.from_email || "",
    recipient,
    subject: item.subject || "(No subject)",
    preview: item.text_body || String(item.html_body || "").replace(/<[^>]+>/g, " "),
    body: item.text_body || "",
    bodyHtml: item.html_body || "",
    orderId,
    orderNumber: order?.order_number || "",
    created: item.received_at || item.created || item.updated || "",
    eventLabel: item.delivery_status || (inbound ? "received" : "sent"),
    messageId: item.message_id || "",
    inReplyTo: item.in_reply_to || "",
    references: Array.isArray(item.references_json) ? item.references_json : [],
    attachments: Array.isArray(item.attachments) ? item.attachments : [],
    attachmentMeta: Array.isArray(item.attachment_meta) ? item.attachment_meta : [],
    threadKey: `thread:${item.thread || item.id}`
  };
}

function normalizeDraft(draft) {
  return {
    ...draft,
    id: `draft:${draft.id}`,
    mailbox: "drafts",
    type: "draft",
    direction: "outbound",
    participant: draft.to || "Draft",
    recipient: draft.to || "",
    sender: "orders@nemesisminifigures.com",
    preview: draft.body || "Draft message",
    bodyHtml: draft.body_html || "",
    orderId: draft.order_id || "",
    orderNumber: emailOrder(draft.order_id)?.order_number || "",
    created: draft.updated || draft.created || "",
    eventLabel: "draft",
    threadKey: draft.order_id ? `order:${draft.order_id}` : `draft:${draft.id}`
  };
}

function normalizeTemplate(template) {
  return {
    id: `template:${template.id}`,
    templateId: template.id,
    mailbox: "templates",
    type: "template",
    direction: "outbound",
    participant: "Template",
    sender: "orders@nemesisminifigures.com",
    recipient: "",
    subject: template.name,
    preview: template.body,
    body: template.body,
    created: "",
    eventLabel: "template",
    threadKey: `template:${template.id}`
  };
}

function emailMailboxMessages(mailbox = emailCenterState.mailbox) {
  if (mailbox === "drafts") return emailDrafts().map(normalizeDraft);
  if (mailbox === "templates") return EMAIL_TEMPLATES.map(normalizeTemplate);
  return emailCenterState.messages.filter(message => message.mailbox === mailbox);
}

function emailTimeLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) return `${Math.max(1, Math.round(diff / minute))}m ago`;
  if (diff < day) return `${Math.round(diff / hour)}h ago`;
  return adminDateLabel(value);
}

function renderEmailMailboxCounts() {
  const counts = {
    inbox: emailCenterState.messages.filter(message => message.mailbox === "inbox").length,
    sent: emailCenterState.messages.filter(message => message.mailbox === "sent").length,
    drafts: emailDrafts().length,
    templates: EMAIL_TEMPLATES.length
  };
  Object.entries(counts).forEach(([key, count]) => {
    const target = $(`#${key}Count`);
    if (target) target.textContent = String(count);
  });
}

function renderEmailList() {
  const log = $("#adminEmailLog");
  if (!log) return;
  const messages = emailMailboxMessages();
  renderEmailMailboxCounts();
  $all(".inbox-mailbox").forEach(button => button.classList.toggle("active", button.dataset.mailbox === emailCenterState.mailbox));

  if (!messages.length) {
    log.innerHTML = `<div class="inbox-empty">
      <span class="material-symbols-outlined">mark_email_read</span>
      <strong>${emailCenterState.mailbox === "inbox" ? "Inbox Clear" : "Nothing Here Yet"}</strong>
      <p>${emailCenterState.mailbox === "inbox" ? "No unread customer emails." : "Messages will appear here when this mailbox has activity."}</p>
    </div>`;
    renderEmailViewer(null);
    return;
  }

  if (!messages.some(message => message.id === emailCenterState.selectedId)) {
    emailCenterState.selectedId = messages[0].id;
  }

  log.innerHTML = messages.map(message => `
    <div class="inbox-message-row ${message.failed ? "is-error" : ""} ${message.unread ? "is-unread" : ""} ${message.id === emailCenterState.selectedId ? "active" : ""}">
      <button class="inbox-message-select" type="button" data-email-id="${esc(message.id)}">
        <span class="inbox-message-dot" aria-hidden="true"></span>
        <span class="inbox-message-main">
          <span class="inbox-message-top">
            <strong>${esc(message.participant || "Nemesis Email")}</strong>
            <time>${esc(emailTimeLabel(message.created))}</time>
          </span>
          <span class="inbox-message-subject">${esc(message.subject || "(No subject)")}</span>
          <span class="inbox-message-preview">${esc(message.preview || "Email event recorded.")}</span>
        </span>
        <span class="inbox-message-tag">${esc(message.orderNumber || message.eventLabel || message.mailbox)}</span>
      </button>
      ${message.mailbox !== "templates" ? `
        <button class="inbox-message-more" type="button" data-email-menu="${esc(message.id)}" aria-label="Message actions" title="Message actions">
          <span class="material-symbols-outlined">more_vert</span>
        </button>
        <div class="inbox-message-menu hidden" data-email-menu-panel="${esc(message.id)}">
          <button type="button" data-delete-email="${esc(message.id)}"><span class="material-symbols-outlined">delete</span>${message.mailbox === "drafts" ? "Delete draft" : "Delete conversation"}</button>
        </div>
      ` : ""}
    </div>
  `).join("");

  $all("[data-email-id]", log).forEach(button => {
    button.addEventListener("click", () => {
      emailCenterState.selectedId = button.dataset.emailId;
      setMobileInboxReading(true);
      const selected = messages.find(message => message.id === emailCenterState.selectedId);
      if (selected?.recordId && selected.unread) markEmailRead(selected);
      renderEmailList();
    });
  });

  $all("[data-email-menu]", log).forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const panel = log.querySelector(`[data-email-menu-panel="${CSS.escape(button.dataset.emailMenu)}"]`);
      $all("[data-email-menu-panel]", log).forEach(item => {
        if (item !== panel) item.classList.add("hidden");
      });
      panel?.classList.toggle("hidden");
    });
  });

  $all("[data-delete-email]", log).forEach(button => {
    button.addEventListener("click", async event => {
      event.stopPropagation();
      const message = messages.find(item => item.id === button.dataset.deleteEmail);
      if (!message) return;
      if (button.dataset.confirmDelete !== "true") {
        button.dataset.confirmDelete = "true";
        button.innerHTML = '<span class="material-symbols-outlined">warning</span>Click again to delete';
        window.setTimeout(() => {
          if (!button.isConnected) return;
          button.dataset.confirmDelete = "false";
          button.innerHTML = `<span class="material-symbols-outlined">delete</span>${message.mailbox === "drafts" ? "Delete draft" : "Delete conversation"}`;
        }, 3500);
        return;
      }
      await deleteEmailConversation(message);
    });
  });

  renderEmailViewer(messages.find(message => message.id === emailCenterState.selectedId) || messages[0]);
}

function renderEmailViewer(message) {
  const viewer = $("#emailViewer");
  if (!viewer) return;
  if (!message) {
    viewer.innerHTML = `<div class="inbox-empty">
      <span class="material-symbols-outlined">mail</span>
      <strong>Select a message</strong>
      <p>Choose a message from the list or compose a new customer email.</p>
    </div>`;
    return;
  }

  const related = emailMailboxMessages("inbox")
    .concat(emailMailboxMessages("sent"))
    .filter(item => item.threadKey === message.threadKey)
    .sort((a, b) => String(a.created || "").localeCompare(String(b.created || "")));
  const thread = related.length ? related : [message];
  const order = emailOrder(message.orderId);
  const canLink = Boolean(message.auditId || message.recordId);
  const canReply = message.mailbox !== "templates";

  viewer.innerHTML = `
    <div class="inbox-viewer-head">
      <button class="inbox-mobile-back" type="button" data-email-back-list>
        <span class="material-symbols-outlined">arrow_back</span>
        Inbox
      </button>
      <h3>${esc(message.subject || "(No subject)")}</h3>
      <div class="inbox-viewer-meta">
        <span>${message.direction === "inbound" ? "From" : "To"}: ${esc(message.direction === "inbound" ? message.sender : message.recipient || message.participant)}</span>
        <span>${message.orderId ? `Related order: ${esc(order?.order_number || message.orderNumber || "Linked order")}` : "No related order"}</span>
        ${message.created ? `<span>${esc(adminDateLabel(message.created))}</span>` : ""}
      </div>
      <div class="inbox-viewer-actions">
        ${canReply ? `<button class="btn small primary" type="button" data-email-reply="${esc(message.id)}"><span class="material-symbols-outlined btn-icon">reply</span>Reply</button>` : ""}
        ${message.mailbox === "templates" ? `<button class="btn small primary" type="button" data-template-compose="${esc(message.templateId)}"><span class="material-symbols-outlined btn-icon">edit</span>Use Template</button>` : ""}
        ${message.mailbox === "drafts" ? `<button class="btn small primary" type="button" data-draft-edit="${esc(message.id)}"><span class="material-symbols-outlined btn-icon">edit</span>Edit Draft</button>` : ""}
        ${canLink ? `<button class="btn small" type="button" data-email-link-order="${esc(message.id)}"><span class="material-symbols-outlined btn-icon">link</span>Link Order</button>` : ""}
      </div>
    </div>
    <div class="inbox-thread">
      ${thread.map(item => `<article class="inbox-thread-bubble ${item.direction}">
        <strong>${item.direction === "inbound" ? esc(item.sender || "Customer") : "You"}</strong>
        <span>${renderEmailBodyHtml(item)}</span>
        ${renderEmailAttachments(item)}
      </article>`).join("")}
    </div>
  `;

  $("[data-email-back-list]", viewer)?.addEventListener("click", () => setMobileInboxReading(false));
  $("[data-email-reply]", viewer)?.addEventListener("click", () => openEmailCompose({
    to: message.direction === "inbound" ? message.sender : message.recipient,
    order_id: message.orderId,
    thread_id: message.threadId,
    subject: /^re:/i.test(message.subject || "") ? message.subject : `Re: ${message.subject || ""}`,
    body: ""
  }));
  $("[data-template-compose]", viewer)?.addEventListener("click", event => openTemplateCompose(event.currentTarget.dataset.templateCompose));
  $("[data-draft-edit]", viewer)?.addEventListener("click", event => openDraftCompose(event.currentTarget.dataset.draftEdit));
  $("[data-email-link-order]", viewer)?.addEventListener("click", event => openEmailLinkOrder(event.currentTarget.dataset.emailLinkOrder));
}

async function markEmailRead(message) {
  message.unread = false;
  try {
    await api("/api/nemesis/email/read", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ message_record_id: message.recordId })
    });
  } catch {}
}

async function deleteEmailConversation(message) {
  if (message.mailbox === "drafts") {
    const draftId = String(message.id || "").replace(/^draft:/, "");
    saveEmailDrafts(emailDrafts().filter(item => item.id !== draftId));
    emailCenterState.selectedId = "";
    setMobileInboxReading(false);
    showAdminToast("Draft deleted.");
    renderEmailList();
    return;
  }

  try {
    await api("/api/nemesis/email/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ thread_id: message.threadId || "", audit_id: message.auditId || "" })
    });
    showAdminToast("Conversation deleted.");
    emailCenterState.selectedId = "";
    setMobileInboxReading(false);
    await renderEmailCenter();
  } catch (error) {
    showAdminToast(error.message || "Conversation could not be deleted.", "error");
  }
}

function fillEmailOrderSelects() {
  const html = orderOptionHtml(emailCenterState.orders);
  ["manualEmailOrder", "emailLinkOrderSelect"].forEach(id => {
    const select = $(`#${id}`);
    if (select) select.innerHTML = html;
  });
}

async function renderEmailCenter() {
  const log = $("#adminEmailLog");
  if (!log && !$("#manualEmailOrder")) return;

  try {
    const centerData = await api("/api/nemesis/email-center", { headers: authHeaders() });
    const ordersData = { items: centerData.orders || [] };
    const auditData = { items: centerData.audit || [] };

    emailCenterState.orders = ordersData.items || [];
    emailCenterState.threads = centerData.threads || [];
    fillEmailOrderSelects();
    const storedMessages = (centerData.messages || []).map(normalizeStoredEmailMessage);
    const storedIds = new Set(storedMessages.map(message => message.messageId).filter(Boolean));
    const historicalMessages = (auditData.items || [])
      .filter(item => /email/i.test(item.event_type || ""))
      .filter(item => !storedIds.has(item.new_values?.message_id || ""))
      .map(normalizeEmailEvent);
    emailCenterState.messages = storedMessages
      .concat(historicalMessages)
      .sort((a, b) => String(b.created || "").localeCompare(String(a.created || "")));

    renderEmailList();
  } catch {
    if (log) {
      log.innerHTML = `<div class="inbox-empty">
          <span class="material-symbols-outlined">error</span>
          <strong>Email activity could not be loaded</strong>
          <p>Refresh the admin session and try again.</p>
        </div>`;
    }
  }
}

function selectedComposeOrder() {
  const selected = $("#manualEmailOrder")?.selectedOptions?.[0];
  if (!selected || !selected.value) return null;
  return emailOrder(selected.value) || {
    id: selected.value,
    customer_email: selected.dataset.email || "",
    customer_name: selected.dataset.name || "",
    order_number: selected.dataset.number || "",
    shipping_address: selected.dataset.address || ""
  };
}

function openEmailCompose(prefill = {}) {
  const modal = $("#emailComposeModal");
  if (!modal) return;
  modal.classList.remove("is-minimized");
  editingEmailDraftId = prefill.draft_id || "";
  composingEmailThreadId = prefill.thread_id || "";
  $("#manualEmailTo").value = prefill.to || "";
  $("#manualEmailCc").value = prefill.cc || "";
  $("#manualEmailBcc").value = prefill.bcc || "";
  $("#manualEmailOrder").value = prefill.order_id || "";
  $("#manualEmailSubject").value = prefill.subject || "";
  setEmailEditor(prefill.body_html || prefill.body || "", Boolean(prefill.body_html));
  clearEmailAttachments();
  modal.classList.remove("hidden");
  window.setTimeout(focusEmailEditor, 50);
}

function closeEmailCompose() {
  closeEmailPopovers();
  $("#emailComposeModal")?.classList.add("hidden");
}

function clearEmailCompose() {
  editingEmailDraftId = "";
  composingEmailThreadId = "";
  closeEmailPopovers();
  $("#manualEmailTo").value = "";
  $("#manualEmailCc").value = "";
  $("#manualEmailBcc").value = "";
  $("#manualEmailOrder").value = "";
  $("#manualEmailSubject").value = "";
  setEmailEditor("");
  clearEmailAttachments();
}

function openTemplateCompose(templateId) {
  const template = EMAIL_TEMPLATES.find(item => item.id === templateId);
  if (!template) return;
  const hydrated = hydrateTemplate(template, selectedComposeOrder());
  openEmailCompose({
    template_id: template.id,
    subject: hydrated.subject,
    body: hydrated.body
  });
}

function openDraftCompose(draftId) {
  const cleanId = String(draftId || "").replace(/^draft:/, "");
  const draft = emailDrafts().find(item => item.id === cleanId);
  if (!draft) return;
  openEmailCompose({ ...draft, draft_id: cleanId });
}

function saveCurrentEmailDraft() {
  const drafts = emailDrafts();
  const draft = {
    id: editingEmailDraftId || `draft_${Date.now()}`,
    to: $("#manualEmailTo")?.value.trim() || "",
    cc: $("#manualEmailCc")?.value.trim() || "",
    bcc: $("#manualEmailBcc")?.value.trim() || "",
    order_id: $("#manualEmailOrder")?.value || "",
    thread_id: composingEmailThreadId,
    subject: $("#manualEmailSubject")?.value.trim() || "(No subject)",
    body: emailEditorText(),
    body_html: emailEditorHtml(),
    updated: new Date().toISOString()
  };
  if (!draft.to && !draft.body && !draft.subject) return;
  saveEmailDrafts([draft, ...drafts.filter(item => item.id !== draft.id)].slice(0, 50));
  editingEmailDraftId = draft.id;
  showAdminToast("Draft saved.");
  closeEmailCompose();
  emailCenterState.mailbox = "drafts";
  emailCenterState.selectedId = `draft:${draft.id}`;
  renderEmailList();
}

function openEmailLinkOrder(messageId) {
  const message = emailCenterState.messages.find(item => item.id === messageId);
  if (!message) return;
  emailCenterState.linkMessageId = messageId;
  const select = $("#emailLinkOrderSelect");
  if (select) select.value = message.orderId || "";
  $("#emailLinkOrderModal")?.classList.remove("hidden");
}

function closeEmailLinkOrder() {
  emailCenterState.linkMessageId = "";
  $("#emailLinkOrderModal")?.classList.add("hidden");
}

async function saveEmailOrderLink() {
  const message = emailCenterState.messages.find(item => item.id === emailCenterState.linkMessageId);
  if (!message?.auditId && !message?.recordId) return;
  const orderId = $("#emailLinkOrderSelect")?.value || "";
  try {
    await api("/api/nemesis/email/link-order", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ audit_id: message.auditId || "", message_record_id: message.recordId || "", order_id: orderId })
    });
    showAdminToast("Email linked to order.");
    closeEmailLinkOrder();
    renderEmailCenter();
  } catch (error) {
    showAdminToast(error.message || "Email could not be linked.", "error");
  }
}

async function sendManualEmail() {
  const payload = {
    to: $("#manualEmailTo")?.value.trim() || "",
    cc: $("#manualEmailCc")?.value.trim() || "",
    bcc: $("#manualEmailBcc")?.value.trim() || "",
    order_id: $("#manualEmailOrder")?.value || "",
    thread_id: composingEmailThreadId,
    subject: $("#manualEmailSubject")?.value.trim() || "",
    message: emailEditorText(),
    message_html: emailEditorHtml()
  };
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => formData.append(key, value || ""));
  selectedEmailAttachments.forEach(file => formData.append("attachments", file, file.name));
  const hasAttachments = selectedEmailAttachments.length > 0;

  try {
    await api("/api/nemesis/email/send", {
      method: "POST",
      headers: hasAttachments ? authHeaders() : { "Content-Type": "application/json", ...authHeaders() },
      body: hasAttachments ? formData : JSON.stringify(payload)
    });
    showAdminToast("Email sent.");
    closeEmailCompose();
    clearEmailCompose();
    emailCenterState.mailbox = "sent";
    renderEmailCenter();
    renderAudit();
  } catch (error) {
    showAdminToast(error.message || "Email could not be sent.", "error");
  }
}

async function renderAdminCustomers() {
  const list = $("#adminCustomerList");
  if (!list) return;
  try {
    const data = await api("/api/collections/customers/records?perPage=200", { headers: authHeaders() });
    const customers = [...(data.items || [])].sort((a, b) => String(b.updated || "").localeCompare(String(a.updated || "")));
    list.innerHTML = customers.map(customer => `
      <div class="admin-row">
        <div class="admin-row-head"><strong>${esc(customer.name)}</strong><span>${esc(customer.email)}</span></div>
        <span>${Number(customer.order_count || 0)} orders</span>
        <span>${moneyLabel(customer.total_spent || 0)}</span>
      </div>
    `).join("") || `<div class="notice">No customers yet.</div>`;
  } catch {
    list.innerHTML = `<div class="notice">Customers will appear here once orders are placed.</div>`;
  }
}

function adminDateLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

async function renderAdminWaitlist() {
  const list = $("#adminWaitlistList");
  if (!list) return;

  try {
    let data;
    try {
      data = await api("/api/collections/waitlist/records?sort=-signed_up_at,email&perPage=200", { headers: authHeaders() });
    } catch {
      data = await api("/api/collections/waitlist/records?perPage=200", { headers: authHeaders() });
    }
    list.innerHTML = data.items.map(entry => `
      <div class="admin-row waitlist-admin-row">
        <div class="admin-row-head">
          <strong>${esc(entry.email)}</strong>
        </div>
        <span>${esc(adminDateLabel(entry.signed_up_at || entry.created))}</span>
        <div class="inline-actions">
          <button class="btn small danger waitlist-remove-btn" type="button" data-delete-waitlist="${esc(entry.id)}">Remove</button>
        </div>
      </div>
    `).join("") || `<div class="notice">No waitlist signups yet.</div>`;

    $all("[data-delete-waitlist]", list).forEach(button => {
      button.addEventListener("click", async () => {
        if (button.dataset.confirmDelete !== "true") {
          button.dataset.confirmDelete = "true";
          button.textContent = "Confirm";
          window.setTimeout(() => {
            if (button.dataset.confirmDelete === "true") {
              button.dataset.confirmDelete = "false";
              button.textContent = "Remove";
            }
          }, 3200);
          return;
        }

        await fetch(`${PB_URL}/api/collections/waitlist/records/${button.dataset.deleteWaitlist}`, {
          method: "DELETE",
          headers: authHeaders()
        });
        showAdminToast("Waitlist entry removed.");
        renderAdminWaitlist();
      });
    });
  } catch {
    list.innerHTML = `<div class="notice">Waitlist signups could not be loaded.</div>`;
  }
}

async function renderSiteSettings() {
  if (!$("#siteSettingsForm")) return;
  const data = await api("/api/collections/site_settings/records?perPage=1", { headers: authHeaders() }).catch(() => ({ items: [] }));
  const settings = data.items?.[0] || {};
  $("#siteSettingsForm").dataset.recordId = settings.id || "";
  $("#domesticShipping").value = settings.domestic_shipping ?? 0;
  $("#northAmericaShipping").value = settings.north_america_shipping ?? 10;
  $("#europeShipping").value = settings.europe_shipping ?? 15;
  $("#internationalShipping").value = settings.international_shipping ?? 25;
  $("#taxEnabled").checked = Boolean(settings.tax_enabled);
  $("#trackingEnabled").checked = Boolean(settings.tracking_enabled);
  $("#showPreordersInCatalogue").checked = settings.show_preorders_in_catalogue !== false;
  $("#stripeTestMode").checked = Boolean(settings.stripe_test_mode);
  $("#stripeLivePublishableKey").value = settings.stripe_publishable_key || "";
  $("#stripeTestPublishableKey").value = settings.stripe_test_publishable_key || "";
  updateStripeModePanels();
  $("#lowStockThreshold").value = settings.low_stock_threshold ?? 3;
  $("#newReleaseDays").value = settings.new_release_days ?? 30;
  $("#newReleaseMode").value = settings.new_release_mode || "time_window";
  $("#previewEnabled").checked = Boolean(settings.preview_enabled);
  await renderPreviewWhitelist(settings.preview_whitelist || ["index.html"]);
}

function dateOnlyLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "2-digit",
    year: "numeric"
  }).format(date);
}

function activeStripeMode() {
  return $("#stripeTestMode")?.checked ? "test" : "live";
}

function updateStripeModePanels() {
  const mode = activeStripeMode();
  $all("[data-stripe-mode-panel]").forEach(panel => {
    panel.hidden = false;
    panel.classList.toggle("is-active", panel.dataset.stripeModePanel === mode);
  });
}

function setSettingsSection(section = "access") {
  const target = section || "access";
  $all("[data-settings-section-tab]").forEach(button => {
    button.classList.toggle("active", button.dataset.settingsSectionTab === target);
  });
  $all("[data-settings-section-panel]").forEach(panel => {
    panel.classList.toggle("active", panel.dataset.settingsSectionPanel === target);
  });
}

function initSettingsSectionTabs() {
  const tabs = $all("[data-settings-section-tab]");
  if (!tabs.length) return;
  tabs.forEach(button => {
    button.addEventListener("click", () => setSettingsSection(button.dataset.settingsSectionTab || "access"));
  });
  const active = tabs.find(button => button.classList.contains("active"))?.dataset.settingsSectionTab || "access";
  setSettingsSection(active);
}

async function renderStripeSecretStatus() {
  const statusTargets = {
    liveServer: $("#stripeServerKeyStatus"),
    liveWebhook: $("#stripeWebhookSecretStatus"),
    testServer: $("#stripeTestServerKeyStatus"),
    testWebhook: $("#stripeTestWebhookSecretStatus")
  };
  if (!statusTargets.liveServer || !statusTargets.liveWebhook) return;

  const setStatus = (element, configured, label, updatedValue = "") => {
    if (!element) return;
    element.classList.toggle("is-configured", configured);
    element.classList.toggle("is-missing", !configured);
    const date = updatedValue ? dateOnlyLabel(updatedValue) || updatedValue : "";
    element.innerHTML = `<span></span>${configured ? `${label} configured` : `No ${label.toLowerCase()} configured`}${date ? ` <em>Last updated: ${esc(date)}</em>` : ""}`;
  };

  try {
    const data = await api("/api/nemesis/stripe-config/status");
    setStatus(statusTargets.liveServer, Boolean(data.live_server_key_configured ?? data.server_key_configured), "Live server key", data.live_server_key_last_updated ?? data.server_key_last_updated);
    setStatus(statusTargets.liveWebhook, Boolean(data.live_webhook_secret_configured ?? data.webhook_secret_configured), "Live webhook secret", data.live_webhook_secret_last_updated ?? data.webhook_secret_last_updated);
    setStatus(statusTargets.testServer, Boolean(data.test_server_key_configured), "Test server key", data.test_server_key_last_updated);
    setStatus(statusTargets.testWebhook, Boolean(data.test_webhook_secret_configured), "Test webhook secret", data.test_webhook_secret_last_updated);
  } catch {
    setStatus(statusTargets.liveServer, false, "Live server key");
    setStatus(statusTargets.liveWebhook, false, "Live webhook secret");
    setStatus(statusTargets.testServer, false, "Test server key");
    setStatus(statusTargets.testWebhook, false, "Test webhook secret");
  }
}

async function renderEmailSmtpStatus() {
  const status = $("#emailSmtpStatus");
  if (!status) return;

  try {
    const data = await api("/api/nemesis/email-config/status");
    status.classList.toggle("is-configured", Boolean(data.configured));
    status.classList.toggle("is-missing", !data.configured);
    status.innerHTML = `<span></span>${data.configured ? "Transactional email configured" : "No transactional email configured"}`;

    if ($("#emailSmtpHost")) $("#emailSmtpHost").value = data.host || "smtp-relay.brevo.com";
    if ($("#emailSmtpPort")) $("#emailSmtpPort").value = data.port || 587;
    if ($("#emailSmtpLogin") && data.username_configured) $("#emailSmtpLogin").placeholder = "SMTP login saved";
    if ($("#emailSmtpPassword") && data.password_configured) $("#emailSmtpPassword").placeholder = "SMTP password saved";
    if ($("#emailFromName")) $("#emailFromName").value = data.from_name || "Nemesis Minifigures";
    if ($("#emailFromEmail")) $("#emailFromEmail").value = data.from_email || "orders@nemesisminifigures.com";
    if ($("#emailAdminEmail")) $("#emailAdminEmail").value = data.admin_email || "Nemesisminifigures@gmail.com";
    if ($("#emailTestRecipient") && !$("#emailTestRecipient").value) $("#emailTestRecipient").value = data.admin_email || "Nemesisminifigures@gmail.com";
  } catch {
    status.classList.remove("is-configured");
    status.classList.add("is-missing");
    status.innerHTML = `<span></span>Email status could not be loaded`;
  }
}

async function saveEmailSmtp() {
  const payload = {
    host: $("#emailSmtpHost")?.value.trim() || "smtp-relay.brevo.com",
    port: Number($("#emailSmtpPort")?.value || 587),
    username: $("#emailSmtpLogin")?.value.trim() || "",
    password: $("#emailSmtpPassword")?.value.trim() || "",
    from_name: $("#emailFromName")?.value.trim() || "Nemesis Minifigures",
    from_email: $("#emailFromEmail")?.value.trim() || "orders@nemesisminifigures.com",
    admin_email: $("#emailAdminEmail")?.value.trim() || "Nemesisminifigures@gmail.com"
  };

  try {
    await api("/api/nemesis/email-config/smtp", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload)
    });
    if ($("#emailSmtpPassword")) $("#emailSmtpPassword").value = "";
    showAdminToast("Transactional email saved.");
    renderEmailSmtpStatus();
  } catch (error) {
    showAdminToast(error.message || "Email settings could not be saved.", "error");
  }
}

async function clearEmailSmtp() {
  if (!confirm("Clear transactional email SMTP settings?")) return;
  try {
    await api("/api/nemesis/email-config/smtp", {
      method: "DELETE",
      headers: authHeaders()
    });
    showAdminToast("Transactional email settings cleared.");
    renderEmailSmtpStatus();
  } catch (error) {
    showAdminToast(error.message || "Email settings could not be cleared.", "error");
  }
}

async function sendTestEmail() {
  const to = $("#emailTestRecipient")?.value.trim() || "";
  if (!to) {
    showAdminToast("Enter a test recipient email.", "error");
    return;
  }

  try {
    await api("/api/nemesis/email-config/test", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ to })
    });
    showAdminToast("Test email sent.");
  } catch (error) {
    showAdminToast(error.message || "Test email could not be sent.", "error");
  }
}

async function saveStripeSecret(endpoint, inputSelector, mode, successMessage) {
  const input = $(inputSelector);
  if (!input) return;

  const key = input.value.trim();
  if (!key) {
    showAdminToast("Enter a key before saving.", "error");
    return;
  }

  try {
    await api(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ key, mode })
    });
    input.value = "";
    showAdminToast(successMessage);
    renderStripeSecretStatus();
  } catch (error) {
    input.value = "";
    showAdminToast(error.message || "Stripe key could not be saved.", "error");
    renderStripeSecretStatus();
  }
}

function saveStripeServerKey() {
  return saveStripeSecret("/api/nemesis/stripe-config/server-key", "#stripeLiveRestrictedKey", "live", "Stripe live server key updated.");
}

function saveStripeWebhookSecret() {
  return saveStripeSecret("/api/nemesis/stripe-config/webhook-secret", "#stripeLiveWebhookSecret", "live", "Stripe live webhook secret updated.");
}

function saveStripeTestServerKey() {
  return saveStripeSecret("/api/nemesis/stripe-config/server-key", "#stripeTestRestrictedKey", "test", "Stripe test server key updated.");
}

function saveStripeTestWebhookSecret() {
  return saveStripeSecret("/api/nemesis/stripe-config/webhook-secret", "#stripeTestWebhookSecret", "test", "Stripe test webhook secret updated.");
}

async function clearStripeSecret(endpoint, mode, successMessage) {
  try {
    await api(`${endpoint}?mode=${encodeURIComponent(mode)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ mode })
    });
    showAdminToast(successMessage);
    renderStripeSecretStatus();
  } catch (error) {
    showAdminToast(error.message || "Stripe key could not be cleared.", "error");
    renderStripeSecretStatus();
  }
}

function clearStripeServerKey() {
  return clearStripeSecret("/api/nemesis/stripe-config/server-key", "live", "Stripe live server key cleared.");
}

function clearStripeWebhookSecret() {
  return clearStripeSecret("/api/nemesis/stripe-config/webhook-secret", "live", "Stripe live webhook secret cleared.");
}

function clearStripeTestServerKey() {
  return clearStripeSecret("/api/nemesis/stripe-config/server-key", "test", "Stripe test server key cleared.");
}

function clearStripeTestWebhookSecret() {
  return clearStripeSecret("/api/nemesis/stripe-config/webhook-secret", "test", "Stripe test webhook secret cleared.");
}

async function saveSettingsPayload(payload, successMessage) {
  const form = $("#siteSettingsForm");
  const id = form?.dataset.recordId || "";
  const message = $("#siteSettingsMessage");

  try {
    const saved = await api(id ? `/api/collections/site_settings/records/${id}` : "/api/collections/site_settings/records", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload)
    });
    if (form) form.dataset.recordId = saved.id || id || "";
    sessionStorage.removeItem(SITE_SETTINGS_CACHE);
    if (message) message.textContent = "";
    showAdminToast(successMessage);
    renderSiteSettings();
  } catch (error) {
    if (message) message.textContent = "";
    showAdminToast(error.message || "Settings could not be saved.", "error");
  }
}

function saveShippingSettings() {
  return saveSettingsPayload({
    domestic_shipping: Number($("#domesticShipping").value || 0),
    north_america_shipping: Number($("#northAmericaShipping").value || 0),
    europe_shipping: Number($("#europeShipping").value || 0),
    international_shipping: Number($("#internationalShipping").value || 0),
    tax_enabled: $("#taxEnabled").checked,
    tracking_enabled: $("#trackingEnabled").checked
  }, "Shipping settings saved.");
}

function saveCatalogueSettings() {
  return saveSettingsPayload({
    show_preorders_in_catalogue: $("#showPreordersInCatalogue").checked
  }, "Catalogue settings saved.");
}

function saveStripePublishableKey() {
  const key = $("#stripeLivePublishableKey").value.trim();
  if (key && !/^pk_live_[A-Za-z0-9_]+$/.test(key)) {
    showAdminToast("Enter a valid live publishable key that starts with pk_live_.", "error");
    return;
  }
  return saveSettingsPayload({
    stripe_publishable_key: key
  }, "Stripe live publishable key saved.");
}

function saveStripeTestPublishableKey() {
  const key = $("#stripeTestPublishableKey").value.trim();
  if (key && !/^pk_test_[A-Za-z0-9_]+$/.test(key)) {
    showAdminToast("Enter a valid test publishable key that starts with pk_test_.", "error");
    return;
  }
  return saveSettingsPayload({
    stripe_test_publishable_key: key
  }, "Stripe test publishable key saved.");
}

function saveStripeMode() {
  updateStripeModePanels();
  return saveSettingsPayload({
    stripe_test_mode: $("#stripeTestMode").checked
  }, $("#stripeTestMode").checked ? "Stripe test mode enabled." : "Stripe live mode enabled.");
}

function saveRibbonRuleSettings() {
  return saveSettingsPayload({
    low_stock_threshold: Number($("#lowStockThreshold").value || 3),
    new_release_days: Number($("#newReleaseDays").value || 30),
    new_release_mode: $("#newReleaseMode").value || "time_window"
  }, "Ribbon rules saved.");
}

async function savePreviewSettings() {
  const form = $("#siteSettingsForm");
  const message = $("#previewSettingsMessage");
  if (!form || !$("#previewEnabled")) return;

  const id = form.dataset.recordId;
  const payload = {
    preview_enabled: $("#previewEnabled").checked,
    preview_whitelist: selectedPreviewWhitelist()
  };

  if (message) message.textContent = "";

  try {
    const saved = await api(id ? `/api/collections/site_settings/records/${id}` : "/api/collections/site_settings/records", {
      method: id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload)
    });

    form.dataset.recordId = saved.id || id || "";
    sessionStorage.removeItem(SITE_SETTINGS_CACHE);

    showAdminToast("Preview settings saved.");
  } catch (error) {
    showAdminToast(error.message || "Preview settings could not be saved.", "error");
  }
}

async function renderAudit() {
  const list = $("#auditList");
  if (!list) return;
  try {
    const data = await api("/api/collections/audit_log/records", { headers: authHeaders() });
    list.innerHTML = data.items.map(item => `
      <div class="admin-row"><strong>${esc(item.action || item.event_type)}</strong><span>${esc(item.target_label || item.target_object || "")}</span><span>${esc(item.created || "")}</span></div>
    `).join("") || `<div class="notice">No audit entries yet.</div>`;
  } catch {
    list.innerHTML = `<div class="notice">Audit entries will appear here once PocketBase is connected.</div>`;
  }
}

async function init() {
  // The catalogue titles are rendered into canvases. Wait for the local display
  // face first so a cached fallback font is never baked into those images.
  if (document.fonts?.load) {
    try {
      await document.fonts.load('900 132px "Akira Expanded"');
      await document.fonts.ready;
    } catch (error) {
      console.warn("The display font could not be preloaded.", error);
    }
  }
  enforceAdminSessionVersion();
  preventUnsafeAdminFormSubmits();
  const allowed = await enforcePreviewMode();
  if (!allowed) return;
  const settings = await getSiteSettings();
  if (STATIC_PORTFOLIO) {
    document.querySelectorAll("a[href]").forEach(link => {
      const href = link.getAttribute("href");
      const routes = {
        "/": "./", "./": "./",
        catalog: "catalog/", "catalog/": "catalog/",
        about: "about/", "about/": "about/",
        orders: "orders/", "orders/": "orders/",
        preorders: "preorders/", "preorders/": "preorders/",
        updates: "updates/", "updates/": "updates/",
        checkout: "checkout/", "checkout/": "checkout/",
        success: "success/", "success/": "success/"
      };
      if (routes[href]) link.setAttribute("href", routes[href]);
    });
  }
  ensureTopChrome();
  setActive();
  setupNav(settings);
  await initAnnouncementBar();
  initHeaderScroll();
  initHomeScrollReveals();
  setupScrollbarActivity();
  updateCartLinks();
  cookies();
  initWaitlist(settings);
  initHome();
  initCatalog();
  initPreordersPage();
  initAboutPage();
  initUpdatesPage();
  initCheckout();
  initSuccess();
  initOrderLookup();
  if (!STATIC_PORTFOLIO) initAdmin();
}

document.addEventListener("DOMContentLoaded", init);

const SUPABASE_URL = "https://YOUR_PROJECT_ID.supabase.co";
// The anon key is safe to expose only while the sales table has RLS enabled.
const SUPABASE_ANON_KEY = "YOUR_SUPABASE_ANON_KEY";
const CURRENCY_SYMBOL = "₦";
const MAX_AMOUNT_CENTS = 999_999_999_999n;

const isConfigured = !SUPABASE_URL.includes("YOUR_")
  && !SUPABASE_ANON_KEY.includes("YOUR_")
  && Boolean(window.supabase);
const supabaseClient = isConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

const form = document.querySelector("#sale-form");
const itemInput = document.querySelector("#item-name");
const amountInput = document.querySelector("#amount");
const timeInput = document.querySelector("#sold-at");
const submitButton = document.querySelector("#save-sale");
const salesBody = document.querySelector("#sales-body");
const emptyState = document.querySelector("#empty-state");
const quickAdd = document.querySelector("#quick-add");
const formMessage = document.querySelector("#form-message");
const itemError = document.querySelector("#item-error");
const amountError = document.querySelector("#amount-error");
const timeError = document.querySelector("#time-error");
const totalValue = document.querySelector("#total-value");
const saleCount = document.querySelector("#sale-count");
const tickerTrack = document.querySelector("#ticker-track");
const stampLayer = document.querySelector("#stamp-layer");
document.querySelectorAll("[data-currency]").forEach((element) => {
  element.textContent = CURRENCY_SYMBOL;
});

let sales = [];
let salesLoadState = "loading";
let previousTotalCents = null;
let newestSaleId = null;
let newestSaleTimer;

function localDayRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function formatCents(cents) {
  const whole = cents / 100n;
  const fraction = String(cents % 100n).padStart(2, "0");
  return `${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(whole)}.${fraction}`;
}

function formatMoney(cents) {
  return `${CURRENCY_SYMBOL}${formatCents(cents)}`;
}

function parseAmountCents(value) {
  const match = value.trim().match(/^(\d+)(?:\.(\d{0,2}))?$|^\.(\d{1,2})$/);
  if (!match) return null;

  const whole = match[1] || "0";
  const fraction = (match[2] ?? match[3] ?? "").padEnd(2, "0");
  const cents = BigInt(`${whole}${fraction}`);
  if (cents < 1n || cents > MAX_AMOUNT_CENTS) return null;
  return cents;
}

function amountForDatabase(cents) {
  return `${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
}

function localDateTimeValue(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function centsForSale(sale) {
  const amount = String(sale.amount);
  const [whole, fraction = ""] = amount.split(".");
  return BigInt(`${whole}${fraction.padEnd(2, "0").slice(0, 2)}`);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function render() {
  const totalCents = sales.reduce((total, sale) => total + centsForSale(sale), 0n);
  const cumulativeById = new Map();
  let cumulativeCents = 0n;

  for (const sale of [...sales].reverse()) {
    cumulativeCents += centsForSale(sale);
    cumulativeById.set(sale.id, cumulativeCents);
  }

  salesBody.innerHTML = sales.map((sale) => {
    const soldAt = new Date(sale.sold_at);
    const time = new Intl.DateTimeFormat("en-NG", {
      hour: "numeric",
      minute: "2-digit",
    }).format(soldAt);
    const isNewest = sale.id === newestSaleId;
    const isStamped = sale.id === newestSaleId;
    return `<tr class="${isStamped ? "row-stamped" : ""}">
      <td class="sale-time">${escapeHtml(time)}${isNewest ? '<span class="new-tag">NEW</span>' : ""}</td>
      <td class="sale-item">${escapeHtml(sale.item_name)}</td>
      <td class="money-cell">${formatMoney(centsForSale(sale))}</td>
      <td class="money-cell running-total">${formatMoney(cumulativeById.get(sale.id))}</td>
    </tr>`;
  }).join("");

  emptyState.hidden = sales.length > 0;
  emptyState.textContent = salesLoadState === "loading"
    ? "Loading today's sales..."
    : salesLoadState === "error"
      ? "Sales unavailable. Check the connection."
      : "No sales yet. Go sell something.";
  saleCount.textContent = `${sales.length} ${sales.length === 1 ? "SALE" : "SALES"}`;
  renderTicker(totalCents);
  animateTotal(totalCents);
  renderQuickAdd();
}

function animateTotal(targetCents) {
  if (previousTotalCents === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    totalValue.textContent = formatCents(targetCents);
  } else if (targetCents !== previousTotalCents) {
    const from = previousTotalCents;
    const startedAt = performance.now();
    const duration = 600;
    totalValue.classList.remove("total-flash");

    function tick(now) {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      const progressUnits = BigInt(Math.round(eased * 1_000_000));
      const current = from + ((targetCents - from) * progressUnits) / 1_000_000n;
      totalValue.textContent = formatCents(current);
      const tickerTotal = tickerTrack.querySelector(".ticker-total");
      if (tickerTotal) tickerTotal.textContent = formatMoney(current);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        totalValue.classList.add("total-flash");
        window.setTimeout(() => totalValue.classList.remove("total-flash"), 250);
      }
    }

    requestAnimationFrame(tick);
  }

  previousTotalCents = targetCents;
}

function renderTicker(totalCents) {
  const latest = sales[0];
  const lastSale = latest
    ? `LAST SALE: ${escapeHtml(latest.item_name)} ${formatMoney(centsForSale(latest))}`
    : "NO SALES YET";
  const message = `TODAY'S TOTAL <span class="ticker-total">${formatMoney(totalCents)}</span> ✦ ${sales.length} ${sales.length === 1 ? "SALE" : "SALES"} ✦ ${lastSale} ✦ KEEP SELLING ✦`;
  tickerTrack.innerHTML = [0, 1].map((copy) =>
    `<span class="ticker-copy"${copy ? ' aria-hidden="true"' : ""}>${message}</span>`,
  ).join("");
}

function renderQuickAdd() {
  const recentNames = [];
  const seen = new Set();
  for (const sale of sales) {
    const key = sale.item_name.trim().toLocaleLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      recentNames.push(sale.item_name);
    }
    if (recentNames.length === 5) break;
  }
  quickAdd.innerHTML = recentNames.map((name) =>
    `<button class="quick-chip" type="button" data-item="${escapeHtml(name)}">${escapeHtml(name)}</button>`,
  ).join("");
}

function clearErrors() {
  itemError.textContent = "";
  amountError.textContent = "";
  timeError.textContent = "";
  formMessage.textContent = "";
  itemInput.removeAttribute("aria-invalid");
  amountInput.removeAttribute("aria-invalid");
  timeInput.removeAttribute("aria-invalid");
}

function setFailure(message) {
  formMessage.textContent = message;
  formMessage.classList.add("message-error");
}

function playStamp() {
  stampLayer.classList.remove("stamp-active");
  document.body.classList.remove("screen-shake");
  requestAnimationFrame(() => {
    stampLayer.classList.add("stamp-active");
    document.body.classList.add("screen-shake");
  });
  window.setTimeout(() => {
    stampLayer.classList.remove("stamp-active");
    document.body.classList.remove("screen-shake");
  }, 950);
}

async function loadToday() {
  if (!supabaseClient) {
    salesLoadState = "error";
    render();
    setFailure("Add your Supabase URL and anon key in app.js to load sales.");
    return;
  }

  const { start, end } = localDayRange();
  const { data, error } = await supabaseClient
    .from("sales")
    .select("id, item_name, amount, sold_at")
    .gte("sold_at", start)
    .lt("sold_at", end)
    .order("sold_at", { ascending: false });

  if (error) {
    salesLoadState = "error";
    render();
    setFailure("Could not load today's sales. Check the Supabase settings and try again.");
    return;
  }
  salesLoadState = "ready";
  sales = [...new Map([...(data ?? []), ...sales].map((sale) => [sale.id, sale])).values()]
    .sort((left, right) => new Date(right.sold_at) - new Date(left.sold_at));
  render();
}

quickAdd.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-item]");
  if (!chip) return;
  itemInput.value = chip.dataset.item;
  amountInput.focus();
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearErrors();

  const itemName = itemInput.value.trim();
  const amountCents = parseAmountCents(amountInput.value);
  let hasError = false;

  if (!itemName) {
    itemError.textContent = "Add an item name.";
    itemInput.setAttribute("aria-invalid", "true");
    hasError = true;
  }
  if (amountCents === null) {
    amountError.textContent = `Enter an amount greater than ${CURRENCY_SYMBOL}0, with up to 2 decimal places.`;
    amountInput.setAttribute("aria-invalid", "true");
    hasError = true;
  }
  const soldAt = new Date(timeInput.value);
  if (!timeInput.value || Number.isNaN(soldAt.getTime())) {
    timeError.textContent = "Choose a valid sale time.";
    timeInput.setAttribute("aria-invalid", "true");
    hasError = true;
  }
  if (hasError) return;
  if (!supabaseClient) {
    setFailure("Add your Supabase URL and anon key in app.js before saving.");
    return;
  }

  submitButton.disabled = true;
  submitButton.textContent = "SAVING...";

  const { data, error } = await supabaseClient
    .from("sales")
    .insert({
      item_name: itemName,
      amount: amountForDatabase(amountCents),
      sold_at: soldAt.toISOString(),
    })
    .select("id, item_name, amount, sold_at")
    .single();

  submitButton.disabled = false;
  submitButton.textContent = "LOG SALE";

  if (error) {
    setFailure("Sale not saved. Check your connection and try again.");
    return;
  }

  const { start, end } = localDayRange();
  const saleTime = new Date(data.sold_at).getTime();
  if (saleTime >= new Date(start).getTime() && saleTime < new Date(end).getTime()) {
    salesLoadState = "ready";
    sales = [data, ...sales.filter((sale) => sale.id !== data.id)].sort((left, right) =>
      new Date(right.sold_at) - new Date(left.sold_at),
    );
  }
  newestSaleId = data.id;
  window.clearTimeout(newestSaleTimer);
  newestSaleTimer = window.setTimeout(() => {
    newestSaleId = null;
    render();
  }, 4_000);
  render();

  form.reset();
  timeInput.value = localDateTimeValue();
  formMessage.classList.remove("message-error");
  formMessage.textContent = saleTime >= new Date(start).getTime() && saleTime < new Date(end).getTime()
    ? "Sale saved. Keep it moving."
    : "Sale saved. It is outside today's log.";
  itemInput.focus();
  playStamp();
});

timeInput.value = localDateTimeValue();
render();
itemInput.focus({ preventScroll: true });
loadToday();

function scheduleMidnightRefresh() {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  window.setTimeout(() => {
    sales = [];
    salesLoadState = "loading";
    previousTotalCents = null;
    newestSaleId = null;
    timeInput.value = localDateTimeValue();
    render();
    loadToday();
    scheduleMidnightRefresh();
  }, nextMidnight.getTime() - now.getTime() + 50);
}

scheduleMidnightRefresh();
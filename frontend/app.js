const SUPABASE_URL = "https://zvyddbyzsmhibwobsqah.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2eWRkYnl6c21oaWJ3b2JzcWFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NzA1MTAsImV4cCI6MjEwNzQ0NjUxMH0.hUrbXxz2VL_n4TrvOEK1In2AqmE1R0HzF0Fb_R3YOJs";
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
const totalHeading = document.querySelector("#total-heading");
const ledgerHeading = document.querySelector("#ledger-heading");
const dateInput = document.querySelector("#dashboard-date");
const previousDayButton = document.querySelector("#previous-day");
const nextDayButton = document.querySelector("#next-day");
const copyTotalButton = document.querySelector("#copy-total");
const tickerTrack = document.querySelector("#ticker-track");
const stampLayer = document.querySelector("#stamp-layer");
document.querySelectorAll("[data-currency]").forEach((element) => {
  element.textContent = CURRENCY_SYMBOL;
});

let sales = [];
let salesLoadState = "loading";
let selectedDayKey = localDateKey(new Date());
let salesLoadRequest = 0;
let previousTotalCents = null;
let newestSaleId = null;
let newestSaleTimer;

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateFromLocalKey(dateKey) {
  const match = dateKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return localDateKey(date) === dateKey ? date : null;
}

function localDayRange(dateKey = selectedDayKey) {
  const date = dateFromLocalKey(dateKey);
  if (!date) return null;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function isViewingToday() {
  return selectedDayKey === localDateKey(new Date());
}

function selectedDayLabel(options = { month: "short", day: "numeric", year: "numeric" }) {
  return new Intl.DateTimeFormat("en-NG", options).format(dateFromLocalKey(selectedDayKey));
}

function updateDateControls() {
  const today = localDateKey(new Date());
  dateInput.value = selectedDayKey;
  dateInput.max = today;
  nextDayButton.disabled = selectedDayKey >= today;
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
  const newestFirst = [...sales].sort((left, right) =>
    new Date(right.sold_at) - new Date(left.sold_at),
  );
  const cumulativeById = new Map();
  let cumulativeCents = 0n;

  for (const sale of [...newestFirst].reverse()) {
    cumulativeCents += centsForSale(sale);
    cumulativeById.set(sale.id, cumulativeCents);
  }

  salesBody.innerHTML = newestFirst.map((sale) => {
    const soldAt = new Date(sale.sold_at);
    const time = new Intl.DateTimeFormat("en-NG", {
      hour: "numeric",
      minute: "2-digit",
    }).format(soldAt);
    const isNewest = sale.id === newestSaleId;
    return `<tr class="${isNewest ? "row-stamped" : ""}">
      <td class="sale-time">${escapeHtml(time)}${isNewest ? '<span class="new-tag">NEW</span>' : ""}</td>
      <td class="sale-item">${escapeHtml(sale.item_name)}</td>
      <td class="money-cell">${formatMoney(centsForSale(sale))}</td>
      <td class="money-cell running-total">${formatMoney(cumulativeById.get(sale.id))}</td>
      <td class="action-cell"><button class="delete-sale" type="button" data-sale-id="${escapeHtml(sale.id)}" aria-label="Delete ${escapeHtml(sale.item_name)} sale" title="Delete sale">×</button></td>
    </tr>`;
  }).join("");

  emptyState.hidden = sales.length > 0;
  const dayLabel = selectedDayLabel();
  totalHeading.textContent = isViewingToday() ? "SOLD TODAY" : `SOLD ${dayLabel.toUpperCase()}`;
  ledgerHeading.textContent = isViewingToday() ? "Today's sales" : `Sales for ${dayLabel}`;
  emptyState.textContent = salesLoadState === "loading"
    ? `Loading sales for ${dayLabel}...`
    : salesLoadState === "error"
      ? "Sales unavailable. Check the connection."
      : "No sales yet. Go sell something.";
  saleCount.textContent = `${sales.length} ${sales.length === 1 ? "SALE" : "SALES"}`;
  renderTicker(totalCents);
  animateTotal(totalCents);
  renderQuickAdd();
}

async function deleteSale(saleId) {
  const sale = sales.find((entry) => entry.id === saleId);
  if (!sale || !supabaseClient) return;

  const confirmation = `Delete ${sale.item_name} sale for ${formatMoney(centsForSale(sale))}? This cannot be undone.`;
  if (!window.confirm(confirmation)) return;

  formMessage.classList.remove("message-error");
  formMessage.textContent = "Deleting sale...";

  const { data, error } = await supabaseClient
    .from("sales")
    .delete()
    .eq("id", sale.id)
    .select("id");

  if (error || !data?.some((deletedSale) => deletedSale.id === sale.id)) {
    setFailure("Sale was not deleted. Check your connection and try again.");
    return;
  }

  sales = sales.filter((entry) => entry.id !== sale.id);
  if (newestSaleId === sale.id) newestSaleId = null;
  render();
  formMessage.classList.remove("message-error");
  formMessage.textContent = "Sale deleted. The selected day's total is updated.";
}

function animateTotal(targetCents) {
  if (previousTotalCents === null || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    totalValue.textContent = formatCents(targetCents);
  } else if (targetCents !== previousTotalCents) {
    const from = previousTotalCents;
    const startedAt = performance.now();
    const duration = 600;
    totalValue.classList.remove("total-flash");
    const tickerTotals = tickerTrack.querySelectorAll(".ticker-total");
    const updateDisplayedTotal = (cents) => {
      totalValue.textContent = formatCents(cents);
      tickerTotals.forEach((tickerTotal) => {
        tickerTotal.textContent = formatMoney(cents);
      });
    };
    updateDisplayedTotal(from);

    let animationFinished = false;
    const finishAnimation = () => {
      if (animationFinished) return;
      animationFinished = true;
      updateDisplayedTotal(targetCents);
      totalValue.classList.add("total-flash");
      window.setTimeout(() => totalValue.classList.remove("total-flash"), 250);
    };
    const finishFallback = window.setTimeout(finishAnimation, duration + 100);

    function tick(now) {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      const progressUnits = BigInt(Math.round(eased * 1_000_000));
      const current = from + ((targetCents - from) * progressUnits) / 1_000_000n;
      updateDisplayedTotal(current);
      if (progress < 1) {
        requestAnimationFrame(tick);
      } else {
        window.clearTimeout(finishFallback);
        finishAnimation();
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
  const totalLabel = isViewingToday() ? "TODAY'S TOTAL" : `${selectedDayLabel().toUpperCase()} TOTAL`;
  const message = `${totalLabel} <span class="ticker-total">${formatMoney(totalCents)}</span> ✦ ${sales.length} ${sales.length === 1 ? "SALE" : "SALES"} ✦ ${lastSale} ✦ KEEP SELLING ✦`;
  tickerTrack.innerHTML = [0, 1].map((copy) =>
    `<span class="ticker-copy"${copy ? ' aria-hidden="true"' : ""}>${message}</span>`,
  ).join("");
}

function renderQuickAdd() {
  const recentNames = [];
  const seen = new Set();
  for (const sale of [...sales].sort((left, right) =>
    new Date(right.sold_at) - new Date(left.sold_at),
  )) {
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

async function loadSelectedDay() {
  const requestId = ++salesLoadRequest;
  if (!supabaseClient) {
    salesLoadState = "error";
    render();
    setFailure("Add your Supabase URL and anon key in app.js to load sales.");
    return;
  }

  const dayRange = localDayRange();
  if (!dayRange) return;
  const { data, error } = await supabaseClient
    .from("sales")
    .select("id, item_name, amount, sold_at")
    .gte("sold_at", dayRange.start)
    .lt("sold_at", dayRange.end)
    .order("sold_at", { ascending: false });

  if (requestId !== salesLoadRequest) return;
  if (error) {
    salesLoadState = "error";
    render();
    setFailure(`Could not load sales for ${selectedDayLabel()}. Check the Supabase settings and try again.`);
    return;
  }
  salesLoadState = "ready";
  sales = [...new Map([...(data ?? []), ...sales].map((sale) => [sale.id, sale])).values()]
    .sort((left, right) => new Date(right.sold_at) - new Date(left.sold_at));
  render();
}

async function selectDashboardDay(dateKey) {
  if (!dateFromLocalKey(dateKey) || dateKey > localDateKey(new Date())) {
    updateDateControls();
    return;
  }

  selectedDayKey = dateKey;
  sales = [];
  salesLoadState = "loading";
  previousTotalCents = null;
  newestSaleId = null;
  window.clearTimeout(newestSaleTimer);
  updateDateControls();
  render();
  await loadSelectedDay();
}

function shiftDashboardDay(offset) {
  const date = dateFromLocalKey(selectedDayKey);
  date.setDate(date.getDate() + offset);
  return selectDashboardDay(localDateKey(date));
}

dateInput.addEventListener("change", () => selectDashboardDay(dateInput.value));
previousDayButton.addEventListener("click", () => shiftDashboardDay(-1));
nextDayButton.addEventListener("click", () => shiftDashboardDay(1));

quickAdd.addEventListener("click", (event) => {
  const chip = event.target.closest("[data-item]");
  if (!chip) return;
  itemInput.value = chip.dataset.item;
  amountInput.focus();
});

salesBody.addEventListener("click", (event) => {
  const deleteButton = event.target.closest(".delete-sale");
  if (deleteButton) deleteSale(deleteButton.dataset.saleId);
});

copyTotalButton.addEventListener("click", async () => {
  const totalCents = sales.reduce((total, sale) => total + centsForSale(sale), 0n);
  try {
    await window.navigator.clipboard.writeText(formatMoney(totalCents));
    formMessage.classList.remove("message-error");
    formMessage.textContent = isViewingToday() ? "Today's total copied." : `Total for ${selectedDayLabel()} copied.`;
  } catch {
    setFailure("Could not copy the total. Select the amount to copy it manually.");
  }
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

  const dayRange = localDayRange();
  const saleTime = new Date(data.sold_at).getTime();
  const saleMatchesSelectedDay = saleTime >= new Date(dayRange.start).getTime()
    && saleTime < new Date(dayRange.end).getTime();
  if (saleMatchesSelectedDay) {
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
  formMessage.textContent = saleMatchesSelectedDay
    ? "Sale saved. Keep it moving."
    : `Sale saved outside the ${isViewingToday() ? "today's" : "selected-day"} dashboard.`;
  itemInput.focus();
  playStamp();
});

dateInput.value = selectedDayKey;
updateDateControls();
timeInput.value = localDateTimeValue();
render();
itemInput.focus({ preventScroll: true });
loadSelectedDay();

function scheduleMidnightRefresh() {
  const now = new Date();
  const scheduledDayKey = localDateKey(now);
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  window.setTimeout(() => {
    updateDateControls();
    if (selectedDayKey === scheduledDayKey) {
      selectedDayKey = localDateKey(new Date());
      sales = [];
      salesLoadState = "loading";
      previousTotalCents = null;
      newestSaleId = null;
      timeInput.value = localDateTimeValue();
      updateDateControls();
      render();
      loadSelectedDay();
    }
    scheduleMidnightRefresh();
  }, nextMidnight.getTime() - now.getTime() + 50);
}

scheduleMidnightRefresh();
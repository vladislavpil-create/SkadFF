const storageKey = "warehouse-efficiency-v1";

const operations = [
  { key: "supply", label: "Поставки" },
  { key: "util", label: "Утилизация" },
  { key: "claim", label: "Рекламация" },
];

const monthNames = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const defaults = {
  june: {
    label: "Июнь 2026",
    ownFixed: 964650,
    plan: {
      operationCounts: {
        supply: 8061,
        util: 2553,
        claim: 406,
      },
      targetOwnBudget: 964650,
      daysPassed: 30,
      workDays: 30,
    },
    rows: {
      supply: { count: 8061, coef: 1, ownRate: 58, ffRate: 795367 / 8061 },
      util: { count: 2553, coef: 2.9, ownRate: 168, ffRate: 270439 / 2553 },
      claim: { count: 406, coef: 2.9, ownRate: 168, ffRate: 120 },
    },
  },
  may: {
    label: "Май 2026",
    ownFixed: 807218,
    plan: {
      operationCounts: {
        supply: 6133,
        util: 1224,
        claim: 191,
      },
      targetOwnBudget: 807218,
      daysPassed: 31,
      workDays: 31,
    },
    rows: {
      supply: { count: 6133, coef: 1, ownRate: 78.8519, ffRate: 98.71 },
      util: { count: 1224, coef: 2.9, ownRate: 228.6705, ffRate: 105.93 },
      claim: { count: 191, coef: 2.9, ownRate: 228.6705, ffRate: 120 },
    },
  },
  july: createEmptyMonth("Июль 2026", 31),
  august: createEmptyMonth("Август 2026", 31),
  september: createEmptyMonth("Сентябрь 2026", 30),
  october: createEmptyMonth("Октябрь 2026", 31),
  november: createEmptyMonth("Ноябрь 2026", 30),
  december: createEmptyMonth("Декабрь 2026", 31),
};

const defaultMonthOrder = ["may", "june", "july", "august", "september", "october", "november", "december"];

let data = loadData();
let monthOrder = loadMonthOrder(data);
let activeMonth = monthOrder.includes("june") ? "june" : monthOrder[0];

const els = {
  savingValue: document.querySelector("#savingValue"),
  savingPercent: document.querySelector("#savingPercent"),
  costCompare: document.querySelector("#costCompare"),
  keyKpi: document.querySelector("#keyKpi"),
  operationCosts: document.querySelector("#operationCosts"),
  operationVolumes: document.querySelector("#operationVolumes"),
  totalFact: document.querySelector("#totalFact"),
  unitCosts: document.querySelector("#unitCosts"),
  monthTabs: document.querySelector("#monthTabs"),
  addMonth: document.querySelector("#addMonth"),
  operationInputs: document.querySelector("#operationInputs"),
  planOperationInputs: document.querySelector("#planOperationInputs"),
  forecastSummary: document.querySelector("#forecastSummary"),
  planRows: document.querySelector("#planRows"),
  monthLabel: document.querySelector("#monthLabel"),
  ownFixed: document.querySelector("#ownFixed"),
  planInputs: document.querySelectorAll("[data-plan-field]"),
  weightedRows: document.querySelector("#weightedRows"),
  changes: document.querySelector("#changes"),
  conclusion: document.querySelector("#conclusion"),
  resetData: document.querySelector("#resetData"),
  saveData: document.querySelector("#saveData"),
};

els.addMonth.addEventListener("click", addNextMonth);

[els.monthLabel, els.ownFixed].forEach((input) => {
  input.addEventListener("input", () => {
    const value = input.dataset.field === "ownFixed" ? numberValue(input.value) : input.value;
    data[activeMonth][input.dataset.field] = value;
    if (input.dataset.field === "label") renderTabs();
    renderDashboard();
  });
});

els.planInputs.forEach((input) => {
  input.addEventListener("input", () => {
    data[activeMonth].plan[input.dataset.planField] = numberValue(input.value);
    renderDashboard();
  });
});

els.resetData.addEventListener("click", () => {
  data = clone(defaults);
  monthOrder = defaultMonthOrder.slice();
  activeMonth = "june";
  saveData();
  render();
});

els.saveData.addEventListener("click", () => {
  saveData();
  els.saveData.textContent = "Сохранено";
  setTimeout(() => {
    els.saveData.textContent = "Сохранить";
  }, 1100);
});

function createEmptyMonth(label, workDays = 30) {
  return {
    label,
    ownFixed: 0,
    plan: {
      operationCounts: {
        supply: 0,
        util: 0,
        claim: 0,
      },
      targetOwnBudget: 0,
      daysPassed: 1,
      workDays,
    },
    rows: {
      supply: { count: 0, coef: 1, ownRate: 58, ffRate: 795367 / 8061 },
      util: { count: 0, coef: 2.9, ownRate: 168, ffRate: 270439 / 2553 },
      claim: { count: 0, coef: 2.9, ownRate: 168, ffRate: 120 },
    },
  };
}

function loadData() {
  const saved = localStorage.getItem(storageKey);
  if (!saved) return clone(defaults);

  try {
    return mergeData(clone(defaults), JSON.parse(saved));
  } catch {
    return clone(defaults);
  }
}

function mergeData(base, source) {
  const sourceMonths = Object.keys(source || {}).filter((month) => source[month]?.rows && source[month]?.plan);

  [...new Set([...Object.keys(base), ...sourceMonths])].forEach((month) => {
    if (!source[month]) return;
    if (!base[month]) {
      base[month] = createEmptyMonth(source[month].label || month, numberValue(source[month].plan?.workDays) || 30);
    }
    mergeMonth(base[month], source[month]);
  });
  return base;
}

function mergeMonth(baseMonth, sourceMonth) {
  baseMonth.label = sourceMonth.label || baseMonth.label;
  baseMonth.ownFixed = Number(sourceMonth.ownFixed ?? baseMonth.ownFixed);
  baseMonth.plan = { ...baseMonth.plan, ...(sourceMonth.plan || {}) };
  if (!sourceMonth.plan?.operationCounts) {
    baseMonth.plan.operationCounts = planCountsFromLegacy(baseMonth, sourceMonth.plan);
  } else {
    baseMonth.plan.operationCounts = { ...baseMonth.plan.operationCounts, ...sourceMonth.plan.operationCounts };
  }
  operations.forEach(({ key }) => {
    baseMonth.rows[key] = { ...baseMonth.rows[key], ...(sourceMonth.rows?.[key] || {}) };
  });
}

function planCountsFromLegacy(month, plan = {}) {
  const targetFact = numberValue(plan.targetFact);
  const currentFact = sum(Object.values(month.rows), "count");
  const ratio = currentFact ? targetFact / currentFact : 1;

  return operations.reduce((acc, { key }) => {
    acc[key] = Math.round(numberValue(month.rows[key].count) * (targetFact ? ratio : 1));
    return acc;
  }, {});
}

function saveData() {
  localStorage.setItem(storageKey, JSON.stringify(data));
  localStorage.setItem(`${storageKey}-months`, JSON.stringify(monthOrder));
}

function loadMonthOrder(sourceData) {
  const saved = localStorage.getItem(`${storageKey}-months`);
  if (saved) {
    try {
      const parsed = JSON.parse(saved).filter((key) => sourceData[key]);
      if (parsed.length) {
        return [...parsed, ...Object.keys(sourceData).filter((key) => !parsed.includes(key))];
      }
    } catch {
      return defaultMonthOrder.slice();
    }
  }

  return [...defaultMonthOrder, ...Object.keys(sourceData).filter((key) => !defaultMonthOrder.includes(key))];
}

function renderTabs() {
  els.monthTabs.innerHTML = monthOrder
    .filter((key) => data[key])
    .map((key) => `<button class="tab ${key === activeMonth ? "active" : ""}" type="button" data-month="${key}">${data[key].label}</button>`)
    .join("");

  els.monthTabs.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => {
      activeMonth = button.dataset.month;
      render();
    });
  });
}

function addNextMonth() {
  const next = getNextMonth();
  data[next.key] = createEmptyMonth(next.label, next.workDays);
  monthOrder.push(next.key);
  activeMonth = next.key;
  saveData();
  render();
}

function getNextMonth() {
  const lastKey = monthOrder[monthOrder.length - 1];
  const lastLabel = data[lastKey]?.label || "Декабрь 2026";
  const parsed = parseMonthLabel(lastLabel);
  const nextMonthIndex = parsed.monthIndex === 11 ? 0 : parsed.monthIndex + 1;
  const nextYear = parsed.monthIndex === 11 ? parsed.year + 1 : parsed.year;

  return {
    key: `m${nextYear}_${String(nextMonthIndex + 1).padStart(2, "0")}`,
    label: `${monthNames[nextMonthIndex]} ${nextYear}`,
    workDays: new Date(nextYear, nextMonthIndex + 1, 0).getDate(),
  };
}

function parseMonthLabel(label) {
  const parts = String(label || "").split(" ");
  const monthIndex = monthNames.findIndex((name) => name.toLowerCase() === String(parts[0] || "").toLowerCase());
  const year = Number(parts[1]) || 2026;

  return {
    monthIndex: monthIndex >= 0 ? monthIndex : 11,
    year,
  };
}

function calcMonth(month) {
  const source = data[month];
  const rows = operations.map((operation) => {
    const row = source.rows[operation.key];
    const count = numberValue(row.count);
    const coef = numberValue(row.coef);
    const ownRate = numberValue(row.ownRate);
    const ffRate = numberValue(row.ffRate);
    const ownCost = count * ownRate;
    const ffCost = count * ffRate;
    const weighted = count * coef;

    return {
      ...operation,
      count,
      coef,
      weighted,
      ownRate,
      ffRate,
      ownCost,
      ffCost,
      diff: ownCost - ffCost,
    };
  });

  const ownTotal = numberValue(source.ownFixed) || sum(rows, "ownCost");
  const ffTotal = sum(rows, "ffCost");
  const factTotal = sum(rows, "count");
  const weightedTotal = sum(rows, "weighted");
  const saving = ffTotal - ownTotal;

  return {
    label: source.label,
    rows,
    ownTotal,
    ffTotal,
    factTotal,
    weightedTotal,
    weightedUnit: weightedTotal ? ownTotal / weightedTotal : 0,
    saving,
    savingPercent: ffTotal ? saving / ffTotal : 0,
  };
}

function render() {
  renderTabs();
  renderInputs();
  renderDashboard();
}

function renderInputs() {
  const month = data[activeMonth];
  els.monthLabel.value = month.label;
  els.ownFixed.value = Math.round(month.ownFixed);
  els.planInputs.forEach((input) => {
    input.value = clean(month.plan[input.dataset.planField] ?? 0);
  });
  els.operationInputs.innerHTML = "";
  els.planOperationInputs.innerHTML = "";

  operations.forEach((operation) => {
    const row = month.rows[operation.key];
    const line = document.createElement("div");
    line.className = "input-row";
    line.innerHTML = `
      <strong>${operation.label}</strong>
      <input data-key="${operation.key}" data-field="count" type="number" min="0" step="1" value="${clean(row.count)}" />
      <input data-key="${operation.key}" data-field="coef" type="number" min="0" step="0.1" value="${clean(row.coef)}" />
      <input data-key="${operation.key}" data-field="ffRate" type="number" min="0" step="0.01" value="${clean(row.ffRate)}" />
    `;
    line.querySelectorAll("input").forEach((input) => {
      input.addEventListener("input", () => {
        data[activeMonth].rows[input.dataset.key][input.dataset.field] = numberValue(input.value);
        renderDashboard();
      });
    });
    els.operationInputs.append(line);

    const planLine = document.createElement("div");
    planLine.className = "input-row plan-input-row";
    planLine.innerHTML = `
      <strong>${operation.label}</strong>
      <input data-plan-operation="${operation.key}" type="number" min="0" step="1" value="${clean(month.plan.operationCounts[operation.key] ?? 0)}" />
    `;
    planLine.querySelector("input").addEventListener("input", (event) => {
      data[activeMonth].plan.operationCounts[event.target.dataset.planOperation] = numberValue(event.target.value);
      renderDashboard();
    });
    els.planOperationInputs.append(planLine);
  });
}

function renderDashboard() {
  const current = calcMonth(activeMonth);
  const previousKey = getPreviousMonthKey(activeMonth);
  const previous = previousKey ? calcMonth(previousKey) : current;
  const forecast = calcForecast(current, data[activeMonth].plan);

  els.savingValue.textContent = money(current.saving);
  els.savingPercent.textContent = percent(-current.savingPercent);
  els.keyKpi.textContent = money(current.saving);
  els.costCompare.innerHTML = `
    <div class="mini-row"><span>Стоимость обработки</span><strong>${money(current.ownTotal)}</strong><strong>${money(current.ffTotal)}</strong></div>
    <div class="mini-row"><span>Разница</span><strong class="${tone(current.saving)}">${money(-current.saving)}</strong><strong>ФФ</strong></div>
  `;

  els.operationCosts.innerHTML = current.rows
    .map((row) => {
      const diffPercent = row.ffCost ? row.diff / row.ffCost : 0;
      return `
        <tr>
          <td>${row.label}</td>
          <td>${money(row.ownCost)}</td>
          <td>${money(row.ffCost)}</td>
          <td class="${tone(-row.diff)}">${money(row.diff)}<br><small>${percent(diffPercent)}</small></td>
        </tr>
      `;
    })
    .join("") + `
      <tr>
        <td><strong>Итого</strong></td>
        <td><strong>${money(current.ownTotal)}</strong></td>
        <td><strong>${money(current.ffTotal)}</strong></td>
        <td class="${tone(current.saving)}"><strong>${money(-current.saving)}</strong><br><small>${percent(-current.savingPercent)}</small></td>
      </tr>
    `;

  els.operationVolumes.innerHTML = current.rows
    .map((row) => `
      <div class="volume-row">
        <span>${row.label}</span>
        <strong>${integer(row.count)} шт.</strong>
      </div>
    `)
    .join("");
  els.totalFact.textContent = `${integer(current.factTotal)} шт.`;

  els.unitCosts.innerHTML = current.rows
    .map((row) => {
      const diff = row.ownRate - row.ffRate;
      return `
        <tr>
          <td>${row.label}</td>
          <td>${money2(row.ownRate)}</td>
          <td>${money2(row.ffRate)}</td>
          <td class="${tone(-diff)}">${money2(diff)}<br><small>${percent(row.ffRate ? diff / row.ffRate : 0)}</small></td>
        </tr>
      `;
    })
    .join("");

  renderForecast(current, forecast);

  els.weightedRows.innerHTML = monthOrder
    .filter((key) => data[key])
    .map((key) => calcMonth(key))
    .map((month) => `
      <tr>
        <td>${month.label}</td>
        <td>${integer(month.factTotal)}</td>
        <td>${integer(month.weightedTotal)}</td>
      </tr>
    `)
    .join("");

  const spendChange = change(current.ownTotal, previous.ownTotal);
  const weightedChange = change(current.weightedTotal, previous.weightedTotal);
  const factChange = change(current.factTotal, previous.factTotal);
  const unitChange = change(current.weightedUnit, previous.weightedUnit);
  const savingChange = change(current.saving, previous.saving);

  els.changes.innerHTML = [
    changeRow("Расходы склада", spendChange, true),
    changeRow("Объем взвешенный", weightedChange, false),
    changeRow("Факт операций", factChange, false),
    changeRow("Себестоимость 1 взвешенной ед.", unitChange, true),
    changeRow("Экономия против ФФ", savingChange, false),
  ].join("");

  els.conclusion.innerHTML = `
    <strong>Вывод:</strong>
    в месяце ${current.label} обработано ${percentText(weightedChange.rate)} взвешенного объема относительно ${previous.label}, а стоимость 1 взвешенной единицы
    ${unitChange.diff < 0 ? "снизилась" : "выросла"} на ${money2(Math.abs(unitChange.diff))} (${percentText(unitChange.rate)}).
    Текущая экономия собственного склада против ФФ: <strong>${money(current.saving)}</strong>.
  `;

  saveData();
}

function getPreviousMonthKey(monthKey) {
  const index = monthOrder.indexOf(monthKey);
  if (index <= 0) return "";
  return monthOrder[index - 1];
}

function changeRow(label, item, inverseGood) {
  const good = inverseGood ? item.diff <= 0 : item.diff >= 0;
  return `
    <div class="change-row">
      <span>${label}</span>
      <strong class="${good ? "positive" : "negative"}">${moneySigned(item.diff)} · ${percentText(item.rate)}</strong>
    </div>
  `;
}

function calcForecast(month, plan) {
  const daysPassed = Math.max(numberValue(plan.daysPassed), 1);
  const workDays = Math.max(numberValue(plan.workDays), daysPassed);
  const pace = workDays / daysPassed;
  const planRows = calcPlanRows(month, plan.operationCounts || {});
  const projectedRows = month.rows.map((row) => calcPlanOperation(row, row.count * pace));
  const projectedFact = sum(projectedRows, "count");
  const projectedWeighted = sum(projectedRows, "weighted");
  const projectedOwn = month.ownTotal * pace;
  const projectedFf = sum(projectedRows, "ffCost");
  const projectedSaving = projectedFf - projectedOwn;
  const targetFact = sum(planRows, "count");
  const targetWeighted = sum(planRows, "weighted");
  const targetOwn = numberValue(plan.targetOwnBudget);
  const targetFf = sum(planRows, "ffCost");
  const targetSaving = targetFf - targetOwn;

  return {
    plan: {
      targetFact,
      targetWeighted,
      targetSaving,
      targetOwn,
      targetFf,
      targetOwnBudget: numberValue(plan.targetOwnBudget),
      daysPassed,
      workDays,
    },
    projectedFact,
    projectedWeighted,
    projectedOwn,
    projectedFf,
    projectedSaving,
  };
}

function calcPlanRows(month, operationCounts) {
  return month.rows.map((row) => calcPlanOperation(row, operationCounts[row.key]));
}

function calcPlanOperation(row, count) {
  const planCount = numberValue(count);
  const ownCost = planCount * row.ownRate;
  const ffCost = planCount * row.ffRate;

  return {
    ...row,
    count: planCount,
    weighted: planCount * row.coef,
    ownCost,
    ffCost,
    saving: ffCost - ownCost,
  };
}

function renderForecast(month, forecast) {
  const plan = forecast.plan;
  const projectedSavingDelta = forecast.projectedSaving - plan.targetSaving;
  const projectedBudgetReserve = plan.targetOwnBudget - forecast.projectedOwn;
  const planSavingInput = document.querySelector("#planSaving");
  if (planSavingInput) planSavingInput.value = Math.round(plan.targetSaving);

  els.forecastSummary.innerHTML = `
    <div class="forecast-card">
      <span>Прогноз операций</span>
      <strong>${integer(forecast.projectedFact)} шт.</strong>
      <small class="${tone(forecast.projectedFact - plan.targetFact)}">${deltaText(forecast.projectedFact - plan.targetFact, "шт.")} к плану</small>
    </div>
    <div class="forecast-card">
      <span>Прогноз экономии</span>
      <strong>${money(forecast.projectedSaving)}</strong>
      <small class="${tone(projectedSavingDelta)}">${moneySigned(projectedSavingDelta)} к плану</small>
    </div>
    <div class="forecast-card">
      <span>Бюджет склада</span>
      <strong>${money(forecast.projectedOwn)}</strong>
      <small class="${tone(projectedBudgetReserve)}">${moneySigned(projectedBudgetReserve)} запас бюджета</small>
    </div>
    <div class="forecast-card">
      <span>Темп периода</span>
      <strong>${plan.daysPassed}/${plan.workDays} дней</strong>
      <small>прогноз по текущему среднему темпу</small>
    </div>
  `;

  els.planRows.innerHTML = [
    planRow("Операции", `${integer(month.factTotal)} шт.`, `${integer(plan.targetFact)} шт.`, `${integer(forecast.projectedFact)} шт.`, progress(month.factTotal, plan.targetFact), forecast.projectedFact - plan.targetFact),
    planRow("Взвешенный объем", integer(month.weightedTotal), integer(plan.targetWeighted), integer(forecast.projectedWeighted), progress(month.weightedTotal, plan.targetWeighted), forecast.projectedWeighted - plan.targetWeighted),
    planRow("Экономия", money(month.saving), money(plan.targetSaving), money(forecast.projectedSaving), progress(month.saving, plan.targetSaving), forecast.projectedSaving - plan.targetSaving),
    planRow("Стоимость ФФ по плану", money(month.ffTotal), money(plan.targetFf), money(forecast.projectedFf), progress(month.ffTotal, plan.targetFf), forecast.projectedFf - plan.targetFf),
    planRow("Расходы склада", money(month.ownTotal), money(plan.targetOwnBudget), money(forecast.projectedOwn), progress(month.ownTotal, plan.targetOwnBudget), plan.targetOwnBudget - forecast.projectedOwn),
  ].join("");
}

function planRow(label, fact, plan, projected, progressValue, forecastDelta) {
  return `
    <tr>
      <td>${label}<br><small>${percent(progressValue)} выполнено</small></td>
      <td>${fact}</td>
      <td>${plan}</td>
      <td class="${tone(forecastDelta)}">${projected}</td>
    </tr>
  `;
}

function progress(value, target) {
  if (!target) return 0;
  return value / target;
}

function change(current, previous) {
  const diff = current - previous;
  return {
    diff,
    rate: previous ? diff / previous : 0,
  };
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + Number(row[key] || 0), 0);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function numberValue(value) {
  return Number(String(value ?? "").replace(",", ".")) || 0;
}

function clean(value) {
  return Number(value.toFixed ? value.toFixed(4) : value);
}

function money(value) {
  return `${integer(value)} ₽`;
}

function money2(value) {
  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0)} ₽`;
}

function moneySigned(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${money(value)}`;
}

function deltaText(value, unit) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${integer(value)} ${unit}`;
}

function integer(value) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(value || 0);
}

function percent(value) {
  return `${new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format((value || 0) * 100)}%`;
}

function percentText(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${percent(value)}`;
}

function tone(value) {
  return value >= 0 ? "positive" : "negative";
}

render();

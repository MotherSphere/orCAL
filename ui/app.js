const themeState = {
  value: localStorage.getItem("orcal-theme") || "latte",
};

const root = document.documentElement;
const toggleButton = document.querySelector(".theme-toggle-button");
const toggleLabel = document.querySelector(".theme-toggle-label");
const keypad = document.querySelector(".calculator-keypad");
const expressionEl = document.querySelector("[data-expression]");
const resultEl = document.querySelector("[data-result]");
const resultWrapperEl = document.querySelector(".screen-result-wrapper");
const resultTooltipEl = document.querySelector("[data-result-tooltip]");
const statusTimeEl = document.querySelector(".status-time");
const statusIconsEl = document.querySelector(".status-icons");
const statusMessageEl = document.querySelector(".status-message");
const batteryButton = document.querySelector('[data-action="battery"]');

const tauriInvoke = window.__TAURI__?.tauri?.invoke ?? null;
const tauriAppWindow = window.__TAURI__?.window?.appWindow ?? null;
const isTauriAvailable = Boolean(tauriAppWindow);
let statusMessageTimeout = null;
const batteryLevels = [100, 80, 40, 20, 0];
let batteryIndex = 0;

const keys = [
  { label: "C", type: "utility", action: "clear" },
  { label: "±", type: "utility", action: "toggle-sign" },
  { label: "%", type: "utility", action: "percent" },
  { label: "⌫", type: "backspace", action: "backspace", ariaLabel: "Backspace" },
  { label: "7", type: "number" },
  { label: "8", type: "number" },
  { label: "9", type: "number" },
  { label: "÷", type: "operator", action: "operator" },
  { label: "4", type: "number" },
  { label: "5", type: "number" },
  { label: "6", type: "number" },
  { label: "×", type: "operator", action: "operator" },
  { label: "1", type: "number" },
  { label: "2", type: "number" },
  { label: "3", type: "number" },
  { label: "−", type: "operator", action: "operator" },
  { label: "0", type: "number" },
  { label: ".", type: "number", action: "decimal" },
  { label: "=", type: "operator", action: "equals" },
  { label: "+", type: "operator", action: "operator" },
];

const state = {
  expression: "",
  result: "0",
};

const operatorMap = {
  "÷": "/",
  "×": "*",
  "−": "-",
  "+": "+",
};

const renderKeys = () => {
  keys.forEach((key) => {
    const button = document.createElement("button");
    button.type = "button";
    button.classList.add("key");
    button.textContent = key.label;
    button.dataset.action = key.action || "input";

    if (key.type === "operator") {
      button.classList.add("key-operator");
    }

    if (key.type === "utility") {
      button.classList.add("key-utility");
    }

    if (key.type === "backspace") {
      button.classList.add("key-backspace");
      button.setAttribute("aria-label", key.ariaLabel || key.label);
    }

    keypad.appendChild(button);
  });
};

const updateStatusTime = () => {
  if (!statusTimeEl) {
    return;
  }
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  statusTimeEl.textContent = formatter.format(new Date());
};

const showStatusMessage = (message) => {
  if (!statusMessageEl) {
    return;
  }
  statusMessageEl.textContent = message;
  statusMessageEl.classList.add("status-message--visible");
  if (statusMessageTimeout) {
    window.clearTimeout(statusMessageTimeout);
  }
  statusMessageTimeout = window.setTimeout(() => {
    statusMessageEl.classList.remove("status-message--visible");
    statusMessageEl.textContent = "";
  }, 3_000);
};

const updateBatteryButton = () => {
  if (!batteryButton) {
    return;
  }
  const level = batteryLevels[batteryIndex];
  const icon = level <= 20 ? "🪫" : "🔋";
  batteryButton.textContent = icon;
  batteryButton.dataset.batteryLevel = `${level}`;
  batteryButton.setAttribute("aria-label", `Battery ${level}%`);
};

const disableInterface = () => {
  document.documentElement.classList.add("app-disabled");
  document.querySelectorAll("button").forEach((button) => {
    button.disabled = true;
    button.setAttribute("aria-disabled", "true");
  });
};

const applyTheme = () => {
  root.dataset.theme = themeState.value;
  toggleButton.setAttribute("aria-pressed", themeState.value === "mocha");
  toggleLabel.textContent = themeState.value === "mocha" ? "Mocha" : "Latte";
};

const updateScreen = () => {
  expressionEl.textContent = state.expression || "";
  resultEl.textContent = state.result || "0";
  if (resultTooltipEl) {
    resultTooltipEl.textContent = state.result || "0";
  }
  if (resultWrapperEl) {
    requestAnimationFrame(() => {
      const isOverflowing =
        resultEl.scrollWidth > resultEl.clientWidth;
      resultWrapperEl.classList.toggle(
        "screen-result-wrapper--tooltip",
        isOverflowing,
      );
    });
  }
};

const formatResult = (value, { useGrouping = false } = {}) => {
  const normalized = value.toString().replace(",", ".");
  const numberValue = Number.parseFloat(normalized);
  if (Number.isNaN(numberValue)) {
    return value;
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    useGrouping,
  }).format(numberValue);
};

const lastNumberMatch = () =>
  state.expression.match(/(-?\d+(?:[.,]\d+)?)$/u);

const toggleSign = () => {
  const match = lastNumberMatch();
  if (!match) {
    return;
  }
  const [number] = match;
  const start = state.expression.slice(0, -number.length);
  const updated = number.startsWith("-")
    ? number.slice(1)
    : `-${number}`;
  state.expression = `${start}${updated}`;
};

const applyPercent = () => {
  const match = lastNumberMatch();
  if (!match) {
    return;
  }
  const [number] = match;
  const normalized = number.replace(",", ".");
  const value = Number.parseFloat(normalized);
  if (Number.isNaN(value)) {
    return;
  }
  const percentValue = value / 100;
  const formatted = formatResult(percentValue.toString(), { useGrouping: false });
  const start = state.expression.slice(0, -number.length);
  state.expression = `${start}${formatted}`;
};

const appendOperator = (operator) => {
  if (!state.expression) {
    return;
  }
  if (/[+\-*/]$/u.test(state.expression)) {
    state.expression = `${state.expression.slice(0, -1)}${operator}`;
    return;
  }
  state.expression = `${state.expression}${operator}`;
};

const appendInput = (value) => {
  if (value === "." || value === ",") {
    const match = lastNumberMatch();
    if (match && /[.,]/u.test(match[0])) {
      return;
    }
  }
  const normalizedValue = value === "," ? "." : value;
  state.expression = `${state.expression}${normalizedValue}`;
};

const toBackendExpression = () =>
  state.expression
    .split("")
    .map((char) => operatorMap[char] || char)
    .join("")
    .replace(/,/gu, ".");

const evaluateExpression = async () => {
  if (!state.expression) {
    return;
  }
  if (!tauriInvoke) {
    state.result = "Available in Tauri";
    return;
  }
  try {
    const response = await tauriInvoke("evaluate_expression", {
      expression: toBackendExpression(),
    });
    state.result = formatResult(response.result);
  } catch (error) {
    state.result =
      typeof error === "string" ? error : "Invalid expression";
  }
};

const handleInputAction = async ({ action, label }) => {
  switch (action) {
    case "clear":
      state.expression = "";
      state.result = "0";
      break;
    case "backspace":
      state.expression = state.expression.slice(0, -1);
      break;
    case "toggle-sign":
      toggleSign();
      break;
    case "percent":
      applyPercent();
      break;
    case "operator":
      appendOperator(operatorMap[label] || label);
      break;
    case "equals":
      await evaluateExpression();
      break;
    default:
      appendInput(label);
  }

  updateScreen();
};

keypad.addEventListener("click", async (event) => {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  await handleInputAction({
    action: button.dataset.action,
    label: button.textContent,
  });
});

document.addEventListener("keydown", async (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return;
  }

  const { key, code } = event;
  let action = null;
  let label = null;

  if (/^\d$/u.test(key)) {
    action = "input";
    label = key;
  } else if (key === "," || key === ".") {
    action = "decimal";
    label = ".";
  } else if (["+", "-", "*", "/"].includes(key)) {
    action = "operator";
    label = key;
  } else if (key === "%") {
    action = "percent";
  } else if (key === "Enter" || code === "NumpadEnter") {
    action = "equals";
  } else if (key === "Backspace") {
    action = "backspace";
  } else if (key === "Delete" || key === "Escape") {
    action = "clear";
  }

  if (!action) {
    return;
  }

  event.preventDefault();
  await handleInputAction({ action, label });
});

updateStatusTime();
setInterval(updateStatusTime, 60_000);

toggleButton.addEventListener("click", () => {
  themeState.value = themeState.value === "mocha" ? "latte" : "mocha";
  localStorage.setItem("orcal-theme", themeState.value);
  applyTheme();
});

statusIconsEl?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  if (
    button.dataset.action !== "battery" &&
    button.getAttribute("aria-disabled") === "true"
  ) {
    showStatusMessage("Available only in the Tauri app.");
    return;
  }

  const appWindow = tauriAppWindow;
  if (button.dataset.action === "battery") {
    batteryIndex = batteryLevels.length - 1;
    const level = batteryLevels[batteryIndex];
    updateBatteryButton();
    showStatusMessage("Battery empty, orCAL is shutting down.");
    if (appWindow?.close) {
      window.setTimeout(() => appWindow.close(), 800);
    } else {
      window.close();
      disableInterface();
    }
    return;
  }

  if (button.dataset.action === "minimize") {
    if (appWindow?.minimize) {
      appWindow.minimize();
    } else {
      showStatusMessage("Available only in the Tauri app.");
      console.warn("Tauri appWindow unavailable for minimize.");
    }
  }

  if (button.dataset.action === "close") {
    if (appWindow?.close) {
      appWindow.close();
    } else {
      window.close();
      showStatusMessage("Available only in the Tauri app.");
      console.warn("Tauri appWindow unavailable for close.");
    }
  }
});

if (!isTauriAvailable) {
  document
    .querySelectorAll(
      ".status-icon-button[data-action='minimize'], .status-icon-button[data-action='close']",
    )
    .forEach((button) => {
      button.setAttribute("aria-disabled", "true");
      button.classList.add("status-icon-button--disabled");
    });
}

renderKeys();
applyTheme();
updateScreen();
updateBatteryButton();

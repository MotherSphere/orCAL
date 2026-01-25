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
const frameEl = document.querySelector(".calculator-tablet-frame");
const tabletBodyEl = document.querySelector(".calculator-tablet-body");
const modePillEl = document.querySelector(".mode-pill");
const modeToggleEl = document.querySelector(".status-mode-toggle");

const modeState = {
  value: localStorage.getItem("orcal-calc-mode") || "scientific",
};


const tauriInvoke = window.__TAURI__?.tauri?.invoke ?? null;

// Tablet scientific layout (7 columns x 5 rows).
// Order matters (CSS grid auto-placement).
// Standard (simplified) keypad (4 columns x 5 rows).
const keysStandard = [
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
  { label: ".", type: "number", ariaLabel: "Decimal point" },
  { label: "+", type: "operator", action: "operator" },
  { label: "=", type: "operator", action: "equals" },
];

// Scientific keypad (7 columns x 5 rows).
const keysScientific = [
  { label: "(", type: "muted", action: "paren" },
  { label: ")", type: "muted", action: "paren" },
  { label: "π", type: "muted", action: "const-pi", ariaLabel: "Pi" },
  { label: "C", type: "utility", action: "clear" },
  { label: "±", type: "utility", action: "toggle-sign" },
  { label: "%", type: "utility", action: "percent" },
  { label: "⌫", type: "backspace", action: "backspace", ariaLabel: "Backspace" },

  { label: "sin", type: "muted", action: "func" },
  { label: "cos", type: "muted", action: "func" },
  { label: "tan", type: "muted", action: "func" },
  { label: "7", type: "number" },
  { label: "8", type: "number" },
  { label: "9", type: "number" },
  { label: "÷", type: "operator", action: "operator" },

  { label: "ln", type: "muted", action: "func" },
  { label: "log", type: "muted", action: "func" },
  { label: "√", type: "muted", action: "sqrt", ariaLabel: "Square root" },
  { label: "4", type: "number" },
  { label: "5", type: "number" },
  { label: "6", type: "number" },
  { label: "×", type: "operator", action: "operator" },

  { label: "x²", type: "muted", action: "square" },
  { label: "xʸ", type: "muted", action: "power" },
  { label: "1/x", type: "muted", action: "reciprocal" },
  { label: "1", type: "number" },
  { label: "2", type: "number" },
  { label: "3", type: "number" },
  { label: "−", type: "operator", action: "operator" },

  { label: "e", type: "muted", action: "const-e", ariaLabel: "Euler's number" },
  { label: "!", type: "muted", action: "factorial" },
  { label: "ANS", type: "muted", action: "ans", ariaLabel: "Last result" },
  { label: "0", type: "number" },
  { label: ".", type: "number", action: "decimal" },
  { label: "=", type: "operator", action: "equals" },
  { label: "+", type: "operator", action: "operator" },
];

const state = {
  expression: "",
  result: "0",
};

const memory = {
  ans: "0",
};

const operatorMap = {
  "÷": "/",
  "×": "*",
  "−": "-",
  "+": "+",
  "^": "^",
};

let activeKeys = modeState.value === "scientific" ? keysScientific : keysStandard;

const renderKeys = () => {
  keypad.innerHTML = "";
  activeKeys.forEach((key) => {
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

    if (key.type === "muted") {
      button.classList.add("key-muted");
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
    maximumFractionDigits: 8,
    useGrouping,
  }).format(numberValue);
};

const lastNumberMatch = () =>
  state.expression.match(/(-?\d+(?:[.,]\d+)?)$/u);

const extractLastAtom = () => {
  const expr = state.expression;
  if (!expr) {
    return null;
  }

  if (expr.endsWith("ANS")) {
    return { start: expr.length - 3, end: expr.length, text: "ANS" };
  }

  const lastChar = expr.at(-1);
  if (lastChar === "π" || lastChar === "e") {
    return { start: expr.length - 1, end: expr.length, text: lastChar };
  }

  if (lastChar === ")") {
    let depth = 0;
    let start = -1;
    for (let i = expr.length - 1; i >= 0; i -= 1) {
      if (expr[i] === ")") {
        depth += 1;
      } else if (expr[i] === "(") {
        depth -= 1;
        if (depth === 0) {
          start = i;
          break;
        }
      }
    }
    if (start === -1) {
      return null;
    }

    // Include any function name right before the parentheses (sin, cos, ln, ...)
    let fnStart = start;
    for (let i = start - 1; i >= 0; i -= 1) {
      if (/[a-z]/iu.test(expr[i])) {
        fnStart = i;
      } else {
        break;
      }
    }

    return { start: fnStart, end: expr.length, text: expr.slice(fnStart) };
  }

  const match = lastNumberMatch();
  if (match) {
    const [number] = match;
    return {
      start: expr.length - number.length,
      end: expr.length,
      text: number,
    };
  }

  return null;
};

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
  if (/[+\-*/^]$/u.test(state.expression)) {
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

const insertFunction = (name) => {
  // Always insert an opening parenthesis for a natural scientific flow.
  state.expression = `${state.expression}${name}(`;
};

const insertConstant = (symbol) => {
  state.expression = `${state.expression}${symbol}`;
};

const applySquare = () => {
  const atom = extractLastAtom();
  if (!atom) {
    return;
  }
  const before = state.expression.slice(0, atom.start);
  const target = atom.text;
  state.expression = `${before}(${target})^2`;
};

const applyReciprocal = () => {
  const atom = extractLastAtom();
  if (!atom) {
    return;
  }
  const before = state.expression.slice(0, atom.start);
  const target = atom.text;
  state.expression = `${before}1/(${target})`;
};

const degreesToRadians = (value) => (value * Math.PI) / 180;

const safeLocalEvaluate = (rawExpression) => {
  const allowedIdentifiers = new Set([
    "sin",
    "cos",
    "tan",
    "ln",
    "log",
    "sqrt",
    "PI",
    "E",
    "ANS",
  ]);

  let expr = rawExpression
    .replace(/×/gu, "*")
    .replace(/÷/gu, "/")
    .replace(/−/gu, "-")
    .replace(/,/gu, ".")
    .replace(/π/gu, "PI")
    .replace(/\bANS\b/gu, "ANS")
    .replace(/(?<![A-Za-z0-9_])e(?![A-Za-z0-9_])/gu, "E")
    .replace(/\^/gu, "**");

  // Reject anything that is not part of our tiny expression language.
  if (!/^[0-9A-Za-z_+\-*/().\s]*$/u.test(expr)) {
    throw new Error("Invalid expression");
  }

  const identifiers = expr.match(/[A-Za-z_]+/gu) ?? [];
  for (const ident of identifiers) {
    if (!allowedIdentifiers.has(ident)) {
      throw new Error("Unsupported function");
    }
  }

  const context = {
    sin: (value) => Math.sin(degreesToRadians(value)),
    cos: (value) => Math.cos(degreesToRadians(value)),
    tan: (value) => Math.tan(degreesToRadians(value)),
    ln: (value) => Math.log(value),
    log: (value) => (Math.log10 ? Math.log10(value) : Math.log(value) / Math.LN10),
    sqrt: (value) => Math.sqrt(value),
    PI: Math.PI,
    E: Math.E,
    ANS: Number.parseFloat(memory.ans.toString().replace(",", ".")) || 0,
  };

  const names = Object.keys(context);
  const values = Object.values(context);

  // eslint-disable-next-line no-new-func
  const fn = new Function(...names, `"use strict"; return (${expr});`);
  const result = fn(...values);

  if (typeof result !== "number" || Number.isNaN(result) || !Number.isFinite(result)) {
    throw new Error("Invalid result");
  }
  return result;
};

const factorialNumber = (value) => {
  if (!Number.isFinite(value)) {
    throw new Error("Invalid expression");
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("Factorial: integer ≥ 0");
  }
  if (value > 170) {
    // 171! overflows to Infinity in JS.
    throw new Error("Factorial too large");
  }
  let result = 1;
  for (let i = 2; i <= value; i += 1) {
    result *= i;
  }
  return result;
};

const applyFactorial = () => {
  const atom = extractLastAtom();
  if (!atom) {
    return;
  }
  try {
    const value = safeLocalEvaluate(atom.text);
    const computed = factorialNumber(value);
    const before = state.expression.slice(0, atom.start);
    state.expression = `${before}${formatResult(computed.toString(), { useGrouping: false })}`;
  } catch (error) {
    state.result = typeof error === "string" ? error : error?.message ?? "Invalid expression";
  }
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
  const raw = state.expression;
  const shouldUseBackend =
    Boolean(tauriInvoke) &&
    !/[a-z]/iu.test(raw) &&
    !/[π^√]/u.test(raw) &&
    !/\bANS\b/u.test(raw) &&
    !/(?<![A-Za-z0-9_])e(?![A-Za-z0-9_])/u.test(raw);

  if (shouldUseBackend) {
    try {
      const response = await tauriInvoke("evaluate_expression", {
        expression: toBackendExpression(),
      });
      state.result = formatResult(response.result);
      memory.ans = state.result;
      return;
    } catch (error) {
      state.result = typeof error === "string" ? error : "Invalid expression";
      return;
    }
  }

  try {
    const computed = safeLocalEvaluate(raw);
    state.result = formatResult(computed.toString());
    memory.ans = state.result;
  } catch (error) {
    state.result = typeof error === "string" ? error : error?.message ?? "Invalid expression";
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
    case "paren":
      appendInput(label);
      break;
    case "const-pi":
      insertConstant("π");
      break;
    case "const-e":
      insertConstant("e");
      break;
    case "ans":
      appendInput("ANS");
      break;
    case "func":
      insertFunction(label);
      break;
    case "sqrt":
      insertFunction("sqrt");
      break;
    case "square":
      applySquare();
      break;
    case "power":
      appendOperator("^");
      break;
    case "reciprocal":
      applyReciprocal();
      break;
    case "factorial":
      applyFactorial();
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


const applyModeUI = () => {
  const isScientific = modeState.value === "scientific";
  if (frameEl) {
    frameEl.dataset.mode = modeState.value;
  }
  if (tabletBodyEl) {
    tabletBodyEl.setAttribute(
      "aria-label",
      isScientific ? "Scientific calculator" : "Calculator"
    );
  }
  if (modePillEl) {
    modePillEl.textContent = isScientific ? "Scientific" : "Standard";
    modePillEl.classList.remove("mode-pill-swap");
    // Force reflow to restart animation.
    void modePillEl.offsetWidth;
    modePillEl.classList.add("mode-pill-swap");
  }
  if (modeToggleEl) {
    modeToggleEl.setAttribute("aria-pressed", String(isScientific));
    modeToggleEl.setAttribute(
      "aria-label",
      isScientific ? "Switch to standard mode" : "Switch to scientific mode"
    );
    modeToggleEl.title = isScientific
      ? "Switch to standard mode"
      : "Switch to scientific mode";
    modeToggleEl.classList.remove("mode-toggle-pulse");
    void modeToggleEl.offsetWidth;
    modeToggleEl.classList.add("mode-toggle-pulse");
  }
};

let isModeSwitching = false;

const setMode = (nextMode) => {
  if (isModeSwitching || nextMode === modeState.value) {
    return;
  }
  isModeSwitching = true;

  // Animate keypad out, then swap, then animate in.
  keypad.classList.remove("keypad-swap-in");
  keypad.classList.add("keypad-swap-out");

  window.setTimeout(() => {
    modeState.value = nextMode;
    localStorage.setItem("orcal-calc-mode", nextMode);
    activeKeys = nextMode === "scientific" ? keysScientific : keysStandard;

    applyModeUI();
    renderKeys();

    keypad.classList.remove("keypad-swap-out");
    keypad.classList.add("keypad-swap-in");

    window.setTimeout(() => {
      keypad.classList.remove("keypad-swap-in");
      isModeSwitching = false;
    }, 240);
  }, 180);
};

const toggleMode = () => {
  setMode(modeState.value === "scientific" ? "standard" : "scientific");
};

if (modeToggleEl) {
  modeToggleEl.addEventListener("click", toggleMode);
}

applyModeUI();

renderKeys();
applyTheme();
updateScreen();

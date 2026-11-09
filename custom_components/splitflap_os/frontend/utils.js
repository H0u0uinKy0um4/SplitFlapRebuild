/** Small, dependency-free helpers used by the panel. */

export function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

export function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

/** Replace `{name}` placeholders without touching unknown placeholders. */
export function formatMessage(template, params) {
  if (!params) return String(template);
  return String(template).replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name])
      : match
  );
}

function numberText(value) {
  if (value === null || value === undefined || value === "") return "–";
  return String(value);
}

function centerLine(line, cols) {
  const value = String(line || "");
  if (value.length >= cols) return value.slice(0, cols);
  const left = Math.floor((cols - value.length) / 2);
  return " ".repeat(left) + value + " ".repeat(cols - value.length - left);
}

/**
 * QR 编码封装：基于 `qrcode`（MIT），浏览器端经 Rollup 打成 bundle。
 */
import QRCode from "qrcode";

export const QR_LEVELS = Object.freeze(["L", "M", "Q", "H"]);

/**
 * @param {string} text
 * @param {{ level?: 'L'|'M'|'Q'|'H', margin?: number, width?: number, dark?: string, light?: string }} [options]
 */
export async function encodeQrSvg(text, options = {}) {
  const payload = String(text ?? "");
  if (!payload) throw new Error("请输入要编码的文本");
  const level = options.level || "M";
  if (!QR_LEVELS.includes(level)) throw new Error("纠错级别须为 L/M/Q/H");

  return QRCode.toString(payload, {
    type: "svg",
    errorCorrectionLevel: level,
    margin: options.margin ?? 2,
    width: options.width ?? 256,
    color: {
      dark: options.dark || "#000000",
      light: options.light || "#ffffff",
    },
  });
}

/**
 * @param {string} text
 * @param {{ level?: 'L'|'M'|'Q'|'H' }} [options]
 * @returns {Promise<boolean[][]>}
 */
export async function encodeQrModules(text, options = {}) {
  const payload = String(text ?? "");
  if (!payload) throw new Error("请输入要编码的文本");
  const level = options.level || "M";
  const qr = QRCode.create(payload, { errorCorrectionLevel: level });
  const size = qr.modules.size;
  const modules = [];
  for (let y = 0; y < size; y++) {
    const row = [];
    for (let x = 0; x < size; x++) row.push(Boolean(qr.modules.get(x, y)));
    modules.push(row);
  }
  return modules;
}

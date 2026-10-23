/**
 * URL 编解码纯函数（浏览器 / Node 共用）
 */

export function encodeComponent(text) {
  return encodeURIComponent(String(text ?? ""));
}

export function decodeComponent(text) {
  const raw = String(text ?? "");
  try {
    return decodeURIComponent(raw.replace(/\+/g, "%20"));
  } catch {
    throw new Error("无法解码：包含非法百分号编码");
  }
}

export function encodeUri(text) {
  return encodeURI(String(text ?? ""));
}

export function decodeUri(text) {
  const raw = String(text ?? "");
  try {
    return decodeURI(raw);
  } catch {
    throw new Error("无法解码：包含非法百分号编码");
  }
}

/** application/x-www-form-urlencoded：空格 → + */
export function encodeForm(text) {
  return encodeURIComponent(String(text ?? "")).replace(/%20/g, "+");
}

export function decodeForm(text) {
  return decodeComponent(String(text ?? "").replace(/\+/g, "%20"));
}

export function applyUrlCodec(mode, text) {
  switch (mode) {
    case "encode-component":
      return encodeComponent(text);
    case "decode-component":
      return decodeComponent(text);
    case "encode-uri":
      return encodeUri(text);
    case "decode-uri":
      return decodeUri(text);
    case "encode-form":
      return encodeForm(text);
    case "decode-form":
      return decodeForm(text);
    default:
      throw new Error("未知模式：" + mode);
  }
}

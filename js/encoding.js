/**
 * Eazit Reader - Robust Korean Text Encoding Detector & Decoder
 * Fallback Chain: BOM Detection -> Strict UTF-8 -> EUC-KR / CP949 -> Lenient UTF-8
 */

export function decodeText(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);

  // 1) BOM (Byte Order Mark) Detection
  if (bytes.length >= 3 && bytes[0] === 0xEF && bytes[1] === 0xBB && bytes[2] === 0xBF) {
    return new TextDecoder('utf-8').decode(arrayBuffer);
  }
  if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) {
    return new TextDecoder('utf-16le').decode(arrayBuffer);
  }
  if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) {
    return new TextDecoder('utf-16be').decode(arrayBuffer);
  }

  // 2) Strict UTF-8 Decoding (throws exception if invalid byte sequence found)
  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true });
    return utf8.decode(arrayBuffer);
  } catch (e) {
    // UTF-8 failed, likely Korean legacy encoding
  }

  // 3) EUC-KR / CP949 (Covers majority of Korean web novels)
  try {
    return new TextDecoder('euc-kr').decode(arrayBuffer);
  } catch (e) {}

  // 4) Fallback: Lenient UTF-8
  return new TextDecoder('utf-8', { fatal: false }).decode(arrayBuffer);
}

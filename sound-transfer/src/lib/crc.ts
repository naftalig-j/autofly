// CRC-8/MAXIM (Dallas/Maxim 1-Wire) polynomial 0x31

const TABLE = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x01 ? (crc >>> 1) ^ 0x8c : crc >>> 1;
    }
    t[i] = crc;
  }
  return t;
})();

export function crc8(data: Uint8Array | Uint8Array<ArrayBuffer>): number {
  let crc = 0x00;
  for (const byte of data) {
    crc = TABLE[crc ^ byte];
  }
  return crc;
}

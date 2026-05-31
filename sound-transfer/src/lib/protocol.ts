// ─── Audio Protocol Constants ─────────────────────────────────────────────────
// MFSK-16: 16 data frequencies encode one nibble (4 bits) per symbol.
// Two symbols per byte → 2× overhead but very robust detection.
//
// Packet layout:
//   [SYNC×3] [LEN_NIB3][LEN_NIB2][LEN_NIB1][LEN_NIB0] [DATA nibbles…] [CRC_HI][CRC_LO] [END×3]
//
// Throughput at 80 ms/symbol: ~6.25 bytes/sec (100 chars ≈ 16 s, 300 B ≈ 48 s)

export const SAMPLE_RATE         = 44100;
export const SYMBOL_DURATION_S   = 0.08;    // 80 ms — more robust in noisy environments
export const SYMBOL_DURATION_MS  = SYMBOL_DURATION_S * 1000;
export const SYMBOL_SAMPLES      = Math.floor(SAMPLE_RATE * SYMBOL_DURATION_S); // 3528

// Control tones (outside the data band)
export const FREQ_SYNC = 800;   // Preamble marker
export const FREQ_END  = 2700;  // Postamble marker

// 16 data tones: 1000 Hz … 2500 Hz in 100 Hz steps
export const DATA_FREQS: readonly number[] = Array.from({ length: 16 }, (_, i) => 1000 + i * 100);

// All recognised frequencies (for FFT bin pre-computation)
export const ALL_FREQS: readonly number[] = [FREQ_SYNC, ...DATA_FREQS, FREQ_END];

// Maximum payload before image needs to be compressed
export const MAX_PAYLOAD_BYTES = 512;

// ─── Decoder noise-rejection & consensus parameters ───────────────────────────

export const POLL_INTERVAL_MS        = 8;
export const READINGS_WINDOW         = 10;  // ~80 ms of history (10 × 8 ms = one symbol)
export const MIN_CONSENSUS           = 7;   // 7/10 readings must agree

// ── dBFS detection gates ──────────────────────────────────────────────────────
//
// We use getFloatFrequencyData which returns actual dBFS values (negative, e.g. −12).
// getByteFrequencyData's default window is only −100…−30 dBFS (70 dB range) which
// causes the Blackman sidelobe leakage at −25 dBFS to saturate to the same byte
// as the −12 dBFS peak, making the dominance ratio 1.0 — impossible to pass.
//
// Gate 1  MIN_PEAK_DB:      signal below this is treated as silence.
// Gate 2  NOISE_HEADROOM_DB: peak must exceed calibrated noise floor by this many dB.
// Gate 3  PEAK_DOMINANCE_DB: peak must exceed 2nd-best recognised tone by this many dB.
//         With fftSize=2048 the adjacent-tone leakage (100 Hz away = 3.6 bins) is
//         ≈ −13 dB below the peak → 13 dB > 8 dB threshold ✓.
export const MIN_PEAK_DB             = -50; // dBFS — "is there a signal at all?"
export const NOISE_HEADROOM_DB       = 10;  // dB above calibrated noise floor
export const PEAK_DOMINANCE_DB       = 8;   // dB above 2nd-best recognised tone

// Calibration: measure ambient noise for this long before listening for SYNC.
export const CALIBRATION_MS          = 400;

// Display normalisation: map this dBFS range to 0–1 for the spectrum visualiser.
export const FFT_DB_DISPLAY_MIN      = -80;
export const FFT_DB_DISPLAY_RANGE    = 70;  // so −80…−10 dBFS → 0…1

// fftSize = 2048  →  window = 2048/44100 ≈ 46 ms
// Symbol duration  = 80 ms
// We read at 75 % of a symbol (60 ms in), so the 46 ms window spans 14–60 ms —
// entirely inside the current symbol (no bleed from adjacent symbols).
//
// Frequency resolution: 44100/2048 ≈ 21.5 Hz/bin.
// Our data tones are 100 Hz apart = 4.65 bins — beyond the Blackman window's
// first null at ±3 bins, so adjacent tones do not bleed into each other's bin.
// fftSize=1024 (43 Hz/bin) gave only 2.3 bins between tones, which is inside
// the Blackman main lobe — causing the dominance gate to always fail.
export const FFT_SIZE                = 2048;
// Minimum duration (ms) the SYNC tone must be held before the decoder locks on.
// Replaces the old "syncCount" approach — the encoder sends 3×80ms = 240ms of SYNC,
// so 40ms minimum is very conservative and still rejects brief false triggers.
export const SYNC_MIN_DURATION_MS    = 40;
export const HEADER_NIBBLES          = 4;   // encodes 16-bit payload length
export const CHECKSUM_NIBBLES        = 2;   // encodes CRC-8

// Hardware bandpass filter bounds (applied before the analyser to strip out-of-band noise)
export const BANDPASS_LOW_HZ         = 650;   // removes speech, AC hum, rumble
export const BANDPASS_HIGH_HZ        = 2900;  // removes hiss, HF interference

export type DecoderState =
  | 'idle'
  | 'calibrating'
  | 'detecting_sync'
  | 'reading_header'
  | 'reading_data'
  | 'reading_checksum'
  | 'done'
  | 'error';

export type TransferPayloadType = 'text' | 'image' | 'binary';

export interface TransferPacket {
  type: TransferPayloadType;
  data: Uint8Array;
}

// First byte of the payload encodes content type
export const TYPE_TAG_TEXT   = 0x54; // 'T'
export const TYPE_TAG_IMAGE  = 0x49; // 'I'
export const TYPE_TAG_BINARY = 0x42; // 'B'

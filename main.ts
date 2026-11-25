// news-image-20261125 — v1 entry: "The World in One Day"
// A program that draws one newspaper front page summing up Wednesday 25 November 2026
// and writes it to /output/entry.png (MAKEFUN_OUTPUT_DIR, else ./out).
// Pure Node 22 stdlib. No network, no Date, no randomness: two runs write identical bytes.
// Text is rendered with an embedded 5x7 bitmap font (no image model: text stays exact).

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import * as crypto from "node:crypto";

export const W = 1024;
export const H = 1024;

// ---------------------------------------------------------------------------
// 5x7 bitmap font. Each glyph: 7 rows of 5 chars ('1' = ink). Baseline is row 6.
// Capitals/digits use rows 0-6; lowercase x-height sits on rows 2-6; descenders
// (g, j, p, q, y) drop to row 6; ascenders (b, d, f, h, k, l, t) reach row 0.
// ---------------------------------------------------------------------------
export const FONT: Record<string, string[]> = {
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  a: ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
  b: ["10000", "10000", "11110", "10001", "10001", "10001", "11110"],
  c: ["00000", "00000", "01110", "10000", "10000", "10001", "01110"],
  d: ["00001", "00001", "01111", "10001", "10001", "10001", "01111"],
  e: ["00000", "00000", "01110", "10001", "11111", "10000", "01110"],
  f: ["00110", "01001", "01000", "11110", "01000", "01000", "01000"],
  g: ["00000", "01110", "10001", "10001", "01111", "00001", "01110"],
  h: ["10000", "10000", "11110", "10001", "10001", "10001", "10001"],
  i: ["00000", "00100", "00000", "01100", "00100", "00100", "01110"],
  j: ["00010", "00000", "00110", "00010", "00010", "00010", "01100"],
  k: ["10000", "10000", "10010", "10100", "11000", "10100", "10010"],
  l: ["01100", "00100", "00100", "00100", "00100", "00100", "01110"],
  m: ["00000", "00000", "11010", "10101", "10101", "10101", "10101"],
  n: ["00000", "00000", "11110", "10001", "10001", "10001", "10001"],
  o: ["00000", "00000", "01110", "10001", "10001", "10001", "01110"],
  p: ["00000", "00000", "11110", "10001", "10001", "11110", "10000"],
  q: ["00000", "00000", "01111", "10001", "10001", "01111", "00001"],
  r: ["00000", "00000", "10110", "11001", "10000", "10000", "10000"],
  s: ["00000", "00000", "01111", "10000", "01110", "00001", "11110"],
  t: ["01000", "01000", "11110", "01000", "01000", "01000", "00110"],
  u: ["00000", "00000", "10001", "10001", "10001", "10011", "01101"],
  v: ["00000", "00000", "10001", "10001", "10001", "01010", "00100"],
  w: ["00000", "00000", "10001", "10101", "10101", "10101", "01010"],
  x: ["00000", "00000", "10001", "01010", "00100", "01010", "10001"],
  y: ["00000", "00000", "10001", "10001", "01111", "00001", "01110"],
  z: ["00000", "00000", "11111", "00010", "00100", "01000", "11111"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  '"': ["01010", "01010", "01010", "00000", "00000", "00000", "00000"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "*": ["00000", "10101", "01110", "10101", "00000", "00000", "00000"],
  "+": ["00000", "00100", "00100", "11111", "00100", "00100", "00000"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "<": ["00010", "00100", "01000", "10000", "01000", "00100", "00010"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  ">": ["01000", "00100", "00010", "00001", "00010", "00100", "01000"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "@": ["01110", "10001", "10111", "10101", "10110", "10000", "01110"],
  "[": ["01110", "01000", "01000", "01000", "01000", "01000", "01110"],
  "]": ["01110", "00010", "00010", "00010", "00010", "00010", "01110"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  "~": ["00000", "00000", "01101", "10110", "00000", "00000", "00000"],
  "•": ["00000", "00100", "01110", "01110", "01110", "00100", "00000"],
};

// ---------------------------------------------------------------------------
// Canvas: a plain RGB buffer + drawing primitives. All coordinates are ints.
// ---------------------------------------------------------------------------
export type RGB = [number, number, number];
export const PAPER: RGB = [247, 241, 227];
export const INK: RGB = [26, 26, 26];
export const NAVY: RGB = [27, 58, 92];
export const RED: RGB = [176, 30, 36];
export const GOLD: RGB = [201, 162, 39];
export const TEAL: RGB = [46, 110, 106];
export const GREY: RGB = [107, 107, 107];
export const SEA: RGB = [191, 217, 222];
export const LAND: RGB = [222, 205, 160];
export const NIGHT: RGB = [14, 27, 46];
export const CREAM2: RGB = [238, 230, 211];
export const WHITE: RGB = [255, 255, 255];
export const ORANGE: RGB = [224, 122, 31];
export const YELLOW: RGB = [240, 196, 66];

export class Canvas {
  buf: Uint8Array;
  constructor() {
    this.buf = new Uint8Array(W * H * 3);
    for (let i = 0; i < W * H; i++) {
      this.buf[i * 3] = PAPER[0];
      this.buf[i * 3 + 1] = PAPER[1];
      this.buf[i * 3 + 2] = PAPER[2];
    }
  }
  px(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3;
    this.buf[i] = c[0];
    this.buf[i + 1] = c[1];
    this.buf[i + 2] = c[2];
  }
  fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(W, Math.floor(x + w));
    const y1 = Math.min(H, Math.floor(y + h));
    for (let yy = y0; yy < y1; yy++) {
      let i = (yy * W + x0) * 3;
      for (let xx = x0; xx < x1; xx++) {
        this.buf[i] = c[0];
        this.buf[i + 1] = c[1];
        this.buf[i + 2] = c[2];
        i += 3;
      }
    }
  }
  hline(x0: number, x1: number, y: number, c: RGB, t = 1): void {
    this.fillRect(Math.min(x0, x1), y, Math.abs(x1 - x0) + 1, t, c);
  }
  vline(x: number, y0: number, y1: number, c: RGB, t = 1): void {
    this.fillRect(x, Math.min(y0, y1), t, Math.abs(y1 - y0) + 1, c);
  }
  rect(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
    this.fillRect(x, y, w, t, c);
    this.fillRect(x, y + h - t, w, t, c);
    this.fillRect(x, y, t, h, c);
    this.fillRect(x + w - t, y, t, h, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    let x = x0;
    let y = y0;
    for (;;) {
      this.px(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }
  fillCircle(cx: number, cy: number, r: number, c: RGB): void {
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      this.fillRect(cx - half, cy + y, half * 2 + 1, 1, c);
    }
  }
  fillEllipse(cx: number, cy: number, rx: number, ry: number, c: RGB): void {
    for (let y = -ry; y <= ry; y++) {
      const t = 1 - (y * y) / (ry * ry);
      const half = Math.floor(rx * Math.sqrt(Math.max(0, t)));
      this.fillRect(cx - half, cy + y, half * 2 + 1, 1, c);
    }
  }
  fillTri(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, c: RGB): void {
    const minY = Math.max(0, Math.min(y1, y2, y3));
    const maxY = Math.min(H - 1, Math.max(y1, y2, y3));
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      const edges: Array<[number, number, number, number]> = [
        [x1, y1, x2, y2],
        [x2, y2, x3, y3],
        [x3, y3, x1, y1],
      ];
      for (const [ax, ay, bx, by] of edges) {
        if ((ay <= y && by > y) || (by <= y && ay > y)) {
          xs.push(ax + ((y - ay) * (bx - ax)) / (by - ay));
        }
      }
      if (xs.length >= 2) {
        const xa = Math.floor(Math.min(...xs));
        const xb = Math.ceil(Math.max(...xs));
        this.fillRect(xa, y, xb - xa + 1, 1, c);
      }
    }
  }
  // --- text ---
  glyph(ch: string): string[] {
    return FONT[ch] || FONT["?"];
  }
  textWidth(s: string, sc: number): number {
    return s.length * 6 * sc - sc;
  }
  drawText(s: string, x: number, y: number, sc: number, c: RGB): void {
    const norm = normalize(s);
    let cx = x;
    for (const ch of norm) {
      const g = this.glyph(ch);
      for (let r = 0; r < 7; r++) {
        const row = g[r];
        for (let col = 0; col < 5; col++) {
          if (row[col] === "1") this.fillRect(cx + col * sc, y + r * sc, sc, sc, c);
        }
      }
      cx += 6 * sc;
    }
  }
  drawTextCentered(s: string, cx: number, y: number, sc: number, c: RGB): void {
    this.drawText(s, cx - Math.floor(this.textWidth(s, sc) / 2), y, sc, c);
  }
  wrap(s: string, maxW: number, sc: number): string[] {
    const words = normalize(s).split(" ");
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const test = cur === "" ? w : cur + " " + w;
      if (this.textWidth(test, sc) <= maxW || cur === "") cur = test;
      else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur !== "") lines.push(cur);
    return lines;
  }
}

export function normalize(s: string): string {
  return s
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, ".")
    .replace(/[^\x20-\x7E•]/g, "?");
}

// ---------------------------------------------------------------------------
// PNG encoder (stdlib only): RGB8, filter 0 per row, zlib deflate, CRC32.
// ---------------------------------------------------------------------------
const CRC_TABLE: Uint32Array = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}

export function encodePNG(cv: Canvas): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(cv.buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0))]);
}

export function sha256Hex(b: Buffer): string {
  return crypto.createHash("sha256").update(b).digest("hex");
}

// ---------------------------------------------------------------------------
// Story data — every story verified as HAPPENED or FIRST REPORTED on
// Wednesday 25 November 2026 (live news search, 25 Nov 2026, 06:30-07:00 UTC).
// Two late verifications changed the list: COP31 collapsed Sun 22 Nov (not 25 Nov),
// the Huawei verdict was Tue 24 Nov, and the UK heat toll 5,258 was reported Tue 24 Nov
// — all three moved to the DATE CHECK box. US PCE/GDP were unreleased at press time:
// never shown as results. Nothing here is invented, hyped, or speculated as fact.
// ---------------------------------------------------------------------------
export type Region = "EUROPE" | "MIDDLE EAST" | "AMERICAS" | "ASIA" | "AFRICA" | "OCEANIA" | "GLOBAL";
export const REGION_ORDER: Region[] = ["EUROPE", "MIDDLE EAST", "AMERICAS", "ASIA", "AFRICA", "OCEANIA", "GLOBAL"];
export const REGION_COLOR: Record<Region, RGB> = {
  EUROPE: [27, 58, 92],
  "MIDDLE EAST": [176, 30, 36],
  AMERICAS: [46, 110, 106],
  ASIA: [176, 116, 31],
  AFRICA: [107, 74, 31],
  OCEANIA: [90, 90, 140],
  GLOBAL: [107, 107, 107],
};

export interface Hero {
  n: number;
  region: Region;
  loc: string;
  head: string;
  sub: string;
  src: string;
  status: string;
  tag: string;
  scene: "rocket" | "refinery" | "city";
}
export const HEROES: Hero[] = [
  {
    n: 1, region: "ASIA", loc: "JIUQUAN, CHINA",
    head: "Shenzhou-24 lifts off",
    sub: "Pakistan's first astronaut rides to Tiangong",
    src: "REUTERS", status: "CONFIRMED", tag: "TOP STORY - 00:18 UTC", scene: "rocket",
  },
  {
    n: 2, region: "EUROPE", loc: "SAMARA, RUSSIA",
    head: "Two refineries hit in Samara",
    sub: "Drones strike Syzran and Kuibyshev; fires reported",
    src: "KYIV INDEPENDENT", status: "REPORTED", tag: "02:12 UTC", scene: "refinery",
  },
  {
    n: 3, region: "EUROPE", loc: "ZAPORIZHZHIA, UKRAINE",
    head: "Zaporizhzhia strike kills 2",
    sub: "Russian strike wounds ~50, incl. children",
    src: "REUTERS", status: "CONFIRMED", tag: "04:12 UTC", scene: "city",
  },
];

export interface GridStory {
  n: number;
  region: Region;
  loc: string;
  head: string;
  src: string;
  status: string;
  icon: string;
}
export const GRID: GridStory[] = [
  { n: 4, region: "AMERICAS", loc: "CARTAGENA, COLOMBIA", head: "Gunmen seize 30 in store siege", src: "WH NEWS", status: "REPORTED", icon: "store" },
  { n: 5, region: "OCEANIA", loc: "CANBERRA, AUSTRALIA", head: "Inflation jumps to 4.9%", src: "ABS", status: "CONFIRMED", icon: "chart" },
  { n: 6, region: "AMERICAS", loc: "IOWA, USA", head: "Army to blow up 4,000 kg stash", src: "REUTERS", status: "OFFICIAL", icon: "blast" },
  { n: 7, region: "OCEANIA", loc: "HONIARA, SOLOMON IS.", head: "Australia signs security deal", src: "CHENNAIONLINE", status: "REPORTED", icon: "flags" },
  { n: 8, region: "ASIA", loc: "SEOUL, SOUTH KOREA", head: "Minister quits in exam scandal", src: "WH NEWS", status: "REPORTED", icon: "podium" },
  { n: 9, region: "ASIA", loc: "DHAKA, BANGLADESH", head: "Garment pay up 36% at last", src: "CHENNAIONLINE", status: "REPORTED", icon: "coin" },
  { n: 10, region: "AMERICAS", loc: "GULF OF MEXICO", head: "Plane down; six missing", src: "CHENNAIONLINE", status: "REPORTED", icon: "plane" },
  { n: 11, region: "ASIA", loc: "PYONGYANG, N. KOREA", head: "Swiss office under threat", src: "WH NEWS", status: "REPORTED", icon: "flag" },
  { n: 12, region: "MIDDLE EAST", loc: "GAZA", head: "Death toll reaches 74,746", src: "WAFA", status: "REPORTED", icon: "flame" },
  { n: 13, region: "GLOBAL", loc: "GLOBAL", head: "266M face acute hunger", src: "WFP", status: "REPORTED", icon: "wheat" },
  { n: 14, region: "GLOBAL", loc: "BRUSSELS", head: "NATO vows space defence", src: "WH NEWS", status: "REPORTED", icon: "satellite" },
  { n: 15, region: "MIDDLE EAST", loc: "JERUSALEM, ISRAEL", head: "Katz: Iran building chemical arms", src: "CHENNAIONLINE", status: "REPORTED", icon: "warning" },
];

export interface AlsoStory { n: number; region: Region; text: string; }
export const ALSO: AlsoStory[] = [
  { n: 17, region: "AMERICAS", text: "Shein pays $100M to settle suits (PARIS TIMES)" },
  { n: 18, region: "EUROPE", text: "Putin vows 'inevitable' retaliation (INDEPENDENT)" },
  { n: 19, region: "EUROPE", text: "Odesa strike kills 2, child hurt (INDEPENDENT)" },
  { n: 20, region: "EUROPE", text: "Kyiv flats hit by drones, 2 hurt (INDEPENDENT)" },
  { n: 21, region: "EUROPE", text: "Russia calls ship strikes 'terrorism' (BD GLOBAL)" },
  { n: 22, region: "AMERICAS", text: "Trump to unveil tariffs on 16 partners (REUTERS)" },
  { n: 23, region: "AMERICAS", text: "Giuliani given Medal of Freedom (REUTERS)" },
  { n: 24, region: "AMERICAS", text: "Trump pardons turkeys Freedom, Feathers (REUTERS)" },
  { n: 25, region: "AMERICAS", text: "Fort Hood gunman seeks stay (REUTERS)" },
  { n: 26, region: "AMERICAS", text: "Abrego Garcia to leave US (REUTERS)" },
  { n: 27, region: "AMERICAS", text: "Vance oil deal under Senate inquiry (REUTERS)" },
  { n: 28, region: "MIDDLE EAST", text: "Iran flogs singer, band members (CHENNAIONLINE)" },
  { n: 29, region: "MIDDLE EAST", text: "Les Democrates halt coalition talks (PARIS TIMES)" },
  { n: 30, region: "AFRICA", text: "Two Libyans die of Benghazi wounds (PARIS TIMES)" },
  { n: 31, region: "EUROPE", text: "French mayors warn of voter anger (PARIS TIMES)" },
  { n: 32, region: "MIDDLE EAST", text: "Eisenkot: arson is 'Jewish terrorism' (WH NEWS)" },
  { n: 33, region: "MIDDLE EAST", text: "Likud fraud claims dismissed (NMH)" },
  { n: 34, region: "GLOBAL", text: "TikTok tops abuse list for women (NMH)" },
  { n: 35, region: "EUROPE", text: "Two held after Anmer Hall break-in (NMH)" },
  { n: 36, region: "AMERICAS", text: "Four admit riot at justice's home (NMH)" },
  { n: 37, region: "AMERICAS", text: "El-Sayed: Israel must choose identity (NMH)" },
  { n: 38, region: "EUROPE", text: "Macron weighs spending caps (NMH)" },
  { n: 39, region: "EUROPE", text: "Pesquet links space and medicine (NMH)" },
  { n: 40, region: "AFRICA", text: "Morocco football rise sparks debate (NMH)" },
  { n: 41, region: "MIDDLE EAST", text: "Knesset member in clash with comedian (NMH)" },
  { n: 42, region: "ASIA", text: "Hasina announces return for Victory Day (NMH)" },
  { n: 43, region: "EUROPE", text: "Ukraine weighs Kinburn Spit rescue (NMH)" },
  { n: 44, region: "AMERICAS", text: "Fort Hood survivors kept out (CHENNAIONLINE)" },
  { n: 45, region: "MIDDLE EAST", text: "Iraq: hoses moved Kurdish oil (VKB)" },
  { n: 46, region: "MIDDLE EAST", text: "Houthi bus strike kills civilians (VKB)" },
  { n: 47, region: "AMERICAS", text: "Ohio bus crash kills two drivers (VKB)" },
  { n: 48, region: "EUROPE", text: "UK bought fake C4 for Ukraine (VKB)" },
  { n: 49, region: "EUROPE", text: "'Lion' scare triggers Istanbul search (VKB)" },
  { n: 50, region: "AMERICAS", text: "'Dirty bomber' Padilla freed (VKB)" },
  { n: 51, region: "EUROPE", text: "Russian force in Ukraine put at 1.6M (VKB)" },
  { n: 52, region: "EUROPE", text: "EU curbs Chinese car imports (VKB)" },
  { n: 53, region: "ASIA", text: "India signs 114-Rafale jet deal (VKB)" },
  { n: 54, region: "EUROPE", text: "Armenia, Europe talk closer ties (VKB)" },
  { n: 55, region: "MIDDLE EAST", text: "Qatar, US back Hormuz shipping freedom (VKB)" },
  { n: 56, region: "ASIA", text: "Indonesia factory fire rescue goes on (VKB)" },
  { n: 57, region: "EUROPE", text: "Greece plans Ukraine supply line (VKB)" },
  { n: 58, region: "MIDDLE EAST", text: "Israel hits south Lebanon (VKB)" },
];

export const TOTAL_STORIES = HEROES.length + GRID.length + ALSO.length; // 57

export const BIG_NUMBERS: Array<{ num: string; label: string }> = [
  { num: "00:18", label: "SHENZHOU LIFTS OFF, UTC" },
  { num: "2", label: "REFINERIES HIT IN SAMARA" },
  { num: "4,000+", label: "KG OF EXPLOSIVES, IOWA" },
  { num: "30", label: "HOSTAGES SEIZED, CARTAGENA" },
  { num: "4.9%", label: "AUSTRALIA CPI, OCTOBER" },
  { num: "36%", label: "BANGLADESH PAY RISE" },
];

// Timeline: only times verified from sources (UTC). Morning items carry no clock
// time — they sit in the MORNING segment by report time, never an invented hour.
export const TIMELINE: Array<{ seg: number; time: string; label: string }> = [
  { seg: 0, time: "00:18", label: "SHENZHOU LIFTS OFF" },
  { seg: 0, time: "00:30", label: "AUSTRALIA CPI 4.9%" },
  { seg: 0, time: "02:12", label: "SAMARA REFINERIES HIT" },
  { seg: 0, time: "04:12", label: "ZAPORIZHZHIA STRIKE" },
  { seg: 0, time: "", label: "CARTAGENA HOSTAGES" },
  { seg: 1, time: "", label: "SOLOMON IS. DEAL SIGNED" },
  { seg: 1, time: "", label: "SEOUL MINISTER QUITS" },
  { seg: 1, time: "", label: "DHAKA PAY UP 36%" },
];
export const SEGMENTS = ["NIGHT 00-06", "MORNING 06-12", "MIDDAY 12-15", "AFTERNOON 15-18", "EVENING 18-24"];

export const DATE_CHECK =
  "LEFT OUT ON PURPOSE - NOT 25 NOVEMBER NEWS: COP31 collapsed Sun 22 Nov; Benghazi ship strike 22 Nov; " +
  "Sparta II hit 21 Nov; Huawei guilty verdict Tue 24 Nov; UK heat toll 5,258, reported Tue 24 Nov; " +
  "Duma budget vote 24 Nov; Norway $7bn pledge 24 Nov; Dow over 50,000, 24 Nov close; US confidence, " +
  "24 Nov release; US PCE and GDP were still to come at press time. Every story above happened or was " +
  "first reported on Wednesday 25 November 2026.";

// Map pins: schematic positions for the 16 located hero/grid stories (x, y in page px).
// WFP (13) and NATO space (14) are global stories: shown in the map legend, not pinned.
export const PINS: Array<{ n: number; x: number; y: number }> = [
  { n: 1, x: 440, y: 712 },
  { n: 2, x: 360, y: 706 },
  { n: 3, x: 300, y: 706 },
  { n: 4, x: 116, y: 756 },
  { n: 5, x: 518, y: 762 },
  { n: 6, x: 120, y: 722 },
  { n: 7, x: 545, y: 756 },
  { n: 8, x: 452, y: 714 },
  { n: 9, x: 415, y: 724 },
  { n: 10, x: 110, y: 736 },
  { n: 11, x: 468, y: 704 },
  { n: 12, x: 312, y: 732 },
  { n: 15, x: 336, y: 736 },
];

// ---------------------------------------------------------------------------
// Layout. Page 1024x1024, margin 12, thin ink border + gold rule.
// Sections (y ranges): masthead 14-56, sub-strip 57-77, big numbers 79-135,
// continent strip 137-159, heroes 162-334, grid header 336-348, grid 350-662,
// map + timeline 664-792, ALSO 794-934, DATE CHECK 938-996, footer 1000-1007.
// ---------------------------------------------------------------------------
export const M = 12; // left/right margin
export const CW = W - 2 * M; // 1000

export function statusColor(s: string): RGB {
  if (s === "CONFIRMED") return TEAL;
  if (s === "REPORTED") return ORANGE;
  return NAVY; // OFFICIAL
}

export function drawSegments(cv: Canvas, segs: Array<[string, RGB]>, x: number, y: number, sc: number): number {
  let cx = x;
  for (const [t, c] of segs) {
    cv.drawText(t, cx, y, sc, c);
    cx += cv.textWidth(t, sc) + sc; // glyph advance includes 1-space gap
  }
  return cx - sc;
}

export function segWidth(cv: Canvas, segs: Array<[string, RGB]>, sc: number): number {
  let w = 0;
  for (const [t] of segs) w += cv.textWidth(t, sc) + sc;
  return w - sc;
}

export function regionCounts(): Record<Region, number> {
  const counts: Record<Region, number> = {
    EUROPE: 0, "MIDDLE EAST": 0, AMERICAS: 0, ASIA: 0, AFRICA: 0, OCEANIA: 0, GLOBAL: 0,
  };
  for (const h of HEROES) counts[h.region]++;
  for (const g of GRID) counts[g.region]++;
  for (const a of ALSO) counts[a.region]++;
  return counts;
}

// --- small icons, drawn in a ~30x30 box at (bx, by), colour c ---
export function drawIcon(cv: Canvas, kind: string, bx: number, by: number, c: RGB): void {
  switch (kind) {
    case "store": // shop front with awning
      cv.fillRect(bx + 4, by + 12, 22, 14, c);
      cv.fillTri(bx + 2, by + 12, bx + 28, by + 12, bx + 15, by + 4, c);
      cv.fillRect(bx + 12, by + 18, 6, 8, PAPER);
      break;
    case "chart": // rising bars
      cv.fillRect(bx + 5, by + 20, 5, 6, c);
      cv.fillRect(bx + 13, by + 14, 5, 12, c);
      cv.fillRect(bx + 21, by + 8, 5, 18, c);
      cv.hline(bx + 3, bx + 27, by + 27, c);
      break;
    case "blast": // starburst
      cv.fillCircle(bx + 15, by + 15, 5, c);
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        cv.line(bx + 15, by + 15, Math.round(bx + 15 + Math.cos(a) * 13), Math.round(by + 15 + Math.sin(a) * 13), c);
      }
      break;
    case "flags": // two flags
      cv.vline(bx + 8, by + 5, by + 26, c, 2);
      cv.vline(bx + 20, by + 8, by + 26, c, 2);
      cv.fillTri(bx + 8, by + 5, bx + 18, by + 8, bx + 8, by + 11, c);
      cv.fillTri(bx + 20, by + 8, bx + 28, by + 11, bx + 20, by + 14, c);
      break;
    case "podium": // speaker's podium + steps
      cv.fillRect(bx + 11, by + 12, 8, 14, c);
      cv.fillRect(bx + 4, by + 20, 6, 6, c);
      cv.fillRect(bx + 20, by + 20, 6, 6, c);
      cv.fillCircle(bx + 15, by + 6, 4, c);
      break;
    case "coin": // coin with $
      cv.fillCircle(bx + 15, by + 15, 11, c);
      cv.fillCircle(bx + 15, by + 15, 7, PAPER);
      cv.drawText("$", bx + 12, by + 8, 2, c);
      break;
    case "plane": // aircraft in flight
      cv.fillTri(bx + 2, by + 15, bx + 26, by + 11, bx + 26, by + 19, c);
      cv.fillRect(bx + 12, by + 8, 4, 14, c);
      cv.fillRect(bx + 18, by + 18, 3, 8, c);
      break;
    case "flag": // single flag
      cv.vline(bx + 8, by + 4, by + 26, c, 2);
      cv.fillTri(bx + 8, by + 4, bx + 26, by + 9, bx + 8, by + 14, c);
      break;
    case "flame": // candle flame
      cv.fillTri(bx + 15, by + 3, bx + 8, by + 18, bx + 22, by + 18, ORANGE);
      cv.fillRect(bx + 13, by + 18, 4, 8, c);
      break;
    case "wheat": // stalk with grains
      cv.vline(bx + 15, by + 6, by + 27, c, 2);
      cv.fillEllipse(bx + 10, by + 10, 3, 5, c);
      cv.fillEllipse(bx + 20, by + 10, 3, 5, c);
      cv.fillEllipse(bx + 10, by + 18, 3, 5, c);
      cv.fillEllipse(bx + 20, by + 18, 3, 5, c);
      break;
    case "satellite": // satellite + panels
      cv.fillRect(bx + 12, by + 12, 8, 8, c);
      cv.fillRect(bx + 2, by + 13, 8, 5, NAVY);
      cv.fillRect(bx + 22, by + 13, 8, 5, NAVY);
      cv.line(bx + 16, by + 12, bx + 22, by + 5, c);
      cv.fillCircle(bx + 23, by + 4, 2, c);
      break;
    case "warning": // triangle + !
      cv.fillTri(bx + 15, by + 3, bx + 3, by + 26, bx + 27, by + 26, c);
      cv.fillTri(bx + 15, by + 8, bx + 8, by + 23, bx + 22, by + 23, PAPER);
      cv.drawText("!", bx + 13, by + 10, 2, c);
      break;
    case "bag": // money bag
      cv.fillRect(bx + 8, by + 12, 14, 13, c);
      cv.fillTri(bx + 15, by + 4, bx + 10, by + 12, bx + 20, by + 12, c);
      cv.drawText("$", bx + 12, by + 14, 2, PAPER);
      break;
    default:
      cv.fillCircle(bx + 15, by + 15, 8, c);
  }
}

// --- hero scenes, band (bx, by, w=324, h=78) ---
export function drawScene(cv: Canvas, scene: string, bx: number, by: number): void {
  if (scene === "rocket") {
    cv.fillRect(bx, by, 324, 78, NIGHT);
    const stars: Array<[number, number]> = [
      [12, 8], [40, 20], [70, 6], [96, 16], [210, 8], [240, 18], [268, 6], [296, 22],
      [30, 40], [60, 52], [220, 44], [252, 56], [286, 44], [310, 30], [150, 10], [180, 26],
    ];
    for (const [sx, sy] of stars) cv.px(bx + sx, by + sy, WHITE);
    // ground
    cv.fillRect(bx, by + 66, 324, 12, [46, 52, 64]);
    // rocket body
    cv.fillRect(bx + 148, by + 12, 28, 54, WHITE);
    cv.fillTri(bx + 148, by + 12, bx + 176, by + 12, bx + 162, by + 0, RED);
    cv.fillRect(bx + 160, by + 30, 4, 10, NAVY);
    cv.fillTri(bx + 148, by + 52, bx + 136, by + 66, bx + 148, by + 66, RED);
    cv.fillTri(bx + 176, by + 52, bx + 188, by + 66, bx + 176, by + 66, RED);
    // flame
    cv.fillTri(bx + 152, by + 66, bx + 172, by + 66, bx + 162, by + 77, ORANGE);
    cv.fillTri(bx + 156, by + 66, bx + 168, by + 66, bx + 162, by + 74, YELLOW);
    // smoke
    cv.fillCircle(bx + 120, by + 70, 5, [140, 140, 140]);
    cv.fillCircle(bx + 205, by + 71, 6, [140, 140, 140]);
    // tower
    cv.fillRect(bx + 60, by + 30, 6, 36, [90, 96, 110]);
    cv.fillRect(bx + 54, by + 28, 18, 4, [90, 96, 110]);
  } else if (scene === "refinery") {
    cv.fillRect(bx, by, 324, 78, [232, 214, 180]);
    cv.fillRect(bx, by + 52, 324, 26, [120, 104, 78]);
    // dusk band
    cv.fillRect(bx, by + 44, 324, 8, ORANGE);
    // towers
    cv.fillRect(bx + 60, by + 14, 26, 52, [70, 70, 74]);
    cv.fillRect(bx + 100, by + 6, 20, 60, [70, 70, 74]);
    cv.fillRect(bx + 60, by + 10, 26, 4, [70, 70, 74]);
    cv.fillRect(bx + 100, by + 2, 20, 4, [70, 70, 74]);
    cv.fillRect(bx + 140, by + 22, 40, 44, [90, 90, 94]);
    cv.fillRect(bx + 200, by + 30, 60, 36, [100, 100, 104]);
    // tanks
    cv.fillEllipse(bx + 250, by + 56, 22, 10, [80, 80, 84]);
    cv.fillRect(bx + 228, by + 56, 44, 10, [80, 80, 84]);
    // flames + smoke
    cv.fillTri(bx + 66, by + 14, bx + 80, by + 14, bx + 73, by + 2, ORANGE);
    cv.fillTri(bx + 104, by + 6, bx + 116, by + 6, bx + 110, by -4, ORANGE);
    cv.fillCircle(bx + 230, by + 22, 6, [110, 110, 110]);
    cv.fillCircle(bx + 240, by + 14, 8, [130, 130, 130]);
    cv.fillCircle(bx + 252, by + 6, 6, [150, 150, 150]);
  } else {
    // city under attack: pale sky, building silhouettes, smoke, rescue light
    cv.fillRect(bx, by, 324, 78, [214, 226, 232]);
    cv.fillRect(bx, by + 66, 324, 12, [90, 94, 100]);
    const blds: Array<[number, number, number]> = [
      [20, 30, 26], [52, 20, 34], [92, 36, 22], [120, 16, 40], [166, 28, 26],
      [198, 12, 42], [246, 26, 28], [280, 34, 24],
    ];
    for (const [x, top, w] of blds) {
      cv.fillRect(bx + x, by + top, w, 66 - top, [120, 128, 138]);
      for (let wy = top + 5; wy < 60; wy += 9) {
        for (let wx = x + 4; wx < x + w - 4; wx += 8) cv.fillRect(bx + wx, by + wy, 3, 3, [230, 236, 240]);
      }
    }
    // damaged building: cracked facade + smoke column
    cv.fillRect(bx + 120, by + 16, 40, 50, [96, 100, 108]);
    cv.line(bx + 128, by + 20, bx + 140, by + 40, INK);
    cv.line(bx + 140, by + 40, bx + 132, by + 58, INK);
    cv.fillCircle(bx + 140, by + 10, 5, [140, 140, 140]);
    cv.fillCircle(bx + 144, by + 2, 7, [160, 160, 160]);
    cv.fillCircle(bx + 150, by -4, 6, [180, 180, 180]);
    // rescue beacon
    cv.fillCircle(bx + 300, by + 58, 4, RED);
  }
}

// --- world map: schematic continents + numbered pins ---
export function drawMap(cv: Canvas, fx: number, fy: number, fw: number, fh: number): void {
  cv.fillRect(fx, fy, fw, fh, SEA);
  cv.rect(fx, fy, fw, fh, INK, 1);
  // continents (schematic, page coords relative to frame origin)
  const L = LAND;
  // North America
  cv.fillRect(fx + 28, fy + 8, 130, 34, L);
  cv.fillRect(fx + 50, fy + 42, 70, 18, L);
  cv.fillTri(fx + 28, fy + 8, fx + 28, fy + 42, fx + 10, fy + 30, L);
  // South America
  cv.fillRect(fx + 70, fy + 64, 48, 30, L);
  cv.fillTri(fx + 70, fy + 94, fx + 118, fy + 94, fx + 94, fy + 104, L);
  // Europe
  cv.fillRect(fx + 250, fy + 6, 55, 22, L);
  cv.fillRect(fx + 240, fy + 28, 40, 14, L);
  // Africa
  cv.fillRect(fx + 245, fy + 46, 58, 38, L);
  cv.fillTri(fx + 245, fy + 84, fx + 303, fy + 84, fx + 274, fy + 98, L);
  // Asia
  cv.fillRect(fx + 300, fy + 2, 150, 34, L);
  cv.fillRect(fx + 320, fy + 36, 62, 20, L);
  cv.fillRect(fx + 380, fy + 36, 40, 22, L);
  cv.fillTri(fx + 382, fy + 56, fx + 420, fy + 56, fx + 400, fy + 72, L);
  cv.fillRect(fx + 440, fy + 8, 26, 26, L);
  // Australia
  cv.fillRect(fx + 470, fy + 68, 58, 20, L);
  // graticule: faint dotted lines
  for (let gx = fx + 40; gx < fx + fw; gx += 40) cv.vline(gx, fy + 2, fy + fh - 3, [170, 198, 204], 1);
  for (let gy = fy + 26; gy < fy + fh; gy += 26) cv.hline(fx + 2, fx + fw - 3, gy, [170, 198, 204], 1);
  // pins
  for (const p of PINS) {
    cv.fillCircle(p.x, p.y, 6, RED);
    const s = String(p.n);
    cv.drawText(s, p.x - Math.floor(cv.textWidth(s, 1) / 2), p.y - 3, 1, WHITE);
  }
}

// ---------------------------------------------------------------------------
// Page assembly
// ---------------------------------------------------------------------------
export function buildPage(): Canvas {
  const cv = new Canvas();
  // border + gold rule
  cv.rect(6, 6, 1012, 1012, INK, 2);
  cv.fillRect(8, 12, 1008, 2, GOLD);

  // masthead
  cv.fillRect(8, 14, 1008, 42, NAVY);
  cv.drawTextCentered("WEDNESDAY 25 NOVEMBER 2026", 512, 19, 5, WHITE);
  // sub-strip
  const sub = `${TOTAL_STORIES} STORIES - 7 REGIONS - ALL DATED WEDNESDAY 25 NOVEMBER 2026`;
  cv.drawTextCentered(sub, 512, 59, 2, INK);

  // big numbers
  const bnY = 79;
  const bnW = 162;
  for (let i = 0; i < BIG_NUMBERS.length; i++) {
    const x = M + i * (bnW + 5);
    cv.rect(x, bnY, bnW, 56, INK, 1);
    cv.fillRect(x + 1, bnY + 1, bnW - 2, 3, NAVY);
    cv.drawTextCentered(BIG_NUMBERS[i].num, x + bnW / 2, bnY + 8, 3, INK);
    cv.drawTextCentered(BIG_NUMBERS[i].label, x + bnW / 2, bnY + 34, 1, GREY);
  }

  // continent strip (counts computed from the data, not hard-coded)
  const counts = regionCounts();
  const segs: Array<[string, RGB]> = [];
  for (const r of REGION_ORDER) {
    if (segs.length) segs.push([" - ", GREY]);
    segs.push([r, REGION_COLOR[r]]);
    segs.push([" " + String(counts[r]), INK]);
  }
  const stripW = segWidth(cv, segs, 2);
  drawSegments(cv, segs, 512 - Math.floor(stripW / 2), 139, 2);
  cv.hline(12, 1011, 160, INK, 1);

  // heroes
  const heroY = 162;
  const heroW = 324;
  for (let i = 0; i < HEROES.length; i++) {
    const h = HEROES[i];
    const x = M + i * (heroW + 6);
    // tag line: time tag only (region lives in the meta line's location + the strip)
    cv.drawText(h.tag, x, heroY, 1, RED);
    // scene band
    drawScene(cv, h.scene, x, heroY + 9, 78);
    cv.rect(x, heroY + 9, heroW, 78, INK, 1);
    // meta: loc - src - status
    const meta: Array<[string, RGB]> = [
      [h.loc, INK],
      [" - ", GREY],
      [h.src, GREY],
      [" - ", GREY],
      [h.status, statusColor(h.status)],
    ];
    drawSegments(cv, meta, x, heroY + 89, 1);
    // headline (2 lines, scale 3)
    const hl = cv.wrap(h.head, heroW - 8, 3);
    cv.drawText(hl[0], x, heroY + 98, 3, INK);
    if (hl[1]) cv.drawText(hl[1], x, heroY + 120, 3, INK);
    // sub (2 lines, scale 2)
    const sl = cv.wrap(h.sub, heroW - 8, 2);
    cv.drawText(sl[0], x, heroY + 143, 2, GREY);
    if (sl[1]) cv.drawText(sl[1], x, heroY + 157, 2, GREY);
  }

  // grid header
  cv.drawText("IN THE WORLD TODAY", M, 336, 1, INK);
  const gh = "ALL STORIES DATED 25 NOVEMBER 2026";
  cv.drawText(gh, 1012 - M - cv.textWidth(gh, 1), 336, 1, GREY);

  // grid: 3 rows x 4 cols, cell 243x100
  const cellW = 243;
  const cellH = 100;
  for (let i = 0; i < GRID.length; i++) {
    const g = GRID[i];
    const row = Math.floor(i / 4);
    const col = i % 4;
    const x = M + col * (cellW + 9);
    const y = 350 + row * cellH;
    // band: cream field, region bar at left, number, icon at right
    cv.fillRect(x, y, cellW, 40, CREAM2);
    cv.fillRect(x, y, 6, 40, REGION_COLOR[g.region]);
    cv.rect(x, y, cellW, 40, INK, 1);
    cv.drawText(String(g.n), x + 10, y + 10, 2, INK);
    drawIcon(cv, g.icon, x + cellW - 32, y + 5, REGION_COLOR[g.region]);
    // headline (2 lines, scale 2)
    const hl = cv.wrap(g.head, cellW - 8, 2);
    cv.drawText(hl[0], x, y + 44, 2, INK);
    if (hl[1]) cv.drawText(hl[1], x, y + 58, 2, INK);
    // loc
    cv.drawText(g.loc, x, y + 76, 1, RED);
    // src + status
    const meta: Array<[string, RGB]> = [
      [g.src, GREY],
      [" - ", GREY],
      [g.status, statusColor(g.status)],
    ];
    drawSegments(cv, meta, x, y + 86, 1);
  }

  // map + timeline titles
  cv.drawText("WHERE IT HAPPENED - 13 PINNED, 2 GLOBAL", M, 666, 2, INK);
  cv.drawText("THE DAY IN UTC", 598, 666, 2, INK);
  const tt = "ALL TIMES UTC";
  cv.drawText(tt, 1012 - M - cv.textWidth(tt, 1), 668, 1, GREY);

  // map frame (12, 682, 580x106)
  drawMap(cv, M, 682, 580, 106);
  // timeline frame (598, 682, 414x106): vertical guide + rows
  cv.rect(598, 682, 414, 106, INK, 1);
  cv.vline(700, 690, 780, GREY, 1);
  const tlY = 690;
  for (let i = 0; i < TIMELINE.length; i++) {
    const t = TIMELINE[i];
    const y = tlY + i * 11;
    cv.fillCircle(700, y + 3, 3, RED);
    const label = t.time === "" ? (t.seg === 0 ? "NIGHT" : "MORNING") : t.time;
    cv.drawText(label, 612, y, 1, RED);
    cv.drawText(t.label, 712, y, 1, INK);
  }

  // ALSO list
  cv.drawText("ALSO ON WEDNESDAY 25 NOVEMBER", M, 794, 2, INK);
  const alsoCols: Array<Array<AlsoStory>> = [
    ALSO.slice(0, 14),
    ALSO.slice(14, 28),
    ALSO.slice(28),
  ];
  for (let c = 0; c < 3; c++) {
    const x = M + c * 337;
    for (let r = 0; r < alsoCols[c].length; r++) {
      const a = alsoCols[c][r];
      const y = 810 + r * 9;
      cv.fillRect(x, y + 1, 5, 5, REGION_COLOR[a.region]);
      cv.drawText(`${a.n}. ${a.text}`, x + 8, y, 1, INK);
    }
  }

  // DATE CHECK box
  cv.fillRect(M, 938, 1000, 58, WHITE);
  cv.rect(M, 938, 1000, 58, RED, 2);
  cv.drawText("DATE CHECK - WHAT WE LEFT OUT, AND WHY", M + 6, 942, 1, RED);
  const dcLines = cv.wrap(DATE_CHECK, 1000 - 12, 1);
  for (let i = 0; i < dcLines.length; i++) cv.drawText(dcLines[i], M + 6, 950 + i * 9, 1, INK);

  // footer
  cv.drawTextCentered(
    "DRAWN FOR THIS PAGE. SOURCES AS SHOWN. NMH: NEWS MEDIA HOUSE. VKB: VINCENTKNOTLEY.BLOG. WEDNESDAY 25 NOVEMBER 2026.",
    512, 1000, 1, GREY,
  );
  return cv;
}

export function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  fs.mkdirSync(outDir, { recursive: true });
  const cv = buildPage();
  const png = encodePNG(cv);
  const outPath = path.join(outDir, "entry.png");
  fs.writeFileSync(outPath, png);
  console.log(`wrote ${outPath} ${png.length} bytes sha256=${sha256Hex(png)}`);
}

main();

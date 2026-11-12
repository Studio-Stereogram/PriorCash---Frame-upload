// FullPageAsciiMotion — Framer Code Component (three.js → ASCII)
//
// One persistent ASCII 3D object that travels and transforms through the
// whole page. Foundation: Full Page Motion (scroll-driven shape stops, idle
// rotation, morph spin, breathing, chaos, center fade). Renderer: AsciiHero
// (3D scene → tiny render target → luminance → glyphs on a 2D canvas).
//
// Setup in Framer
// 1. Mark your page sections as Scroll Sections (Scroll Section → Name).
// 2. Place this component ONCE on the page. In "Fixed" layer mode it renders
//    into its own full-viewport layer attached to <body>, so the size and
//    position of the component's own frame don't matter (keep it small).
// 3. Add one entry per section in "Sections" and pick its Scroll Section in
//    the "Section" link picker (page → section). The section's range is
//    measured automatically from its real top and bottom on the page.
//    The order of the list is the order of the flow.
// 4. Any section can use "Image (Upload)" instead of a 3D shape. Images are
//    loaded lazily: the sections around the current scroll position first,
//    the rest one by one after the page has finished loading, in idle time.
//    A ~512px copy is fetched and turned into ASCII once, then cached.
//
// 5. Scripted sequence (Next Touch): turn on "Use Scripted Animation" in one
//    Sections item and upload the geometry file (nexttouch-geo.json, packed
//    from the STEP model) into "Device Model". The device is drawn live from
//    that geometry as ASCII, on the same glyph grid as every other section,
//    so it is one continuous ASCII element with its neighbours. The section
//    on the page must be tall enough for the whole script: the last
//    milestone's Idle End + ~100vh (≈ 960vh with the defaults). Milestones
//    (position, scale, transform / idle ranges, camera angle), element
//    timing, device look, 3D motion and depth of field are all controls of
//    that Sections item. The section's own Char Size sets how fine the
//    device is drawn.
//
// WebGL runs in Preview and on the published site. The editor canvas shows a
// CPU-rendered still of the section chosen in "Canvas Preview" — no WebGL
// context is ever created there (a scripted section shows the device at the
// milestone picked in "Canvas State" with its ASCII elements).

import * as React from "react"
import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import * as THREE from "three"

// ─── Types ───────────────────────────────────────────────────────────────────

type ShapeKey =
    | "knot"
    | "torus"
    | "sphere"
    | "sphereRings"
    | "sphereHalftone"
    | "sphereChaos"
    | "earth"
    | "mars"
    | "box"
    | "boxChaos"
    | "icosahedron"
    | "capsule"
    | "stripes"
    | "framer"
    | "waves"
    | "blob"
    | "plane"
    | "ring"
    | "empty"
    | "image"

type Direction = "cw" | "ccw"
type ImageTone = "darkOnLight" | "lightOnDark"
type ImageColors = "ink" | "duotone" | "original"
type TransitionStyle = "morph" | "dissolve" | "wipe" | "radial"

interface ResponsiveImageValue {
    src?: string
    srcSet?: string
    alt?: string
}
type Detection = "ids" | "manual" | "progress"
type Anchor = "before" | "centered" | "after"
type Quality = "low" | "balanced" | "high"
type LayerMode = "fixed" | "frame"
type RGBA = [number, number, number, number]

// What Framer's Link control can hand over: a resolved URL string
// ("./#offers", "/page#offers", "#offers") or an unresolved page link object.
interface PageLinkValue {
    webPageId?: string
    hash?: string
}
type SectionLink = string | PageLinkValue | null | undefined

interface SectionConfig {
    name?: string
    // Scroll Section picked with the Link control (page → section).
    section?: SectionLink
    // Legacy: plain text ID from earlier versions — still honored.
    id?: string
    shape?: ShapeKey
    // Scripted sequence: the device drawn live from its geometry as ASCII,
    // with ASCII QR code, data cloud, card, checkmark and hand-over.
    scripted?: boolean
    scriptModel?: string // uploaded geometry file (Framer hands over its URL)
    scriptModelUrl?: string // or: where the geometry file is hosted
    scriptSize?: number
    scriptLook?: ScriptLookConfig
    m1?: MilestoneConfig
    m2?: MilestoneConfig
    m3?: MilestoneConfig
    m4?: MilestoneConfig
    m5?: MilestoneConfig
    m6?: MilestoneConfig
    m7?: MilestoneConfig
    m8?: MilestoneConfig
    scriptTiming?: Record<string, number>
    script3d?: Script3dConfig
    scriptDof?: ScriptDofConfig
    scriptPreview?: number
    // Shape "image": the uploaded picture and its options.
    image?: ResponsiveImageValue | string | null
    invert?: boolean
    removeBg?: boolean
    rotation?: number
    positionX?: number
    positionY?: number
    scale?: number
    rotationSpeed?: number
    direction?: Direction
    charSize?: number
    opacity?: number
    accentColor?: string
    transition?: number
    start?: number
    end?: number
    mobileX?: number
    mobileY?: number
}

interface Settings {
    // Global
    enabled: boolean
    layer: LayerMode
    zIndex: number
    pointerEvents: "none" | "auto"
    quality: Quality
    cell: number
    characters: string
    inkColor: string
    gradient: boolean
    inkColor2: string
    accentColor: string
    landColor: string
    seaColor: string
    backgroundColor: string
    intensity: number
    centerFade: number
    cameraDistance: number
    // Animation
    autoSpin: boolean
    rotationSpeed: number
    animationSpeed: number
    mouseFollow: boolean
    followStrength: number
    floatAmount: number
    chaos: number
    breathing: number
    morphAmount: number
    morphSpin: number
    scramble: boolean
    transitionSmoothing: number
    // Transition front (shared by shapes and images)
    transitionStyle: TransitionStyle
    frontAccent: boolean
    glitch: number
    // Image sections
    imageSize: number
    imageCharacters: string
    edgeCharacters: string
    imageTone: ImageTone
    imageColors: ImageColors
    autoLevels: boolean
    contrast: number
    brightness: number
    threshold: number
    edgeGlyphs: number
    edgeFade: number
    bgTolerance: number
    imageSway: number
    imageWave: number
    shimmer: number
    imageTwist: number
    imageZoom: number
    // Scripted sequence: idle animation
    scriptIdle: boolean
    scriptIdleIntensity: number
    scriptIdleSpeed: number
    scriptRotation: number
    scriptFloat: number
    scriptDepth: number
    // Scroll
    detection: Detection
    trigger: number
    anchor: Anchor
    manualUnit: "vh" | "px"
    scrollSmoothing: number
    sectionTransitions: boolean
    respectReducedMotion: boolean
    debug: boolean
    // Responsive
    mobileBreakpoint: number
    mobileScale: number
    mobileCharSize: number
    // Editor
    previewSection: number
    // Sections
    sections: SectionConfig[]
}

type Props = Partial<Settings> & { style?: React.CSSProperties }

interface NormSection {
    name: string
    id: string
    shape: ShapeKey
    imageSrc: string
    invert: boolean
    removeBg: boolean
    rot: number
    scripted: boolean
    script: ScriptConf
    scriptPreview: number
    x: number
    y: number
    scale: number
    speed: number
    direction: Direction
    charSize: number
    opacity: number
    accent: string
    transition: number
    start: number
    end: number
    mobileX: number
    mobileY: number
}

interface MotionState {
    x: number
    y: number
    scale: number
    speed: number
    opacity: number
    cell: number
    ar: number
    ag: number
    ab: number
    spin: number
    rot: number // in-plane rotation of image sections (degrees)
}

interface ShapePair {
    a: ShapeKey
    b: ShapeKey
    p: number
    // Indices into track.sections of the current transition (debug readout).
    ia: number
    ib: number
}

interface Track {
    mode: Detection
    sections: NormSection[]
    // zones[i] = scroll range over which the state morphs into sections[i]
    zones: Array<[number, number]>
    // "ids" mode diagnostics: whether each section's ID resolved, and the
    // document-space anchor used for it (measured or estimated).
    found?: boolean[]
    ranges?: Array<[number, number]>
}

/** Document-space extent of a section (null = not found on the page). */
type SectionRect = { top: number; bottom: number } | null

interface DeformParams {
    time: number
    chaos: number
    breathing: number
}

type Orienter = (rot: number, mx: number, my: number, follow: number) => void
type Deformer = (p: DeformParams) => void

interface ShapeInstance {
    key: ShapeKey
    root: THREE.Object3D
    meshes: THREE.Mesh[]
    geometries: THREE.BufferGeometry[]
    materials: THREE.Material[]
    colorMode: "mono" | "earth"
    fillViewport: boolean
    empty: boolean
    orient: Orienter
    deform: Deformer | null
    lastTime: number
    lastChaos: number
    lastBreathing: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SHAPE_OPTIONS: ShapeKey[] = [
    "knot",
    "torus",
    "sphere",
    "sphereRings",
    "sphereHalftone",
    "sphereChaos",
    "earth",
    "mars",
    "box",
    "boxChaos",
    "icosahedron",
    "capsule",
    "stripes",
    "framer",
    "waves",
    "blob",
    "plane",
    "ring",
    "empty",
    "image",
]

const SHAPE_TITLES = [
    "Knot",
    "Torus",
    "Sphere",
    "Sphere · Rings",
    "Sphere · Halftone",
    "Sphere + Chaos",
    "Earth",
    "Mars",
    "Box / Cube",
    "Cube + Chaos",
    "Icosahedron",
    "Capsule",
    "Stripes",
    "Framer Logo",
    "Waves",
    "Blob",
    "Plane (Field)",
    "Ring",
    "Empty (Disperse)",
    "Image (Upload)",
]

const FONT_STACK = '"JetBrains Mono", "SF Mono", Menlo, Consolas, monospace'
const CAMERA_FOV = 40
// Zoom slider is inverted into camera distance: distance = CAM_SPAN - zoom.
const CAM_SPAN = 10.8
// Every shape morphs toward a sphere of this radius mid-transition, so two
// unrelated geometries meet in a shared intermediate form.
const MORPH_R = 1.3
const GRAD_STEPS = 16
const ALPHA_LEVELS = 15
const MIN_LUM = 0.045
const DUO_STEPS = 16
const FIELD_MAX = 384 // long side of a sampled image field, in texels
const FRONT_WIDTH = 0.16 // softness of the per-cell transition front

const QUALITY: Record<Quality, { fps: number; dpr: number }> = {
    low: { fps: 24, dpr: 1 },
    balanced: { fps: 30, dpr: 2 },
    high: { fps: 60, dpr: 2 },
}

const DEFAULT_SECTIONS: SectionConfig[] = [
    {
        name: "Hero",
        section: "",
        shape: "knot",
        positionX: 65,
        positionY: 50,
        scale: 1,
        rotationSpeed: 1,
        direction: "cw",
        charSize: 0,
        opacity: 1,
        transition: 60,
        start: 0,
        end: 60,
        mobileX: -1,
        mobileY: -1,
    },
    {
        name: "About",
        section: "",
        shape: "earth",
        positionX: 50,
        positionY: 50,
        scale: 2,
        rotationSpeed: 0.6,
        direction: "cw",
        charSize: 0,
        opacity: 1,
        transition: 60,
        start: 120,
        end: 180,
        mobileX: -1,
        mobileY: -1,
    },
    {
        name: "Projects",
        section: "",
        shape: "stripes",
        positionX: 25,
        positionY: 60,
        scale: 1.5,
        rotationSpeed: 1,
        direction: "ccw",
        charSize: 0,
        opacity: 1,
        transition: 60,
        start: 240,
        end: 300,
        mobileX: -1,
        mobileY: -1,
    },
    {
        name: "Contact",
        section: "",
        shape: "blob",
        positionX: 75,
        positionY: 75,
        scale: 0.8,
        rotationSpeed: 1,
        direction: "cw",
        charSize: 0,
        opacity: 1,
        transition: 60,
        start: 360,
        end: 420,
        mobileX: -1,
        mobileY: -1,
    },
]

const DEFAULTS: Settings = {
    enabled: true,
    layer: "fixed",
    zIndex: 0,
    pointerEvents: "none",
    quality: "balanced",
    cell: 13,
    characters: " .·:;=+*/<>{}#@",
    inkColor: "#101317",
    gradient: false,
    inkColor2: "#2433FF",
    accentColor: "#2433FF",
    landColor: "#2F9E63",
    seaColor: "#2433FF",
    backgroundColor: "rgba(0, 0, 0, 0)",
    intensity: 1,
    centerFade: 0,
    cameraDistance: 3.8,
    autoSpin: true,
    rotationSpeed: 1,
    animationSpeed: 1,
    mouseFollow: true,
    followStrength: 1,
    floatAmount: 0.5,
    chaos: 0.6,
    breathing: 15,
    morphAmount: 0.85,
    morphSpin: 45,
    scramble: true,
    transitionSmoothing: 0.35,
    transitionStyle: "morph",
    frontAccent: false,
    glitch: 0.25,
    imageSize: 55,
    imageCharacters: " .:-=+*#%@",
    edgeCharacters: "-\\|/",
    imageTone: "darkOnLight",
    imageColors: "ink",
    autoLevels: true,
    contrast: 1.15,
    brightness: 0,
    threshold: 0.08,
    edgeGlyphs: 0.25,
    edgeFade: 0.25,
    bgTolerance: 0.16,
    imageSway: 0.35,
    imageWave: 0.15,
    shimmer: 0.2,
    imageTwist: 6,
    imageZoom: 0.1,
    scriptIdle: true,
    scriptIdleIntensity: 1,
    scriptIdleSpeed: 1,
    scriptRotation: 1,
    scriptFloat: 1,
    scriptDepth: 1,
    detection: "ids",
    trigger: 50,
    anchor: "before",
    manualUnit: "vh",
    scrollSmoothing: 0.4,
    sectionTransitions: true,
    respectReducedMotion: true,
    debug: false,
    mobileBreakpoint: 810,
    mobileScale: 0.7,
    mobileCharSize: 11,
    previewSection: 1,
    sections: DEFAULT_SECTIONS,
}

// ─── Math helpers ────────────────────────────────────────────────────────────

function clamp01(v: number): number {
    return v < 0 ? 0 : v > 1 ? 1 : v
}

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
}

function smoothstep(e0: number, e1: number, x: number): number {
    const t = clamp01((x - e0) / (e1 - e0))
    return t * t * (3 - 2 * t)
}

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function fract(n: number): number {
    return n - Math.floor(n)
}

function hash3(x: number, y: number, z: number): number {
    const qx = Math.round(x * 1e4) / 1e4
    const qy = Math.round(y * 1e4) / 1e4
    const qz = Math.round(z * 1e4) / 1e4
    return fract(Math.sin(qx * 127.1 + qy * 311.7 + qz * 74.7) * 43758.5453)
}

function hash2(x: number, y: number): number {
    return fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453)
}

/** Frame-rate independent exponential follow factor for a 0–1 smoothing. */
function followFactor(dt: number, smoothing: number): number {
    if (smoothing <= 0.001) return 1
    const k = 60 * Math.pow(0.02, clamp01(smoothing))
    return 1 - Math.exp(-dt * k)
}

function num(v: unknown, fallback: number): number {
    return typeof v === "number" && isFinite(v) ? v : fallback
}

// ─── Noise (from AsciiHero) ──────────────────────────────────────────────────

function noise3(x: number, y: number, z: number): number {
    return (
        Math.sin(x * 1.7 + Math.sin(y * 2.3 + Math.sin(z * 1.9))) * 0.5 +
        Math.sin(y * 1.9 + Math.sin(z * 2.1 + Math.sin(x * 1.3))) * 0.3 +
        Math.sin(z * 2.3 + Math.sin(x * 1.5 + Math.sin(y * 1.7))) * 0.2
    )
}

function fbm(x: number, y: number, z: number): number {
    let v = 0
    let amp = 0.55
    let f = 1
    for (let o = 0; o < 4; o++) {
        v += amp * noise3(x * f + o * 7.13, y * f + o * 3.71, z * f + o * 11.9)
        amp *= 0.5
        f *= 2.1
    }
    return v
}

// ─── Colors ──────────────────────────────────────────────────────────────────

let colorCtx: CanvasRenderingContext2D | null = null
const colorCache = new Map<string, RGBA>()

/** Parse any CSS color (hex, rgb[a], hsl, named…) via the canvas normalizer. */
function parseCssColor(value: string): RGBA {
    if (!value) return [0, 0, 0, 0]
    const hit = colorCache.get(value)
    if (hit) return hit
    let out: RGBA = [0, 0, 0, 1]
    if (typeof document !== "undefined") {
        if (!colorCtx)
            colorCtx = document.createElement("canvas").getContext("2d")
        if (colorCtx) {
            colorCtx.fillStyle = "#000000"
            colorCtx.fillStyle = value
            const n = String(colorCtx.fillStyle)
            if (n.charAt(0) === "#") {
                out = [
                    parseInt(n.slice(1, 3), 16),
                    parseInt(n.slice(3, 5), 16),
                    parseInt(n.slice(5, 7), 16),
                    1,
                ]
            } else {
                const m = n.match(/rgba?\(([^)]+)\)/)
                if (m) {
                    const parts = m[1].split(",").map((s) => parseFloat(s))
                    out = [
                        parts[0] || 0,
                        parts[1] || 0,
                        parts[2] || 0,
                        parts.length > 3 ? parts[3] : 1,
                    ]
                }
            }
        }
    }
    if (colorCache.size > 512) colorCache.clear()
    colorCache.set(value, out)
    return out
}

/** Canvas can't read CSS variables — resolve Framer color tokens first. */
function resolveCssVar(value: string, el: Element): string {
    if (!value || value.indexOf("var(") === -1) return value
    const m = value.match(/var\((--[^,)]+)/)
    if (m) {
        const resolved = window
            .getComputedStyle(el)
            .getPropertyValue(m[1])
            .trim()
        if (resolved) return resolved
        const fallback = value.match(/,\s*([^)]+)\)\s*$/)
        if (fallback) return fallback[1].trim()
    }
    return value
}

function rgbaString(c: RGBA): string {
    return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${c[3]})`
}

// ─── Settings & sections ─────────────────────────────────────────────────────

function withDefaults(props: Props): Settings {
    const out: Record<string, unknown> = { ...DEFAULTS }
    const src = props as Record<string, unknown>
    for (const k of Object.keys(DEFAULTS)) {
        const v = src[k]
        if (v !== undefined && v !== null) out[k] = v
    }
    return out as unknown as Settings
}

function cleanHash(h: string): string {
    let s = h.trim().replace(/^#/, "")
    try {
        s = decodeURIComponent(s)
    } catch (e) {
        // keep the raw value
    }
    return s.trim()
}

/** Extract the Scroll Section ID (the URL hash) from a Link control value. */
function sectionIdFromLink(v: SectionLink): string {
    if (!v) return ""
    if (typeof v === "object") {
        return typeof v.hash === "string" ? cleanHash(v.hash) : ""
    }
    if (typeof v !== "string") return ""
    const s = v.trim()
    const i = s.lastIndexOf("#")
    if (i >= 0) return cleanHash(s.slice(i + 1))
    // A bare word typed into the link field ("offers") is treated as an ID;
    // anything URL-like without a hash is a page link without a section.
    return /^[\w-]+$/.test(s) ? s : ""
}

// The image is sampled at ≤384px, so a ~512px download is all it needs.
const IMAGE_TARGET_PX = 512

/** Ask Framer's image CDN for a scaled-down copy when no srcSet offers one. */
function withScaleDown(url: string): string {
    if (!/framerusercontent\.com\/images\//.test(url)) return url
    if (/[?&]scale-down-to=/.test(url) || /\.svg(\?|$)/i.test(url)) return url
    return `${url}${url.indexOf("?") >= 0 ? "&" : "?"}scale-down-to=${IMAGE_TARGET_PX}`
}

/**
 * Pick the smallest useful URL from a ResponsiveImage value: the smallest
 * srcSet candidate that is at least IMAGE_TARGET_PX wide, falling back to
 * the largest candidate or to `src` (scaled down on Framer's CDN).
 */
function pickImageSrc(v: SectionConfig["image"]): string {
    if (!v) return ""
    if (typeof v === "string") return withScaleDown(v.trim())
    const src = typeof v.src === "string" ? v.src.trim() : ""
    if (typeof v.srcSet === "string" && v.srcSet.trim()) {
        let best = ""
        let bestW = Infinity
        let largest = ""
        let largestW = -1
        for (const part of v.srcSet.split(",")) {
            const bits = part.trim().split(/\s+/)
            if (!bits[0]) continue
            const m = bits[1] ? bits[1].match(/^(\d+)w$/) : null
            const w = m ? parseInt(m[1], 10) : 0
            if (w >= IMAGE_TARGET_PX && w < bestW) {
                best = bits[0]
                bestW = w
            }
            if (w > largestW) {
                largest = bits[0]
                largestW = w
            }
        }
        if (best) return best
        if (largest && largestW > 0) return largest
    }
    return withScaleDown(src)
}

function normSection(
    c: SectionConfig | null | undefined,
    i: number
): NormSection {
    const d: SectionConfig = c || {}
    const shape =
        d.shape && SHAPE_OPTIONS.indexOf(d.shape) >= 0 ? d.shape : "knot"
    const id = sectionIdFromLink(d.section) || cleanHash(d.id || "")
    const rawName = (d.name || "").trim()
    return {
        name:
            rawName && rawName !== "Section"
                ? rawName
                : id || rawName || `Section ${i + 1}`,
        id,
        shape,
        imageSrc: shape === "image" && !d.scripted ? pickImageSrc(d.image) : "",
        invert: !!d.invert,
        removeBg: !!d.removeBg,
        rot: num(d.rotation, 0),
        scripted: !!d.scripted,
        script: normScript(d),
        scriptPreview: Math.max(
            1,
            Math.min(8, Math.round(Number(d.scriptPreview) || 1))
        ),
        x: num(d.positionX, 50),
        y: num(d.positionY, 50),
        scale: Math.max(0, num(d.scale, 1)),
        speed: num(d.rotationSpeed, 1),
        direction: d.direction === "ccw" ? "ccw" : "cw",
        charSize: Math.max(0, num(d.charSize, 0)),
        opacity: clamp01(num(d.opacity, 1)),
        accent: d.accentColor || "",
        transition: Math.max(0, num(d.transition, 60)),
        start: num(d.start, i * 100),
        end: num(d.end, i * 100 + 60),
        mobileX: num(d.mobileX, -1),
        mobileY: num(d.mobileY, -1),
    }
}

function normSections(cfg: Settings): NormSection[] {
    const list = (Array.isArray(cfg.sections) ? cfg.sections : []).map((c, i) =>
        normSection(c, i)
    )
    if (list.length === 0) list.push(normSection(null, 0))
    return list
}

const STATE_KEYS: Array<keyof MotionState> = [
    "x",
    "y",
    "scale",
    "speed",
    "opacity",
    "cell",
    "ar",
    "ag",
    "ab",
    "spin",
    "rot",
]

function makeState(): MotionState {
    return {
        x: 50,
        y: 50,
        scale: 1,
        speed: 1,
        opacity: 1,
        cell: 13,
        ar: 36,
        ag: 51,
        ab: 255,
        spin: 0,
        rot: 0,
    }
}

/** What a section draws: two sections with the same key need no morph. */
function sourceKey(sec: NormSection): string {
    if (sec.scripted) return `script|${sec.id}|${sec.name}`
    if (sec.shape !== "image") return sec.shape
    if (!sec.imageSrc) return "empty"
    return `img|${sec.imageSrc}|${sec.invert ? 1 : 0}|${sec.removeBg ? 1 : 0}`
}

/** True when a section renders nothing (Empty, or Image without a file). */
function isEmptySection(sec: NormSection): boolean {
    if (sec.scripted) return false
    return sec.shape === "empty" || (sec.shape === "image" && !sec.imageSrc)
}

function lerpState(o: MotionState, a: MotionState, b: MotionState, t: number) {
    for (let i = 0; i < STATE_KEYS.length; i++) {
        const k = STATE_KEYS[i]
        o[k] = a[k] + (b[k] - a[k]) * t
    }
}

/** The fully-reached visual state of one section. */
function sectionState(
    sec: NormSection,
    cfg: Settings,
    mobile: boolean,
    globalAccent: RGBA,
    colorOf: (v: string) => RGBA,
    o: MotionState
) {
    o.x = mobile && sec.mobileX >= 0 ? sec.mobileX : sec.x
    o.y = mobile && sec.mobileY >= 0 ? sec.mobileY : sec.y
    o.scale = sec.scale * (mobile ? cfg.mobileScale : 1)
    o.speed = sec.speed * (sec.direction === "ccw" ? -1 : 1)
    o.opacity = sec.opacity
    let c = sec.charSize > 0 ? sec.charSize : cfg.cell
    if (mobile && cfg.mobileCharSize > 0) c = Math.max(c, cfg.mobileCharSize)
    o.cell = c
    let acc = globalAccent
    if (sec.accent) {
        const a = colorOf(sec.accent)
        if (a[3] > 0) acc = a
    }
    o.ar = acc[0]
    o.ag = acc[1]
    o.ab = acc[2]
    o.spin = 0
    o.rot = sec.shape === "image" ? sec.rot : 0
}

/**
 * Build the scroll track. The order of the Sections list is the order of
 * the flow.
 *
 * Section mode: `rects` holds each picked Scroll Section's measured
 * document-space top and bottom — that IS the section's range, no manual
 * numbers needed. A section's state is held while the trigger line is inside
 * it; the morph into the next section happens at the boundary between them
 * (or spreads across any gap if other content sits in between). Sections
 * that aren't found are NOT dropped: their position is estimated between
 * found neighbors, so one unresolved section can never collapse the flow
 * into a single shape. With nothing found it falls back to even page-progress
 * distribution (the original Full Page Motion behavior).
 *
 * `endPos` is the largest reachable scroll coordinate (page bottom at the
 * trigger line); the smallest is the trigger line at page top.
 */
function buildTrack(
    requested: Detection,
    list: NormSection[],
    rects: SectionRect[],
    cfg: Settings,
    vh: number,
    endPos: number
): Track {
    const startPos = (clamp01(cfg.trigger / 100) || 0) * vh
    let mode = requested
    const zones: Array<[number, number]> = [[0, 0]]
    let sections: NormSection[] = list

    if (mode === "ids") {
        const n = list.length
        const found: boolean[] = []
        const st: number[] = []
        const en: number[] = []
        let last = -Infinity
        for (let i = 0; i < n; i++) {
            const r = rects[i]
            const ok = !!r && isFinite(r.top) && isFinite(r.bottom)
            found.push(ok)
            if (ok && r) {
                // Keep list order: a section that sits above an earlier one
                // on the page is clamped instead of reshuffling the flow.
                const s = Math.max(r.top, last)
                const e = Math.max(r.bottom, s)
                st.push(s)
                en.push(e)
                last = e
            } else {
                st.push(NaN)
                en.push(NaN)
            }
        }
        const foundIdx: number[] = []
        for (let i = 0; i < n; i++) if (found[i]) foundIdx.push(i)

        if (foundIdx.length === 0) {
            mode = "progress"
        } else {
            // Estimate the unresolved sections as points spread between their
            // found neighbors, by list position.
            const f0 = foundIdx[0]
            const fl = foundIdx[foundIdx.length - 1]
            for (let i = 0; i < f0; i++) {
                st[i] = en[i] = (st[f0] * i) / f0
            }
            for (let k = 0; k < foundIdx.length - 1; k++) {
                const a = foundIdx[k]
                const b = foundIdx[k + 1]
                for (let i = a + 1; i < b; i++) {
                    st[i] = en[i] = lerp(en[a], st[b], (i - a) / (b - a))
                }
            }
            const end = Math.max(endPos, en[fl])
            for (let i = fl + 1; i < n; i++) {
                st[i] = en[i] = lerp(en[fl], end, (i - fl) / (n - 1 - fl))
            }

            let prevEnd = -Infinity
            const ranges: Array<[number, number]> = []
            for (let i = 0; i < n; i++) ranges.push([st[i], en[i]])
            for (let i = 1; i < n; i++) {
                const gs = en[i - 1] // previous section's bottom
                const ge = st[i] // this section's top
                const L = (list[i].transition / 100) * vh
                let s: number
                let e: number
                if (L > 0 && ge - gs >= L) {
                    // Content between the two sections: morph across the gap.
                    s = gs
                    e = ge
                } else if (cfg.anchor === "centered") {
                    const mid = (gs + ge) / 2
                    s = mid - L / 2
                    e = mid + L / 2
                } else if (cfg.anchor === "after") {
                    s = gs
                    e = gs + L
                } else {
                    // "Before": finish exactly when this section's top
                    // reaches the trigger line.
                    s = ge - L
                    e = ge
                }
                // Keep every morph inside the reachable scroll range: the
                // first section is untouched at page load and the last one
                // is fully reached at the bottom of the page.
                if (s < startPos) s = startPos
                if (e > endPos) e = endPos
                if (s > e) s = e
                // Never let a transition start before the previous one has
                // finished — overlapping zones would make the shape pop.
                if (s < prevEnd) s = prevEnd
                if (e < s) e = s
                zones.push([s, e])
                prevEnd = e
            }
            return { mode, sections: list, zones, found, ranges }
        }
    }

    if (mode === "manual") {
        const unit = cfg.manualUnit === "px" ? 1 : vh / 100
        const items = list
            .map((sec) => ({
                sec,
                start: sec.start * unit,
                end: Math.max(sec.start, sec.end) * unit,
            }))
            .sort((a, b) => a.start - b.start)
        sections = items.map((it) => it.sec)
        for (let i = 1; i < items.length; i++) {
            const prevEnd = items[i - 1].end
            const start = items[i].start
            if (start > prevEnd) {
                zones.push([prevEnd, start])
            } else {
                const L = (items[i].sec.transition / 100) * vh
                zones.push([start - L / 2, start + L / 2])
            }
        }
        return { mode, sections, zones }
    }

    // Page progress: stops evenly distributed across the whole scroll.
    sections = list
    const n = list.length
    for (let i = 1; i < n; i++) zones.push([(i - 1) / (n - 1), i / (n - 1)])
    return { mode: "progress", sections, zones }
}

/**
 * Evaluate the track at a scroll coordinate. Numeric state is blended
 * sequentially (so it is continuous and reversible); the shape pair is the
 * most recent transition that has started.
 */
function evaluateTrack(
    track: Track,
    pos: number,
    cfg: Settings,
    mobile: boolean,
    globalAccent: RGBA,
    colorOf: (v: string) => RGBA,
    out: MotionState,
    tmp: MotionState,
    pair: ShapePair
) {
    const secs = track.sections
    sectionState(secs[0], cfg, mobile, globalAccent, colorOf, out)
    pair.a = secs[0].shape
    pair.b = secs[0].shape
    pair.p = 0
    pair.ia = 0
    pair.ib = 0
    const spinRad = (cfg.morphSpin * Math.PI) / 180
    for (let i = 1; i < secs.length; i++) {
        const z = track.zones[i]
        let t: number
        if (!cfg.sectionTransitions) t = pos >= (z[0] + z[1]) / 2 ? 1 : 0
        else if (z[1] - z[0] < 1e-6) t = pos >= z[0] ? 1 : 0
        else t = easeInOutCubic(clamp01((pos - z[0]) / (z[1] - z[0])))
        if (t <= 0) continue
        sectionState(secs[i], cfg, mobile, globalAccent, colorOf, tmp)
        const spinBefore = out.spin
        lerpState(out, out, tmp, t)
        out.spin = spinBefore + t * spinRad
        pair.a = secs[i - 1].shape
        pair.b = secs[i].shape
        pair.p = t
        pair.ia = i - 1
        pair.ib = i
    }
    if (pair.p >= 0.999) {
        pair.a = pair.b
        pair.p = 0
        pair.ia = pair.ib
    }
}

// ─── Land mask (from AsciiHero) ──────────────────────────────────────────────

// NASA "land_ocean_ice" equirectangular image reduced to a 180×90 bitmask
// (1 bit per 2°×2° cell), row 0 = north, col 0 = 180°W.
const MASK_W = 180
const MASK_H = 90
const LAND_MASK =
    "///////////////////////////////////////////////////////////////////////////////////////////////////////P////A//////////////////v//9//P/4AAAAGbf////////////9//4D///gAAAAAAAAD///////////////wA///wAAAAAAAAD///////////////wAL//wAAAAAAAAH///////wB3/////4AD/4AAAAAAAAA////////AD8Af///wAD/4AAAAAAAAP////////AH//////AgD/gAAAH/AAf/////////AH/////+B4D+AAAAP/g///////////AH/////8AwDoAAAA//////////////AP/////wAgAAAAAB//////////////AP8////gDwAAAAAD4////////////wAP4P///gHgAAAAAD4f//////////gAAAAA///8D+AAAACAj/////////4A4AAAAA////D/AAAADBz/////////4AwAAAAAf/////gAAADP//////////8AAAAAAAP/////wAAAD///////////8AAAAAAAD////8AAAAB///////////+AAAAAAAD////4AAAAB///////////+AAAAAAAD////wAAAAB//wfv//////wAAAAAAAD////gAAAAH//wfP//////gAAAAAAAD////AAAAAPgP//P/////+AAAAAAAAD///+AAAAAPgD//P/////8AAAAAAAAB///8AAAAAP/AH///////AEAAAAAAAA///8AAAAAP/AH///////AMAAAAAAAAP//wAAAAAf/zH///////AAAAAAAAAAP//wAAAAAf//////////AAAAAAAAAAP/gwAAAAA///////////AAAAAAAAAAD/AgAAAAB///////////gAAAAAAAAAA/AAAAAAD//////H///8AAAAAAAAAAAfAAAAAAD//////D///8AAAAAAAAAAAPAAAAAAD/////+B/z/wAAAAAAAAAAAPMAAAAAD/////+A/h/AAAAAAAAAAAAH+AAAAAD/////4A/B/AAAAAAAAAAAAAPAAAAAD/////wAeA/AAAAAAAAAAAAADAAAAAD/////wAMAPAAAAAAAAAAAAADAwAAAD/////gAMADAAAAAAAAAAAAAAD/AAAB/////wAMAAAAAAAAAAAAAAAAH/gAAA/////gAAAAAAAAAAAAAAAAAAH/8AAADn///gAAAAEAAAAAAAAAAAAAH/8AAAAD///AAAAYOAAAAAAAAAAAAAP/+AAAAD//8AAAAM+AAAAAAAAAAAAAP//gAAAB//8AAAAM8AAAAAAAAAAAAAP//8AAAA//4AAAAEAAMAAAAAAAAAAAP//+AAAA//wAAAAHAAMAAAAAAAAAAAP///AAAA//wAAAAAAADgAAAAAAAAAAH///AAAA//wAAAAAAADAAAAAAAAAAAD///AAAA//wAAAAAAAAAAAAAAAAAAAD///AAAA//wAAAAAAAgAAAAAAAAAAAB//+AAAA//yAAAAAAPzAAAAAAAAAAAA//+AAAA//jAAAAAAf/gAAAAAAAAAAA//8AAAA//DAAAAAB//wAAAAAAAAAAAf/8AAAA//DAAAAAD//wAAAAAAAAAAAf/gAAAAf/DAAAAAH//4AAAAAAAAAAA//AAAAAP+CAAAAAP//8AAAAAAAAAAA//AAAAAP8AAAAAAP//8AAAAAAAAAAA/+AAAAAP8AAAAAAH//8AAAAAAAAAAA/8AAAAAH4AAAAAAD//8AAAAAAAAAAA/8AAAAADwAAAAAADw/8AAAAAAAAAAA/wAAAAAAAAAAAAAAAH4AAAAAAAAAAA/wAAAAAAAAAAAAAAADwAAAAAAAAAAA8AAAAAAAAAAAAAAAAAAAAAAAAAAAAA8AAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAA4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB4oAAAAAAAAAAAAAAAAA//dAAP/3ABP//lW9QAb///ugAAHmEQ/9///////z////////8Af/AAADfd///////////j////////8A//AAAD////////////////////AAAAAAAAAADwD/////////D///////AAAAAAAAAADwD/////////A////6qqAAAAAAAAAADwD///8AAAAAA///+AAAAAAAAAAAAADwD///8AAAAABP8HAAAAAAAAAAAAAADAD///8AAAAAAP8AAAAAAAAAAAAAAADAD//8AAAAAAAA8AAAAAAAAAAAAAAADAD//8AAAAAAAA8AAAAAAAAAAAAAAADAD/8AAAAAAAAAAAAAAAAAAAAAAAAAAADw8AAAAAAAAAAAAAAAAAAAAAAAAAAADw"

let landBits: Uint8Array | null = null

function isLand(nx: number, ny: number, nz: number): boolean {
    if (!landBits) {
        const bin = window.atob(LAND_MASK)
        landBits = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) landBits[i] = bin.charCodeAt(i)
    }
    const lon = Math.atan2(nz, nx)
    const lat = Math.asin(Math.max(-1, Math.min(1, ny)))
    // (π - lon): the camera looks down -z, so screen-right is decreasing
    // atan2(z,x) — this keeps east longitude reading rightward.
    const u = (Math.PI - lon) / (2 * Math.PI)
    const row = Math.min(
        MASK_H - 1,
        Math.max(0, Math.floor((0.5 - lat / Math.PI) * MASK_H))
    )
    const col = Math.min(MASK_W - 1, Math.max(0, Math.floor(u * MASK_W)))
    const idx = row * MASK_W + col
    return ((landBits[idx >> 3] >> (7 - (idx & 7))) & 1) === 1
}

// ─── Geometry builders ───────────────────────────────────────────────────────

/** Earth/Mars: per-vertex brightness (or channel-encoded land/sea). */
function makePlanetGeometry(kind: "earth" | "mars"): THREE.BufferGeometry {
    const seg = kind === "earth" ? 128 : 96
    const geo = new THREE.SphereGeometry(1.35, seg, seg)
    const pos = geo.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
        const nx = pos.getX(i) / 1.35
        const ny = pos.getY(i) / 1.35
        const nz = pos.getZ(i) / 1.35
        if (kind === "earth") {
            // Land red-dominant, ocean blue-dominant, ice neutral white —
            // the glyph pass reads these channel ratios back.
            if (Math.abs(ny) > 0.88) {
                colors[i * 3] = 1
                colors[i * 3 + 1] = 1
                colors[i * 3 + 2] = 1
            } else if (isLand(nx, ny, nz)) {
                colors[i * 3] = 1
                colors[i * 3 + 1] = 0.85
                colors[i * 3 + 2] = 0.1
            } else {
                colors[i * 3] = 0.1
                colors[i * 3 + 1] = 0.45
                colors[i * 3 + 2] = 1
            }
            continue
        }
        let v = 0.62 + 0.3 * fbm(nx * 2.2 + 5, ny * 2.2 + 5, nz * 2.2 + 5)
        const maria = fbm(nx * 1.3 + 20, ny * 1.3 + 20, nz * 1.3 + 20)
        if (maria < -0.32) v = 0.34
        if (Math.abs(ny) > 0.92) v = 1
        v = Math.max(0.15, Math.min(1, v))
        colors[i * 3] = v
        colors[i * 3 + 1] = v
        colors[i * 3 + 2] = v
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    return geo
}

/** Sphere with baked rings or halftone pattern so rotation reads clearly. */
function makePatternedSphereGeometry(
    style: "rings" | "halftone"
): THREE.BufferGeometry {
    const geo = new THREE.SphereGeometry(1.35, 128, 128)
    const pos = geo.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    const ax = 0.55
    const ay = 0.72
    const az = 0.42
    const alen = Math.sqrt(ax * ax + ay * ay + az * az)
    for (let i = 0; i < pos.count; i++) {
        const nx = pos.getX(i) / 1.35
        const ny = pos.getY(i) / 1.35
        const nz = pos.getZ(i) / 1.35
        let v: number
        if (style === "rings") {
            const d = Math.max(
                -1,
                Math.min(1, (nx * ax + ny * ay + nz * az) / alen)
            )
            const band = Math.floor((Math.acos(d) / Math.PI) * 9) % 2
            v = band === 0 ? 0.95 : 0.1
        } else {
            const lat = Math.asin(Math.max(-1, Math.min(1, ny)))
            const lon = Math.atan2(nz, nx)
            const g = Math.sin(lat * 28) * Math.sin(lon * 14)
            v = g > 0 ? 0.2 + 0.75 * g : 0.08
        }
        colors[i * 3] = v
        colors[i * 3 + 1] = v
        colors[i * 3 + 2] = v
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    return geo
}

/** Extruded Framer logomark (24-unit grid, y flipped for THREE.Shape). */
function makeFramerLogoGeometry(): THREE.BufferGeometry {
    const top = new THREE.Shape()
    top.moveTo(4, 24)
    top.lineTo(20, 24)
    top.lineTo(20, 16)
    top.lineTo(12, 16)
    top.closePath()

    const middle = new THREE.Shape()
    middle.moveTo(4, 16)
    middle.lineTo(12, 16)
    middle.lineTo(20, 8)
    middle.lineTo(4, 8)
    middle.closePath()

    const bottom = new THREE.Shape()
    bottom.moveTo(4, 8)
    bottom.lineTo(12, 8)
    bottom.lineTo(12, 0)
    bottom.closePath()

    const geo = new THREE.ExtrudeGeometry([top, middle, bottom], {
        depth: 6,
        bevelEnabled: true,
        bevelThickness: 0.5,
        bevelSize: 0.5,
        bevelSegments: 2,
    })
    geo.center()
    geo.scale(0.11, 0.11, 0.11)
    return geo
}

/** Flat field that fills the viewport; noise-tinted so it reads as texture. */
function makePlaneGeometry(): THREE.BufferGeometry {
    const geo = new THREE.PlaneGeometry(2, 2, 64, 40)
    const pos = geo.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
        const v =
            0.42 + 0.22 * fbm(pos.getX(i) * 1.6 + 3, pos.getY(i) * 1.6 + 3, 1.7)
        colors[i * 3] = v
        colors[i * 3 + 1] = v
        colors[i * 3 + 2] = v
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    return geo
}

/** Annulus (Full Page Motion "Ring") with banded, angle-varied brightness. */
function makeRingGeometry(): THREE.BufferGeometry {
    const thetaSeg = 120
    const phiSeg = 10
    const geo = new THREE.RingGeometry(0.72, 1.6, thetaSeg, phiSeg)
    const uv = geo.attributes.uv as THREE.BufferAttribute
    const colors = new Float32Array(uv.count * 3)
    for (let k = 0; k < uv.count; k++) {
        const i = k % (thetaSeg + 1)
        const j = Math.floor(k / (thetaSeg + 1))
        const u = i / thetaSeg
        const r = j / phiSeg
        // Polar UVs (around, outward) so the wrap morph covers a sphere.
        uv.setXY(k, u, r)
        const band = 0.5 + 0.5 * Math.cos(r * Math.PI * 5)
        const v = 0.3 + 0.6 * band * (0.7 + 0.3 * Math.sin(u * Math.PI * 2 * 7))
        colors[k * 3] = v
        colors[k * 3 + 1] = v
        colors[k * 3 + 2] = v
    }
    uv.needsUpdate = true
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3))
    return geo
}

// ─── Morph targets ───────────────────────────────────────────────────────────

/**
 * Radial projection onto the shared morph sphere — good for star-shaped
 * geometry. `local` is the mesh's matrix inside its shape root, so grouped
 * meshes (Stripes) project around the group center.
 */
function addRadialMorph(geo: THREE.BufferGeometry, local?: THREE.Matrix4) {
    const pos = geo.attributes.position as THREE.BufferAttribute
    const n = pos.count
    const tp = new Float32Array(n * 3)
    const tn = new Float32Array(n * 3)
    const inv = local ? local.clone().invert() : null
    const v = new THREE.Vector3()
    const d = new THREE.Vector3()
    for (let i = 0; i < n; i++) {
        v.fromBufferAttribute(pos, i)
        if (local) v.applyMatrix4(local)
        const l = v.length()
        if (l < 1e-5) d.set(0, 1, 0)
        else d.copy(v).divideScalar(l)
        v.copy(d).multiplyScalar(MORPH_R)
        if (inv) {
            v.applyMatrix4(inv)
            d.transformDirection(inv)
        }
        tp[i * 3] = v.x
        tp[i * 3 + 1] = v.y
        tp[i * 3 + 2] = v.z
        tn[i * 3] = d.x
        tn[i * 3 + 1] = d.y
        tn[i * 3 + 2] = d.z
    }
    geo.morphAttributes.position = [new THREE.BufferAttribute(tp, 3)]
    geo.morphAttributes.normal = [new THREE.BufferAttribute(tn, 3)]
}

function signedVolume(p: Float32Array, index: THREE.BufferAttribute | null) {
    const triCount = (index ? index.count : p.length / 3) / 3
    let s = 0
    for (let t = 0; t < triCount; t++) {
        const ia = (index ? index.getX(t * 3) : t * 3) * 3
        const ib = (index ? index.getX(t * 3 + 1) : t * 3 + 1) * 3
        const ic = (index ? index.getX(t * 3 + 2) : t * 3 + 2) * 3
        const e1x = p[ib] - p[ia]
        const e1y = p[ib + 1] - p[ia + 1]
        const e1z = p[ib + 2] - p[ia + 2]
        const e2x = p[ic] - p[ia]
        const e2y = p[ic + 1] - p[ia + 1]
        const e2z = p[ic + 2] - p[ia + 2]
        const cx = e1y * e2z - e1z * e2y
        const cy = e1z * e2x - e1x * e2z
        const cz = e1x * e2y - e1y * e2x
        s +=
            cx * (p[ia] + p[ib] + p[ic]) +
            cy * (p[ia + 1] + p[ib + 1] + p[ic + 1]) +
            cz * (p[ia + 2] + p[ib + 2] + p[ic + 2])
    }
    return s
}

/**
 * UV-wrap onto the morph sphere — for shapes radial projection would
 * collapse (planes, torus, knot, ring). Orientation is checked so the front
 * faces end up facing outward.
 */
function addWrapMorph(geo: THREE.BufferGeometry) {
    const uv = geo.attributes.uv as THREE.BufferAttribute
    const n = uv.count
    const build = (sign: number) => {
        const tp = new Float32Array(n * 3)
        const tn = new Float32Array(n * 3)
        for (let i = 0; i < n; i++) {
            const lon = sign * uv.getX(i) * Math.PI * 2
            const lat = (uv.getY(i) - 0.5) * Math.PI
            const dx = Math.cos(lat) * Math.cos(lon)
            const dy = Math.sin(lat)
            const dz = -Math.cos(lat) * Math.sin(lon)
            tp[i * 3] = dx * MORPH_R
            tp[i * 3 + 1] = dy * MORPH_R
            tp[i * 3 + 2] = dz * MORPH_R
            tn[i * 3] = dx
            tn[i * 3 + 1] = dy
            tn[i * 3 + 2] = dz
        }
        return { tp, tn }
    }
    let res = build(1)
    if (signedVolume(res.tp, geo.index) < 0) res = build(-1)
    geo.morphAttributes.position = [new THREE.BufferAttribute(res.tp, 3)]
    geo.morphAttributes.normal = [new THREE.BufferAttribute(res.tn, 3)]
}

// ─── Deformers ───────────────────────────────────────────────────────────────

function snapshot(geo: THREE.BufferGeometry): Float32Array {
    return new Float32Array(
        (geo.attributes.position as THREE.BufferAttribute).array as Float32Array
    )
}

function wavesDeformer(geo: THREE.BufferGeometry): Deformer {
    const pos = geo.attributes.position as THREE.BufferAttribute
    const base = snapshot(geo)
    return ({ time }) => {
        for (let i = 0; i < pos.count; i++) {
            const x = base[i * 3]
            const y = base[i * 3 + 1]
            pos.setZ(
                i,
                Math.sin(x * 1.6 + time * 1.8) * 0.16 +
                    Math.cos(y * 1.9 + time * 1.3) * 0.2 +
                    Math.sin((x + y) * 1.1 + time) * 0.12
            )
        }
        pos.needsUpdate = true
        geo.computeVertexNormals()
    }
}

function blobDeformer(geo: THREE.BufferGeometry): Deformer {
    const pos = geo.attributes.position as THREE.BufferAttribute
    const base = snapshot(geo)
    return ({ time }) => {
        for (let i = 0; i < pos.count; i++) {
            const bx = base[i * 3]
            const by = base[i * 3 + 1]
            const bz = base[i * 3 + 2]
            const d =
                1 +
                0.2 *
                    Math.sin(bx * 3.1 + time * 1.7) *
                    Math.cos(by * 2.3 + time * 1.3) +
                0.12 * Math.sin((by + bz) * 4 + time * 2.1)
            pos.setXYZ(i, bx * d, by * d, bz * d)
        }
        pos.needsUpdate = true
        geo.computeVertexNormals()
    }
}

/**
 * Full Page Motion "Chaos" variants: hashed radial jitter (consistent across
 * duplicated vertices, so faces never tear) plus per-vertex breathing.
 */
function chaosDeformer(geo: THREE.BufferGeometry): Deformer {
    const pos = geo.attributes.position as THREE.BufferAttribute
    const base = snapshot(geo)
    const hashes = new Float32Array(pos.count)
    for (let i = 0; i < pos.count; i++) {
        hashes[i] = hash3(base[i * 3], base[i * 3 + 1], base[i * 3 + 2])
    }
    return ({ time, chaos, breathing }) => {
        const c = clamp01(chaos)
        const br = Math.max(0, breathing) * 0.0018
        for (let i = 0; i < pos.count; i++) {
            const h = hashes[i]
            const d =
                1 +
                (0.1 + c * 0.42) * (h - 0.5) +
                br * Math.sin(time * (1.3 + h * 2.2) + h * 40)
            pos.setXYZ(
                i,
                base[i * 3] * d,
                base[i * 3 + 1] * d,
                base[i * 3 + 2] * d
            )
        }
        pos.needsUpdate = true
        geo.computeVertexNormals()
    }
}

function rippleDeformer(geo: THREE.BufferGeometry): Deformer {
    const pos = geo.attributes.position as THREE.BufferAttribute
    const base = snapshot(geo)
    return ({ time, breathing }) => {
        const amp = Math.max(0, breathing) * 0.0025
        for (let i = 0; i < pos.count; i++) {
            const x = base[i * 3]
            const y = base[i * 3 + 1]
            pos.setZ(
                i,
                amp *
                    (Math.sin(x * 2.4 + time * 1.3) * Math.cos(y * 2.9 - time) +
                        Math.sin((x - y) * 1.7 + time * 0.7))
            )
        }
        pos.needsUpdate = true
        geo.computeVertexNormals()
    }
}

// ─── Shape factory ───────────────────────────────────────────────────────────

function makeMaterial(opts: {
    vertexColors?: boolean
    roughness?: number
    doubleSide?: boolean
}): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: opts.roughness === undefined ? 0.35 : opts.roughness,
        metalness: 0.15,
        vertexColors: !!opts.vertexColors,
        side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    })
}

function buildShape(key: ShapeKey): ShapeInstance {
    const root = new THREE.Group()
    root.visible = false
    const inst: ShapeInstance = {
        key,
        root,
        meshes: [],
        geometries: [],
        materials: [],
        colorMode: "mono",
        fillViewport: false,
        empty: false,
        orient: () => {},
        deform: null,
        lastTime: NaN,
        lastChaos: NaN,
        lastBreathing: NaN,
    }
    const add = (
        geo: THREE.BufferGeometry,
        mat: THREE.Material,
        parent: THREE.Object3D = root
    ): THREE.Mesh => {
        const mesh = new THREE.Mesh(geo, mat)
        mesh.frustumCulled = false
        parent.add(mesh)
        inst.meshes.push(mesh)
        inst.geometries.push(geo)
        if (inst.materials.indexOf(mat) < 0) inst.materials.push(mat)
        return mesh
    }
    const tumble: Orienter = (rot, mx, my, f) => {
        root.rotation.set(rot * 1.6 + my * 1.1 * f, rot + mx * 1.4 * f, 0)
    }
    inst.orient = tumble

    switch (key) {
        case "empty": {
            inst.empty = true
            break
        }
        case "stripes": {
            // Vertical bars piercing a tilted diamond slab.
            const mat = makeMaterial({})
            const slab = add(
                new THREE.BoxGeometry(2.05, 2.05, 0.09, 6, 6, 1),
                mat
            )
            slab.rotation.z = Math.PI / 4
            for (let i = 0; i < 15; i++) {
                const h = 1.8 + 0.9 * fract(Math.sin(i * 12.9898) * 43758.5453)
                const bar = add(
                    new THREE.BoxGeometry(0.05, h, 0.05, 1, 12, 1),
                    mat
                )
                bar.position.x = -1.4 + i * 0.2
                bar.position.z = i % 2 === 0 ? 0.34 : -0.34
            }
            for (const m of inst.meshes) {
                m.updateMatrix()
                addRadialMorph(m.geometry, m.matrix)
            }
            break
        }
        case "earth":
        case "mars": {
            const geo = makePlanetGeometry(key)
            addRadialMorph(geo)
            add(geo, makeMaterial({ vertexColors: true, roughness: 0.85 }))
            inst.colorMode = key === "earth" ? "earth" : "mono"
            // Planets keep an axial tilt and spin about their axis.
            inst.orient = (rot, mx, my, f) => {
                root.rotation.set(0.35 + my * 0.5 * f, rot + mx * f, 0)
            }
            break
        }
        case "sphere": {
            const geo = new THREE.SphereGeometry(1.35, 48, 48)
            addRadialMorph(geo)
            add(geo, makeMaterial({}))
            break
        }
        case "sphereRings":
        case "sphereHalftone": {
            const geo = makePatternedSphereGeometry(
                key === "sphereRings" ? "rings" : "halftone"
            )
            addRadialMorph(geo)
            add(geo, makeMaterial({ vertexColors: true }))
            break
        }
        case "sphereChaos": {
            const geo = new THREE.IcosahedronGeometry(1.35, 5)
            addRadialMorph(geo)
            add(geo, makeMaterial({ roughness: 0.6 }))
            inst.deform = chaosDeformer(geo)
            break
        }
        case "box": {
            const geo = new THREE.BoxGeometry(1.9, 1.9, 1.9, 8, 8, 8)
            addRadialMorph(geo)
            add(geo, makeMaterial({}))
            break
        }
        case "boxChaos": {
            const geo = new THREE.BoxGeometry(1.9, 1.9, 1.9, 12, 12, 12)
            addRadialMorph(geo)
            add(geo, makeMaterial({ roughness: 0.6 }))
            inst.deform = chaosDeformer(geo)
            break
        }
        case "torus": {
            const geo = new THREE.TorusGeometry(1.15, 0.42, 26, 90)
            addWrapMorph(geo)
            add(geo, makeMaterial({}))
            break
        }
        case "icosahedron": {
            const geo = new THREE.IcosahedronGeometry(1.5, 0)
            addRadialMorph(geo)
            add(geo, makeMaterial({}))
            break
        }
        case "capsule": {
            const geo = new THREE.CapsuleGeometry(0.75, 1.3, 12, 32)
            addRadialMorph(geo)
            add(geo, makeMaterial({}))
            break
        }
        case "framer": {
            const geo = makeFramerLogoGeometry()
            addRadialMorph(geo)
            add(geo, makeMaterial({}))
            // Keep the logomark upright and readable while it turns.
            inst.orient = (rot, mx, my, f) => {
                root.rotation.set(0.12 + my * 0.4 * f, rot + mx * 1.2 * f, 0)
            }
            break
        }
        case "waves": {
            const geo = new THREE.PlaneGeometry(4.4, 4.4, 56, 56)
            addWrapMorph(geo)
            add(geo, makeMaterial({ doubleSide: true }))
            inst.deform = wavesDeformer(geo)
            inst.orient = (_rot, mx, my, f) => {
                root.rotation.set(-1.1 + my * 0.35 * f, 0, mx * 0.4 * f)
            }
            break
        }
        case "blob": {
            const geo = new THREE.IcosahedronGeometry(1.25, 4)
            addRadialMorph(geo)
            add(geo, makeMaterial({}))
            inst.deform = blobDeformer(geo)
            break
        }
        case "plane": {
            const geo = makePlaneGeometry()
            addWrapMorph(geo)
            add(
                geo,
                makeMaterial({
                    vertexColors: true,
                    doubleSide: true,
                    roughness: 0.9,
                })
            )
            inst.fillViewport = true
            inst.deform = rippleDeformer(geo)
            // Flat, camera-facing: no tumbling, only a light cursor tilt.
            inst.orient = (_rot, mx, my, f) => {
                root.rotation.set(my * 0.12 * f, mx * 0.15 * f, 0)
            }
            break
        }
        case "ring": {
            const geo = makeRingGeometry()
            addWrapMorph(geo)
            const mesh = add(
                geo,
                makeMaterial({
                    vertexColors: true,
                    doubleSide: true,
                    roughness: 0.7,
                })
            )
            // Flat formation: tilted toward the camera, turning about its
            // own axis instead of tumbling.
            inst.orient = (rot, mx, my, f) => {
                root.rotation.set(-1.22 + my * 0.3 * f, mx * 0.4 * f, 0)
                mesh.rotation.z = -rot * 0.6
            }
            break
        }
        default: {
            const geo = new THREE.TorusKnotGeometry(1.05, 0.34, 220, 28)
            addWrapMorph(geo)
            add(geo, makeMaterial({}))
        }
    }

    for (const m of inst.meshes) m.updateMorphTargets()
    return inst
}

function disposeShape(inst: ShapeInstance) {
    for (const g of inst.geometries) g.dispose()
    for (const m of inst.materials) m.dispose()
}

// ─── CPU rasterizer (static canvas / no-WebGL fallback) ──────────────────────

const CPU_LIGHT_1 = new THREE.Vector3(2, 2, 3).normalize()
const CPU_LIGHT_2 = new THREE.Vector3(-3, -1, -2).normalize()

/**
 * Software rasterizer from AsciiHero, extended for double-sided meshes.
 * Fills `buf` in the same RGBA bottom-up layout as a WebGL readback, so the
 * glyph pass is shared. Morph targets are ignored (static frames never morph).
 */
function rasterizeCPU(
    root: THREE.Object3D,
    cols: number,
    rows: number,
    aspect: number,
    camZ: number,
    buf: Uint8Array
) {
    buf.fill(0)
    const depth = new Float32Array(cols * rows)
    depth.fill(-1e9)
    const f = 1 / Math.tan((CAMERA_FOV * Math.PI) / 360)

    root.updateMatrixWorld(true)
    const meshes: THREE.Mesh[] = []
    root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh)
    })

    const va = new THREE.Vector3()
    const vb = new THREE.Vector3()
    const vc = new THREE.Vector3()
    const verts = [va, vb, vc]
    const sx = [0, 0, 0]
    const sy = [0, 0, 0]
    const vi = [0, 0, 0]

    function plot(
        x: number,
        y: number,
        z: number,
        r: number,
        g: number,
        b: number
    ) {
        if (x < 0 || y < 0 || x >= cols || y >= rows) return
        const di = y * cols + x
        if (z <= depth[di]) return
        depth[di] = z
        const bi = ((rows - 1 - y) * cols + x) * 4
        buf[bi] = r
        buf[bi + 1] = g
        buf[bi + 2] = b
        buf[bi + 3] = 255
    }

    for (let m = 0; m < meshes.length; m++) {
        const mesh = meshes[m]
        const geo = mesh.geometry
        const pos = geo.attributes.position as THREE.BufferAttribute
        const colAttr = geo.attributes.color as
            | THREE.BufferAttribute
            | undefined
        const index = geo.index
        const doubleSided =
            (mesh.material as THREE.Material).side === THREE.DoubleSide
        const triCount = (index ? index.count : pos.count) / 3
        for (let t = 0; t < triCount; t++) {
            let visible = true
            let viewZ = 0
            for (let k = 0; k < 3; k++) {
                vi[k] = index ? index.getX(t * 3 + k) : t * 3 + k
                const v = verts[k]
                v.fromBufferAttribute(pos, vi[k]).applyMatrix4(mesh.matrixWorld)
                const vz = v.z - camZ
                if (vz > -0.1) {
                    visible = false
                    break
                }
                sx[k] = (((v.x * f) / aspect / -vz) * 0.5 + 0.5) * cols
                sy[k] = (0.5 - ((v.y * f) / -vz) * 0.5) * rows
                viewZ += vz / 3
            }
            if (!visible) continue
            const area =
                (sx[1] - sx[0]) * (sy[2] - sy[0]) -
                (sx[2] - sx[0]) * (sy[1] - sy[0])
            if (area === 0) continue
            if (area < 0 && !doubleSided) continue
            const sgn = area > 0 ? 1 : -1

            const e1x = vb.x - va.x
            const e1y = vb.y - va.y
            const e1z = vb.z - va.z
            const e2x = vc.x - va.x
            const e2y = vc.y - va.y
            const e2z = vc.z - va.z
            let nx = e1y * e2z - e1z * e2y
            let ny = e1z * e2x - e1x * e2z
            let nz = e1x * e2y - e1y * e2x
            const nl = (Math.sqrt(nx * nx + ny * ny + nz * nz) || 1) * sgn
            nx /= nl
            ny /= nl
            nz /= nl
            let shade =
                0.12 +
                1.15 *
                    Math.max(
                        0,
                        nx * CPU_LIGHT_1.x +
                            ny * CPU_LIGHT_1.y +
                            nz * CPU_LIGHT_1.z
                    ) +
                0.5 *
                    Math.max(
                        0,
                        nx * CPU_LIGHT_2.x +
                            ny * CPU_LIGHT_2.y +
                            nz * CPU_LIGHT_2.z
                    )
            if (shade > 1) shade = 1
            let r = 1
            let g = 1
            let b = 1
            if (colAttr) {
                r =
                    (colAttr.getX(vi[0]) +
                        colAttr.getX(vi[1]) +
                        colAttr.getX(vi[2])) /
                    3
                g =
                    (colAttr.getY(vi[0]) +
                        colAttr.getY(vi[1]) +
                        colAttr.getY(vi[2])) /
                    3
                b =
                    (colAttr.getZ(vi[0]) +
                        colAttr.getZ(vi[1]) +
                        colAttr.getZ(vi[2])) /
                    3
            }
            const R = Math.min(255, r * shade * 255) | 0
            const G = Math.min(255, g * shade * 255) | 0
            const B = Math.min(255, b * shade * 255) | 0

            const minX = Math.max(0, Math.floor(Math.min(sx[0], sx[1], sx[2])))
            const maxX = Math.min(
                cols - 1,
                Math.ceil(Math.max(sx[0], sx[1], sx[2]))
            )
            const minY = Math.max(0, Math.floor(Math.min(sy[0], sy[1], sy[2])))
            const maxY = Math.min(
                rows - 1,
                Math.ceil(Math.max(sy[0], sy[1], sy[2]))
            )
            for (let y = minY; y <= maxY; y++) {
                for (let x = minX; x <= maxX; x++) {
                    const px = x + 0.5
                    const py = y + 0.5
                    const w0 =
                        ((sx[1] - sx[0]) * (py - sy[0]) -
                            (sy[1] - sy[0]) * (px - sx[0])) *
                        sgn
                    const w1 =
                        ((sx[2] - sx[1]) * (py - sy[1]) -
                            (sy[2] - sy[1]) * (px - sx[1])) *
                        sgn
                    const w2 =
                        ((sx[0] - sx[2]) * (py - sy[2]) -
                            (sy[0] - sy[2]) * (px - sx[2])) *
                        sgn
                    if (w0 < 0 || w1 < 0 || w2 < 0) continue
                    plot(x, y, viewZ, R, G, B)
                }
            }
            // Centroid splat so sub-cell triangles still contribute coverage.
            plot(
                ((sx[0] + sx[1] + sx[2]) / 3) | 0,
                ((sy[0] + sy[1] + sy[2]) / 3) | 0,
                viewZ,
                R,
                G,
                B
            )
        }
    }
}

// ─── Image sections ──────────────────────────────────────────────────────────

/** Integer hash → [0, 1). Per-frame randomness without Math.random. */
function hashU(a: number, b: number): number {
    let h =
        Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^
        Math.imul((b + 0x632be59b) | 0, 0xc2b2ae35)
    h ^= h >>> 15
    h = Math.imul(h, 0x2c1b3c6d)
    h ^= h >>> 12
    h = Math.imul(h, 0x297a2d39)
    h ^= h >>> 15
    return (h >>> 0) / 4294967296
}

/** Smooth 2D value noise in [0, 1]. */
function vnoise(x: number, y: number): number {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    return lerp(
        lerp(hash2(xi, yi), hash2(xi + 1, yi), u),
        lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u),
        v
    )
}

interface FieldLevel {
    w: number
    h: number
    lum: Float32Array // 0..1 (sRGB luma)
    alpha: Float32Array // 0..1 (incl. removed background)
    rgb: Uint8Array
}

interface ImageField {
    aspect: number
    levels: FieldLevel[] // [0] = full res, then 2× box-filtered mips
    lo: number // 2nd luma percentile (Auto Levels)
    hi: number // 98th luma percentile
}

/**
 * Turn raw RGBA pixels into a sampled image field. With `removeBg`, the
 * background color is estimated from the border and flood-filled away from
 * the edges (similar colors inside the subject survive), with a soft
 * 1-texel feather.
 */
function buildField(
    data: Uint8ClampedArray | Uint8Array,
    w: number,
    h: number,
    removeBg: boolean,
    tolerance: number
): ImageField {
    const n = w * h
    const lum = new Float32Array(n)
    const alpha = new Float32Array(n)
    const rgb = new Uint8Array(n * 3)
    for (let i = 0; i < n; i++) {
        const r = data[i * 4]
        const g = data[i * 4 + 1]
        const b = data[i * 4 + 2]
        lum[i] = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255
        alpha[i] = data[i * 4 + 3] / 255
        rgb[i * 3] = r
        rgb[i * 3 + 1] = g
        rgb[i * 3 + 2] = b
    }

    if (removeBg && w > 2 && h > 2) {
        const rs: number[] = []
        const gs: number[] = []
        const bs: number[] = []
        const border: number[] = []
        for (let x = 0; x < w; x++) border.push(x, (h - 1) * w + x)
        for (let y = 1; y < h - 1; y++) border.push(y * w, y * w + w - 1)
        for (const i of border) {
            if (alpha[i] < 0.5) continue
            rs.push(rgb[i * 3])
            gs.push(rgb[i * 3 + 1])
            bs.push(rgb[i * 3 + 2])
        }
        if (rs.length > 0) {
            const med = (a: number[]) => {
                a.sort((p, q) => p - q)
                return a[a.length >> 1]
            }
            const br = med(rs)
            const bg = med(gs)
            const bb = med(bs)
            const tol = Math.max(0.01, tolerance) * 441.7
            const tol2 = tol * tol
            const near = (i: number) => {
                const dr = rgb[i * 3] - br
                const dg = rgb[i * 3 + 1] - bg
                const db = rgb[i * 3 + 2] - bb
                return dr * dr + dg * dg + db * db <= tol2
            }
            const fill = new Uint8Array(n)
            const stack = new Int32Array(n)
            let sp = 0
            for (const i of border) {
                if (!fill[i] && near(i)) {
                    fill[i] = 1
                    stack[sp++] = i
                }
            }
            while (sp > 0) {
                const i = stack[--sp]
                const x = i % w
                const y = (i / w) | 0
                if (x > 0 && !fill[i - 1] && near(i - 1)) {
                    fill[i - 1] = 1
                    stack[sp++] = i - 1
                }
                if (x < w - 1 && !fill[i + 1] && near(i + 1)) {
                    fill[i + 1] = 1
                    stack[sp++] = i + 1
                }
                if (y > 0 && !fill[i - w] && near(i - w)) {
                    fill[i - w] = 1
                    stack[sp++] = i - w
                }
                if (y < h - 1 && !fill[i + w] && near(i + w)) {
                    fill[i + w] = 1
                    stack[sp++] = i + w
                }
            }
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    let s = 0
                    let c = 0
                    for (let oy = -1; oy <= 1; oy++) {
                        const yy = y + oy
                        if (yy < 0 || yy >= h) continue
                        for (let ox = -1; ox <= 1; ox++) {
                            const xx = x + ox
                            if (xx < 0 || xx >= w) continue
                            s += fill[yy * w + xx]
                            c++
                        }
                    }
                    const i = y * w + x
                    alpha[i] *= fill[i] ? 0 : 1 - s / c
                }
            }
        }
    }

    // Luma percentiles of the visible pixels (alpha-weighted histogram).
    const hist = new Float64Array(256)
    let total = 0
    for (let i = 0; i < n; i++) {
        const a = alpha[i]
        if (a <= 0.05) continue
        hist[Math.min(255, (lum[i] * 255) | 0)] += a
        total += a
    }
    let lo = 0
    let hi = 1
    if (total > 0) {
        let acc = 0
        let loI = 0
        let hiI = 255
        for (let i = 0; i < 256; i++) {
            acc += hist[i]
            if (acc >= total * 0.02) {
                loI = i
                break
            }
        }
        acc = 0
        for (let i = 255; i >= 0; i--) {
            acc += hist[i]
            if (acc >= total * 0.02) {
                hiI = i
                break
            }
        }
        if (hiI - loI >= 8) {
            lo = loI / 255
            hi = (hiI + 1) / 255
        }
    }

    const levels: FieldLevel[] = [{ w, h, lum, alpha, rgb }]
    let cur = levels[0]
    while (cur.w > 12 && cur.h > 12) {
        const nw = cur.w >> 1
        const nh = cur.h >> 1
        const nl = new Float32Array(nw * nh)
        const na = new Float32Array(nw * nh)
        const nrgb = new Uint8Array(nw * nh * 3)
        for (let y = 0; y < nh; y++) {
            for (let x = 0; x < nw; x++) {
                let sa = 0
                let sl = 0
                let sr = 0
                let sg = 0
                let sb = 0
                for (let oy = 0; oy < 2; oy++) {
                    for (let ox = 0; ox < 2; ox++) {
                        const si = (y * 2 + oy) * cur.w + (x * 2 + ox)
                        const a = cur.alpha[si]
                        sa += a
                        sl += cur.lum[si] * a
                        sr += cur.rgb[si * 3] * a
                        sg += cur.rgb[si * 3 + 1] * a
                        sb += cur.rgb[si * 3 + 2] * a
                    }
                }
                const di = y * nw + x
                na[di] = sa / 4
                if (sa > 1e-4) {
                    nl[di] = sl / sa
                    nrgb[di * 3] = sr / sa
                    nrgb[di * 3 + 1] = sg / sa
                    nrgb[di * 3 + 2] = sb / sa
                }
            }
        }
        cur = { w: nw, h: nh, lum: nl, alpha: na, rgb: nrgb }
        levels.push(cur)
    }
    return { aspect: w / h, levels, lo, hi }
}

interface ImageEntry {
    src: string
    status: "loading" | "ready" | "error"
    error: string
    img: HTMLImageElement | null
    width: number
    height: number
    readyAt: number
    fields: Map<string, ImageField>
    listeners: Set<(e: ImageEntry) => void>
}

type ImageListener = (e: ImageEntry) => void

// Shared across instances and remounts: revisiting a section, editing a
// control or remounting never reloads or reprocesses an image.
const imageCache = new Map<string, ImageEntry>()

/**
 * Start loading an image (once per URL). The picture is decoded with
 * img.decode(), off the main thread, before it is reported ready — so the
 * first frame that draws it never stalls on a synchronous decode.
 */
function requestImage(
    src: string,
    listener: ImageListener,
    priority: "high" | "low"
): ImageEntry {
    const hit = imageCache.get(src)
    if (hit) {
        hit.listeners.add(listener)
        return hit
    }
    const entry: ImageEntry = {
        src,
        status: "loading",
        error: "",
        img: null,
        width: 0,
        height: 0,
        readyAt: 0,
        fields: new Map(),
        listeners: new Set([listener]),
    }
    imageCache.set(src, entry)
    const notify = () => entry.listeners.forEach((fn) => fn(entry))
    const img = new Image()
    // Pixels are read back, so the image must be CORS-enabled.
    img.crossOrigin = "anonymous"
    img.decoding = "async"
    img.setAttribute("fetchpriority", priority)
    let settled = false
    const ready = () => {
        if (settled) return
        settled = true
        // SVGs without intrinsic size report 0 — give them a working size.
        const isSvg = /\.svg(\?|$)/i.test(src)
        entry.width = img.naturalWidth || (isSvg ? IMAGE_TARGET_PX : 0)
        entry.height = img.naturalHeight || (isSvg ? IMAGE_TARGET_PX : 0)
        entry.img = img
        entry.status = entry.width > 0 && entry.height > 0 ? "ready" : "error"
        if (entry.status === "error") entry.error = "empty image"
        entry.readyAt =
            typeof performance !== "undefined" ? performance.now() : 0
        notify()
    }
    const fail = () => {
        if (settled) return
        settled = true
        entry.status = "error"
        entry.error = "could not load"
        notify()
    }
    img.src = src
    if (typeof img.decode === "function") {
        img.decode().then(ready, () => {
            // decode() also rejects for some valid images (e.g. SVG in some
            // browsers): fall back to the load events.
            if (img.complete && img.naturalWidth > 0) ready()
            else {
                img.onload = ready
                img.onerror = fail
                if (img.complete) fail()
            }
        })
    } else {
        img.onload = ready
        img.onerror = fail
    }
    return entry
}

function releaseImage(src: string, listener: ImageListener) {
    const e = imageCache.get(src)
    if (e) e.listeners.delete(listener)
}

/** requestIdleCallback with a timeout fallback (Safari has none). */
function scheduleIdle(fn: () => void, timeout: number): () => void {
    const w = window as Window & {
        requestIdleCallback?: (
            cb: () => void,
            opts?: { timeout: number }
        ) => number
        cancelIdleCallback?: (handle: number) => void
    }
    if (typeof w.requestIdleCallback === "function") {
        const h = w.requestIdleCallback(fn, { timeout })
        return () => {
            if (w.cancelIdleCallback) w.cancelIdleCallback(h)
        }
    }
    const h = window.setTimeout(fn, 150)
    return () => window.clearTimeout(h)
}

function getField(
    entry: ImageEntry,
    removeBg: boolean,
    tolerance: number
): ImageField | null {
    if (entry.status !== "ready" || !entry.img) return null
    const key = removeBg ? `bg:${Math.round(tolerance * 100)}` : "raw"
    const hit = entry.fields.get(key)
    if (hit) return hit
    const sc = Math.min(1, FIELD_MAX / Math.max(entry.width, entry.height))
    const w = Math.max(1, Math.round(entry.width * sc))
    const h = Math.max(1, Math.round(entry.height * sc))
    const cv = document.createElement("canvas")
    cv.width = w
    cv.height = h
    const ctx = cv.getContext("2d", { willReadFrequently: true })
    if (!ctx) return null
    let pixels: ImageData
    try {
        ctx.drawImage(entry.img, 0, 0, w, h)
        pixels = ctx.getImageData(0, 0, w, h)
    } catch (err) {
        entry.status = "error"
        entry.error = "blocked by CORS (host must allow cross-origin)"
        return null
    }
    const f = buildField(pixels.data, w, h, removeBg, tolerance)
    if (entry.fields.size > 3) entry.fields.clear()
    entry.fields.set(key, f)
    return f
}

/** Screen → image mapping: center, size, in-plane rotation, 3D tilt. */
interface Xform {
    cx: number
    cy: number
    W: number
    H: number
    cos: number
    sin: number
    D: number
    e1x: number
    e1y: number
    e1z: number
    e2x: number
    e2y: number
    e2z: number
    nx: number
    ny: number
    nz: number
}

function makeXform(
    cx: number,
    cy: number,
    W: number,
    H: number,
    rotDeg: number,
    tiltX: number,
    tiltY: number,
    D: number
): Xform {
    const r = (rotDeg * Math.PI) / 180
    const ca = Math.cos(tiltX)
    const sa = Math.sin(tiltX)
    const cb = Math.cos(tiltY)
    const sb = Math.sin(tiltY)
    // R = Ry(tiltY) · Rx(tiltX): plane basis e1, e2 and normal n.
    return {
        cx,
        cy,
        W: Math.max(1e-3, W),
        H: Math.max(1e-3, H),
        cos: Math.cos(r),
        sin: Math.sin(r),
        D,
        e1x: cb,
        e1y: 0,
        e1z: -sb,
        e2x: sb * sa,
        e2y: ca,
        e2z: cb * sa,
        nx: sb * ca,
        ny: -sa,
        nz: cb * ca,
    }
}

/** Image box size for an aspect ratio at the given host size. */
function boxSize(
    aspect: number,
    w: number,
    h: number,
    baseSize: number,
    scale: number
): [number, number] {
    let H = (Math.max(5, baseSize) / 100) * h
    let W = H * aspect
    const maxW = 0.92 * w
    if (W > maxW) {
        W = maxW
        H = W / aspect
    }
    return [W * scale, H * scale]
}

interface ImageLayerInput {
    field: ImageField
    invert: boolean
    fade: number
    xf: Xform
}

interface GridInfo {
    cols: number
    rows: number
    cw: number
    cell: number
    shift: Int16Array // per-row glitch offset, in cells
}

/**
 * Sample an image into the glyph grid: `dst` gets the normalized glyph
 * density per cell (0 = empty, cutoff already applied), `cls` = 3 (image)
 * and `rgb` the texel color. Only the image's projected bbox is visited.
 */
function sampleImage(
    L: ImageLayerInput,
    g: GridInfo,
    cfg: Settings,
    time: number,
    waveAmp: number,
    dst: Float32Array,
    cls: Uint8Array,
    rgbDst: Uint8Array
) {
    const { cols, rows, cw, cell } = g
    const xf = L.xf
    // Screen bbox of the (rotated, tilted) image.
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    const hw = xf.W / 2
    const hh = xf.H / 2
    const corners = [-hw, -hh, hw, -hh, -hw, hh, hw, hh]
    for (let c = 0; c < 8; c += 2) {
        const u = corners[c]
        const v = corners[c + 1]
        const lx = u * xf.cos - v * xf.sin
        const ly = u * xf.sin + v * xf.cos
        const X = lx * xf.e1x + ly * xf.e2x
        const Y = lx * xf.e1y + ly * xf.e2y
        const Z = lx * xf.e1z + ly * xf.e2z
        const k = xf.D / Math.max(1, xf.D - Z)
        const sx = xf.cx + X * k
        const sy = xf.cy + Y * k
        if (sx < minX) minX = sx
        if (sx > maxX) maxX = sx
        if (sy < minY) minY = sy
        if (sy > maxY) maxY = sy
    }
    const pad = 12
    const x0b = Math.max(0, Math.floor(minX / cw) - pad)
    const x1b = Math.min(cols - 1, Math.ceil(maxX / cw) + pad)
    const y0b = Math.max(0, Math.floor(minY / cell) - 1)
    const y1b = Math.min(rows - 1, Math.ceil(maxY / cell) + 1)
    if (x1b < x0b || y1b < y0b) return

    // Mip level: about one texel per glyph cell across the image.
    const cellsAcross = xf.W / cw
    const levels = L.field.levels
    let lv = levels[0]
    for (let i = levels.length - 1; i >= 0; i--) {
        if (levels[i].w >= cellsAcross * 1.15 || i === 0) {
            lv = levels[i]
            break
        }
    }
    const LW = lv.w
    const LH = lv.h
    const lum = lv.lum
    const alp = lv.alpha
    const rgb = lv.rgb

    const dark = cfg.imageTone !== "lightOnDark"
    const inv = L.invert
    const lvLo = cfg.autoLevels ? L.field.lo : 0
    const lvK = cfg.autoLevels ? 1 / Math.max(0.03, L.field.hi - L.field.lo) : 1
    const contrast = Math.max(0, cfg.contrast)
    const bright = cfg.brightness
    const th = clamp01(cfg.threshold)
    const thK = 1 / Math.max(1e-3, 1 - th)
    const ef = clamp01(cfg.edgeFade) * 0.35
    const layerFade = clamp01(L.fade)
    const D = xf.D

    for (let y = y0b; y <= y1b; y++) {
        const dy = (y + 0.5) * cell - xf.cy
        const sh = g.shift[y] * cw
        for (let x = x0b; x <= x1b; x++) {
            const idx = y * cols + x
            const dx = (x + 0.5) * cw + sh - xf.cx
            // Ray from the eye (0,0,D) through the screen point onto the
            // tilted image plane → plane coordinates.
            const den = xf.nx * dx + xf.ny * dy - xf.nz * D
            if (den > -1e-6 && den < 1e-6) continue
            const t = -(xf.nz * D) / den
            if (t <= 0) continue
            const X = t * dx
            const Y = t * dy
            const Z = D * (1 - t)
            const px = X * xf.e1x + Y * xf.e1y + Z * xf.e1z
            const pz = X * xf.e2x + Y * xf.e2y + Z * xf.e2z
            const lx = px * xf.cos + pz * xf.sin
            const ly = -px * xf.sin + pz * xf.cos
            let u = lx / xf.W + 0.5
            let v = ly / xf.H + 0.5
            if (waveAmp > 0) {
                u += waveAmp * 0.012 * Math.sin(v * 10 + time * 1.6)
                v += waveAmp * 0.01 * Math.sin(u * 8 - time * 1.2)
            }
            if (u <= 0 || u >= 1 || v <= 0 || v >= 1) continue

            // Bilinear, alpha-weighted (no dark fringes at cut-outs).
            const fx = u * LW - 0.5
            const fy = v * LH - 0.5
            let xa = Math.floor(fx)
            let ya = Math.floor(fy)
            const tx = fx - xa
            const ty = fy - ya
            let xb = xa + 1
            let yb = ya + 1
            if (xa < 0) xa = 0
            if (ya < 0) ya = 0
            if (xb > LW - 1) xb = LW - 1
            if (yb > LH - 1) yb = LH - 1
            const i00 = ya * LW + xa
            const i10 = ya * LW + xb
            const i01 = yb * LW + xa
            const i11 = yb * LW + xb
            const a00 = alp[i00] * (1 - tx) * (1 - ty)
            const a10 = alp[i10] * tx * (1 - ty)
            const a01 = alp[i01] * (1 - tx) * ty
            const a11 = alp[i11] * tx * ty
            const a = a00 + a10 + a01 + a11
            if (a < 0.02) continue
            let l =
                (lum[i00] * a00 +
                    lum[i10] * a10 +
                    lum[i01] * a01 +
                    lum[i11] * a11) /
                a
            l = (l - lvLo) * lvK
            if (l < 0) l = 0
            else if (l > 1) l = 1

            let d = dark ? 1 - l : l
            if (inv) d = 1 - d
            d = (d - 0.5) * contrast + 0.5 + bright
            if (d <= 0) continue
            if (d > 1) d = 1
            let e = 1
            if (ef > 0) {
                const m = Math.min(u, 1 - u, v, 1 - v)
                if (m < ef) e = smoothstep(0, ef, m)
            }
            const raw = d * a * e * layerFade
            if (raw <= th) continue
            dst[idx] = Math.max(0.002, (raw - th) * thK)
            cls[idx] = 3
            const nyi = Math.min(LH - 1, Math.max(0, Math.round(fy)))
            const nxi = Math.min(LW - 1, Math.max(0, Math.round(fx)))
            const ni = nyi * LW + nxi
            rgbDst[idx * 3] = rgb[ni * 3]
            rgbDst[idx * 3 + 1] = rgb[ni * 3 + 1]
            rgbDst[idx * 3 + 2] = rgb[ni * 3 + 2]
        }
    }
}

// ─── Scripted sequence: the device, drawn live as ASCII ─────────────────────
//
// One scroll timeline, one visual system:
//
// A. The device is real geometry: the CAD edges and a hull mesh of the STEP
//    model, packed into one JSON file ("Device Model"). Every frame it is
//    rendered from the current milestone's camera angle into a tiny off-screen
//    target and reduced to cells of the component's own glyph grid. CAD edges
//    and the silhouette become direction glyphs (- \ | /), surfaces a light
//    tone from the image ramp, the two displays an even texture. The device is
//    a normal glyph layer the whole time, so the section transitions morph it
//    from / into whatever the neighbouring sections show.
// B. QR code, data cloud, credit card, checkmark and hand-over particles are
//    ASCII as well, drawn on the same canvas and anchored to the model's two
//    displays in the same 3D space.
//
// The editor canvas never creates a WebGL context: its still is rasterised on
// the CPU by the same code that serves as fallback where WebGL2 is missing.

const SCRIPT_NAMES = [
    "Device intro",
    "QR close-up",
    "Data to NAV",
    "Phone receipt",
    "Four devices",
    "One device",
    "Payment",
    "Remote access",
]
const DEV_BODY = 0.69 // device height as a fraction of the element space's height
const DEV_DIST = 7.1 // camera distance (model units) at Device Size 62, scale 1
const DEV_FOV = 28 // degrees
const DEV_SSX = 3 // off-screen samples per glyph cell
const DEV_SSY = 4
const DEV_SEG_BYTES = 22 // p0 i16×3, p1 i16×3, nA i8×3, nB i8×3, len u8, layer u8, kind u8, pad

/** Camera angle around the device: az = turn (0 = front), el = height, roll, d = distance factor. */
interface CamPose {
    az: number
    el: number
    roll: number
    d: number
}

interface DevGeoCpu {
    pos: Float32Array // xyz per vertex
    tri: Uint32Array
    segP: Float32Array // p0 xyz, p1 xyz per segment
    segN: Float32Array // nA xyz, nB xyz per segment
    segM: Uint8Array // length (mm), layer, kind per segment
    sx: Float32Array // scratch: projected vertices
    sy: Float32Array
    sz: Float32Array
    sw: Float32Array
}

/** The packed model (see pack.py): edge segments with both face normals, a hull mesh, the two displays. */
interface DevGeo {
    n: number // edge segments
    nt: number // triangles
    i32: boolean // 32-bit indices
    segs: Uint8Array
    verts: Uint8Array // int16 xyz, normalised to −1…1 (1 = 150 mm)
    idx: Uint8Array
    quads: [Vec3[], Vec3[]] // small display, large display: tl, tr, br, bl
    normals: [Vec3, Vec3]
    aspect: [number, number] // height / width of each display
    cpu: DevGeoCpu | null
}

function b64Bytes(s: string): Uint8Array {
    const b = atob(s)
    const u = new Uint8Array(b.length)
    for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i)
    return u
}

function parseDevGeo(j: unknown): DevGeo | null {
    if (!j || typeof j !== "object") return null
    const o = j as Record<string, unknown>
    const quad = (v: unknown): Vec3[] | null => {
        if (!Array.isArray(v) || v.length !== 4) return null
        const out: Vec3[] = []
        for (const p of v) {
            if (!Array.isArray(p) || p.length < 3) return null
            out.push([Number(p[0]) || 0, Number(p[1]) || 0, Number(p[2]) || 0])
        }
        return out
    }
    const small = quad(o.small)
    const big = quad(o.big)
    if (
        typeof o.segs !== "string" ||
        typeof o.verts !== "string" ||
        typeof o.idx !== "string" ||
        !small ||
        !big
    )
        return null
    let segs: Uint8Array
    let verts: Uint8Array
    let idx: Uint8Array
    try {
        segs = b64Bytes(o.segs)
        verts = b64Bytes(o.verts)
        idx = b64Bytes(o.idx)
    } catch (e) {
        return null
    }
    const i32 = !!o.i32
    const n = Math.floor(segs.length / DEV_SEG_BYTES)
    const nt = Math.floor(idx.length / (i32 ? 12 : 6))
    if (n < 1 || nt < 1 || verts.length < 18) return null
    const sub = (a: Vec3, b: Vec3): Vec3 => [
        a[0] - b[0],
        a[1] - b[1],
        a[2] - b[2],
    ]
    const info = (q: Vec3[]): { nrm: Vec3; asp: number } => {
        const u = sub(q[1], q[0])
        const v = sub(q[3], q[0])
        let nx = u[1] * v[2] - u[2] * v[1]
        let ny = u[2] * v[0] - u[0] * v[2]
        let nz = u[0] * v[1] - u[1] * v[0]
        const l = Math.hypot(nx, ny, nz) || 1
        nx /= l
        ny /= l
        nz /= l
        // Outward = away from the model's centre (the origin).
        const cx = (q[0][0] + q[2][0]) / 2
        const cy = (q[0][1] + q[2][1]) / 2
        const cz = (q[0][2] + q[2][2]) / 2
        const s = nx * cx + ny * cy + nz * cz < 0 ? -1 : 1
        return {
            nrm: [nx * s, ny * s, nz * s],
            asp:
                Math.hypot(v[0], v[1], v[2]) /
                (Math.hypot(u[0], u[1], u[2]) || 1),
        }
    }
    const a = info(small)
    const b = info(big)
    return {
        n,
        nt,
        i32,
        segs,
        verts,
        idx,
        quads: [small, big],
        normals: [a.nrm, b.nrm],
        aspect: [a.asp, b.asp],
        cpu: null,
    }
}

/** Typed copies for the CPU rasteriser (built on first use). */
function devGeoCpu(g: DevGeo): DevGeoCpu {
    if (g.cpu) return g.cpu
    const dv = new DataView(g.verts.buffer, g.verts.byteOffset, g.verts.length)
    const nv = Math.floor(g.verts.length / 6)
    const pos = new Float32Array(nv * 3)
    for (let i = 0; i < nv * 3; i++)
        pos[i] = Math.max(-1, dv.getInt16(i * 2, true) / 32767)
    const di = new DataView(g.idx.buffer, g.idx.byteOffset, g.idx.length)
    const tri = new Uint32Array(g.nt * 3)
    for (let i = 0; i < g.nt * 3; i++)
        tri[i] = g.i32 ? di.getUint32(i * 4, true) : di.getUint16(i * 2, true)
    const ds = new DataView(g.segs.buffer, g.segs.byteOffset, g.segs.length)
    const segP = new Float32Array(g.n * 6)
    const segN = new Float32Array(g.n * 6)
    const segM = new Uint8Array(g.n * 3)
    for (let s = 0; s < g.n; s++) {
        const o = s * DEV_SEG_BYTES
        for (let k = 0; k < 6; k++) {
            segP[s * 6 + k] = Math.max(-1, ds.getInt16(o + k * 2, true) / 32767)
            segN[s * 6 + k] = Math.max(-1, ds.getInt8(o + 12 + k) / 127)
        }
        segM[s * 3] = ds.getUint8(o + 18)
        segM[s * 3 + 1] = ds.getUint8(o + 19)
        segM[s * 3 + 2] = ds.getUint8(o + 20)
    }
    g.cpu = {
        pos,
        tri,
        segP,
        segN,
        segM,
        sx: new Float32Array(nv),
        sy: new Float32Array(nv),
        sz: new Float32Array(nv),
        sw: new Float32Array(nv),
    }
    return g.cpu
}

// Column-major 4×4 matrices, as WebGL takes them.
function m4mul(a: Float32Array, b: Float32Array): Float32Array {
    const o = new Float32Array(16)
    for (let c = 0; c < 4; c++)
        for (let r = 0; r < 4; r++)
            o[c * 4 + r] =
                a[r] * b[c * 4] +
                a[4 + r] * b[c * 4 + 1] +
                a[8 + r] * b[c * 4 + 2] +
                a[12 + r] * b[c * 4 + 3]
    return o
}
function m4persp(fov: number, asp: number, n: number, f: number): Float32Array {
    const t = 1 / Math.tan(fov / 2)
    const o = new Float32Array(16)
    o[0] = t / asp
    o[5] = t
    o[10] = (f + n) / (n - f)
    o[11] = -1
    o[14] = (2 * f * n) / (n - f)
    return o
}
/** View matrix of a camera at e looking at the origin, +Y up. */
function m4look(e: Vec3): Float32Array {
    let l = Math.hypot(e[0], e[1], e[2]) || 1
    const zx = e[0] / l
    const zy = e[1] / l
    const zz = e[2] / l
    let xx = zz
    let xz = -zx
    l = Math.hypot(xx, xz) || 1
    xx /= l
    xz /= l
    const yx = zy * xz
    const yy = zz * xx - zx * xz
    const yz = -zy * xx
    return new Float32Array([
        xx,
        yx,
        zx,
        0,
        0,
        yy,
        zy,
        0,
        xz,
        yz,
        zz,
        0,
        -(xx * e[0] + xz * e[2]),
        -(yx * e[0] + yy * e[1] + yz * e[2]),
        -(zx * e[0] + zy * e[1] + zz * e[2]),
        1,
    ])
}
function m4rotZ(a: number): Float32Array {
    const c = Math.cos(a)
    const s = Math.sin(a)
    return new Float32Array([c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])
}
/** Scale and shift in clip space: x' = x·sx + tx·w, y' = y·sy + ty·w. */
function m4clip(sx: number, sy: number, tx: number, ty: number): Float32Array {
    return new Float32Array([
        sx,
        0,
        0,
        0,
        0,
        sy,
        0,
        0,
        0,
        0,
        1,
        0,
        tx,
        ty,
        0,
        1,
    ])
}

// Edge directions travel through the off-screen target as one byte (1…254).
const DEV_DIR_COS = new Float32Array(256)
const DEV_DIR_SIN = new Float32Array(256)
for (let c = 1; c < 255; c++) {
    const th = ((c - 1) / 253 - 0.5) * Math.PI
    DEV_DIR_COS[c] = Math.cos(2 * th)
    DEV_DIR_SIN[c] = Math.sin(2 * th)
}
function devDirCode(dx: number, dy: number): number {
    let th = Math.atan2(dy, dx)
    th -= Math.PI * Math.floor(th / Math.PI + 0.5)
    return 1 + Math.round((th / Math.PI + 0.5) * 253)
}

/**
 * CPU version of the off-screen pass, into the same buffer layout the WebGL
 * pass reads back: R = surface tone (0 = empty), G = display, B = edge
 * direction code. Row 0 is the bottom row, as with gl.readPixels.
 */
function devRasterCPU(
    g: DevGeo,
    m: Float32Array,
    eye: Vec3,
    fw: number,
    fh: number,
    pix: Uint8Array,
    zb: Float32Array,
    creaseCos: number,
    minLen: number,
    details: boolean,
    viewW: number,
    viewH: number,
    extra: Array<{ v: Float32Array; flat: number }> = []
) {
    const c = devGeoCpu(g)
    pix.fill(0)
    zb.fill(Infinity)
    const nv = c.sx.length
    const P = c.pos
    for (let i = 0; i < nv; i++) {
        const x = P[i * 3]
        const y = P[i * 3 + 1]
        const z = P[i * 3 + 2]
        const w = m[3] * x + m[7] * y + m[11] * z + m[15]
        c.sw[i] = w
        if (w <= 1e-6) continue
        c.sx[i] =
            (((m[0] * x + m[4] * y + m[8] * z + m[12]) / w) * 0.5 + 0.5) * fw
        c.sy[i] =
            (((m[1] * x + m[5] * y + m[9] * z + m[13]) / w) * 0.5 + 0.5) * fh
        c.sz[i] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w
    }
    const fill = (
        ax: number,
        ay: number,
        az: number,
        bx: number,
        by: number,
        bz: number,
        cx: number,
        cy: number,
        cz: number,
        r: number,
        gch: number,
        bias: number
    ) => {
        const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx)))
        const x1 = Math.min(fw - 1, Math.ceil(Math.max(ax, bx, cx)))
        const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy)))
        const y1 = Math.min(fh - 1, Math.ceil(Math.max(ay, by, cy)))
        if (x1 < x0 || y1 < y0) return
        const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
        if (Math.abs(area) < 1e-9) return
        const inv = 1 / area
        for (let py = y0; py <= y1; py++) {
            const sy = py + 0.5
            for (let px = x0; px <= x1; px++) {
                const sx = px + 0.5
                const w0 = ((bx - sx) * (cy - sy) - (by - sy) * (cx - sx)) * inv
                const w1 = ((cx - sx) * (ay - sy) - (cy - sy) * (ax - sx)) * inv
                const w2 = 1 - w0 - w1
                if (w0 < 0 || w1 < 0 || w2 < 0) continue
                const z = w0 * az + w1 * bz + w2 * cz + bias
                const i = py * fw + px
                if (z > zb[i]) continue
                zb[i] = z
                pix[i * 4] = r
                pix[i * 4 + 1] = gch
            }
        }
    }
    // Hull mesh: flat shading per face, as the fragment shader does.
    const T = c.tri
    const l1x = -0.3421
    const l1y = 0.8308
    const l1z = 0.4398
    for (let t = 0; t < g.nt; t++) {
        const ia = T[t * 3]
        const ib = T[t * 3 + 1]
        const ic = T[t * 3 + 2]
        if (c.sw[ia] <= 1e-6 || c.sw[ib] <= 1e-6 || c.sw[ic] <= 1e-6) continue
        const ax = P[ia * 3]
        const ay = P[ia * 3 + 1]
        const az = P[ia * 3 + 2]
        const ux = P[ib * 3] - ax
        const uy = P[ib * 3 + 1] - ay
        const uz = P[ib * 3 + 2] - az
        const vx = P[ic * 3] - ax
        const vy = P[ic * 3 + 1] - ay
        const vz = P[ic * 3 + 2] - az
        let nx = uy * vz - uz * vy
        let ny = uz * vx - ux * vz
        let nz = ux * vy - uy * vx
        const nl = Math.hypot(nx, ny, nz)
        if (nl < 1e-12) continue
        nx /= nl
        ny /= nl
        nz /= nl
        let ex = eye[0] - ax
        let ey = eye[1] - ay
        let ez = eye[2] - az
        const el = Math.hypot(ex, ey, ez) || 1
        ex /= el
        ey /= el
        ez /= el
        let dv = nx * ex + ny * ey + nz * ez
        if (dv < 0) {
            nx = -nx
            ny = -ny
            nz = -nz
            dv = -dv
        }
        const lum =
            0.3 + 0.48 * Math.max(0, nx * l1x + ny * l1y + nz * l1z) + 0.22 * dv
        fill(
            c.sx[ia],
            c.sy[ia],
            c.sz[ia],
            c.sx[ib],
            c.sy[ib],
            c.sz[ib],
            c.sx[ic],
            c.sy[ic],
            c.sz[ic],
            Math.max(5, Math.min(255, Math.round(lum * 255))),
            0,
            0.0006
        )
    }
    // Extra bodies (phone, panels): flat tone or a simple shade.
    const prj = (x: number, y: number, z: number): [number, number, number, number] => {
        const w = m[3] * x + m[7] * y + m[11] * z + m[15]
        if (w <= 1e-6) return [0, 0, 0, w]
        return [
            (((m[0] * x + m[4] * y + m[8] * z + m[12]) / w) * 0.5 + 0.5) * fw,
            (((m[1] * x + m[5] * y + m[9] * z + m[13]) / w) * 0.5 + 0.5) * fh,
            (m[2] * x + m[6] * y + m[10] * z + m[14]) / w,
            w,
        ]
    }
    for (const e of extra) {
        const V = e.v
        for (let t = 0; t + 8 < V.length; t += 9) {
            const a = prj(V[t], V[t + 1], V[t + 2])
            const b = prj(V[t + 3], V[t + 4], V[t + 5])
            const cc = prj(V[t + 6], V[t + 7], V[t + 8])
            if (a[3] <= 1e-6 || b[3] <= 1e-6 || cc[3] <= 1e-6) continue
            let lum = e.flat
            if (lum < 0) {
                const ux = V[t + 3] - V[t], uy = V[t + 4] - V[t + 1], uz = V[t + 5] - V[t + 2]
                const vx = V[t + 6] - V[t], vy = V[t + 7] - V[t + 1], vz = V[t + 8] - V[t + 2]
                let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
                const nl = Math.hypot(nx, ny, nz) || 1
                nx /= nl; ny /= nl; nz /= nl
                lum = 0.3 + 0.48 * Math.abs(nx * l1x + ny * l1y + nz * l1z)
            }
            fill(a[0], a[1], a[2], b[0], b[1], b[2], cc[0], cc[1], cc[2], Math.max(5, Math.min(255, Math.round(lum * 255))), 0, e.flat >= 0 ? -0.0004 : 0.0006)
        }
    }
    // Displays.
    const pr = (p: Vec3): [number, number, number, number] => {
        const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]
        if (w <= 1e-6) return [0, 0, 0, w]
        return [
            (((m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / w) * 0.5 +
                0.5) *
                fw,
            (((m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / w) * 0.5 +
                0.5) *
                fh,
            (m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]) / w,
            w,
        ]
    }
    for (const q of g.quads) {
        const s = q.map(pr)
        if (s.some((v) => v[3] <= 1e-6)) continue
        for (const [i, j, k] of [
            [0, 1, 2],
            [0, 2, 3],
        ])
            fill(
                s[i][0],
                s[i][1],
                s[i][2],
                s[j][0],
                s[j][1],
                s[j][2],
                s[k][0],
                s[k][1],
                s[k][2],
                255,
                255,
                0
            )
    }
    // Edges: a crease between two faces, or the silhouette, hidden by the hull's depth.
    const SP = c.segP
    const SN = c.segN
    const SM = c.segM
    for (let s = 0; s < g.n; s++) {
        const o = s * 6
        const ly = SM[s * 3 + 1]
        if (ly === 4 && !details) continue
        const mx = (SP[o] + SP[o + 3]) / 2
        const my = (SP[o + 1] + SP[o + 4]) / 2
        const mz = (SP[o + 2] + SP[o + 5]) / 2
        const vx = eye[0] - mx
        const vy = eye[1] - my
        const vz = eye[2] - mz
        const a = SN[o] * vx + SN[o + 1] * vy + SN[o + 2] * vz
        const b = SN[o + 3] * vx + SN[o + 4] * vy + SN[o + 5] * vz
        const la = Math.hypot(SN[o], SN[o + 1], SN[o + 2]) || 1
        const lb = Math.hypot(SN[o + 3], SN[o + 4], SN[o + 5]) || 1
        const d =
            (SN[o] * SN[o + 3] +
                SN[o + 1] * SN[o + 4] +
                SN[o + 2] * SN[o + 5]) /
            (la * lb)
        const crease = SM[s * 3 + 2] > 0 && d < creaseCos
        if (crease ? !(a > 0 || b > 0) || SM[s * 3] < minLen : !(a * b < 0))
            continue
        const p0 = pr([SP[o], SP[o + 1], SP[o + 2]])
        const p1 = pr([SP[o + 3], SP[o + 4], SP[o + 5]])
        if (p0[3] <= 1e-6 || p1[3] <= 1e-6) continue
        const dx = p1[0] - p0[0]
        const dy = p1[1] - p0[1]
        const code = devDirCode((dx / fw) * viewW, (dy / fh) * viewH)
        const steps = Math.max(
            1,
            Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)))
        )
        for (let k = 0; k <= steps; k++) {
            const t = k / steps
            const px = Math.floor(p0[0] + dx * t)
            const py = Math.floor(p0[1] + dy * t)
            if (px < 0 || py < 0 || px >= fw || py >= fh) continue
            const i = py * fw + px
            if (p0[2] + (p1[2] - p0[2]) * t - 0.004 > zb[i]) continue
            pix[i * 4 + 2] = code
        }
    }
}

/** Cubic-bezier easing (same curves as CSS cubic-bezier). */
function bezierEase(
    x1: number,
    y1: number,
    x2: number,
    y2: number
): (x: number) => number {
    const cx = 3 * x1
    const bx = 3 * (x2 - x1) - cx
    const ax = 1 - cx - bx
    const cy = 3 * y1
    const by = 3 * (y2 - y1) - cy
    const ay = 1 - cy - by
    return (x: number) => {
        if (x <= 0) return 0
        if (x >= 1) return 1
        let t = x
        for (let i = 0; i < 8; i++) {
            const e = ((ax * t + bx) * t + cx) * t - x
            const d = (3 * ax * t + 2 * bx) * t + cx
            if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break
            t -= e / d
        }
        t = clamp01(t)
        return ((ay * t + by) * t + cy) * t
    }
}
// Arrivals decelerate, departures accelerate away, in-place moves ease both ends.
const EASE_ARRIVE = bezierEase(0.16, 1, 0.3, 1)
const EASE_LEAVE = bezierEase(0.7, 0, 0.84, 0)
const EASE_MOVE = bezierEase(0.65, 0, 0.35, 1)

function shash(x: number, y: number): number {
    let a = fract(x * 0.1031)
    let b = fract(y * 0.1031)
    let c = fract(x * 0.1031)
    const d = a * (b + 33.33) + b * (c + 33.33) + c * (a + 33.33)
    a += d
    b += d
    c += d
    return fract((a + b) * c)
}

function srng(seed: number): () => number {
    let a = seed >>> 0
    return () => {
        a = (a + 0x6d2b79f5) >>> 0
        let t = a
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

// ── Configuration ────────────────────────────────────────────────────────────

interface MilestoneConfig {
    x?: number
    y?: number
    scale?: number
    transformStart?: number
    transformEnd?: number
    idleStart?: number
    idleEnd?: number
    turn?: number
    tilt?: number
    roll?: number
    distance?: number
    idleTurn?: number
    idleTilt?: number
}

interface ScriptMilestone {
    t0: number
    t1: number
    i0: number
    i1: number
    x: number
    y: number
    s: number
    a: CamPose // camera when the idle begins
    b: CamPose // camera reached at Idle End
}

// Positions, scales and ranges: the scroll script. Camera angles: read off the
// original device video (0° = front, 180° = back with the customer display).
const MS_DEFAULTS: Array<Required<MilestoneConfig>> = [
    // 1 · Intro: the device assembles from the previous section's glyphs; the camera tilts up from a plan view into the front view.
    { x: 64, y: 52, scale: 1, transformStart: 0, transformEnd: 40, idleStart: 40, idleEnd: 100, turn: 0, tilt: 58, roll: 0, distance: 1, idleTurn: 4, idleTilt: -1 },
    // 2 · QR close-up on the customer display.
    { x: 62, y: 50, scale: 1, transformStart: 120, transformEnd: 200, idleStart: 200, idleEnd: 270, turn: 188, tilt: 22, roll: -2, distance: 0.42, idleTurn: 3, idleTilt: 1 },
    // 3 · Back view, wide: the QR dissolves into data that flows to the NAV node.
    { x: 50, y: 57, scale: 1, transformStart: 290, transformEnd: 350, idleStart: 350, idleEnd: 450, turn: 204, tilt: 34, roll: -3, distance: 1.08, idleTurn: 4, idleTilt: 2 },
    // 4 · The customer's phone receives the e-receipt from NAV.
    { x: 46, y: 56, scale: 1, transformStart: 470, transformEnd: 530, idleStart: 530, idleEnd: 650, turn: 204, tilt: 30, roll: -3, distance: 1.12, idleTurn: 3, idleTilt: 1 },
    // 5 · Front view: the device splits into the four old devices.
    { x: 64, y: 52, scale: 1, transformStart: 670, transformEnd: 730, idleStart: 730, idleEnd: 830, turn: 360, tilt: 56, roll: 0, distance: 1, idleTurn: 2, idleTilt: 0 },
    // 6 · … and merges back into one.
    { x: 64, y: 52, scale: 1, transformStart: 850, transformEnd: 910, idleStart: 910, idleEnd: 970, turn: 364, tilt: 56, roll: 0, distance: 1, idleTurn: 2, idleTilt: 0 },
    // 7 · Payment at the customer display; during the idle the camera drifts up to the side so both checkmarks show.
    { x: 62, y: 55, scale: 1, transformStart: 990, transformEnd: 1070, idleStart: 1070, idleEnd: 1210, turn: 566, tilt: 32, roll: -4, distance: 0.86, idleTurn: 44, idleTilt: 32 },
    // 8 · Remote access: panels lift off the large display, linked to the phone.
    { x: 44, y: 55, scale: 1, transformStart: 1230, transformEnd: 1310, idleStart: 1310, idleEnd: 1390, turn: 720, tilt: 50, roll: 0, distance: 1.38, idleTurn: 3, idleTilt: 1 },
]

type ElKey =
    | "qrIn"
    | "toNav"
    | "navIn"
    | "navOff"
    | "phoneIn"
    | "receipt"
    | "attach"
    | "split"
    | "merge"
    | "cardIn"
    | "cardTap"
    | "cardOut"
    | "check"
    | "checkOff"
    | "panels"
    | "link"
const EL_KEYS: ElKey[] = [
    "qrIn", "toNav", "navIn", "navOff", "phoneIn", "receipt", "attach", "split",
    "merge", "cardIn", "cardTap", "cardOut", "check", "checkOff", "panels", "link",
]
const EL_TITLES = [
    "QR Builds", "QR → Data → NAV", "NAV Node Appears", "NAV Node Fades", "Phone Appears",
    "Receipt Types In", "Attachments Arrive", "Splits Into Four", "Merges Into One",
    "Card Approaches", "Card Taps", "Card Leaves", "Checkmark", "Checkmark Clears",
    "Panels Lift Off", "Link To Phone",
]
const EL_DEFAULTS: Record<ElKey, [number, number]> = {
    qrIn: [190, 240],
    toNav: [300, 400],
    navIn: [280, 330],
    navOff: [640, 690],
    phoneIn: [490, 550],
    receipt: [540, 620],
    attach: [600, 660],
    split: [670, 760],
    merge: [850, 940],
    cardIn: [1060, 1110],
    cardTap: [1110, 1130],
    cardOut: [1135, 1180],
    check: [1125, 1200],
    checkOff: [1215, 1265],
    panels: [1300, 1375],
    link: [1340, 1385],
}

interface ScriptLookConfig {
    contour?: number
    contourColor?: string
    detail?: number
    checkColor?: string
    bodyTone?: number
    screenTone?: number
    edgeAngle?: number
    minEdge?: number
    details?: boolean
    panel?: boolean
    opacity?: number
    elementColor?: string
    scramble?: boolean
    particles?: number
}
interface Script3dConfig {
    perspective?: number
    cloudDepth?: number
    dataCount?: number
}
interface ScriptDofConfig {
    blur?: number
    focus?: number
    range?: number
    pulls?: number
}

interface ScriptConf {
    model: string
    size: number
    ms: ScriptMilestone[]
    el: Record<ElKey, [number, number]>
    contour: number
    contourColor: string
    detail: number
    checkColor: string
    bodyTone: number
    screenTone: number
    creaseCos: number
    minEdge: number
    details: boolean
    panel: boolean
    opacity: number
    elColor: string
    scramble: boolean
    particles: number
    persp: number
    cloudDepth: number
    dataCount: number
    dof: number
    focus: number
    range: number
    pulls: number
}

/** The geometry file: the upload wins, the URL is the alternative. */
function normModelUrl(file: unknown, url: unknown): string {
    if (typeof file === "string" && file.trim()) return file.trim()
    return typeof url === "string" ? url.trim() : ""
}

/** Sanitised milestones: ranges never run backwards. */
function normMilestones(
    list: Array<MilestoneConfig | null | undefined>
): ScriptMilestone[] {
    let prev = -Infinity
    return MS_DEFAULTS.map((def, k) => {
        const d = list[k] || {}
        const t0 = Math.max(num(d.transformStart, def.transformStart), prev)
        const t1 = Math.max(num(d.transformEnd, def.transformEnd), t0)
        const i0 = Math.max(num(d.idleStart, def.idleStart), t1)
        const i1 = Math.max(num(d.idleEnd, def.idleEnd), i0)
        prev = i1
        const a: CamPose = {
            az: num(d.turn, def.turn),
            el: Math.max(-10, Math.min(88, num(d.tilt, def.tilt))),
            roll: num(d.roll, def.roll),
            d: Math.max(0.3, Math.min(4, num(d.distance, def.distance))),
        }
        return {
            t0,
            t1,
            i0,
            i1,
            x: num(d.x, def.x),
            y: num(d.y, def.y),
            s: Math.max(0.05, num(d.scale, def.scale)),
            a,
            b: {
                az: a.az + num(d.idleTurn, def.idleTurn),
                el: Math.max(
                    -10,
                    Math.min(88, a.el + num(d.idleTilt, def.idleTilt))
                ),
                roll: a.roll,
                d: a.d,
            },
        }
    })
}

function normScript(d: SectionConfig): ScriptConf {
    const look = d.scriptLook || {}
    const d3 = d.script3d || {}
    const dof = d.scriptDof || {}
    const tm = (d.scriptTiming || {}) as Record<string, unknown>
    const el = {} as Record<ElKey, [number, number]>
    for (const k of EL_KEYS) {
        const a = num(tm[k], EL_DEFAULTS[k][0])
        el[k] = [a, Math.max(a, num(tm[k + "End"], EL_DEFAULTS[k][1]))]
    }
    return {
        model: normModelUrl(d.scriptModel, d.scriptModelUrl),
        size: Math.max(5, num(d.scriptSize, 62)),
        ms: normMilestones([d.m1, d.m2, d.m3, d.m4, d.m5, d.m6, d.m7, d.m8]),
        el,
        contour: clamp01(num(look.contour, 0.45)),
        contourColor: typeof look.contourColor === "string" ? look.contourColor : "",
        detail: Math.max(0.35, Math.min(1, num(look.detail, 0.55))),
        checkColor: typeof look.checkColor === "string" && look.checkColor ? look.checkColor : "#16A05A",
        bodyTone: clamp01(num(look.bodyTone, 0.5)),
        screenTone: clamp01(num(look.screenTone, 0.5)),
        creaseCos: Math.cos(
            (Math.max(4, Math.min(80, num(look.edgeAngle, 28))) * Math.PI) / 180
        ),
        minEdge: Math.max(0, Math.min(80, num(look.minEdge, 6))),
        details: !!look.details,
        panel: !!look.panel,
        opacity: clamp01(num(look.opacity, 1)),
        elColor: typeof look.elementColor === "string" ? look.elementColor : "",
        scramble: look.scramble !== false,
        particles: clamp01(num(look.particles, 0.6)),
        persp: Math.max(0.6, Math.min(4, num(d3.perspective, 1.6))),
        cloudDepth: Math.max(0, Math.min(0.7, num(d3.cloudDepth, 0.3))),
        dataCount: Math.max(
            0,
            Math.min(1200, Math.round(num(d3.dataCount, 340)))
        ),
        dof: Math.max(0, Math.min(3, num(dof.blur, 1.2))),
        focus: Math.max(-0.3, Math.min(0.7, num(dof.focus, 0))),
        range: Math.max(0, Math.min(0.5, num(dof.range, 0.06))),
        pulls: Math.max(0, Math.min(6, Math.round(num(dof.pulls, 2)))),
    }
}

// ── Timeline ─────────────────────────────────────────────────────────────────

interface ScriptState {
    k: number // milestone index
    phase: 0 | 1 | 2 // hold, transform, idle
    cam: CamPose
    bridge: number // 0..1: how far the turn between two angles scrambles the glyphs
    x: number
    y: number
    s: number
    dis: number // 0..1 final transformation
    enter: number // 1..0 entrance
}

function mixPose(a: CamPose, b: CamPose, t: number): CamPose {
    return {
        az: lerp(a.az, b.az, t),
        el: lerp(a.el, b.el, t),
        roll: lerp(a.roll, b.roll, t),
        d: lerp(a.d, b.d, t),
    }
}

/** State at local scroll L (vh from the section start). A pure function: scrolling back restores it exactly. */
function scriptEval(ms: ScriptMilestone[], L: number): ScriptState {
    const last = ms.length - 1
    const at = (
        k: number,
        phase: 0 | 1 | 2,
        cam: CamPose,
        x: number,
        y: number,
        s: number,
        dis: number,
        enter: number,
        bridge: number
    ): ScriptState => ({ k, phase, cam, bridge, x, y, s, dis, enter })
    for (let k = 0; k <= last; k++) {
        const m = ms[k]
        const prev = k > 0 ? ms[k - 1] : null
        if (L < m.t0) {
            if (!prev) return at(k, 0, { az: m.a.az - 24, el: 86, roll: 0, d: m.a.d * 1.2 }, m.x, m.y + 4, m.s * 0.96, 0, 1, 0)
            return at(k - 1, 0, prev.b, prev.x, prev.y, prev.s, 0, 0, 0)
        }
        if (L < m.t1) {
            const lin = (L - m.t0) / Math.max(1e-6, m.t1 - m.t0)
            if (!prev) {
                const e = EASE_ARRIVE(lin)
                // From a flat plan view (a technical drawing) up into the milestone's angle.
                const plan: CamPose = { az: m.a.az - 24, el: 86, roll: 0, d: m.a.d * 1.2 }
                return at(
                    k,
                    1,
                    mixPose(plan, m.a, e),
                    m.x,
                    lerp(m.y + 4, m.y, e),
                    lerp(m.s * 0.96, m.s, e),
                    0,
                    1 - e,
                    0
                )
            }
            const e = EASE_MOVE(lin)
            // A wide turn crosses as scrambled glyphs; a small one stays clean.
            const turn =
                Math.abs(m.a.az - prev.b.az) + Math.abs(m.a.el - prev.b.el)
            return at(
                k,
                1,
                mixPose(prev.b, m.a, e),
                lerp(prev.x, m.x, e),
                lerp(prev.y, m.y, e),
                lerp(prev.s, m.s, e),
                k === last ? lin : 0,
                0,
                Math.sin(Math.PI * lin) * clamp01(turn / 60)
            )
        }
        if (L < m.i1 || k === last) {
            const q =
                L < m.i0 ? 0 : clamp01((L - m.i0) / Math.max(1e-6, m.i1 - m.i0))
            return at(
                k,
                L < m.i0 ? 0 : 2,
                mixPose(m.a, m.b, q),
                m.x,
                m.y,
                m.s,
                k === last ? 1 : 0,
                0,
                0
            )
        }
        if (L < ms[k + 1].t0) return at(k, 0, m.b, m.x, m.y, m.s, 0, 0, 0)
    }
    const m = ms[last]
    return at(last, 0, m.b, m.x, m.y, m.s, 1, 0, 0)
}

function elRamp(L: number, r: [number, number]): number {
    return r[1] <= r[0]
        ? L >= r[0]
            ? 1
            : 0
        : clamp01((L - r[0]) / (r[1] - r[0]))
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

type Vec2 = [number, number]
type Vec3 = [number, number, number]
type Quad = [Vec2, Vec2, Vec2, Vec2]

/** Projective map from the unit square to a quad (tl, tr, br, bl), as a row-major 3×3. */
function quadMatrix(q: Quad): number[] {
    const x0 = q[0][0],
        y0 = q[0][1],
        x1 = q[1][0],
        y1 = q[1][1]
    const x2 = q[2][0],
        y2 = q[2][1],
        x3 = q[3][0],
        y3 = q[3][1]
    const dx1 = x1 - x2,
        dx2 = x3 - x2,
        dx3 = x0 - x1 + x2 - x3
    const dy1 = y1 - y2,
        dy2 = y3 - y2,
        dy3 = y0 - y1 + y2 - y3
    if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
        return [x1 - x0, x2 - x1, x0, y1 - y0, y2 - y1, y0, 0, 0, 1]
    }
    const den = dx1 * dy2 - dx2 * dy1 || 1e-9
    const g = (dx3 * dy2 - dx2 * dy3) / den
    const h = (dx1 * dy3 - dx3 * dy1) / den
    return [
        x1 - x0 + g * x1,
        x3 - x0 + h * x3,
        x0,
        y1 - y0 + g * y1,
        y3 - y0 + h * y3,
        y0,
        g,
        h,
        1,
    ]
}

function applyMatrix(m: number[], u: number, v: number): Vec2 {
    const w = m[6] * u + m[7] * v + m[8] || 1e-9
    return [(m[0] * u + m[1] * v + m[2]) / w, (m[3] * u + m[4] * v + m[5]) / w]
}

function rot3(p: Vec3, yaw: number, pitch: number, roll: number): Vec3 {
    let x = p[0],
        y = p[1],
        z = p[2]
    let c = Math.cos(roll),
        s = Math.sin(roll)
    let t = x * c - y * s
    y = x * s + y * c
    x = t
    c = Math.cos(pitch)
    s = Math.sin(pitch)
    t = y * c - z * s
    z = y * s + z * c
    y = t
    c = Math.cos(yaw)
    s = Math.sin(yaw)
    t = x * c + z * s
    z = -x * s + z * c
    x = t
    return [x, y, z]
}

function roundRectPts(w: number, h: number, r: number, seg: number): Vec2[] {
    const out: Vec2[] = []
    const cs: Array<[number, number, number]> = [
        [w / 2 - r, -h / 2 + r, -90],
        [w / 2 - r, h / 2 - r, 0],
        [-w / 2 + r, h / 2 - r, 90],
        [-w / 2 + r, -h / 2 + r, 180],
    ]
    for (const [cx, cy, a0] of cs) {
        for (let k = 0; k <= seg; k++) {
            const t = ((a0 + (90 * k) / seg) * Math.PI) / 180
            out.push([cx + r * Math.cos(t), cy + r * Math.sin(t)])
        }
    }
    return out
}

const QR_N = 21
const QR_BITS: boolean[] = (() => {
    const n = QR_N
    const m: boolean[] = new Array(n * n).fill(false)
    const r = srng(7)
    for (let i = 0; i < n * n; i++) m[i] = r() < 0.48
    const finder = (ox: number, oy: number) => {
        for (let dy = -1; dy <= 7; dy++) {
            for (let dx = -1; dx <= 7; dx++) {
                const x = ox + dx
                const y = oy + dy
                if (x < 0 || y < 0 || x >= n || y >= n) continue
                const inR = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6
                m[y * n + x] =
                    (inR && (dx === 0 || dx === 6 || dy === 0 || dy === 6)) ||
                    (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)
            }
        }
    }
    finder(0, 0)
    finder(14, 0)
    finder(0, 14)
    for (let i = 8; i <= 12; i++) {
        m[6 * n + i] = i % 2 === 0
        m[i * n + 6] = i % 2 === 0
    }
    return m
})()
const QR_SCRAMBLE = "%&*+=x#"
const CHECK_PTS: Vec2[] = [
    [-0.45, 0.02],
    [-0.12, 0.34],
    [0.48, -0.32],
]

interface DataParticle {
    u: number
    v: number
    x: number
    y: number
    z: number
    d: number
    d2: number
    g: string
    link: number
}

function buildDataParticles(n: number): DataParticle[] {
    const r = srng(11)
    const out: DataParticle[] = []
    for (let i = 0; i < n; i++) {
        let x = 0,
            y = 0,
            z = 0
        do {
            x = r() * 2 - 1
            y = r() * 2 - 1
            z = r() * 2 - 1
        } while (x * x + y * y + z * z > 1)
        const g = r()
        out.push({
            u: 0.08 + r() * 0.84,
            v: 0.1 + r() * 0.8,
            x,
            y,
            z,
            d: r(),
            d2: r(),
            g:
                g < 0.36
                    ? "0"
                    : g < 0.72
                      ? "1"
                      : g < 0.84
                        ? "+"
                        : g < 0.94
                          ? "#"
                          : ".",
            link: -1,
        })
    }
    for (let i = 0; i < n; i += 2) {
        let best = -1
        let bd = 1e9
        for (let j = i + 1; j < Math.min(n, i + 60); j++) {
            const p = out[i]
            const q = out[j]
            const dd =
                (p.x - q.x) * (p.x - q.x) +
                (p.y - q.y) * (p.y - q.y) +
                (p.z - q.z) * (p.z - q.z)
            if (dd < bd) {
                bd = dd
                best = j
            }
        }
        if (bd < 0.12) out[i].link = best
    }
    return out
}

// ── Engine ───────────────────────────────────────────────────────────────────

interface DevPose {
    fh: number // height of the element space: card and cloud sizes derive from it
    cx: number // device centre on screen
    cy: number
    z: number
    F: number // perspective distance of the element space
    vx: number
    vy: number
}

interface ScriptInput {
    conf: ScriptConf
    L: number
    time: number
    w: number
    h: number
    dpr: number
    reduced: boolean
    mobile: boolean
    mobileX: number
    mobileY: number
    scale: number
    opacity: number
    idleAmp: number
    idleFloat: number
    idleTilt: number
    idleDepth: number
    ink: RGBA // the component's ink (hand-over glyphs match the glyph grid)
    elInk: RGBA // ink of the scripted ASCII elements
    accent: RGBA
    pageBg: RGBA
    role: 0 | 1 | 2 // 0 = alone, 1 = leaving (morphing into the next section), 2 = arriving
    p: number
    cols: number
    rows: number
    cw: number
    cellPx: number
    ramp: string[]
}

interface GridLayer {
    dens: Float32Array
    cls: Uint8Array
    rgb: Uint8Array
}

interface ScriptEngine {
    preload(conf: ScriptConf): void
    update(inp: ScriptInput): void
    cells(slot: GridLayer): boolean
    draw(c2d: CanvasRenderingContext2D, other: GridLayer | null): void
    hide(): void
    status(): string
    dispose(): void
}

const SPRITE_PX = 48
const SPRITE_BLUR = [0, 1.5, 3, 5, 8, 12, 17]

const DEV_VS_MESH = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos; uniform mat4 uVP; out vec3 vW;
void main(){ vW = aPos; gl_Position = uVP * vec4(aPos, 1.0); }`
const DEV_FS_MESH = `#version 300 es
precision highp float;
in vec3 vW; uniform vec3 uCam; uniform float uFlat, uFlatLum, uScreen; out vec4 o;
void main(){
  if (uFlat > 0.5) { o = vec4(uFlatLum, uScreen, 0.0, 1.0); return; }
  vec3 n = normalize(cross(dFdx(vW), dFdy(vW)));
  vec3 e = normalize(uCam - vW);
  if (dot(n, e) < 0.0) n = -n;
  float lum = 0.30 + 0.48 * max(0.0, dot(n, vec3(-0.3421, 0.8308, 0.4398))) + 0.22 * max(0.0, dot(n, e));
  o = vec4(clamp(lum, 0.02, 1.0), 0.0, 0.0, 1.0);
}`
// One instance per edge segment. An edge shows as a crease (its two faces
// meet at more than the Edge Angle and one of them faces the camera) or as
// silhouette (one face towards the camera, one away).
const DEV_VS_LINE = `#version 300 es
precision highp float;
layout(location=0) in float aT;
layout(location=1) in vec3 iP0; layout(location=2) in vec3 iP1;
layout(location=3) in vec3 iNA; layout(location=4) in vec3 iNB; layout(location=5) in vec4 iMeta;
uniform mat4 uVP; uniform vec3 uCam; uniform float uCrease, uMinLen, uBias, uDetail, uD; uniform vec2 uView, uOff;
flat out float vCode; flat out float vDep;
void main(){
  vec3 mid = (iP0 + iP1) * 0.5, v = uCam - mid;
  vDep = clamp((length(v) - (uD - 1.4)) / 2.8, 0.0, 1.0);
  float a = dot(iNA, v), b = dot(iNB, v), d = dot(normalize(iNA), normalize(iNB));
  bool crease = iMeta.z > 0.5 && d < uCrease;
  bool show = crease ? (a > 0.0 || b > 0.0) : (a * b < 0.0);
  if (crease && iMeta.x < uMinLen) show = false;
  if (iMeta.y > 3.5 && uDetail < 0.5) show = false;
  vec4 c0 = uVP * vec4(iP0, 1.0), c1 = uVP * vec4(iP1, 1.0);
  vec2 dd = (c1.xy / c1.w - c0.xy / c0.w) * uView;
  float th = atan(dd.y, dd.x);
  th -= 3.14159265 * floor(th / 3.14159265 + 0.5);
  vCode = (1.0 + floor((th / 3.14159265 + 0.5) * 253.0 + 0.5)) / 255.0;
  vec4 c = mix(c0, c1, aT); c.z -= uBias * c.w; c.xy += uOff * c.w;
  gl_Position = show ? c : vec4(2.0, 2.0, 2.0, 1.0);
}`
const DEV_FS_LINE = `#version 300 es
precision highp float;
flat in float vCode; flat in float vDep; out vec4 o;
void main(){ o = vec4(0.0, 0.0, vCode, 1.0); }`
// The contour: the same edges as a quiet antialiased hairline, fading with depth.
const DEV_FS_LINEC = `#version 300 es
precision highp float;
flat in float vCode; flat in float vDep; uniform vec4 uColor; uniform float uFog; out vec4 o;
void main(){ float a = uColor.a * (1.0 - uFog * vDep); o = vec4(uColor.rgb * a, a); }`

function createScriptEngine(
    staticMode: boolean,
    requestRedraw: () => void
): ScriptEngine {
    // ── Model ────────────────────────────────────────────────────────────────
    let modelUrl = ""
    let geo: DevGeo | null = null
    let geoState: 0 | 1 | 2 | 3 = 0 // none, loading, ready, failed
    let failedAt = 0
    let disposed = false

    function setModel(url: string) {
        if (url === modelUrl) {
            // A failed download is tried again after a while.
            if (geoState === 3 && performance.now() - failedAt > 8000)
                loadModel()
            return
        }
        modelUrl = url
        geo = null
        geoState = 0
        dropBuffers()
        if (url) loadModel()
    }

    function loadModel() {
        if (!modelUrl || disposed || typeof fetch !== "function") return
        const url = modelUrl
        geoState = 1
        fetch(url, { mode: "cors", credentials: "omit" })
            .then((r) => {
                if (!r.ok) throw new Error(String(r.status))
                return r.json()
            })
            .then((j) => {
                if (disposed || url !== modelUrl) return
                const g = parseDevGeo(j)
                if (!g) throw new Error("format")
                geo = g
                geoState = 2
                requestRedraw()
            })
            .catch(() => {
                if (disposed || url !== modelUrl) return
                geoState = 3
                failedAt = performance.now()
                requestRedraw()
            })
    }

    // ── Off-screen WebGL2 pass (live only; never attached to the page) ───────
    let glc: HTMLCanvasElement | null = null
    let gl: WebGL2RenderingContext | null = null
    let glTried = false
    let pMesh: WebGLProgram | null = null
    let pLine: WebGLProgram | null = null
    let pLineC: WebGLProgram | null = null
    const UC: Record<string, WebGLUniformLocation | null> = {}
    let vaoExtra: WebGLVertexArrayObject | null = null
    let bufExtra: WebGLBuffer | null = null
    const UM: Record<string, WebGLUniformLocation | null> = {}
    const UL: Record<string, WebGLUniformLocation | null> = {}
    let vaoMesh: WebGLVertexArrayObject | null = null
    let vaoLine: WebGLVertexArrayObject | null = null
    let vaoQuad: WebGLVertexArrayObject | null = null
    let glBufs: WebGLBuffer[] = []
    let glGeo: DevGeo | null = null
    let fbo: WebGLFramebuffer | null = null
    let fboTex: WebGLTexture | null = null
    let fboDepth: WebGLRenderbuffer | null = null
    let fboW = 0
    let fboH = 0
    let path = "" // "GL" or "CPU": what drew the last frame (debug status)
    let pick: 0 | 1 | 2 = 0 // undecided, WebGL, CPU
    let pickFor = 0 // target size the decision was made for
    let glMs = 0
    let glN = 0
    let cpuMs = 0
    let cpuN = 0

    function dropBuffers() {
        if (gl) {
            for (const b of glBufs) gl.deleteBuffer(b)
            for (const v of [vaoMesh, vaoLine, vaoQuad])
                if (v) gl.deleteVertexArray(v)
        }
        glBufs = []
        vaoMesh = vaoLine = vaoQuad = null
        glGeo = null
    }

    const onLost = (e: Event) => {
        e.preventDefault()
        gl = null
        pMesh = pLine = pLineC = null
        vaoExtra = null
        bufExtra = null
        glBufs = []
        vaoMesh = vaoLine = vaoQuad = null
        glGeo = null
        fbo = null
        fboTex = null
        fboDepth = null
        fboW = fboH = 0
        requestRedraw()
    }
    const onRestored = () => {
        glTried = false
        requestRedraw()
    }

    function initGL(): boolean {
        if (gl) return true
        if (glTried || staticMode) return false
        glTried = true
        if (!glc) {
            glc = document.createElement("canvas")
            glc.width = 4
            glc.height = 4
            glc.addEventListener("webglcontextlost", onLost)
            glc.addEventListener("webglcontextrestored", onRestored)
        }
        let g: WebGL2RenderingContext | null = null
        try {
            g = glc.getContext("webgl2", {
                alpha: true,
                antialias: false,
                depth: true,
                stencil: false,
                premultipliedAlpha: true,
                powerPreference: "low-power",
            })
        } catch (e) {
            g = null
        }
        if (!g) return false
        const build = (vs: string, fs: string): WebGLProgram | null => {
            const p = g.createProgram()
            if (!p) return null
            for (const [type, src] of [
                [g.VERTEX_SHADER, vs],
                [g.FRAGMENT_SHADER, fs],
            ] as Array<[number, string]>) {
                const s = g.createShader(type)
                if (!s) return null
                g.shaderSource(s, src)
                g.compileShader(s)
                if (!g.getShaderParameter(s, g.COMPILE_STATUS)) return null
                g.attachShader(p, s)
                g.deleteShader(s)
            }
            g.linkProgram(p)
            return g.getProgramParameter(p, g.LINK_STATUS) ? p : null
        }
        pMesh = build(DEV_VS_MESH, DEV_FS_MESH)
        pLine = build(DEV_VS_LINE, DEV_FS_LINE)
        pLineC = build(DEV_VS_LINE, DEV_FS_LINEC)
        if (!pMesh || !pLine || !pLineC) return false
        for (const n of ["uVP", "uCam", "uFlat", "uFlatLum", "uScreen"])
            UM[n] = g.getUniformLocation(pMesh, n)
        for (const n of ["uVP", "uCam", "uCrease", "uMinLen", "uBias", "uDetail", "uView", "uD", "uOff", "uColor", "uFog"])
            UC[n] = g.getUniformLocation(pLineC, n)
        vaoExtra = g.createVertexArray()
        g.bindVertexArray(vaoExtra)
        bufExtra = g.createBuffer()
        g.bindBuffer(g.ARRAY_BUFFER, bufExtra)
        g.enableVertexAttribArray(0)
        g.vertexAttribPointer(0, 3, g.FLOAT, false, 0, 0)
        g.bindVertexArray(null)
        for (const n of ["uVP", "uCam", "uCrease", "uMinLen", "uBias", "uDetail", "uView", "uD", "uOff"])
            UL[n] = g.getUniformLocation(pLine, n)
        gl = g
        return true
    }

    function uploadGeo(g: WebGL2RenderingContext, d: DevGeo) {
        if (glGeo === d) return
        dropBuffers()
        const buf = (target: number, data: ArrayBufferView): WebGLBuffer => {
            const b = g.createBuffer() as WebGLBuffer
            g.bindBuffer(target, b)
            g.bufferData(target, data, g.STATIC_DRAW)
            glBufs.push(b)
            return b
        }
        vaoLine = g.createVertexArray()
        g.bindVertexArray(vaoLine)
        buf(g.ARRAY_BUFFER, new Float32Array([0, 1]))
        g.enableVertexAttribArray(0)
        g.vertexAttribPointer(0, 1, g.FLOAT, false, 0, 0)
        buf(g.ARRAY_BUFFER, d.segs)
        const at = (
            loc: number,
            n: number,
            type: number,
            norm: boolean,
            off: number
        ) => {
            g.enableVertexAttribArray(loc)
            g.vertexAttribPointer(loc, n, type, norm, DEV_SEG_BYTES, off)
            g.vertexAttribDivisor(loc, 1)
        }
        at(1, 3, g.SHORT, true, 0)
        at(2, 3, g.SHORT, true, 6)
        at(3, 3, g.BYTE, true, 12)
        at(4, 3, g.BYTE, true, 15)
        at(5, 4, g.UNSIGNED_BYTE, false, 18)
        vaoMesh = g.createVertexArray()
        g.bindVertexArray(vaoMesh)
        buf(g.ARRAY_BUFFER, d.verts)
        g.enableVertexAttribArray(0)
        g.vertexAttribPointer(0, 3, g.SHORT, true, 6, 0)
        buf(g.ELEMENT_ARRAY_BUFFER, d.idx)
        vaoQuad = g.createVertexArray()
        g.bindVertexArray(vaoQuad)
        const qv: number[] = []
        for (const q of d.quads)
            for (const i of [0, 1, 2, 0, 2, 3])
                qv.push(q[i][0], q[i][1], q[i][2])
        buf(g.ARRAY_BUFFER, new Float32Array(qv))
        g.enableVertexAttribArray(0)
        g.vertexAttribPointer(0, 3, g.FLOAT, false, 0, 0)
        g.bindVertexArray(null)
        glGeo = d
    }

    function ensureFbo(
        g: WebGL2RenderingContext,
        w: number,
        h: number
    ): boolean {
        if (fbo && w === fboW && h === fboH) return true
        if (!fbo) {
            fbo = g.createFramebuffer()
            fboTex = g.createTexture()
            fboDepth = g.createRenderbuffer()
        }
        g.bindTexture(g.TEXTURE_2D, fboTex)
        g.texImage2D(
            g.TEXTURE_2D,
            0,
            g.RGBA8,
            w,
            h,
            0,
            g.RGBA,
            g.UNSIGNED_BYTE,
            null
        )
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST)
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST)
        g.bindRenderbuffer(g.RENDERBUFFER, fboDepth)
        g.renderbufferStorage(g.RENDERBUFFER, g.DEPTH_COMPONENT24, w, h)
        g.bindFramebuffer(g.FRAMEBUFFER, fbo)
        g.framebufferTexture2D(
            g.FRAMEBUFFER,
            g.COLOR_ATTACHMENT0,
            g.TEXTURE_2D,
            fboTex,
            0
        )
        g.framebufferRenderbuffer(
            g.FRAMEBUFFER,
            g.DEPTH_ATTACHMENT,
            g.RENDERBUFFER,
            fboDepth
        )
        const ok =
            g.checkFramebufferStatus(g.FRAMEBUFFER) === g.FRAMEBUFFER_COMPLETE
        g.bindFramebuffer(g.FRAMEBUFFER, null)
        fboW = ok ? w : 0
        fboH = ok ? h : 0
        return ok
    }

    /** Surfaces, displays and edges in one target, read back once. */
    function renderGL(
        d: DevGeo,
        m: Float32Array,
        fw: number,
        fh: number,
        conf: ScriptConf,
        viewW: number,
        viewH: number
    ): boolean {
        if (!initGL() || !gl || !pMesh || !pLine) return false
        const g = gl
        if (g.isContextLost()) return false
        uploadGeo(g, d)
        if (!ensureFbo(g, fw, fh)) return false
        g.bindFramebuffer(g.FRAMEBUFFER, fbo)
        g.viewport(0, 0, fw, fh)
        g.disable(g.BLEND)
        g.disable(g.CULL_FACE)
        g.enable(g.DEPTH_TEST)
        g.depthFunc(g.LEQUAL)
        g.depthMask(true)
        g.colorMask(true, true, true, true)
        g.clearColor(0, 0, 0, 0)
        g.clearDepth(1)
        g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT)
        g.useProgram(pMesh)
        g.uniformMatrix4fv(UM.uVP, false, m)
        g.uniform3f(UM.uCam, eye[0], eye[1], eye[2])
        g.uniform1f(UM.uFlat, 0)
        g.bindVertexArray(vaoMesh)
        g.enable(g.POLYGON_OFFSET_FILL)
        g.polygonOffset(1, 1)
        g.drawElements(
            g.TRIANGLES,
            d.nt * 3,
            d.i32 ? g.UNSIGNED_INT : g.UNSIGNED_SHORT,
            0
        )
        g.uniform1f(UM.uFlat, 1)
        g.uniform1f(UM.uFlatLum, 1)
        g.uniform1f(UM.uScreen, 1)
        g.bindVertexArray(vaoQuad)
        g.drawArrays(g.TRIANGLES, 0, 12)
        // Extra bodies of the scene (phone, panels), in the device's own space.
        if (vaoExtra && bufExtra && extras.length) {
            g.bindVertexArray(vaoExtra)
            g.bindBuffer(g.ARRAY_BUFFER, bufExtra)
            for (const e of extras) {
                g.bufferData(g.ARRAY_BUFFER, e.v, g.DYNAMIC_DRAW)
                if (e.flat >= 0) {
                    g.polygonOffset(-1, -6)
                    g.uniform1f(UM.uFlat, 1)
                    g.uniform1f(UM.uFlatLum, e.flat)
                    g.uniform1f(UM.uScreen, 0)
                } else {
                    g.polygonOffset(1, 1)
                    g.uniform1f(UM.uFlat, 0)
                }
                g.drawArrays(g.TRIANGLES, 0, e.v.length / 3)
            }
            g.polygonOffset(1, 1)
        }
        g.disable(g.POLYGON_OFFSET_FILL)
        // Edges go to the blue channel only, tested against the hull's depth.
        g.colorMask(false, false, true, false)
        g.depthMask(false)
        g.useProgram(pLine)
        g.uniformMatrix4fv(UL.uVP, false, m)
        g.uniform3f(UL.uCam, eye[0], eye[1], eye[2])
        g.uniform1f(UL.uCrease, conf.creaseCos)
        g.uniform1f(UL.uMinLen, conf.minEdge)
        g.uniform1f(UL.uBias, 0.003)
        g.uniform1f(UL.uDetail, conf.details ? 1 : 0)
        g.uniform2f(UL.uView, viewW, viewH)
        g.uniform1f(UL.uD, camDist)
        g.uniform2f(UL.uOff, 0, 0)
        g.bindVertexArray(vaoLine)
        g.drawArraysInstanced(g.LINES, 0, 2, d.n)
        g.bindVertexArray(null)
        g.colorMask(true, true, true, true)
        g.depthMask(true)
        g.readPixels(0, 0, fw, fh, g.RGBA, g.UNSIGNED_BYTE, pix)
        g.bindFramebuffer(g.FRAMEBUFFER, null)
        return !g.isContextLost()
    }

    /** Extra bodies drawn with the device: triangles in model space; flat = even tone (−1 = shaded). */
    interface ExtraBody {
        v: Float32Array
        flat: number
    }
    let extras: ExtraBody[] = []
    let camDist = DEV_DIST

    /** The contour: edges as an antialiased hairline on the GL canvas, hidden by the hull, fading with depth. */
    function renderContour(
        d: DevGeo,
        w: number,
        h: number,
        dpr: number,
        conf: ScriptConf,
        color: RGBA,
        alpha: number
    ): HTMLCanvasElement | null {
        if (!initGL() || !gl || !glc || !pMesh || !pLineC || alpha <= 0.002) return null
        const g = gl
        if (g.isContextLost()) return null
        uploadGeo(g, d)
        const pw = Math.max(1, Math.round(w * dpr))
        const ph = Math.max(1, Math.round(h * dpr))
        if (glc.width !== pw || glc.height !== ph) {
            glc.width = pw
            glc.height = ph
        }
        g.bindFramebuffer(g.FRAMEBUFFER, null)
        g.viewport(0, 0, pw, ph)
        g.disable(g.BLEND)
        g.disable(g.CULL_FACE)
        g.enable(g.DEPTH_TEST)
        g.depthFunc(g.LEQUAL)
        g.depthMask(true)
        g.colorMask(true, true, true, true)
        g.clearColor(0, 0, 0, 0)
        g.clearDepth(1)
        g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT)
        // Hull and extras into depth only.
        g.colorMask(false, false, false, false)
        g.useProgram(pMesh)
        g.uniformMatrix4fv(UM.uVP, false, VP)
        g.uniform3f(UM.uCam, eye[0], eye[1], eye[2])
        g.uniform1f(UM.uFlat, 0)
        g.bindVertexArray(vaoMesh)
        g.enable(g.POLYGON_OFFSET_FILL)
        g.polygonOffset(1, 1)
        g.drawElements(g.TRIANGLES, d.nt * 3, d.i32 ? g.UNSIGNED_INT : g.UNSIGNED_SHORT, 0)
        if (vaoExtra && bufExtra && extras.length) {
            g.bindVertexArray(vaoExtra)
            g.bindBuffer(g.ARRAY_BUFFER, bufExtra)
            for (const e of extras) {
                g.bufferData(g.ARRAY_BUFFER, e.v, g.DYNAMIC_DRAW)
                g.drawArrays(g.TRIANGLES, 0, e.v.length / 3)
            }
        }
        g.disable(g.POLYGON_OFFSET_FILL)
        g.colorMask(true, true, true, true)
        g.depthMask(false)
        g.enable(g.BLEND)
        g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA)
        g.useProgram(pLineC)
        g.uniformMatrix4fv(UC.uVP, false, VP)
        g.uniform3f(UC.uCam, eye[0], eye[1], eye[2])
        g.uniform1f(UC.uCrease, conf.creaseCos)
        g.uniform1f(UC.uMinLen, conf.minEdge)
        g.uniform1f(UC.uBias, 0.0016)
        g.uniform1f(UC.uDetail, conf.details ? 1 : 0)
        g.uniform2f(UC.uView, pw, ph)
        g.uniform1f(UC.uD, camDist)
        g.uniform1f(UC.uFog, 0.65)
        g.uniform4f(UC.uColor, color[0] / 255, color[1] / 255, color[2] / 255, alpha)
        g.bindVertexArray(vaoLine)
        const n = Math.max(1, Math.round(dpr))
        for (let i = 0; i < n; i++)
            for (let j = 0; j < n; j++) {
                g.uniform2f(UC.uOff, ((i - (n - 1) / 2) * 2) / pw, ((j - (n - 1) / 2) * 2) / ph)
                g.drawArraysInstanced(g.LINES, 0, 2, d.n)
            }
        g.bindVertexArray(null)
        g.depthMask(true)
        g.disable(g.BLEND)
        return g.isContextLost() ? null : glc
    }

    // ── Per-frame context ────────────────────────────────────────────────────
    let I: ScriptInput | null = null
    let st: ScriptState = scriptEval(normMilestones([]), 0)
    let pose: DevPose = { fh: 1, cx: 0, cy: 0, z: 0, F: 1000, vx: 0, vy: 0 }
    let VP: Float32Array = m4clip(1, 1, 0, 0)
    let eye: Vec3 = [0, 0, DEV_DIST]
    let ascii = 0 // 0 = on its own, 1 = handing over to / from a neighbouring section
    let devFade = 1 // 0 while the device is split into the four old devices
    let reveal = 1 // 0..1 entrance: the device assembles cell by cell
    let greenCss = "#16A05A"
    let contourRGB: RGBA = [5, 5, 5, 1]
    interface BodyFrame {
        c: Vec3
        r: Vec3
        u: Vec3
        n: Vec3
        w: number
        h: number
        e?: number
    }
    let phone: BodyFrame | null = null
    let panels: BodyFrame[] = []
    const qrPos: Array<[number, number, number]> = [] // screen x, y and dissolve threshold of each dark QR module
    function boxTris(c: Vec3, r: Vec3, u: Vec3, n: Vec3, w: number, h: number, d: number): Float32Array {
        const P = (a: number, b: number, e: number): Vec3 => [
            c[0] + r[0] * a * w / 2 + u[0] * b * h / 2 + n[0] * e * d / 2,
            c[1] + r[1] * a * w / 2 + u[1] * b * h / 2 + n[1] * e * d / 2,
            c[2] + r[2] * a * w / 2 + u[2] * b * h / 2 + n[2] * e * d / 2,
        ]
        const f = (a: Vec3, b: Vec3, cc: Vec3, dd: Vec3) => [a, b, cc, a, cc, dd]
        const out: number[] = []
        for (const q of [
            f(P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)),
            f(P(1, -1, -1), P(-1, -1, -1), P(-1, 1, -1), P(1, 1, -1)),
            f(P(1, -1, 1), P(1, -1, -1), P(1, 1, -1), P(1, 1, 1)),
            f(P(-1, -1, -1), P(-1, -1, 1), P(-1, 1, 1), P(-1, 1, -1)),
            f(P(-1, 1, 1), P(1, 1, 1), P(1, 1, -1), P(-1, 1, -1)),
            f(P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1)),
        ])
            for (const p of q) out.push(p[0], p[1], p[2])
        return new Float32Array(out)
    }
    function quadTris(c: Vec3, r: Vec3, u: Vec3, w: number, h: number): Float32Array {
        const P = (a: number, b: number): Vec3 => [
            c[0] + r[0] * a * w / 2 + u[0] * b * h / 2,
            c[1] + r[1] * a * w / 2 + u[1] * b * h / 2,
            c[2] + r[2] * a * w / 2 + u[2] * b * h / 2,
        ]
        const out: number[] = []
        for (const p of [P(-1, -1), P(1, -1), P(1, 1), P(-1, -1), P(1, 1), P(-1, 1)]) out.push(p[0], p[1], p[2])
        return new Float32Array(out)
    }
    /** A point on a body's front plane (x, y in −0.5…0.5 of its width / height) on screen. */
    function bodyPt(b: BodyFrame, x: number, y: number): Vec2 {
        return scr3([
            b.c[0] + b.r[0] * x * b.w + b.u[0] * y * b.h,
            b.c[1] + b.r[1] * x * b.w + b.u[1] * y * b.h,
            b.c[2] + b.r[2] * x * b.w + b.u[2] * y * b.h,
        ])
    }
    let focus = 0
    let statusText = ""
    let inkCss = "#000"
    let accCss = "#00f"
    let bgCss = "#fff"
    let scrInk = "#eef0f4"
    let scrAcc = "#8ea0ff"
    let lightPage = true
    let colorKey = ""
    let pix = new Uint8Array(4)
    let zbuf = new Float32Array(1)
    const devLit: number[] = [] // cells the device covers this frame (hand-over particles)

    /** Element space: a point at depth z in front of the screen plane. */
    function project(x: number, y: number, z: number): Vec3 {
        const F = pose.F
        const s = F / (F - Math.min(z, 0.85 * F))
        return [pose.vx + (x - pose.vx) * s, pose.vy + (y - pose.vy) * s, s]
    }
    // The displays are handed out as screen-space quads, so a point on a
    // display is already a screen point at depth 0 of the element space.
    function at3(nx: number, ny: number): Vec3 {
        return [nx, ny, 0]
    }
    function at(nx: number, ny: number): Vec2 {
        return [nx, ny]
    }
    /** A point of the model on screen. */
    function scr3(p: Vec3): Vec2 {
        const w = I ? I.w : 1
        const h = I ? I.h : 1
        const m = VP
        const cw = Math.max(
            1e-6,
            m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]
        )
        return [
            (((m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12]) / cw) * 0.5 +
                0.5) *
                w,
            (1 -
                (((m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13]) / cw) *
                    0.5 +
                    0.5)) *
                h,
        ]
    }
    /** A display of the model on screen (0 = small, 1 = large) and how well it faces the camera. */
    function devQuad(kind: 0 | 1): { q: Quad; avail: number } {
        if (!geo)
            return {
                q: [
                    [0, 0],
                    [1, 0],
                    [1, 1],
                    [0, 1],
                ],
                avail: 0,
            }
        const c = geo.quads[kind]
        const n = geo.normals[kind]
        const vx = eye[0] - (c[0][0] + c[2][0]) / 2
        const vy = eye[1] - (c[0][1] + c[2][1]) / 2
        const vz = eye[2] - (c[0][2] + c[2][2]) / 2
        const facing =
            (n[0] * vx + n[1] * vy + n[2] * vz) / (Math.hypot(vx, vy, vz) || 1)
        return {
            q: [scr3(c[0]), scr3(c[1]), scr3(c[2]), scr3(c[3])],
            avail: smoothstep(0.08, 0.32, facing) * (1 - st.bridge),
        }
    }

    function update(inp: ScriptInput) {
        I = inp
        const conf = inp.conf
        setModel(conf.model)
        st = scriptEval(conf.ms, inp.L)
        // Hand-over amounts at both ends of the section.
        let enter = st.enter
        let dis = st.dis
        if (inp.role === 2)
            enter = Math.max(enter, 1 - smoothstep(0.75, 1, inp.p))
        if (inp.role === 1) dis = Math.max(dis, smoothstep(0, 0.25, inp.p))
        ascii = staticMode ? 0 : Math.max(enter, dis)

        // Camera: the milestone's angle plus idle motion (float, depth, small tilt).
        const w = inp.w
        const h = inp.h
        const asp = w / Math.max(1, h)
        // A narrow viewport moves the camera back so the device still fits
        // (it then spans a bit under 60% of the width).
        const guard = Math.max(1, 0.9 / Math.max(0.3, asp))
        const sc = Math.max(0.05, st.s * inp.scale)
        const calm =
            (st.phase === 1 ? 0.4 : 1) * (1 - smoothstep(0, 0.6, ascii))
        const amp = inp.reduced ? 0 : inp.idleAmp * calm
        const t = inp.time
        const xp = inp.mobile ? (inp.mobileX >= 0 ? inp.mobileX : 50) : st.x
        const yp =
            st.y + (inp.mobile ? (inp.mobileY >= 0 ? inp.mobileY - 50 : 10) : 0)
        const D = Math.PI / 180
        const az =
            (st.cam.az + Math.sin(t * 0.39) * 3.2 * amp * inp.idleTilt) * D
        const el =
            Math.max(
                -12,
                Math.min(
                    88,
                    st.cam.el +
                        Math.sin(t * 0.53 + 2.1) * 2.4 * amp * inp.idleTilt
                )
            ) * D
        const roll =
            (st.cam.roll +
                Math.sin(t * 0.61 + 0.4) * 0.7 * amp * inp.idleTilt) *
            D
        const dist =
            ((DEV_DIST * (62 / conf.size) * st.cam.d) / sc) *
            guard *
            (1 - Math.sin(t * 0.47 + 0.6) * 0.04 * amp * inp.idleDepth)
        eye = [
            Math.sin(az) * Math.cos(el) * dist,
            Math.sin(el) * dist,
            Math.cos(az) * Math.cos(el) * dist,
        ]
        camDist = dist
        const fx = Math.sin(t * 0.31 + 1.3) * 0.006 * amp * inp.idleFloat
        const fy = Math.sin(t * 0.83) * 0.011 * amp * inp.idleFloat
        VP = m4mul(
            m4clip(1, 1, (xp / 100 + fx) * 2 - 1, 1 - (yp / 100 + fy) * 2),
            m4mul(
                m4persp(
                    DEV_FOV * D,
                    asp,
                    Math.min(1.5, Math.max(0.2, dist - 2)),
                    dist + 9
                ),
                m4mul(m4rotZ(roll), m4look(eye))
            )
        )
        pose = {
            fh: ((conf.size / 100) * h * sc) / DEV_BODY / guard,
            cx: (xp / 100 + fx) * w,
            cy: (yp / 100 + fy) * h,
            z: 0,
            F: conf.persp * h * (inp.reduced ? 1.6 : 1),
            vx: w * 0.5,
            vy: h * 0.46,
        }

        // Focus: on the device plane; during the data cloud it pulls into the cloud and back.
        const q = elRamp(inp.L, [conf.el.toNav[0], conf.el.toNav[1]])
        focus =
            conf.focus +
            (conf.pulls > 0 && q > 0 && q < 1 && !inp.reduced
                ? conf.cloudDepth *
                  (0.5 - 0.5 * Math.cos(q * Math.PI * 2 * conf.pulls))
                : 0)

        // Colours.
        const key =
            inp.elInk.join(",") +
            "|" +
            inp.accent.join(",") +
            "|" +
            inp.pageBg.join(",")
        if (key !== colorKey) {
            colorKey = key
            inkCss = rgbaString(inp.elInk)
            accCss = rgbaString(inp.accent)
            bgCss = rgbaString(inp.pageBg)
            lightPage =
                (inp.pageBg[0] * 0.299 +
                    inp.pageBg[1] * 0.587 +
                    inp.pageBg[2] * 0.114) /
                    255 >
                0.5
            scrInk = "rgb(238,240,244)"
            const a = inp.accent
            scrAcc = lightPage
                ? `rgb(${Math.round(lerp(a[0], 255, 0.45))},${Math.round(lerp(a[1], 255, 0.45))},${Math.round(lerp(a[2], 255, 0.45))})`
                : accCss
            sprites.clear()
        }

        // ── Scene state: fades, extra bodies, colours of the elements ──
        {
            const el = conf.el
            const L = inp.L
            const sp = smoothstep(0.15, 0.85, elRamp(L, el.split))
            const mg = smoothstep(0.15, 0.85, elRamp(L, el.merge))
            devFade = lerp(1 - sp, 1, mg)
            reveal = 1 - st.enter
            greenCss = rgbaString(parseCssColor(conf.checkColor))
            contourRGB = conf.contourColor ? parseCssColor(conf.contourColor) : inp.ink
            extras = []
            phone = null
            panels = []
            const D2 = Math.PI / 180
            const azr = st.cam.az * D2
            const right: Vec3 = [Math.cos(azr), 0, -Math.sin(azr)]
            const body = (c: Vec3, yaw: number, scale: number, flatScreen: number) => {
                const n: Vec3 = [Math.sin(yaw), 0, Math.cos(yaw)]
                const r: Vec3 = [n[2], 0, -n[0]]
                const u: Vec3 = [0, 1, 0]
                const w = 0.46 * scale
                const h = 0.98 * scale
                const d = 0.045 * scale
                extras.push({ v: boxTris(c, r, u, n, w, h, d), flat: 0.58 })
                const sc: Vec3 = [c[0] + n[0] * (d / 2 + 0.002), c[1] + n[1] * (d / 2 + 0.002), c[2] + n[2] * (d / 2 + 0.002)]
                extras.push({ v: quadTris(sc, r, u, w * 0.86, h * 0.92), flat: flatScreen })
                return { c: sc, r, u, n, w, h }
            }
            const pA = EASE_ARRIVE(elRamp(L, el.phoneIn)) * (1 - smoothstep(0, 0.6, elRamp(L, el.split)))
            const pB = EASE_ARRIVE(elRamp(L, el.panels))
            if (pA > 0.01) {
                const c: Vec3 = [right[0] * 1.55, 0.26 + 0.12 * (1 - pA), right[2] * 1.55]
                phone = body(c, azr + Math.PI + 0.25, 0.2 + 0.8 * pA, 0.22)
            } else if (pB > 0.01) {
                const c: Vec3 = [right[0] * 1.7, 0.3 + 0.12 * (1 - pB), right[2] * 1.7]
                phone = body(c, azr + Math.PI - 0.3, (0.2 + 0.8 * pB) * 1.05, 0.22)
            }
            if (pB > 0.01 && geo) {
                // Two panels lift off the large display and settle to the right of the device.
                const q = geo.quads[1]
                const bc: Vec3 = [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2, (q[0][2] + q[2][2]) / 2]
                const n: Vec3 = [Math.sin(azr + Math.PI), 0, Math.cos(azr + Math.PI)]
                const r: Vec3 = [n[2], 0, -n[0]]
                const u: Vec3 = [0, 1, 0]
                const targets: Vec3[] = [
                    [right[0] * 1.0, 0.95, right[2] * 1.0],
                    [right[0] * 1.0, 0.3, right[2] * 1.0],
                ]
                targets.forEach((t, k) => {
                    const e = EASE_MOVE(clamp01((pB - k * 0.2) / 0.8))
                    if (e <= 0) return
                    const c: Vec3 = [lerp(bc[0], t[0], e), lerp(bc[1], t[1], e), lerp(bc[2], t[2], e)]
                    const w = 0.9 * (0.4 + 0.6 * e)
                    const h = 0.55 * (0.4 + 0.6 * e)
                    extras.push({ v: quadTris(c, r, u, w, h), flat: 0.16 })
                    panels.push({ c, r, u, n, w, h, e })
                })
            }
        }

        statusText = !modelUrl
            ? "⚠ upload the “Device Model” file"
            : geoState === 3
              ? "model ✗ not reachable (check the file / URL)"
              : !geo
                ? "model loading…"
                : `${SCRIPT_NAMES[st.k]} · turn ${Math.round(st.cam.az)}° tilt ${Math.round(st.cam.el)}° · ${Math.round(inp.L)}vh · ${geo.n} edges${path ? " · " + path : ""}`
    }

    /**
     * The device as a layer of the glyph grid. Cell classes carry what the
     * glyph pass needs: 3 (image) | 0x40 (scripted device) | glyph code << 3
     * (1–4 = edge direction - \ | /, 5 = junction, 6 = scrambled) | 0x80 (accent).
     */
    function cells(slot: GridLayer): boolean {
        if (!I || !geo) return false
        const inp = I
        const conf = inp.conf
        const cols = inp.cols
        const rows = inp.rows
        const fw = cols * DEV_SSX
        const fh = rows * DEV_SSY
        if (pix.length !== fw * fh * 4) pix = new Uint8Array(fw * fh * 4)
        // The off-screen target covers whole cells, so the view is stretched to the grid.
        const gw = cols * inp.cw
        const gh = rows * inp.cellPx
        const sx = inp.w / gw
        const sy = inp.h / gh
        const m = m4mul(m4clip(sx, sy, sx - 1, 1 - sy), VP)
        // WebGL draws the pass for free but its read-back stalls on some
        // GPUs (and is slow when WebGL is emulated). Both ways are timed over
        // a few frames when WebGL looks slow, and the faster one is kept.
        if (fw * fh !== pickFor) {
            pickFor = fw * fh
            pick = 0
            glMs = glN = cpuMs = cpuN = 0
        }
        const t0 = performance.now()
        const tryCpu = pick === 0 && glN >= 8 && glMs / (glN - 2) > 6
        let usedGL = false
        if (pick !== 2 && !tryCpu)
            usedGL = renderGL(geo, m, fw, fh, conf, gw, gh)
        if (!usedGL) {
            if (zbuf.length !== fw * fh) zbuf = new Float32Array(fw * fh)
            devRasterCPU(
                geo,
                m,
                eye,
                fw,
                fh,
                pix,
                zbuf,
                conf.creaseCos,
                conf.minEdge,
                conf.details,
                gw,
                gh,
                extras
            )
        }
        path = usedGL ? "GL" : "CPU"
        if (pick === 0 && !staticMode) {
            const dt = performance.now() - t0
            if (usedGL) {
                // The first frames compile shaders and upload the model.
                if (++glN > 2) glMs += dt
                if (glN >= 8 && glMs / (glN - 2) <= 6) pick = 1
            } else if (tryCpu) {
                cpuMs += dt
                if (++cpuN >= 6) pick = cpuMs / cpuN < glMs / (glN - 2) ? 2 : 1
            }
        }

        slot.dens.fill(0)
        devLit.length = 0
        const NS = DEV_SSX * DEV_SSY
        const scrV = conf.screenTone * (0.5 + 0.4 * conf.screenTone)
        const mix =
            conf.scramble && !inp.reduced && !staticMode ? st.bridge * 0.6 : 0
        const tick = Math.floor(inp.time * 22)
        const ink = inp.ink
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                let nb = 0
                let lum = 0
                let scrN = 0
                let cnt = 0
                let dx = 0
                let dy = 0
                for (let y = 0; y < DEV_SSY; y++) {
                    let p =
                        (((rows - 1 - r) * DEV_SSY + y) * fw + c * DEV_SSX) * 4
                    for (let x = 0; x < DEV_SSX; x++, p += 4) {
                        const R = pix[p]
                        if (R) {
                            nb++
                            lum += R
                            if (pix[p + 1] > 127) scrN++
                        }
                        const B = pix[p + 2]
                        if (B) {
                            cnt++
                            dx += DEV_DIR_COS[B]
                            dy += DEV_DIR_SIN[B]
                        }
                    }
                }
                if (!nb) continue
                // The surface tone picks the character from the ramp, like every other
                // ASCII shape on the page: a tonal mask, not a line drawing.
                const l = lum / nb / 255
                const full =
                    (scrN * 2 > nb
                        ? scrV
                        : conf.bodyTone * Math.pow(1 - l, 1.1) * 2.1) *
                    (nb / NS)
                if (full > 0.12) devLit.push(r * cols + c)
                let v = full * devFade
                let code = 0
                if (reveal < 1) {
                    // Entrance: cells assemble diagonally with a little noise.
                    const th = 0.55 * (0.62 * (c / cols) + 0.38 * (r / rows)) + 0.45 * hash2(c, r * 1.3)
                    if (th > reveal * 1.08) continue
                    v *= clamp01((reveal * 1.08 - th) / 0.08)
                }
                if (v <= 0.04) continue
                if (
                    mix > 0.02 &&
                    hash2(c + tick * 0.13, r * 1.7 + tick) < mix * 0.55
                )
                    code = 6
                const idx = r * cols + c
                slot.dens[idx] = Math.min(1, v)
                slot.cls[idx] = 3 | 0x40 | (code << 3)
                slot.rgb[idx * 3] = ink[0]
                slot.rgb[idx * 3 + 1] = ink[1]
                slot.rgb[idx * 3 + 2] = ink[2]
            }
        }
        return true
    }
    // ── Glyph sprites with real blur (depth of field) ────────────────────────
    const sprites = new Map<string, HTMLCanvasElement>()
    function sprite(g: string, col: string, lvl: number): HTMLCanvasElement {
        const key = g + "|" + col + "|" + lvl
        let s = sprites.get(key)
        if (s) return s
        const b = SPRITE_BLUR[lvl]
        const pad = Math.ceil(b * 2.2) + 6
        const size = SPRITE_PX + pad * 2
        s = document.createElement("canvas")
        s.width = size
        s.height = size
        const x = s.getContext("2d")
        if (x) {
            x.font = `500 ${SPRITE_PX * 0.9}px ${FONT_STACK}`
            x.textAlign = "center"
            x.textBaseline = "middle"
            // Soft knock-out in the page colour, so glyphs stay readable over the dark device.
            x.save()
            x.shadowColor = bgCss
            x.shadowBlur = 4 + b
            x.shadowOffsetX = 4000
            x.fillStyle = bgCss
            x.globalAlpha = 0.5
            x.fillText(g, size / 2 - 4000, size / 2)
            x.restore()
            x.fillStyle = col
            if (b > 0) {
                x.shadowColor = col
                x.shadowBlur = b * 2
                x.shadowOffsetX = 4000
                x.fillText(g, size / 2 - 4000, size / 2)
            } else {
                x.fillText(g, size / 2, size / 2)
            }
        }
        sprites.set(key, s)
        return s
    }
    function blurLevel(z: number): number {
        if (!I || I.conf.dof <= 0 || I.reduced) return 0
        const d = Math.max(0, Math.abs(z / pose.F - focus) - I.conf.range)
        const px = I.conf.dof * d * 30
        let l = 0
        while (l < SPRITE_BLUR.length - 1 && SPRITE_BLUR[l + 1] <= px) l++
        return l
    }
    function glyph(
        c2d: CanvasRenderingContext2D,
        g: string,
        x: number,
        y: number,
        size: number,
        a: number,
        z: number,
        col: string
    ) {
        const l = blurLevel(z)
        const s = sprite(g, col, l)
        const k = size / SPRITE_PX
        c2d.globalAlpha = clamp01(a / (1 + l * 0.12))
        c2d.drawImage(
            s,
            x - (s.width * k) / 2,
            y - (s.height * k) / 2,
            s.width * k,
            s.height * k
        )
    }

    // ── Element raster: shapes at (fine) glyph-cell resolution, printed as glyphs ──
    // Detailed elements use a smaller cell than the device: finer characters read
    // as detail, and the two scales give the scene depth.
    const rsC = document.createElement("canvas")
    const rsX = rsC.getContext("2d", { willReadFrequently: true })
    const rcC = document.createElement("canvas")
    const rcX = rcC.getContext("2d", { willReadFrequently: true })
    let rcell = 8
    let rcw = 5
    let rcols = 1
    let rrows = 1
    const gray = (v: number) => {
        const c = Math.round(clamp01(v) * 255)
        return `rgb(${c},${c},${c})`
    }
    // Colour classes: grey = ink, (v, .55v, 0) = accent, (0, v, v) = light ink on a screen,
    // (v, 0, v) = accent on a screen, (0, v, 0) = the checkmark colour.
    const accC = (v: number) =>
        `rgb(${Math.round(clamp01(v) * 255)},${Math.round(clamp01(v) * 140)},0)`
    const greenC = (v: number) => `rgb(0,${Math.round(clamp01(v) * 255)},0)`
    const scrC = (v: number) => {
        if (I && !I.conf.panel) return gray(v)
        const c = Math.round(clamp01(v) * 255)
        return `rgb(0,${c},${c})`
    }
    const saccC = (v: number) => {
        if (I && !I.conf.panel) return accC(v)
        const c = Math.round(clamp01(v) * 255)
        return `rgb(${c},0,${c})`
    }
    function rasterBegin() {
        if (!I || !rsX || !rcX) return
        rcell = Math.max(5, Math.round(I.cellPx * I.conf.detail))
        rcw = rcell * (I.cw / Math.max(1, I.cellPx))
        rcols = Math.max(1, Math.ceil(I.w / rcw))
        rrows = Math.max(1, Math.ceil(I.h / rcell))
        for (const [c, x] of [
            [rsC, rsX],
            [rcC, rcX],
        ] as Array<[HTMLCanvasElement, CanvasRenderingContext2D]>) {
            if (c.width !== rcols || c.height !== rrows) {
                c.width = rcols
                c.height = rrows
            }
            x.setTransform(1, 0, 0, 1, 0, 0)
            x.clearRect(0, 0, rcols, rrows)
            x.setTransform(1 / rcw, 0, 0, 1 / rcell, 0, 0)
        }
    }
    function poly(
        x: CanvasRenderingContext2D,
        pts: ArrayLike<ArrayLike<number>>,
        close: boolean
    ) {
        x.beginPath()
        for (let i = 0; i < pts.length; i++) {
            if (i) x.lineTo(pts[i][0], pts[i][1])
            else x.moveTo(pts[i][0], pts[i][1])
        }
        if (close) x.closePath()
    }
    function boxBlur(
        v: Float32Array,
        cols: number,
        rows: number,
        r: number
    ): Float32Array {
        const R = Math.max(1, Math.round(r))
        const Rv = Math.max(1, Math.round(r / 1.6))
        const tmp = new Float32Array(v.length)
        const out = new Float32Array(v.length)
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                let s = 0
                let n = 0
                for (let k = -R; k <= R; k++) {
                    const xx = x + k
                    if (xx >= 0 && xx < cols) {
                        s += v[y * cols + xx]
                        n++
                    }
                }
                tmp[y * cols + x] = s / n
            }
        }
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                let s = 0
                let n = 0
                for (let k = -Rv; k <= Rv; k++) {
                    const yy = y + k
                    if (yy >= 0 && yy < rows) {
                        s += tmp[yy * cols + x]
                        n++
                    }
                }
                out[y * cols + x] = s / n
            }
        }
        return out
    }
    function rasterPrint(
        c2d: CanvasRenderingContext2D,
        blurCells: number,
        alpha: number
    ) {
        if (!I || !rsX || !rcX || alpha <= 0.001) return
        const cols = rcols
        const rows = rrows
        const n = cols * rows
        const ds = rsX.getImageData(0, 0, cols, rows).data
        const dc = rcX.getImageData(0, 0, cols, rows).data
        let cv: Float32Array = new Float32Array(n)
        let cov: Float32Array = new Float32Array(n)
        let any = false
        for (let i = 0; i < n; i++) {
            const k = i * 4
            if (dc[k + 3] > 0) {
                cv[i] =
                    (Math.max(dc[k], dc[k + 1], dc[k + 2]) / 255) *
                    (dc[k + 3] / 255)
                cov[i] = dc[k + 3] / 255
                any = true
            }
        }
        const blurred = any && blurCells > 0.05
        if (blurred) {
            cv = boxBlur(cv, cols, rows, blurCells)
            cov = boxBlur(cov, cols, rows, blurCells)
        }
        const ramp = I.ramp
        const r0 = ramp[0] === " " ? 1 : 0
        const nR = Math.max(1, ramp.length - r0)
        const colOf = [inkCss, accCss, scrInk, scrAcc, greenCss]
        const soft = 1 / (1 + blurCells * 0.25)
        c2d.save()
        c2d.font = `500 ${rcell}px ${FONT_STACK}`
        c2d.textAlign = "left"
        c2d.textBaseline = "top"
        // The card is solid: it knocks out what is behind it before its glyphs are printed.
        if (any) {
            c2d.fillStyle = bgCss
            for (let i = 0; i < n; i++) {
                if (cov[i] > 0.04) {
                    c2d.globalAlpha = Math.min(1, cov[i] * 1.6) * alpha
                    c2d.fillRect(
                        (i % cols) * rcw,
                        Math.floor(i / cols) * rcell,
                        rcw + 0.5,
                        rcell + 0.5
                    )
                }
            }
        }
        let cur = ""
        for (let i = 0; i < n; i++) {
            const k = i * 4
            const vs =
                ds[k + 3] > 0
                    ? (Math.max(ds[k], ds[k + 1], ds[k + 2]) / 255) *
                      (ds[k + 3] / 255)
                    : 0
            const vc = any ? Math.min(1, cv[i] * (blurred ? 1.25 : 1)) : 0
            const useC = any && (cov[i] > 0.3 || vc > vs)
            const v = useC ? vc : vs
            if (v < 0.04) continue
            let cls = 0
            if (!useC) {
                const r = ds[k],
                    g = ds[k + 1],
                    b = ds[k + 2]
                cls =
                    r < g * 0.3 && b < g * 0.3
                        ? 4
                        : r < g * 0.3
                          ? 2
                          : g < r * 0.3 && b > r * 0.6
                            ? 3
                            : b < r * 0.35
                              ? 1
                              : 0
            }
            const col = colOf[cls]
            if (col !== cur) {
                cur = col
                c2d.fillStyle = col
            }
            c2d.globalAlpha = clamp01(0.35 + v) * (useC ? soft : 1) * alpha
            c2d.fillText(
                ramp[r0 + Math.min(nR - 1, Math.floor(v * nR))],
                (i % cols) * rcw,
                Math.floor(i / cols) * rcell
            )
        }
        c2d.restore()
    }

    // ── QR code on the customer display: fine ASCII, dissolving module by module into the data stream ──
    function rasterQR(alpha: number) {
        qrPos.length = 0
        if (!I || !rsX) return
        const el = I.conf.el
        const inP = EASE_ARRIVE(elRamp(I.L, el.qrIn))
        const toNav = elRamp(I.L, el.toNav)
        const sq = devQuad(0)
        const a = sq.avail * alpha
        if (inP <= 0 || a <= 0.001) return
        const qm = quadMatrix(sq.q)
        const n = QR_N
        const qv0 = 0.05
        const qv1 = 0.95
        const qh = (qv1 - qv0) * (geo ? geo.aspect[0] : 9 / 16)
        const qu0 = (1 - qh) / 2
        const rs = rsX
        rs.save()
        rs.fillStyle = accC(1)
        for (let r = 0; r < n; r++) {
            for (let c = 0; c < n; c++) {
                if (!QR_BITS[r * n + c]) continue
                const th = 0.6 * (Math.hypot(c - 10, r - 10) / 14) + 0.4 * shash(c, r + 40)
                const u0 = qu0 + (c / n) * qh
                const u1 = qu0 + ((c + 1) / n) * qh
                const v0 = qv0 + (r / n) * (qv1 - qv0)
                const v1 = qv0 + ((r + 1) / n) * (qv1 - qv0)
                const pc = applyMatrix(qm, (u0 + u1) / 2, (v0 + v1) / 2)
                qrPos.push([pc[0], pc[1], th])
                const bIn = I.reduced ? inP : clamp01((inP * 1.3 - th) / 0.3)
                if (bIn <= 0) continue
                if (toNav * 1.15 > th) continue // this module has left as data
                rs.globalAlpha = a * bIn
                poly(rs, [applyMatrix(qm, u0, v0), applyMatrix(qm, u1, v0), applyMatrix(qm, u1, v1), applyMatrix(qm, u0, v1)], true)
                rs.fill()
            }
        }
        rs.restore()
    }

    // ── Checkmark on both displays, in the display plane ─────────────────────
    function rasterCheck(alpha: number) {
        if (!I || !rsX) return
        const el = I.conf.el
        const C = elRamp(I.L, el.check) * (1 - EASE_LEAVE(elRamp(I.L, el.checkOff)))
        if (C <= 0.001) return
        const rc = rsX
        for (const kind of [0, 1] as Array<0 | 1>) {
            const lq = devQuad(kind)
            const a = Math.min(1, C * 4) * lq.avail * alpha
            if (a <= 0.01) continue
            const qm = quadMatrix(lq.q)
            const asp = geo ? geo.aspect[kind] : 0.6
            const cu = 0.5
            const cvv = 0.5
            const rv = 0.36
            const ru = rv * asp
            const P = (u: number, v: number): Vec2 => applyMatrix(qm, cu + u * ru, cvv + v * rv)
            const ringP = I.reduced ? 1 : EASE_ARRIVE(clamp01(C / 0.55))
            const N2 = 72
            rc.save()
            rc.globalAlpha = a
            rc.lineCap = "round"
            rc.lineJoin = "round"
            if (C >= 1) {
                rc.fillStyle = greenC(0.26)
                rc.beginPath()
                for (let i = 0; i <= N2; i++) {
                    const t = (i / N2) * Math.PI * 2
                    const p = P(Math.cos(t), Math.sin(t))
                    if (i) rc.lineTo(p[0], p[1])
                    else rc.moveTo(p[0], p[1])
                }
                rc.fill()
            }
            rc.strokeStyle = greenC(1)
            rc.lineWidth = rcw * 1.7
            rc.beginPath()
            for (let i = 0; i <= Math.round(N2 * ringP); i++) {
                const t = -Math.PI / 2 + (i / N2) * Math.PI * 2
                const p = P(Math.cos(t), Math.sin(t))
                if (i) rc.lineTo(p[0], p[1])
                else rc.moveTo(p[0], p[1])
            }
            rc.stroke()
            const pts = CHECK_PTS.map(([x, y]) => P(x, y))
            const cp = I.reduced ? (C > 0.5 ? 1 : 0) : EASE_ARRIVE(clamp01((C - 0.4) / 0.5))
            if (cp > 0) {
                const l1 = Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1])
                const l2 = Math.hypot(pts[2][0] - pts[1][0], pts[2][1] - pts[1][1])
                let len = cp * (l1 + l2)
                rc.lineWidth = rcw * 2.1
                rc.beginPath()
                rc.moveTo(pts[0][0], pts[0][1])
                if (len <= l1) {
                    rc.lineTo(lerp(pts[0][0], pts[1][0], len / l1), lerp(pts[0][1], pts[1][1], len / l1))
                } else {
                    rc.lineTo(pts[1][0], pts[1][1])
                    len -= l1
                    rc.lineTo(lerp(pts[1][0], pts[2][0], len / l2), lerp(pts[1][1], pts[2][1], len / l2))
                }
                rc.stroke()
            }
            rc.restore()
        }
    }

    // ── Credit card: a 3D slab, shaded per face, blurred by its distance from the focus ──
    function rasterCard(alpha: number): number {
        if (!I || !rcX || !rsX) return 0
        const el = I.conf.el
        const Ain = elRamp(I.L, el.cardIn)
        const T = elRamp(I.L, el.cardTap)
        const X = elRamp(I.L, el.cardOut)
        if (Ain <= 0 || X >= 1 || alpha <= 0.001) return 0
        const rc = rcX
        const lq = devQuad(1)
        const S3: Vec3 =
            lq.avail > 0
                ? at3(...applyMatrix(quadMatrix(lq.q), 0.5, 0.5))
                : [pose.cx, pose.cy, pose.z]
        const F = pose.F
        const fh = pose.fh
        const D = Math.PI / 180
        const start = [0.85 * fh, -0.62 * fh, 0.62 * F, 40, -32, 24]
        const end = [0.02 * fh, 0, 0.1 * F, 9, -6, -7]
        const mixP = (a: number[], b: number[], t: number) =>
            a.map((v, i) => lerp(v, b[i], t))
        let Pp = mixP(start, end, EASE_MOVE(Ain))
        Pp[2] -= Math.sin(Math.PI * T) * 0.06 * F
        // The exit is subtler than the entrance: a short retreat while it fades.
        if (X > 0) Pp = mixP(Pp, mixP(end, start, 0.22), EASE_LEAVE(X))
        const wob = I.reduced ? 0 : (1 - T) * (1 - X) * 1.2
        Pp[3] += Math.sin(I.time * 1.1) * wob
        Pp[4] += Math.sin(I.time * 0.8 + 1) * wob * 0.7
        const a =
            EASE_ARRIVE(Math.min(1, Ain * 3)) * (1 - EASE_LEAVE(X)) * alpha
        const cw = 0.44 * fh
        const ch = cw / 1.586
        const ct = Math.max(3, cw * 0.04)
        const yaw = Pp[3] * D
        const pitch = Pp[4] * D
        const roll = Pp[5] * D
        const W0: Vec3 = [S3[0] + Pp[0], S3[1] + Pp[1], S3[2] + Pp[2]]
        const toS = (lx: number, ly: number, lz: number): Vec3 => {
            const r = rot3([lx, ly, lz], yaw, pitch, roll)
            return project(W0[0] + r[0], W0[1] + r[1], W0[2] + r[2])
        }
        const nrm = rot3([0, 0, 1], yaw, pitch, roll)
        const frontNear = nrm[2] >= 0
        const Ld: Vec3 = [-0.35, -0.55, 0.76]
        const shade = Math.max(
            0,
            (frontNear ? 1 : -1) *
                (nrm[0] * Ld[0] + nrm[1] * Ld[1] + nrm[2] * Ld[2])
        )
        const outline = roundRectPts(cw, ch, cw * 0.065, 5)
        const front = outline.map(([x, y]) => toS(x, y, ct / 2))
        const back = outline.map(([x, y]) => toS(x, y, -ct / 2))
        const near = frontNear ? front : back
        const far = frontNear ? back : front
        const zN = frontNear ? ct / 2 : -ct / 2
        rc.save()
        rc.globalAlpha = a
        rc.fillStyle = gray(0.12)
        poly(rc, far, true)
        rc.fill()
        for (let i = 0; i < outline.length; i++) {
            const j = (i + 1) % outline.length
            const rn = rot3(
                [
                    outline[j][1] - outline[i][1],
                    -(outline[j][0] - outline[i][0]),
                    0,
                ],
                yaw,
                pitch,
                roll
            )
            const ln = Math.hypot(rn[0], rn[1], rn[2]) || 1
            rc.fillStyle = gray(
                0.5 +
                    0.45 *
                        Math.max(
                            0,
                            (rn[0] * Ld[0] + rn[1] * Ld[1] + rn[2] * Ld[2]) / ln
                        )
            )
            poly(rc, [front[i], front[j], back[j], back[i]], true)
            rc.fill()
        }
        rc.fillStyle = gray(0.05 + 0.1 * shade)
        poly(rc, near, true)
        rc.fill()
        rc.strokeStyle = gray(1)
        rc.lineWidth = I.cw * 1.15
        poly(rc, near, true)
        rc.stroke()
        const pl = (pts: Vec2[], close: boolean) =>
            poly(
                rc,
                pts.map(([x, y]) => toS(x, y, zN)),
                close
            )
        if (frontNear) {
            rc.fillStyle = gray(0.85)
            pl(
                [
                    [-0.38 * cw, -0.16 * ch],
                    [-0.2 * cw, -0.16 * ch],
                    [-0.2 * cw, 0.1 * ch],
                    [-0.38 * cw, 0.1 * ch],
                ],
                true
            )
            rc.fill()
            rc.strokeStyle = gray(0.9)
            rc.lineWidth = I.cw * 0.6
            for (let k = 0; k < 3; k++) {
                const r = (0.05 + k * 0.035) * cw
                const arc: Vec2[] = []
                for (let j = 0; j <= 10; j++) {
                    const t = (-40 + 8 * j) * D
                    arc.push([
                        -0.06 * cw + Math.cos(t) * r,
                        -0.03 * ch + Math.sin(t) * r,
                    ])
                }
                pl(arc, false)
                rc.stroke()
            }
            rc.strokeStyle = gray(0.75)
            for (let g = 0; g < 4; g++) {
                const x0 = -0.4 * cw + g * 0.2 * cw
                pl(
                    [
                        [x0, 0.24 * ch],
                        [x0 + 0.15 * cw, 0.24 * ch],
                    ],
                    false
                )
                rc.stroke()
            }
            for (const dx of [0.24, 0.33]) {
                const ring: Vec2[] = []
                for (let j = 0; j <= 20; j++) {
                    const t = (j / 20) * Math.PI * 2
                    ring.push([
                        dx * cw + Math.cos(t) * 0.075 * cw,
                        0.3 * ch + Math.sin(t) * 0.075 * cw,
                    ])
                }
                pl(ring, true)
                rc.stroke()
            }
        } else {
            rc.fillStyle = gray(0.9)
            pl(
                [
                    [-cw / 2, -0.34 * ch],
                    [cw / 2, -0.34 * ch],
                    [cw / 2, -0.12 * ch],
                    [-cw / 2, -0.12 * ch],
                ],
                true
            )
            rc.fill()
            rc.strokeStyle = gray(0.7)
            rc.lineWidth = I.cw * 0.6
            pl(
                [
                    [-0.4 * cw, 0.04 * ch],
                    [0.14 * cw, 0.04 * ch],
                    [0.14 * cw, 0.2 * ch],
                    [-0.4 * cw, 0.2 * ch],
                ],
                true
            )
            rc.stroke()
        }
        rc.restore()
        // Contactless waves while tapping: scroll-driven (they reverse exactly), never looping.
        if (T > 0 && T < 1 && X <= 0) {
            const c = toS(0, 0, zN)
            const rs = rsX
            for (let k = 0; k < 3; k++) {
                const f = (T * 1.6 + k / 3) % 1
                const r = (0.14 + f * 0.26) * fh
                rs.save()
                rs.globalAlpha = a * Math.sin(Math.PI * T) * (1 - f)
                rs.strokeStyle = accC(0.9)
                rs.lineWidth = I.cw * 0.6
                rs.beginPath()
                rs.ellipse(c[0], c[1], r, r * 0.78, -0.2, 0, Math.PI * 2)
                rs.stroke()
                rs.restore()
            }
        }
        const d = Math.max(
            0,
            Math.abs((W0[2] - pose.z) / F - focus) - I.conf.range
        )
        return I.reduced ? 0 : Math.min(3.5, I.conf.dof * d * 9)
    }

    // ── NAV node: a non-figurative sink the data flows into ─────────────────
    function sinkPt(): Vec2 {
        if (!I) return [0, 0]
        return [I.w * (I.mobile ? 0.78 : 0.84), I.h * (I.mobile ? 0.14 : 0.2)]
    }
    function rasterSink(alpha: number) {
        if (!I || !rsX) return
        const el = I.conf.el
        const A = EASE_ARRIVE(elRamp(I.L, el.navIn)) * (1 - EASE_LEAVE(elRamp(I.L, el.navOff))) * alpha
        if (A <= 0.01) return
        const [x, y] = sinkPt()
        const R = 0.06 * I.h * (0.6 + 0.4 * A)
        const rs = rsX
        rs.save()
        rs.globalAlpha = A
        const g = rs.createRadialGradient(x, y, 0, x, y, R)
        g.addColorStop(0, accC(1))
        g.addColorStop(0.5, accC(0.6))
        g.addColorStop(1, "rgba(0,0,0,0)")
        rs.fillStyle = g
        rs.beginPath()
        rs.arc(x, y, R, 0, Math.PI * 2)
        rs.fill()
        const breathe = I.reduced ? 0 : 0.04 * Math.sin(I.time * 1.1)
        rs.strokeStyle = gray(0.6)
        rs.lineWidth = rcw * 0.8
        rs.beginPath()
        rs.ellipse(x, y, R * (1.35 + breathe), R * (1.32 + breathe), 0, 0, Math.PI * 2)
        rs.stroke()
        rs.strokeStyle = gray(0.35)
        rs.lineWidth = rcw * 0.6
        rs.beginPath()
        rs.ellipse(x, y, R * (1.75 - breathe), R * (1.7 - breathe), 0, 0, Math.PI * 2)
        rs.stroke()
        rs.restore()
    }
    /** QR modules travel as 0/1 glyphs to the NAV node; later a steady trickle runs from NAV to the phone. */
    function drawStream(c2d: CanvasRenderingContext2D, alpha: number) {
        if (!I || alpha <= 0.001) return
        const el = I.conf.el
        const toNav = elRamp(I.L, el.toNav)
        const [sx, sy] = sinkPt()
        const size = Math.max(7, rcell * 1.15)
        c2d.save()
        if (toNav > 0 && toNav < 1.2 && qrPos.length) {
            for (let i = 0; i < qrPos.length; i++) {
                const [x0, y0, th] = qrPos[i]
                const u = clamp01((toNav * 1.15 - th) / 0.45)
                if (u <= 0 || u >= 1) continue
                const jx = (shash(i, 5) - 0.5) * 0.06 * I.w * u
                const jy = (shash(i, 9) - 0.5) * 0.04 * I.h * u
                const cx = (x0 + sx) / 2
                const cy = Math.min(y0, sy) - 0.16 * I.h
                const x = (1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * sx + jx
                const y = (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * sy + jy
                const a = alpha * Math.min(1, (1 - u) / 0.15) * Math.min(1, u / 0.05)
                glyph(c2d, shash(i, 3) > 0.5 ? "1" : "0", x, y, size * lerp(1.15, 0.85, u), a, 0, accCss)
            }
        }
        // Trickle NAV → phone while the receipt arrives.
        const tr = smoothstep(el.phoneIn[0], el.phoneIn[0] + 30, I.L) * (1 - EASE_LEAVE(elRamp(I.L, el.navOff)))
        if (tr > 0.02 && phone) {
            const top = bodyPt(phone, 0, 0.5)
            for (let k = 0; k < 9; k++) {
                const ph0 = (I.reduced ? 0.3 : I.time * 0.42) + k / 9
                const f = ph0 - Math.floor(ph0)
                const cyc = Math.floor(ph0)
                const x = lerp(sx, top[0], f) + (shash(k, cyc) - 0.5) * 2 * rcw
                const y = lerp(sy + 0.07 * I.h, top[1] - rcell, f)
                glyph(c2d, shash(cyc, k) > 0.5 ? "1" : "0", x, y, size, alpha * tr * Math.sin(Math.PI * f) * 0.9, 0, accCss)
            }
        }
        c2d.restore()
    }

    // ── Phone screen: the e-receipt types in, attachments follow; later the shop's live view ──
    function rasterPhone(alpha: number) {
        if (!I || !rsX || !phone) return
        const el = I.conf.el
        const rs = rsX
        const P = (x: number, y: number) => bodyPt(phone as BodyFrame, x, y)
        const bar = (x0: number, x1: number, y: number, hgt: number, col: string, a: number) => {
            if (a <= 0.01) return
            rs.globalAlpha = a
            rs.fillStyle = col
            poly(rs, [P(x0, y), P(x1, y), P(x1, y - hgt), P(x0, y - hgt)], true)
            rs.fill()
        }
        rs.save()
        if (I.L < el.split[1]) {
            const rec = elRamp(I.L, el.receipt)
            const att = elRamp(I.L, el.attach)
            const rows: Array<[number, number, boolean]> = [
                [0.55, 1, true], [0.9, 0.6, false], [0.6, 0.6, false], [0.8, 0.6, false],
                [0.5, 0.6, false], [0.95, 0.95, true],
            ]
            let y = 0.38
            rows.forEach((rw, k) => {
                const a = clamp01((rec * (rows.length + 1) - k) / 1.2)
                bar(-0.36, -0.36 + 0.72 * rw[0] * a, y, 0.028, rw[2] ? accC(rw[1]) : gray(rw[1]), alpha)
                y -= 0.055
            })
            y -= 0.04
            ;[0.7, 0.5, 0.6].forEach((wd, k) => {
                const a = EASE_ARRIVE(clamp01((att - k * 0.25) / 0.5))
                bar(-0.36, -0.36 + 0.72 * wd, y - 0.02 * (1 - a), 0.028, accC(0.75), alpha * a)
                y -= 0.055
            })
        } else {
            const cnt = elRamp(I.L, [el.panels[0] + 20, el.panels[1] + 20])
            bar(-0.36, -0.36 + 0.5 * cnt, 0.38, 0.028, accC(1), alpha)
            bar(-0.36, -0.36 + 0.72 * cnt, 0.325, 0.028, gray(0.6), alpha)
            // a small live chart
            rs.globalAlpha = alpha * cnt
            rs.strokeStyle = accC(1)
            rs.lineWidth = rcw * 1.1
            rs.beginPath()
            const t = I.reduced ? 1.2 : I.time
            for (let i = 0; i <= 16; i++) {
                const u = i / 16
                const v = clamp01(0.4 + 0.22 * Math.sin(u * 8 + t * 0.35) + 0.1 * Math.sin(u * 19 - t * 0.6) + 0.3 * u)
                const p = P(-0.36 + 0.72 * u * cnt, 0.1 + v * 0.16)
                if (i) rs.lineTo(p[0], p[1])
                else rs.moveTo(p[0], p[1])
            }
            rs.stroke()
            bar(-0.36, -0.36 + 0.6 * cnt, 0.02, 0.028, gray(0.6), alpha)
            bar(-0.36, -0.36 + 0.45 * cnt, -0.035, 0.028, gray(0.6), alpha)
            bar(-0.36, -0.36 + 0.55 * cnt, -0.11, 0.028, accC(0.8), alpha)
        }
        rs.restore()
    }

    // ── Panels: sales chart and stock levels, lifted off the large display ──
    function rasterPanels(alpha: number) {
        if (!I || !rsX || !panels.length) return
        const rs = rsX
        const el = I.conf.el
        rs.save()
        panels.forEach((pn, k) => {
            const P = (x: number, y: number) => bodyPt(pn, x, y)
            const e = pn.e || 0
            const cnt = clamp01((elRamp(I!.L, [el.panels[0] + 30 + k * 20, el.panels[1] + 40 + k * 20]) - 0.0))
            rs.globalAlpha = alpha * e
            rs.strokeStyle = gray(0.8)
            rs.lineWidth = rcw * 0.9
            poly(rs, [P(-0.5, -0.5), P(0.5, -0.5), P(0.5, 0.5), P(-0.5, 0.5)], true)
            rs.stroke()
            if (cnt <= 0) return
            rs.fillStyle = accC(1)
            poly(rs, [P(-0.42, 0.4), P(-0.42 + 0.4 * cnt, 0.4), P(-0.42 + 0.4 * cnt, 0.33), P(-0.42, 0.33)], true)
            rs.fill()
            if (k === 0) {
                rs.strokeStyle = accC(1)
                rs.lineWidth = rcw * 1.2
                rs.beginPath()
                const t = I!.reduced ? 1.2 : I!.time
                for (let i = 0; i <= 24; i++) {
                    const u = i / 24
                    if (u > cnt * 1.2) break
                    const v = clamp01(0.35 + 0.25 * Math.sin(u * 7 + t * 0.35) + 0.1 * Math.sin(u * 17 - t * 0.6) + 0.3 * u)
                    const p = P(-0.42 + 0.84 * u, -0.38 + v * 0.6)
                    if (i) rs.lineTo(p[0], p[1])
                    else rs.moveTo(p[0], p[1])
                }
                rs.stroke()
            } else {
                ;[0.82, 0.31, 0.6, 0.91].forEach((v, j) => {
                    const y = 0.18 - j * 0.17
                    rs.fillStyle = gray(0.6)
                    poly(rs, [P(-0.42, y), P(-0.2, y), P(-0.2, y - 0.07), P(-0.42, y - 0.07)], true)
                    rs.fill()
                    rs.fillStyle = v < 0.4 ? accC(1) : gray(0.85)
                    poly(rs, [P(-0.14, y), P(-0.14 + 0.56 * v * cnt, y), P(-0.14 + 0.56 * v * cnt, y - 0.07), P(-0.14, y - 0.07)], true)
                    rs.fill()
                })
            }
        })
        rs.restore()
    }

    // ── The four old devices: line drawings the device splits into and merges from ──
    interface OldDev {
        aw: number
        parts: Array<{ pts: Vec2[]; closed: boolean } | { dots: Vec2[] }>
    }
    const rect = (x0: number, y0: number, x1: number, y1: number) => ({ pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as Vec2[], closed: true })
    const line = (...pts: Vec2[]) => ({ pts, closed: false })
    const dots = (x0: number, y0: number, x1: number, y1: number, nx: number, ny: number) => {
        const d: Vec2[] = []
        for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) d.push([lerp(x0, x1, nx > 1 ? i / (nx - 1) : 0.5), lerp(y0, y1, ny > 1 ? j / (ny - 1) : 0.5)])
        return { dots: d }
    }
    const OLD: OldDev[] = [
        { aw: 1.15, parts: [rect(0, 0, 1.15, 0.66), rect(0.08, 0.07, 1.07, 0.58), line([0.5, 0.66], [0.45, 0.88]), line([0.65, 0.66], [0.7, 0.88]), rect(0.25, 0.88, 0.9, 0.97)] },
        { aw: 1.0, parts: [{ pts: [[0, 1], [0.08, 0.42], [0.92, 0.42], [1, 1]], closed: true }, rect(0.6, 0.06, 0.94, 0.28), line([0.77, 0.28], [0.77, 0.42]), { pts: [[0.16, 0.42], [0.16, 0.26], [0.36, 0.26], [0.36, 0.42]], closed: false }, line([0.05, 0.66], [0.95, 0.66]), dots(0.22, 0.74, 0.78, 0.92, 4, 2)] },
        { aw: 0.75, parts: [{ pts: [[0.05, 0.12], [0.68, 0.02], [0.74, 0.22], [0.32, 0.33], [0.08, 0.3]], closed: true }, line([0.69, 0.05], [0.73, 0.19]), { pts: [[0.32, 0.33], [0.42, 0.84], [0.58, 0.82], [0.5, 0.29]], closed: false }, rect(0.18, 0.84, 0.72, 0.96)] },
        { aw: 0.58, parts: [rect(0, 0, 0.58, 1), rect(0.07, 0.07, 0.51, 0.36), dots(0.13, 0.48, 0.45, 0.86, 3, 4), line([0.12, 0.94], [0.46, 0.94])] },
    ]
    const oldCells: number[] = [] // grid cells the outlines cover (targets of the split particles)
    function oldLayout(slide: number): Array<{ x0: number; y0: number; h: number }> {
        if (!I) return []
        const hpx = Math.min(I.h * 0.21, I.w * 0.11) * (1 - 0.28 * slide)
        const gap = I.w * 0.04 * (1 - slide)
        let tot = gap * 3
        for (const d of OLD) tot += d.aw * hpx
        const cx = pose.cx
        const cy = pose.cy
        let x = cx - tot / 2
        return OLD.map((d, k) => {
            const w = d.aw * hpx
            const o = { x0: lerp(x, cx - w / 2, slide * 0.75), y0: cy - hpx / 2 + (I!.reduced ? 0 : Math.sin(I!.time * 0.8 + k * 1.7) * 3), h: hpx }
            x += w + gap
            return o
        })
    }
    function rasterOld(alpha: number) {
        oldCells.length = 0
        if (!I || !rsX) return
        const el = I.conf.el
        const sp = elRamp(I.L, el.split)
        const mg = elRamp(I.L, el.merge)
        const vis = (1 - devFade) * alpha
        if (vis <= 0.01) return
        const slide = smoothstep(0, 0.4, mg)
        const lay = oldLayout(slide)
        const rs = rsX
        rs.save()
        rs.globalAlpha = vis
        rs.strokeStyle = gray(1)
        rs.lineCap = "round"
        rs.lineJoin = "round"
        rs.lineWidth = rcw * 1.1
        OLD.forEach((d, k) => {
            const o = lay[k]
            const T = (p: Vec2): Vec2 => [o.x0 + p[0] * o.h, o.y0 + p[1] * o.h]
            // back edge: a touch of blueprint depth
            const ex = o.h * 0.09
            const ey = -o.h * 0.07
            rs.globalAlpha = vis * 0.4
            const outer = d.parts[0] as { pts: Vec2[]; closed: boolean }
            poly(rs, outer.pts.map((p) => { const q = T(p); return [q[0] + ex, q[1] + ey] }), outer.closed)
            rs.stroke()
            for (const p of outer.pts) {
                const q = T(p)
                poly(rs, [q, [q[0] + ex, q[1] + ey]], false)
                rs.stroke()
            }
            rs.globalAlpha = vis
            for (const p of d.parts) {
                if ("dots" in p) {
                    rs.fillStyle = gray(0.9)
                    for (const q of p.dots) {
                        const s = T(q)
                        rs.fillRect(s[0] - rcw * 0.5, s[1] - rcell * 0.4, rcw, rcell * 0.8)
                    }
                } else {
                    poly(rs, p.pts.map(T), p.closed)
                    rs.stroke()
                }
            }
            // target cells on the main grid, along the outer outline
            const n = outer.pts.length
            for (let i = 0; i < n; i++) {
                const a = T(outer.pts[i])
                const b = T(outer.pts[(i + 1) % n])
                const l = Math.hypot(b[0] - a[0], b[1] - a[1])
                for (let t = 0; t <= l; t += I.cw * 0.7) {
                    const x = lerp(a[0], b[0], t / l)
                    const y = lerp(a[1], b[1], t / l)
                    const c = Math.floor(x / I.cw)
                    const r = Math.floor(y / I.cellPx)
                    if (c >= 0 && r >= 0 && c < I.cols && r < I.rows) oldCells.push(r * I.cols + c)
                }
            }
        })
        rs.restore()
    }
    /** Glyphs travel between the device's cells and the four outlines while it splits or merges. */
    function drawSplit(c2d: CanvasRenderingContext2D, alpha: number) {
        if (!I || I.reduced || alpha <= 0.001 || devLit.length < 3 || oldCells.length < 3) return
        const el = I.conf.el
        const sp = elRamp(I.L, el.split)
        const mg = elRamp(I.L, el.merge)
        let q = 0
        if (sp > 0 && sp < 1) q = sp
        else if (mg > 0 && mg < 1) q = 1 - mg
        else return
        const inp = I
        const N = 520
        const ramp = inp.ramp
        const r0 = ramp[0] === " " ? 1 : 0
        const nR = Math.max(1, ramp.length - r0)
        const size = Math.max(8, inp.cellPx)
        c2d.save()
        for (let i = 0; i < N; i++) {
            const n = shash(i, 13)
            const ti = clamp01(q * 1.5 - n * 0.5)
            if (ti <= 0 || ti >= 1) continue
            const k = devLit[Math.floor(shash(i, 7) * devLit.length) % devLit.length]
            const sx = ((k % inp.cols) + 0.5) * inp.cw
            const sy = (Math.floor(k / inp.cols) + 0.5) * inp.cellPx
            const c = oldCells[Math.floor(shash(i, 29) * oldCells.length) % oldCells.length]
            const tx = ((c % inp.cols) + 0.5) * inp.cw
            const ty = (Math.floor(c / inp.cols) + 0.5) * inp.cellPx
            const e = EASE_MOVE(ti)
            const arc = Math.sin(Math.PI * ti)
            const rr = shash(i, 3)
            const X = lerp(sx, tx, e) + arc * 0.1 * pose.fh * (rr - 0.5)
            const Y = lerp(sy, ty, e) - arc * 0.05 * pose.fh * rr
            const a = smoothstep(0, 0.12, ti) * (1 - smoothstep(0.85, 1, ti)) * alpha
            glyph(c2d, ramp[r0 + Math.floor(shash(i, 17) * nR)] || "+", X, Y, size, a, 0, inkCss)
        }
        c2d.restore()
    }
    /** Remote access: a pulsing dotted link from the large display to the phone. */
    function drawLink(c2d: CanvasRenderingContext2D, alpha: number) {
        if (!I || !phone || alpha <= 0.001) return
        const lk = elRamp(I.L, I.conf.el.link)
        if (lk <= 0) return
        const lq = devQuad(1)
        const c = applyMatrix(quadMatrix(lq.q), 0.5, 0.5)
        const e = bodyPt(phone, -0.5, 0.1)
        const cx = (c[0] + e[0]) / 2
        const cy = Math.max(c[1], e[1]) + 0.18 * I.h
        const steps = 36
        const pts: Vec2[] = []
        for (let i = 0; i <= steps; i++) {
            const u = i / steps
            pts.push([(1 - u) * (1 - u) * c[0] + 2 * (1 - u) * u * cx + u * u * e[0], (1 - u) * (1 - u) * c[1] + 2 * (1 - u) * u * cy + u * u * e[1]])
        }
        c2d.save()
        const t = I.reduced ? 0.3 : I.time * 0.35
        for (let i = 0; i < steps; i++) {
            const u = i / steps
            if (u > lk) break
            const f1 = t - Math.floor(t)
            const f2 = t + 0.5 - Math.floor(t + 0.5)
            const pulse = Math.max(0, 1 - Math.abs(f1 - u) * 12) + Math.max(0, 1 - Math.abs(f2 - u) * 12)
            glyph(c2d, pulse > 0.5 ? "*" : "·", pts[i][0], pts[i][1], Math.max(8, rcell * 1.2), alpha * (0.35 + 0.65 * Math.min(1, pulse)), 0, accCss)
        }
        c2d.restore()
    }

    // ── Hand-over particles: glyphs travel between the device and the neighbouring section's shape ──
    const lit: number[] = []
    function drawHandover(
        c2d: CanvasRenderingContext2D,
        other: GridLayer | null
    ) {
        if (
            !I ||
            I.role === 0 ||
            I.reduced ||
            I.conf.particles <= 0 ||
            devLit.length < 3
        )
            return
        const inp = I
        // q: 0 at the device, 1 at the other section's shape.
        const q = inp.role === 1 ? inp.p : 1 - inp.p
        if (q <= 0 || q >= 1) return
        lit.length = 0
        if (other) {
            const n = inp.cols * inp.rows
            for (let i = 0; i < n; i++) if (other.dens[i] > 0.12) lit.push(i)
        }
        const N = Math.round(700 * inp.conf.particles)
        const nPts = devLit.length
        const ramp = inp.ramp
        const r0 = ramp[0] === " " ? 1 : 0
        const nR = Math.max(1, ramp.length - r0)
        const size = Math.max(8, inp.cellPx)
        c2d.save()
        for (let i = 0; i < N; i++) {
            const n = shash(i, 11)
            const ti = clamp01(q * 1.5 - n * 0.5)
            if (ti <= 0 || ti >= 1) continue
            const k = devLit[Math.floor(shash(i, 7) * nPts) % nPts]
            const sx = ((k % inp.cols) + 0.5) * inp.cw
            const sy = (Math.floor(k / inp.cols) + 0.5) * inp.cellPx
            const rr = shash(i, 3)
            let tx: number
            let ty: number
            if (lit.length > 0) {
                const c = lit[Math.floor(shash(i, 29) * lit.length)]
                tx = ((c % inp.cols) + 0.5) * inp.cw
                ty = (Math.floor(c / inp.cols) + 0.5) * inp.cellPx
            } else {
                // Nothing to land on (Empty section): disperse outward.
                tx = pose.cx + (sx - pose.cx) * 2.4
                ty = pose.cy + (sy - pose.cy) * 2.4
            }
            const e = EASE_MOVE(ti)
            const arc = Math.sin(Math.PI * ti)
            const X = lerp(sx, tx, e) + arc * 0.14 * pose.fh * (rr - 0.5)
            const Y = lerp(sy, ty, e) - arc * 0.06 * pose.fh * rr
            const Z = arc * 0.25 * pose.F * (rr - 0.3)
            const pr = project(X, Y, Z)
            const a =
                smoothstep(0, 0.12, ti) *
                (1 - smoothstep(0.82, 1, ti)) *
                inp.opacity
            glyph(
                c2d,
                ramp[r0 + Math.floor(shash(i, 17) * nR)] || "+",
                pr[0],
                pr[1],
                size * pr[2],
                a,
                Z,
                inkCss
            )
        }
        c2d.restore()
    }

    /** The ASCII elements, on top of the glyph grid the device was printed into. */
    function draw(c2d: CanvasRenderingContext2D, other: GridLayer | null) {
        if (!I) return
        const inp = I
        if (!geo) {
            if (staticMode || !modelUrl) {
                c2d.save()
                c2d.globalAlpha = 0.7
                c2d.fillStyle = inkCss
                c2d.font = `12px ${FONT_STACK}`
                c2d.textAlign = "center"
                c2d.textBaseline = "middle"
                c2d.fillText(
                    !modelUrl
                        ? "Scripted sequence: upload the “Device Model” file"
                        : geoState === 3
                          ? "Device model could not be loaded"
                          : "Loading device model…",
                    inp.w / 2,
                    inp.h / 2
                )
                c2d.restore()
            }
            return
        }
        const op = clamp01(inp.opacity)
        // Elements belong to the device on its own; they fade as it hands over to a neighbour.
        const elA = (1 - smoothstep(0, 0.4, ascii)) * op
        // The contour: a quiet hairline drawing of the edges over the tonal characters.
        if (!staticMode && inp.conf.contour > 0 && devFade > 0.01) {
            const ca = inp.conf.contour * op * devFade * (1 - smoothstep(0, 0.6, ascii)) * (0.2 + 0.8 * reveal)
            const cc = renderContour(geo, inp.w, inp.h, inp.dpr, inp.conf, contourRGB, ca)
            if (cc) {
                c2d.save()
                c2d.globalAlpha = 1
                c2d.drawImage(cc, 0, 0, inp.w, inp.h)
                c2d.restore()
            }
        }
        rasterBegin()
        rasterCheck((1 - smoothstep(0.55, 0.9, ascii)) * op)
        rasterQR(elA)
        rasterSink(elA)
        rasterPhone(elA)
        rasterPanels(elA)
        rasterOld(elA)
        const cardBlur = rasterCard(elA)
        rasterPrint(c2d, cardBlur, 1)
        drawStream(c2d, elA)
        drawSplit(c2d, elA)
        drawLink(c2d, elA)
        drawHandover(c2d, other)
    }

    function hide() {
        I = null
    }

    function preload(conf: ScriptConf) {
        setModel(conf.model)
    }

    function dispose() {
        disposed = true
        sprites.clear()
        dropBuffers()
        if (gl) {
            if (fboTex) gl.deleteTexture(fboTex)
            if (fboDepth) gl.deleteRenderbuffer(fboDepth)
            if (fbo) gl.deleteFramebuffer(fbo)
            if (pMesh) gl.deleteProgram(pMesh)
            if (pLine) gl.deleteProgram(pLine)
            if (pLineC) gl.deleteProgram(pLineC)
            if (bufExtra) gl.deleteBuffer(bufExtra)
            if (vaoExtra) gl.deleteVertexArray(vaoExtra)
            const ext = gl.getExtension("WEBGL_lose_context")
            if (ext) ext.loseContext()
        }
        if (glc) {
            glc.removeEventListener("webglcontextlost", onLost)
            glc.removeEventListener("webglcontextrestored", onRestored)
        }
        gl = null
        glc = null
        geo = null
    }

    return {
        preload,
        update,
        cells,
        draw,
        hide,
        status: () => statusText,
        dispose,
    }
}

// ─── Component ───────────────────────────────────────────────────────────────

/** One source in the glyph pass (outgoing or incoming), on the glyph grid. */
interface CellLayer {
    kind: "shape" | "image"
    dens: Float32Array // 0..1 per cell (0 = empty)
    cls: Uint8Array // 0 ink, 1 land, 2 sea, 3 image (| 0x80 accent: scripted device layer)
    rgb: Uint8Array
}

/**
 * FullPageAsciiMotion
 *
 * A single, continuously animated ASCII 3D object that travels and
 * transforms through the page, driven by per-section configuration.
 *
 * @framerIntrinsicWidth 400
 * @framerIntrinsicHeight 300
 *
 * @framerSupportedLayoutWidth any-prefer-fixed
 * @framerSupportedLayoutHeight any-prefer-fixed
 */
export default function FullPageAsciiMotion(props: Props) {
    const settings = withDefaults(props)
    const mountRef = React.useRef<HTMLDivElement>(null)
    const isStatic = useIsStaticRenderer()

    // Live settings: the render loop reads these every frame, so editing a
    // control never tears down the renderer.
    const live = React.useRef<Settings>(settings)
    live.current = settings
    const versionRef = React.useRef(0)
    const redrawRef = React.useRef<(() => void) | null>(null)

    // Any re-render (prop change) bumps the version → remeasure + repaint.
    React.useEffect(() => {
        versionRef.current++
        if (redrawRef.current) redrawRef.current()
    })

    React.useEffect(() => {
        const mountEl = mountRef.current
        if (!mountEl || typeof window === "undefined") return
        if (!live.current.enabled) return

        const staticMode = isStatic
        const layerMode = live.current.layer
        const reducedQuery = window.matchMedia
            ? window.matchMedia("(prefers-reduced-motion: reduce)")
            : null

        // Static environments never get a WebGL context.
        let renderer: THREE.WebGLRenderer | null = null
        if (!staticMode) {
            try {
                renderer = new THREE.WebGLRenderer({
                    antialias: false,
                    alpha: true,
                    powerPreference: "low-power",
                })
                renderer.setClearColor(0x000000, 0)
            } catch (e) {
                renderer = null // falls back to the CPU rasterizer
            }
        }

        // ── Host layer ────────────────────────────────────────────────────
        let host: HTMLDivElement = mountEl
        let ownsHost = false
        if (!staticMode && layerMode === "fixed") {
            host = document.createElement("div")
            host.setAttribute("aria-hidden", "true")
            host.setAttribute("data-full-page-ascii", "")
            const hs = host.style
            hs.position = "fixed"
            hs.top = "0"
            hs.left = "0"
            hs.right = "0"
            hs.bottom = "0"
            hs.overflow = "hidden"
            hs.pointerEvents = live.current.pointerEvents
            hs.zIndex = String(live.current.zIndex)
            hs.contain = "strict"
            document.body.appendChild(host)
            ownsHost = true
        }

        const out = document.createElement("canvas")
        out.setAttribute("aria-hidden", "true")
        const os = out.style
        os.position = "absolute"
        os.left = "0"
        os.top = "0"
        os.width = "100%"
        os.height = "100%"
        os.display = "block"
        os.pointerEvents = "none"
        host.appendChild(out)
        const ctxMaybe = out.getContext("2d")
        if (!ctxMaybe) {
            if (out.parentNode) out.parentNode.removeChild(out)
            if (ownsHost && host.parentNode) host.parentNode.removeChild(host)
            if (renderer) renderer.dispose()
            return
        }
        const c2d: CanvasRenderingContext2D = ctxMaybe
        const colorOf = (v: string): RGBA =>
            parseCssColor(resolveCssVar(v, host))

        // ── Scene ─────────────────────────────────────────────────────────
        const scene = new THREE.Scene()
        const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 100)
        camera.position.z = CAM_SPAN - live.current.cameraDistance
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.15)
        keyLight.position.set(2, 2, 3)
        const rimLight = new THREE.DirectionalLight(0xffffff, 0.5)
        rimLight.position.set(-3, -1, -2)
        scene.add(keyLight, rimLight, new THREE.AmbientLight(0xffffff, 0.12))

        // Shapes are built lazily and kept for the component's lifetime, so
        // revisiting a section never rebuilds geometry.
        const shapes = new Map<ShapeKey, ShapeInstance>()
        function getShape(k: ShapeKey): ShapeInstance {
            let inst = shapes.get(k)
            if (!inst) {
                inst = buildShape(k)
                shapes.set(k, inst)
                scene.add(inst.root)
            }
            return inst
        }

        // ── Glyph grid ────────────────────────────────────────────────────
        let gw = 0
        let gh = 0
        let gdpr = 0
        let cellPx = 0
        let cw = 0
        let cols = 0
        let rows = 0
        let bufA = new Uint8Array(4)
        let bufB = new Uint8Array(4)
        let rtA: THREE.WebGLRenderTarget | null = null
        let rtB: THREE.WebGLRenderTarget | null = null
        let noise = new Float32Array(1)
        let fade = new Float32Array(1)
        let fadeFor = -1
        let keys = new Uint32Array(1)
        let cells = new Int32Array(1)
        let glyphs: string[] = []
        let sorted = new Int32Array(1)
        let counts = new Int32Array(1)
        let dens = new Float32Array(1)
        let pick = new Uint8Array(1) // 0 empty, 1 from A, 2 from B, 3 scramble
        let rowShift = new Int16Array(1)
        const layerA: CellLayer = {
            kind: "shape",
            dens: new Float32Array(1),
            cls: new Uint8Array(1),
            rgb: new Uint8Array(3),
        }
        const layerB: CellLayer = {
            kind: "shape",
            dens: new Float32Array(1),
            cls: new Uint8Array(1),
            rgb: new Uint8Array(3),
        }
        const imagePalette: string[] = []

        function ensureGrid(w: number, h: number, cell: number, dpr: number) {
            const c = Math.max(6, Math.min(48, Math.round(cell)))
            if (w === gw && h === gh && c === cellPx && dpr === gdpr) return
            gw = w
            gh = h
            gdpr = dpr
            cellPx = c
            cw = c * 0.62
            out.width = Math.max(1, Math.round(w * dpr))
            out.height = Math.max(1, Math.round(h * dpr))
            c2d.setTransform(dpr, 0, 0, dpr, 0, 0)
            cols = Math.max(1, Math.ceil(w / cw))
            rows = Math.max(1, Math.ceil(h / c))
            const n = cols * rows
            bufA = new Uint8Array(n * 4)
            bufB = new Uint8Array(n * 4)
            for (const L of [layerA, layerB]) {
                L.dens = new Float32Array(n)
                L.cls = new Uint8Array(n)
                L.rgb = new Uint8Array(n * 3)
            }
            if (renderer) {
                if (rtA) rtA.setSize(cols, rows)
                else rtA = new THREE.WebGLRenderTarget(cols, rows)
                if (rtB) rtB.setSize(cols, rows)
                else rtB = new THREE.WebGLRenderTarget(cols, rows)
            }
            // Organic noise for the transition front (cells are ~0.62 wide,
            // so x is scaled to keep the blobs round on screen).
            noise = new Float32Array(n)
            for (let y = 0; y < rows; y++) {
                for (let x = 0; x < cols; x++) {
                    noise[y * cols + x] =
                        0.65 * vnoise((x * 0.62) / 6, y / 6) +
                        0.35 * hash2(x * 1.37 + 0.5, y * 2.11 + 0.5)
                }
            }
            fade = new Float32Array(n)
            fadeFor = -1
            keys = new Uint32Array(n)
            cells = new Int32Array(n)
            glyphs = new Array<string>(n).fill("")
            sorted = new Int32Array(n)
            dens = new Float32Array(n)
            pick = new Uint8Array(n)
            rowShift = new Int16Array(rows)
            camera.aspect = w / h
            camera.updateProjectionMatrix()
        }

        // Full Page Motion "quiet area": dims glyphs behind centered content.
        function ensureFade(cf: number) {
            if (cf === fadeFor) return
            fadeFor = cf
            for (let y = 0; y < rows; y++) {
                const ny = (1 - ((y + 0.5) / rows) * 2) * 1.25
                for (let x = 0; x < cols; x++) {
                    const nx = ((x + 0.5) / cols) * 2 - 1
                    const quiet =
                        1 - smoothstep(0.12, 0.78, Math.sqrt(nx * nx + ny * ny))
                    fade[y * cols + x] = 1 - quiet * cf
                }
            }
        }

        let rampSrc = ""
        let ramp: string[] = []
        function getRamp(src: string): string[] {
            const s = src && Array.from(src).length > 1 ? src : " .:*#@"
            if (s !== rampSrc) {
                rampSrc = s
                ramp = Array.from(s)
            }
            return ramp
        }
        let iRampSrc = ""
        let iRamp: string[] = []
        function getImageRamp(src: string): string[] {
            const s = src && Array.from(src).length > 1 ? src : " .:-=+*#%@"
            if (s !== iRampSrc) {
                iRampSrc = s
                iRamp = Array.from(s)
            }
            return iRamp
        }
        let edgeSrc = ""
        let edgeChars: string[] = []
        function getEdgeChars(src: string): string[] {
            const s = src && Array.from(src).length >= 4 ? src : "-\\|/"
            if (s !== edgeSrc) {
                edgeSrc = s
                edgeChars = Array.from(s).slice(0, 4)
            }
            return edgeChars
        }

        // ── Images: loading policy ────────────────────────────────────────
        // Uploaded images never compete with the page's own first load:
        // • "nearby" images — the section on screen, the one it's morphing
        //   into, and its neighbors — are requested right away (high prio);
        // • every other image waits until the page has finished loading and
        //   is then fetched ONE at a time in idle time (low priority);
        // • once loaded, each image is prepared (sampled into its ASCII
        //   field) in idle time too, so scrolling into it never stutters.
        let imagesDirty = true
        let fadingIn = false
        let wanted: string[] = [] // image URLs of the current sections, in flow order
        const subscribed = new Set<string>() // URLs requested by this instance
        let pageLoaded = staticMode || document.readyState === "complete"
        let cancelPump: (() => void) | null = null
        const cancelPrep = new Map<string, () => void>()

        function prepareFields(e: ImageEntry) {
            if (e.status !== "ready" || cancelPrep.has(e.src)) return
            const run = () => {
                cancelPrep.delete(e.src)
                const cfg = live.current
                for (const s of normSections(cfg)) {
                    if (s.imageSrc === e.src)
                        getField(e, s.removeBg, cfg.bgTolerance)
                }
                imagesDirty = true
            }
            if (staticMode) run()
            else cancelPrep.set(e.src, scheduleIdle(run, 1500))
        }

        const onImage: ImageListener = (e) => {
            imagesDirty = true
            prepareFields(e)
            pumpQueue()
            if (redrawRef.current) redrawRef.current()
        }

        function requestNow(src: string, priority: "high" | "low") {
            if (!src || subscribed.has(src)) return
            subscribed.add(src)
            const e = requestImage(src, onImage, priority)
            // Already loaded by another instance / earlier mount.
            if (e.status !== "loading") Promise.resolve().then(() => onImage(e))
        }

        /** Background queue: one idle-time download at a time, after load. */
        function pumpQueue() {
            if (staticMode || !pageLoaded || cancelPump) return
            for (const src of wanted) {
                const e = imageCache.get(src)
                if (subscribed.has(src) && e && e.status === "loading") return // one at a time
            }
            const next = wanted.find((src) => !subscribed.has(src))
            if (!next) return
            cancelPump = scheduleIdle(() => {
                cancelPump = null
                requestNow(next, "low")
                pumpQueue()
            }, 2000)
        }

        const onPageLoad = () => {
            pageLoaded = true
            pumpQueue()
        }
        if (!pageLoaded) window.addEventListener("load", onPageLoad)

        /** Keep the wanted list in sync with the Sections control. */
        function syncImages(list: NormSection[]) {
            const next: string[] = []
            for (const s of list)
                if (s.imageSrc && next.indexOf(s.imageSrc) < 0)
                    next.push(s.imageSrc)
            wanted = next
            subscribed.forEach((src) => {
                if (next.indexOf(src) < 0) {
                    releaseImage(src, onImage)
                    subscribed.delete(src)
                }
            })
            pumpQueue()
        }

        /** Request the images around the current position immediately. */
        function ensureNearby(secs: NormSection[], ia: number, ib: number) {
            const lo = Math.max(0, Math.min(ia, ib) - 1)
            const hi = Math.min(secs.length - 1, Math.max(ia, ib) + 1)
            for (let i = lo; i <= hi; i++) {
                if (secs[i].imageSrc) requestNow(secs[i].imageSrc, "high")
            }
        }

        function imageStatus(sec: NormSection): string {
            if (!sec.imageSrc) return "image: none (empty)"
            const e = imageCache.get(sec.imageSrc)
            if (!subscribed.has(sec.imageSrc) || !e)
                return "image queued (after page load)"
            if (e.status === "loading") return "image loading…"
            if (e.status === "error") return `image ✗ ${e.error}`
            return `image ✓ ${e.width}×${e.height}${e.fields.size ? "" : " (preparing)"}`
        }

        function stopImages() {
            if (cancelPump) cancelPump()
            cancelPump = null
            cancelPrep.forEach((cancel) => cancel())
            cancelPrep.clear()
            window.removeEventListener("load", onPageLoad)
            subscribed.forEach((src) => releaseImage(src, onImage))
            subscribed.clear()
        }

        // ── Motion state ──────────────────────────────────────────────────
        const cur = makeState()
        const target = makeState()
        const tmp = makeState()
        const pair: ShapePair = { a: "knot", b: "knot", p: 0, ia: 0, ib: 0 }
        let track: Track = {
            mode: "progress",
            sections: [normSection(null, 0)],
            zones: [[0, 0]],
        }
        let scrollable = 1
        let rot = 0
        let time = 0
        let mx = 0.2
        let my = 0.05
        let tx = 0.2
        let ty = 0.05
        let reducedNow = false
        const palette: string[] = []
        // Scripted sequence: engine (created on first use), idle clock, debug status.
        let script: ScriptEngine | null = null
        let scriptUsed = false // a scripted section was rendered this frame
        let scriptOp = 1 // opacity of the scripted device's cells
        let scriptOther: 0 | 1 | 2 = 0 // which layer is the scripted one (1 = A, 2 = B)
        let sTime = 0
        const scriptStatus: string[] = []
        let liveScrollY = 0 // smoothed scroll, read by the script timeline

        /** [ink gradient G] [accent] [land] [sea] [duotone DUO_STEPS] */
        function buildPalette(cfg: Settings): number {
            palette.length = 0
            const ink = colorOf(cfg.inkColor)
            const steps = cfg.gradient ? GRAD_STEPS : 1
            const ink2 = cfg.gradient ? colorOf(cfg.inkColor2) : ink
            for (let i = 0; i < steps; i++) {
                const t = steps > 1 ? i / (steps - 1) : 0
                palette.push(
                    rgbaString([
                        lerp(ink[0], ink2[0], t),
                        lerp(ink[1], ink2[1], t),
                        lerp(ink[2], ink2[2], t),
                        lerp(ink[3], ink2[3], t),
                    ])
                )
            }
            const ga = colorOf(cfg.accentColor)
            const acc: RGBA = [cur.ar, cur.ag, cur.ab, ga[3]]
            palette.push(rgbaString(acc))
            palette.push(rgbaString(colorOf(cfg.landColor)))
            palette.push(rgbaString(colorOf(cfg.seaColor)))
            for (let i = 0; i < DUO_STEPS; i++) {
                const t = i / (DUO_STEPS - 1)
                palette.push(
                    rgbaString([
                        lerp(ink[0], acc[0], t),
                        lerp(ink[1], acc[1], t),
                        lerp(ink[2], acc[2], t),
                        lerp(ink[3], acc[3], t),
                    ])
                )
            }
            return steps
        }

        /**
         * GL/CPU pixel buffer (bottom-up) → cell layer: glyph density = lit
         * luminance; Earth's channel encoding → land / sea classes. Glitch
         * row offsets are applied while reading.
         */
        function shapeToCells(buf: Uint8Array, L: CellLayer, earth: boolean) {
            L.kind = "shape"
            L.dens.fill(0)
            for (let y = 0; y < rows; y++) {
                const srcRow = (rows - 1 - y) * cols // GL reads bottom-up
                const sh = rowShift[y]
                for (let x = 0; x < cols; x++) {
                    const sx = x + sh
                    if (sx < 0 || sx >= cols) continue
                    const bi = (srcRow + sx) * 4
                    const r = buf[bi]
                    const b = buf[bi + 2]
                    const lum =
                        (r * 0.2126 + buf[bi + 1] * 0.7152 + b * 0.0722) / 255
                    if (lum < MIN_LUM) continue
                    const idx = y * cols + x
                    L.dens[idx] = lum
                    // Lighting is white, so encoded channel ratios survive:
                    // red-dominant = land, blue-dominant = sea, neutral = ice.
                    L.cls[idx] = earth
                        ? r > b * 1.15
                            ? 1
                            : b > r * 1.15
                              ? 2
                              : 0
                        : 0
                }
            }
        }

        // ── Glyph pass ────────────────────────────────────────────────────
        // The outgoing (A) and incoming (B) layer — 3D shape or image — are
        // combined per cell through a noise-shaped transition front; cells
        // on the front show scrambled glyphs. Shapes keep their original
        // character mapping and colors; images get their own ramp, edge
        // glyphs and color mode. Draw calls are bucketed by color × alpha to
        // minimize canvas state changes.
        function drawCells(
            cfg: Settings,
            A: CellLayer | null,
            B: CellLayer | null,
            dual: boolean,
            p: number,
            shapeToShape: boolean,
            scrambleOn: boolean
        ) {
            c2d.globalAlpha = 1
            c2d.clearRect(0, 0, gw, gh)
            const bg = colorOf(cfg.backgroundColor)
            if (bg[3] > 0) {
                c2d.fillStyle = rgbaString(bg)
                c2d.fillRect(0, 0, gw, gh)
            }
            const opacity = clamp01(cfg.intensity) * clamp01(cur.opacity)
            if ((opacity <= 0.001 && !scriptUsed) || (!A && !B)) return
            const n = cols * rows
            const dA = A ? A.dens : null
            const dB = dual && B ? B.dens : null

            // ── Combine through the transition front ─────────────────────
            dens.fill(0)
            pick.fill(0)
            // Two 3D shapes have melted into the shared sphere mid-way, so
            // their swap is concentrated around the middle of the morph.
            const pf = shapeToShape ? smoothstep(0.22, 0.78, p) : p
            const W = FRONT_WIDTH
            const P = pf * (1 + 2 * W) - W
            const style = cfg.transitionStyle
            const ccx = (cur.x / 100) * cols
            const ccy = (cur.y / 100) * rows
            const rr = Math.max(
                4,
                Math.min(cols * 0.62, rows) * 0.45 * Math.max(0.3, cur.scale)
            )
            for (let idx = 0; idx < n; idx++) {
                const a = dA ? dA[idx] : 0
                if (!dual) {
                    if (a > 0) {
                        dens[idx] = a
                        pick[idx] = 1
                    }
                    continue
                }
                const b = dB ? dB[idx] : 0
                if (a <= 0 && b <= 0) continue
                if (reducedNow) {
                    const v = p < 0.5 ? a : b
                    if (v > 0) {
                        dens[idx] = v
                        pick[idx] = p < 0.5 ? 1 : 2
                    }
                    continue
                }
                const nz = noise[idx]
                let m: number
                if (style === "dissolve") {
                    m = nz
                } else if (style === "wipe") {
                    m =
                        0.8 * (1 - ((idx / cols) | 0) / Math.max(1, rows - 1)) +
                        0.2 * nz
                } else if (style === "radial") {
                    const ddx = ((idx % cols) - ccx) * 0.62
                    const ddy = ((idx / cols) | 0) - ccy
                    m =
                        0.8 * clamp01(Math.sqrt(ddx * ddx + ddy * ddy) / rr) +
                        0.2 * nz
                } else {
                    // Dense parts of the incoming layer appear first, dense
                    // parts of the outgoing one hold on longest.
                    m = 0.45 * nz + 0.55 * clamp01(1 - b + 0.5 * a * (1 - b))
                }
                const lp = smoothstep(m - W, m + W, P)
                if (scrambleOn && lp > 0.08 && lp < 0.92) {
                    dens[idx] = Math.max(a, b)
                    pick[idx] = 3
                } else if (lp < 0.5) {
                    if (a > 0) {
                        dens[idx] = a
                        pick[idx] = 1
                    }
                } else if (b > 0) {
                    dens[idx] = b
                    pick[idx] = 2
                }
            }

            // ── Glyphs ───────────────────────────────────────────────────
            const rp = getRamp(cfg.characters)
            const nR = rp.length
            const ip = getImageRamp(cfg.imageCharacters)
            const nI = ip.length
            const i0 = ip[0] === " " ? 1 : 0
            const nIUse = Math.max(1, nI - i0)
            const eg = getEdgeChars(cfg.edgeCharacters)
            const edgeAmt = clamp01(cfg.edgeGlyphs)
            const edgeTh = lerp(3.4, 1.0, edgeAmt)
            const shimmer = reducedNow ? 0 : clamp01(cfg.shimmer)
            const shTick = Math.floor(time * 9)
            const scrTick = Math.floor(time * 22)
            const G = buildPalette(cfg)
            const ACC = G
            const LAND = G + 1
            const SEA = G + 2
            const DUO = G + 3
            const IMG = DUO + DUO_STEPS
            const useRgb = cfg.imageColors === "original"
            if (useRgb && imagePalette.length === 0) {
                for (let q = 0; q < 4096; q++) {
                    imagePalette.push(
                        `rgb(${((q >> 8) & 15) * 17},${((q >> 4) & 15) * 17},${(q & 15) * 17})`
                    )
                }
            }
            const LV = ALPHA_LEVELS + 1
            ensureFade(clamp01(cfg.centerFade))

            let count = 0
            for (let y = 0; y < rows; y++) {
                const gi =
                    G > 1
                        ? Math.round((y / Math.max(1, rows - 1)) * (G - 1))
                        : 0
                for (let x = 0; x < cols; x++) {
                    const idx = y * cols + x
                    const k = pick[idx]
                    if (k === 0) continue
                    const v = dens[idx]
                    // The layer this cell belongs to (scramble: the denser one).
                    const L =
                        k === 1
                            ? A
                            : k === 2
                              ? B
                              : (dA ? dA[idx] : 0) >= (dB ? dB[idx] : 0)
                                ? A
                                : B
                    if (!L) continue
                    let glyph: string
                    let ci: number
                    let al: number
                    if (L.kind === "shape") {
                        let ch: number
                        if (k === 3 && nR > 1)
                            ch = 1 + Math.floor(hashU(idx, scrTick) * (nR - 1))
                        else ch = Math.min(nR - 1, (v * nR) | 0)
                        glyph = rp[ch]
                        const c = L.cls[idx]
                        ci =
                            c === 1 ? LAND : c === 2 ? SEA : v > 0.82 ? ACC : gi
                        al = 0.25 + v * 0.75
                    } else {
                        let ch: number
                        // Scripted device: edge-direction glyph picked by the engine.
                        const fg = (L.cls[idx] >> 3) & 7
                        if (k === 3 || fg === 6) {
                            ch = i0 + Math.floor(hashU(idx, scrTick) * nIUse)
                            glyph = ip[ch]
                        } else if (fg > 0) {
                            glyph = fg === 5 ? "+" : eg[fg - 1] || "+"
                        } else {
                            ch = i0 + Math.min(nIUse - 1, Math.floor(v * nIUse))
                            if (
                                shimmer > 0 &&
                                hashU(idx, shTick) < shimmer * 0.08
                            ) {
                                ch += hashU(idx + 7, shTick) < 0.5 ? -1 : 1
                                if (ch < i0) ch = i0
                                if (ch > nI - 1) ch = nI - 1
                            }
                            glyph = ip[ch]
                            // Edge-direction glyphs along strong contours.
                            if (
                                edgeAmt > 0 &&
                                (L.cls[idx] & 0x40) === 0 &&
                                x > 0 &&
                                y > 0 &&
                                x < cols - 1 &&
                                y < rows - 1
                            ) {
                                const u = idx - cols
                                const d = idx + cols
                                const gx =
                                    (dens[u + 1] +
                                        2 * dens[idx + 1] +
                                        dens[d + 1] -
                                        dens[u - 1] -
                                        2 * dens[idx - 1] -
                                        dens[d - 1]) /
                                    0.62
                                const gy =
                                    dens[d - 1] +
                                    2 * dens[d] +
                                    dens[d + 1] -
                                    dens[u - 1] -
                                    2 * dens[u] -
                                    dens[u + 1]
                                if (gx * gx + gy * gy > edgeTh * edgeTh) {
                                    let phi = Math.atan2(gy, gx) + Math.PI / 2
                                    if (phi < 0) phi += Math.PI
                                    if (phi >= Math.PI) phi -= Math.PI
                                    glyph =
                                        eg[
                                            Math.round(phi / (Math.PI / 4)) % 4
                                        ] || glyph
                                }
                            }
                        }
                        if (useRgb) {
                            const o = idx * 3
                            ci =
                                IMG +
                                (((L.rgb[o] >> 4) << 8) |
                                    ((L.rgb[o + 1] >> 4) << 4) |
                                    (L.rgb[o + 2] >> 4))
                        } else if (cfg.imageColors === "duotone") {
                            ci = DUO + Math.round(v * (DUO_STEPS - 1))
                        } else {
                            ci = gi
                        }
                        // Scripted device layer: accent cells (the checkmark).
                        if ((L.cls[idx] & 0x80) !== 0) ci = ACC
                        al = 0.3 + 0.7 * v
                    }
                    if (!glyph || glyph === " ") continue
                    if (k === 3 && cfg.frontAccent) ci = ACC
                    // The scripted device keeps its own opacity (Device Look),
                    // apart from Intensity and the quiet area.
                    const a =
                        (L.cls[idx] & 0x40) !== 0 && L.kind === "image"
                            ? al * scriptOp
                            : al * opacity * fade[idx]
                    const lvl = Math.min(
                        ALPHA_LEVELS,
                        Math.round(a * ALPHA_LEVELS)
                    )
                    if (lvl <= 0) continue
                    keys[count] = ci * LV + lvl
                    cells[count] = idx
                    glyphs[count] = glyph
                    count++
                }
            }
            if (count === 0) return

            // Counting sort by style bucket.
            const K = (IMG + (useRgb ? 4096 : 0)) * LV
            if (counts.length < K + 1) counts = new Int32Array(K + 1)
            else counts.fill(0, 0, K + 1)
            for (let i = 0; i < count; i++) counts[keys[i] + 1]++
            for (let k = 0; k < K; k++) counts[k + 1] += counts[k]
            for (let i = 0; i < count; i++) sorted[counts[keys[i]]++] = i

            c2d.font = `${cellPx}px ${FONT_STACK}`
            c2d.textBaseline = "top"
            let lastKey = -1
            for (let j = 0; j < count; j++) {
                const i = sorted[j]
                const key = keys[i]
                if (key !== lastKey) {
                    lastKey = key
                    const ci = (key / LV) | 0
                    c2d.fillStyle =
                        ci >= IMG ? imagePalette[ci - IMG] : palette[ci]
                    c2d.globalAlpha = (key % LV) / ALPHA_LEVELS
                }
                const idx = cells[i]
                c2d.fillText(
                    glyphs[i],
                    (idx % cols) * cw,
                    ((idx / cols) | 0) * cellPx
                )
            }
            c2d.globalAlpha = 1
        }

        // ── Per-layer placement & rendering ───────────────────────────────
        function deformShape(inst: ShapeInstance, cfg: Settings) {
            if (!inst.deform) return
            if (
                inst.lastTime === time &&
                inst.lastChaos === cfg.chaos &&
                inst.lastBreathing === cfg.breathing
            )
                return
            inst.lastTime = time
            inst.lastChaos = cfg.chaos
            inst.lastBreathing = cfg.breathing
            inst.deform({ time, chaos: cfg.chaos, breathing: cfg.breathing })
        }

        /**
         * role 0 = single, 1 = outgoing, 2 = incoming. During a transition
         * both shapes melt toward the shared morph sphere (meeting mid-way),
         * pulse in scale and twist in opposite directions, so the swap
         * happens while they look alike. Empty disperses / converges.
         */
        function placeShape(
            inst: ShapeInstance,
            role: 0 | 1 | 2,
            p: number,
            otherEmpty: boolean,
            cfg: Settings,
            viewW: number,
            viewH: number
        ) {
            let w = 0
            let sc = cur.scale
            let twist = 0
            if (role === 1) {
                w = smoothstep(0, 0.55, p)
                sc *= 1 - 0.1 * Math.sin(Math.PI * p)
                twist = 0.7 * p
                if (otherEmpty) sc *= 1 + 1.6 * p * p
            } else if (role === 2) {
                w = 1 - smoothstep(0.45, 1, p)
                sc *= 1 - 0.1 * Math.sin(Math.PI * p)
                twist = -0.7 * (1 - p)
                if (otherEmpty) sc *= 1 + 1.6 * (1 - p) * (1 - p)
            }
            const m = w * clamp01(cfg.morphAmount)
            for (const mesh of inst.meshes) {
                const inf = mesh.morphTargetInfluences
                if (inf && inf.length) inf[0] = m
            }
            const fl = reducedNow ? 0 : Math.max(0, cfg.floatAmount)
            const fx = Math.cos(time * 0.53) * 0.012 * viewW * fl
            const fy = Math.sin(time * 0.81) * 0.02 * viewH * fl
            // 0% = left/top edge, 50% = center, 100% = right/bottom edge.
            inst.root.position.set(
                ((cur.x - 50) / 50) * (viewW / 2) + fx,
                -((cur.y - 50) / 50) * (viewH / 2) + fy,
                0
            )
            const s = Math.max(0.0001, sc)
            if (inst.fillViewport) {
                inst.root.scale.set(
                    lerp((viewW / 2) * 1.08 * s, s, w),
                    lerp((viewH / 2) * 1.08 * s, s, w),
                    s
                )
            } else {
                inst.root.scale.setScalar(s)
            }
            const follow =
                cfg.mouseFollow && !reducedNow ? cfg.followStrength : 0
            inst.orient(rot + cur.spin + twist, mx, my, follow)
            deformShape(inst, cfg)
        }

        function renderLayer(
            inst: ShapeInstance,
            buf: Uint8Array,
            rt: THREE.WebGLRenderTarget | null
        ) {
            shapes.forEach((s) => {
                s.root.visible = s === inst
            })
            if (renderer && rt) {
                renderer.setRenderTarget(rt)
                renderer.render(scene, camera)
                renderer.readRenderTargetPixels(rt, 0, 0, cols, rows, buf)
                renderer.setRenderTarget(null)
            } else {
                rasterizeCPU(
                    inst.root,
                    cols,
                    rows,
                    camera.aspect,
                    camera.position.z,
                    buf
                )
            }
        }

        /** The image section's sampled field (null while loading / failed). */
        function imageSource(
            sec: NormSection,
            cfg: Settings,
            nowMs: number
        ): { field: ImageField; fade: number } | null {
            if (!sec.imageSrc) return null
            const e = imageCache.get(sec.imageSrc)
            if (!e || e.status !== "ready") return null
            const f = getField(e, sec.removeBg, cfg.bgTolerance)
            if (!f) return null
            const fade = staticMode ? 1 : clamp01((nowMs - e.readyAt) / 450)
            if (fade < 1) fadingIn = true
            return { field: f, fade }
        }

        /**
         * Scroll position inside section i, in VH, measured from the start of
         * the section (Scroll Sections: its top at the trigger line).
         */
        function scriptLocalVH(i: number, cfg: Settings): number {
            const vh = window.innerHeight || 1
            if (track.mode === "ids" && track.ranges && track.ranges[i]) {
                return (
                    ((liveScrollY +
                        (cfg.trigger / 100) * vh -
                        track.ranges[i][0]) /
                        vh) *
                    100
                )
            }
            if (track.mode === "manual") {
                const unit = cfg.manualUnit === "px" ? 1 : vh / 100
                return (
                    ((liveScrollY - track.sections[i].start * unit) / vh) * 100
                )
            }
            const z = track.zones[i]
            return ((liveScrollY - (z ? z[1] : 0) * scrollable) / vh) * 100
        }

        function getScript(): ScriptEngine {
            if (!script) {
                script = createScriptEngine(staticMode, () => {
                    if (redrawRef.current) redrawRef.current()
                })
            }
            return script
        }

        /**
         * Ink of the scripted ASCII elements: their own colour if set; else
         * the global ink when it stands out from the page, or a strong
         * contrast colour when the global ink is deliberately subtle.
         */
        function scriptElementInk(v: string, cfg: Settings): RGBA {
            if (v) {
                const c = colorOf(v)
                if (c[3] > 0) return [c[0], c[1], c[2], 1]
            }
            const ink = colorOf(cfg.inkColor)
            const bg = pageBackground(cfg)
            const lum = (c: RGBA) =>
                (c[0] * 0.299 + c[1] * 0.587 + c[2] * 0.114) / 255
            if (Math.abs(lum(ink) - lum(bg)) >= 0.45)
                return [ink[0], ink[1], ink[2], 1]
            return lum(bg) > 0.5 ? [16, 19, 23, 1] : [238, 240, 244, 1]
        }

        /** Best guess of the page colour behind the layer (card knock-out, glyph halos). */
        let pageBgAt = -1e9
        let pageBgBody: RGBA | null = null
        function pageBackground(cfg: Settings): RGBA {
            const own = colorOf(cfg.backgroundColor)
            if (own[3] > 0.5) return own
            const now = performance.now()
            if (now - pageBgAt > 1000) {
                pageBgAt = now
                pageBgBody = null
                try {
                    const b = parseCssColor(
                        getComputedStyle(document.body).backgroundColor
                    )
                    if (b[3] > 0.5) pageBgBody = b
                } catch (e) {
                    // keep the fallback
                }
            }
            if (pageBgBody) return pageBgBody
            const ink = colorOf(cfg.inkColor)
            return (ink[0] * 0.299 + ink[1] * 0.587 + ink[2] * 0.114) / 255 <
                0.5
                ? [246, 246, 244, 1]
                : [13, 14, 16, 1]
        }

        /**
         * Update the scripted sequence for this frame. The device is returned
         * as a normal glyph layer, so the standard transition morphs it from /
         * into the neighbouring sections; null while its model is loading.
         */
        function buildScriptLayer(
            sec: NormSection,
            i: number,
            role: 0 | 1 | 2,
            p: number,
            slot: CellLayer,
            cfg: Settings,
            w: number,
            h: number
        ): CellLayer | null {
            if (scriptUsed) return null // one scripted section at a time
            const eng = getScript()
            const ms = sec.script.ms
            let local: number
            if (staticMode) {
                // Editor canvas: the milestone picked in "Canvas State".
                const m = ms[sec.scriptPreview - 1] || ms[0]
                local = sec.scriptPreview >= 8 ? m.t0 : (m.i0 + m.i1) / 2
            } else {
                local = scriptLocalVH(i, cfg)
            }
            const vw = staticMode ? w : window.innerWidth || w
            const mobile = vw < cfg.mobileBreakpoint
            const idleOn = cfg.scriptIdle && !reducedNow && !staticMode
            eng.update({
                conf: sec.script,
                L: local,
                time: sTime,
                w,
                h,
                dpr: gdpr || 1,
                reduced: reducedNow && !staticMode,
                mobile,
                mobileX: sec.mobileX,
                mobileY: sec.mobileY,
                scale:
                    Math.max(0.05, sec.scale) * (mobile ? cfg.mobileScale : 1),
                // The device and its elements have their own opacity: they are
                // not dimmed by the glyph Intensity / section Opacity used to
                // keep background ASCII subtle.
                opacity: sec.script.opacity,
                idleAmp: idleOn ? Math.max(0, cfg.scriptIdleIntensity) : 0,
                idleFloat: Math.max(0, cfg.scriptFloat),
                idleTilt: Math.max(0, cfg.scriptRotation),
                idleDepth: Math.max(0, cfg.scriptDepth),
                ink: colorOf(cfg.inkColor),
                elInk: scriptElementInk(sec.script.elColor, cfg),
                accent: [cur.ar, cur.ag, cur.ab, 1],
                pageBg: pageBackground(cfg),
                role,
                p,
                cols,
                rows,
                cw,
                cellPx,
                ramp: getImageRamp(cfg.imageCharacters),
            })
            scriptUsed = true
            scriptOp = clamp01(sec.script.opacity)
            scriptStatus[i] = eng.status()
            slot.kind = "image"
            return eng.cells(slot) ? slot : null
        }

        /**
         * Fill one cell layer from a section. role 0 = single, 1 = outgoing,
         * 2 = incoming. Returns null when the section draws nothing.
         */
        function buildLayer(
            sec: NormSection,
            role: 0 | 1 | 2,
            p: number,
            otherEmpty: boolean,
            slot: CellLayer,
            buf: Uint8Array,
            rt: THREE.WebGLRenderTarget | null,
            cfg: Settings,
            w: number,
            h: number,
            viewW: number,
            viewH: number,
            nowMs: number,
            secIndex: number
        ): CellLayer | null {
            if (sec.scripted)
                return buildScriptLayer(sec, secIndex, role, p, slot, cfg, w, h)
            if (sec.shape === "image") {
                const src = imageSource(sec, cfg, nowMs)
                if (!src) return null
                const fl = reducedNow ? 0 : Math.max(0, cfg.floatAmount)
                const cx =
                    (cur.x / 100) * w + Math.cos(time * 0.53) * 0.012 * w * fl
                const cy =
                    (cur.y / 100) * h + Math.sin(time * 0.81) * 0.02 * h * fl
                const follow =
                    cfg.mouseFollow && !reducedNow ? cfg.followStrength : 0
                const sw = reducedNow ? 0 : clamp01(cfg.imageSway)
                // Tilt relative to the cursor's resting pose.
                const tiltX =
                    -(my - 0.05) * 0.55 * follow +
                    Math.sin(time * 0.6) * 0.16 * sw
                const tiltY =
                    (mx - 0.2) * 0.65 * follow +
                    Math.cos(time * 0.43) * 0.24 * sw
                const zoom = reducedNow ? 0 : Math.max(0, cfg.imageZoom)
                let k = 1
                if (role === 1)
                    k = (1 + zoom * p) * (otherEmpty ? 1 + 0.6 * p * p : 1)
                else if (role === 2)
                    k =
                        (1 - zoom * (1 - p)) *
                        (otherEmpty ? 1 + 0.6 * (1 - p) * (1 - p) : 1)
                const twist =
                    reducedNow || role === 0
                        ? 0
                        : cfg.imageTwist * Math.sin(Math.PI * p)
                const [bw, bh] = boxSize(
                    src.field.aspect,
                    w,
                    h,
                    cfg.imageSize,
                    cur.scale * k
                )
                slot.kind = "image"
                slot.dens.fill(0)
                sampleImage(
                    {
                        field: src.field,
                        invert: sec.invert,
                        fade: src.fade,
                        xf: makeXform(
                            cx,
                            cy,
                            bw,
                            bh,
                            cur.rot + twist,
                            tiltX,
                            tiltY,
                            1.8 * Math.max(w, h)
                        ),
                    },
                    { cols, rows, cw, cell: cellPx, shift: rowShift },
                    cfg,
                    time,
                    reducedNow ? 0 : clamp01(cfg.imageWave),
                    slot.dens,
                    slot.cls,
                    slot.rgb
                )
                return slot
            }
            const inst = getShape(sec.shape)
            if (inst.empty) return null
            placeShape(inst, role, p, otherEmpty, cfg, viewW, viewH)
            renderLayer(inst, buf, rt)
            shapeToCells(buf, slot, inst.colorMode === "earth")
            return slot
        }

        function drawFrame(
            cfg: Settings,
            w: number,
            h: number,
            dpr: number,
            scrambleOn: boolean,
            nowMs: number
        ) {
            ensureGrid(w, h, cur.cell, dpr)
            const viewH =
                2 * Math.tan((CAMERA_FOV * Math.PI) / 360) * camera.position.z
            const viewW = viewH * camera.aspect
            const secs = track.sections
            const sA = secs[pair.ia] || secs[0]
            const sB = secs[pair.ib] || sA
            const dual =
                pair.ia !== pair.ib &&
                pair.p > 0 &&
                pair.p < 1 &&
                sourceKey(sA) !== sourceKey(sB)
            const p = dual ? pair.p : 0
            fadingIn = false

            // Glitch rows: some rows slide sideways mid-transition.
            const gAmp =
                dual && !reducedNow
                    ? clamp01(cfg.glitch) * Math.sin(Math.PI * p)
                    : 0
            const gTick = Math.floor(time * 14)
            for (let y = 0; y < rows; y++) {
                rowShift[y] =
                    gAmp > 0.01 && hashU(y, gTick) > 0.7
                        ? Math.round(
                              (hashU(y + 977, gTick) - 0.5) * 2 * gAmp * 10
                          )
                        : 0
            }

            shapes.forEach((s) => {
                s.root.visible = false
            })
            const iA = secs[pair.ia] ? pair.ia : 0
            const iB = secs[pair.ib] ? pair.ib : iA
            scriptUsed = false
            scriptOther = sA.scripted ? 1 : dual && sB.scripted ? 2 : 0
            const LA = buildLayer(
                sA,
                dual ? 1 : 0,
                p,
                dual && isEmptySection(sB),
                layerA,
                bufA,
                rtA,
                cfg,
                w,
                h,
                viewW,
                viewH,
                nowMs,
                iA
            )
            const LB = dual
                ? buildLayer(
                      sB,
                      2,
                      p,
                      isEmptySection(sA),
                      layerB,
                      bufB,
                      rtB,
                      cfg,
                      w,
                      h,
                      viewW,
                      viewH,
                      nowMs,
                      iB
                  )
                : null
            const shapeToShape = !!(
                LA &&
                LB &&
                LA.kind === "shape" &&
                LB.kind === "shape"
            )
            drawCells(cfg, LA, LB, dual, p, shapeToShape, scrambleOn && dual)
            // Scripted sequence: the device is part of the glyph grid; its
            // ASCII elements are drawn by the engine on top.
            if (script) {
                if (scriptUsed)
                    script.draw(
                        c2d,
                        dual ? (scriptOther === 1 ? LB : LA) : null
                    )
                else script.hide()
            }
        }

        // ── Static canvas (Framer editor / export) ────────────────────────
        if (staticMode) {
            const drawStatic = () => {
                const cfg = live.current
                const list = normSections(cfg)
                syncImages(list)
                track = {
                    mode: "progress",
                    sections: list,
                    zones: list.map((): [number, number] => [0, 0]),
                }
                const idx = Math.max(
                    0,
                    Math.min(
                        list.length - 1,
                        Math.round(cfg.previewSection) - 1
                    )
                )
                // The editor canvas only ever needs the previewed section.
                if (list[idx].imageSrc) requestNow(list[idx].imageSrc, "high")
                const w = host.clientWidth || 1
                const h = host.clientHeight || 1
                const mobile = w < cfg.mobileBreakpoint
                sectionState(
                    list[idx],
                    cfg,
                    mobile,
                    colorOf(cfg.accentColor),
                    colorOf,
                    cur
                )
                pair.a = list[idx].shape
                pair.b = list[idx].shape
                pair.p = 0
                pair.ia = idx
                pair.ib = idx
                rot = 0.6
                time = 1.2
                sTime = 1.3
                mx = 0.2
                my = 0.05
                reducedNow = true
                camera.position.z = CAM_SPAN - cfg.cameraDistance
                drawFrame(
                    cfg,
                    w,
                    h,
                    Math.min(window.devicePixelRatio || 1, 2),
                    false,
                    1e9
                )
            }
            drawStatic()

            let queued = false
            const queueRedraw = () => {
                if (queued) return
                queued = true
                window.requestAnimationFrame(() => {
                    queued = false
                    drawStatic()
                })
            }
            redrawRef.current = queueRedraw

            // Theme switches don't change props: watch for attribute flips,
            // stylesheet swaps and OS scheme changes.
            const mo = new MutationObserver(queueRedraw)
            mo.observe(document.documentElement, { attributes: true })
            if (document.body) mo.observe(document.body, { attributes: true })
            if (document.head) {
                mo.observe(document.head, {
                    childList: true,
                    subtree: true,
                    characterData: true,
                })
            }
            const mq = window.matchMedia
                ? window.matchMedia("(prefers-color-scheme: dark)")
                : null
            if (mq && mq.addEventListener)
                mq.addEventListener("change", queueRedraw)
            const ro = new ResizeObserver(queueRedraw)
            ro.observe(host)

            return () => {
                redrawRef.current = null
                mo.disconnect()
                if (mq && mq.removeEventListener)
                    mq.removeEventListener("change", queueRedraw)
                ro.disconnect()
                stopImages()
                if (script) script.dispose()
                shapes.forEach(disposeShape)
                shapes.clear()
                if (out.parentNode) out.parentNode.removeChild(out)
            }
        }

        // ── Live: measurement ─────────────────────────────────────────────
        let measureDirty = true
        let lastMeasure = 0
        let lastVersion = -1
        let needsRender = true
        let first = true
        let smoothY = 0
        let hostW = host.clientWidth
        let hostH = host.clientHeight

        function measure(cfg: Settings) {
            const list = normSections(cfg)
            syncImages(list)
            const vh = window.innerHeight || 1
            const sy = window.scrollY || window.pageYOffset || 0
            const docEl = document.documentElement
            const docH = Math.max(
                docEl.scrollHeight,
                document.body ? document.body.scrollHeight : 0
            )
            scrollable = Math.max(1, docH - vh)
            const rects: SectionRect[] = []
            if (cfg.detection === "ids") {
                for (const sec of list) {
                    const el = findSection(sec.id)
                    if (el) {
                        const r = el.getBoundingClientRect()
                        rects.push({ top: r.top + sy, bottom: r.bottom + sy })
                    } else {
                        rects.push(null)
                    }
                }
            }
            const endPos = scrollable + (cfg.trigger / 100) * vh
            track = buildTrack(cfg.detection, list, rects, cfg, vh, endPos)
        }

        /**
         * Resolve a section ID to a rendered element. Framer can keep hidden
         * copies of a section (other breakpoints) with the same ID, so the
         * first visible match wins; an ID that only exists hidden counts as
         * not found instead of reporting a bogus position.
         */
        function findSection(rawId: string): HTMLElement | null {
            const id = rawId.trim().replace(/^#/, "")
            if (!id) return null
            let matches: HTMLElement[] = []
            try {
                const esc =
                    typeof CSS !== "undefined" && CSS.escape
                        ? CSS.escape(id)
                        : id.replace(/["\\]/g, "\\$&")
                matches = Array.from(
                    document.querySelectorAll<HTMLElement>(`[id="${esc}"]`)
                )
            } catch (e) {
                const one = document.getElementById(id)
                if (one) matches = [one]
            }
            for (const el of matches) {
                if (host.contains(el)) continue
                const r = el.getBoundingClientRect()
                if (r.width > 0 || r.height > 0) return el
            }
            return null
        }

        // ── Live: debug overlay ───────────────────────────────────────────
        let dbgPanel: HTMLDivElement | null = null
        let dbgLine: HTMLDivElement | null = null
        let dbgLast = 0
        let dbgText = ""

        function removeDebug() {
            if (dbgPanel && dbgPanel.parentNode)
                dbgPanel.parentNode.removeChild(dbgPanel)
            if (dbgLine && dbgLine.parentNode)
                dbgLine.parentNode.removeChild(dbgLine)
            dbgPanel = null
            dbgLine = null
            dbgText = ""
        }

        function updateDebug(cfg: Settings, nowMs: number) {
            if (!cfg.debug) {
                if (dbgPanel) removeDebug()
                return
            }
            if (!dbgPanel) {
                dbgPanel = document.createElement("div")
                const ps = dbgPanel.style
                ps.position = "absolute"
                ps.top = "12px"
                ps.right = "12px"
                ps.maxWidth = "min(420px, calc(100% - 24px))"
                ps.padding = "10px 12px"
                ps.borderRadius = "8px"
                ps.background = "rgba(12,12,16,0.86)"
                ps.color = "#F2F2F2"
                ps.font = `11px/1.5 ${FONT_STACK}`
                ps.whiteSpace = "pre"
                ps.overflow = "hidden"
                ps.textOverflow = "ellipsis"
                ps.pointerEvents = "none"
                ps.zIndex = "2"
                dbgLine = document.createElement("div")
                const ls = dbgLine.style
                ls.position = "absolute"
                ls.left = "0"
                ls.right = "0"
                ls.height = "0"
                ls.borderTop = "1px dashed rgba(255,40,100,0.9)"
                ls.pointerEvents = "none"
                ls.zIndex = "2"
                host.appendChild(dbgLine)
                host.appendChild(dbgPanel)
            }
            if (nowMs - dbgLast < 150) return
            dbgLast = nowMs

            if (dbgLine) {
                dbgLine.style.display = track.mode === "ids" ? "block" : "none"
                dbgLine.style.top = `${cfg.trigger}%`
            }

            const modeName =
                track.mode === "ids"
                    ? "Scroll Sections (auto range)"
                    : track.mode === "manual"
                      ? "Manual Range"
                      : cfg.detection === "ids"
                        ? "Page Progress (fallback: no section found)"
                        : "Page Progress"
            const lines: string[] = [`ASCII Motion · ${modeName}`]
            const secs = track.sections
            for (let i = 0; i < secs.length; i++) {
                const s = secs[i]
                const active = i === pair.ia || i === pair.ib ? "▶" : " "
                let info: string
                if (track.mode === "ids" && track.found && track.ranges) {
                    const r = track.ranges[i]
                    const at = Math.round(r[0])
                    info = !s.id
                        ? `no section picked · est. ${at}px`
                        : track.found[i]
                          ? `#${s.id} ✓ ${at}–${Math.round(r[1])}px`
                          : `#${s.id} ✗ NOT ON THIS PAGE · est. ${at}px`
                } else if (track.mode === "manual") {
                    info = `${s.start}–${s.end}${cfg.manualUnit}`
                } else {
                    info = `${Math.round((i / Math.max(1, secs.length - 1)) * 100)}% scroll`
                }
                const what: string = s.scripted
                    ? `script: ${scriptStatus[i] || "idle"}`
                    : s.shape === "image"
                      ? imageStatus(s)
                      : s.shape
                lines.push(`${active}${i + 1}. ${s.name} · ${what} · ${info}`)
            }
            const a = secs[pair.ia]
            const b = secs[pair.ib]
            lines.push(
                a && b && pair.ia !== pair.ib
                    ? `now: ${a.name} → ${b.name} ${Math.round(pair.p * 100)}%`
                    : `now: ${a ? a.name : "-"}`
            )
            const text = lines.join("\n")
            if (text !== dbgText && dbgPanel) {
                dbgText = text
                dbgPanel.textContent = text
            }
        }

        function scrollPos(cfg: Settings, y: number): number {
            if (track.mode === "ids")
                return y + (cfg.trigger / 100) * (window.innerHeight || 1)
            if (track.mode === "manual") return y
            return y / scrollable
        }

        // ── Live: listeners & observers ───────────────────────────────────
        const onPointerMove = (e: PointerEvent) => {
            tx = e.clientX / (window.innerWidth || 1) - 0.5
            ty = e.clientY / (window.innerHeight || 1) - 0.5
        }
        const onResize = () => {
            measureDirty = true
            needsRender = true
            if (ownsHost) {
                hostW = host.clientWidth
                hostH = host.clientHeight
            }
        }
        const onLoad = () => {
            measureDirty = true
        }
        const onReducedChange = () => {
            needsRender = true
        }
        window.addEventListener("pointermove", onPointerMove, { passive: true })
        window.addEventListener("resize", onResize)
        window.addEventListener("load", onLoad)
        if (reducedQuery && reducedQuery.addEventListener) {
            reducedQuery.addEventListener("change", onReducedChange)
        }

        const hostRO = new ResizeObserver((entries) => {
            const r = entries[0] && entries[0].contentRect
            if (r) {
                hostW = r.width
                hostH = r.height
            }
            needsRender = true
        })
        hostRO.observe(host)
        // Page height changes (lazy images, CMS lists…) move sections.
        const bodyRO = new ResizeObserver(() => {
            measureDirty = true
        })
        if (document.body) bodyRO.observe(document.body)

        let visible = true
        let io: IntersectionObserver | null = null
        if (!ownsHost) {
            io = new IntersectionObserver((entries) => {
                visible = entries[0] ? entries[0].isIntersecting : true
            })
            io.observe(host)
        }

        // ── Live: frame ───────────────────────────────────────────────────
        function tick(dt: number) {
            const cfg = live.current

            if (ownsHost) {
                const z = String(Math.round(cfg.zIndex))
                if (host.style.zIndex !== z) host.style.zIndex = z
                if (host.style.pointerEvents !== cfg.pointerEvents) {
                    host.style.pointerEvents = cfg.pointerEvents
                }
            }

            const vw = window.innerWidth || 1
            const w = Math.round(hostW || host.clientWidth || vw)
            const h = Math.round(
                hostH || host.clientHeight || window.innerHeight || 1
            )
            const mobile = vw < cfg.mobileBreakpoint
            const reduced = !!(
                cfg.respectReducedMotion &&
                reducedQuery &&
                reducedQuery.matches
            )
            reducedNow = reduced

            const nowMs = performance.now()
            const version = versionRef.current
            if (
                measureDirty ||
                version !== lastVersion ||
                nowMs - lastMeasure > 1000
            ) {
                measure(cfg)
                measureDirty = false
                lastMeasure = nowMs
                if (version !== lastVersion) needsRender = true
                lastVersion = version
            }

            // Scroll → smoothed scroll coordinate → section state.
            const sy = window.scrollY || window.pageYOffset || 0
            const prevSmoothY = smoothY
            if (first) smoothY = sy
            else {
                smoothY +=
                    (sy - smoothY) *
                    followFactor(dt, reduced ? 0 : cfg.scrollSmoothing)
                if (Math.abs(sy - smoothY) < 0.1) smoothY = sy
            }
            liveScrollY = smoothY
            evaluateTrack(
                track,
                scrollPos(cfg, smoothY),
                cfg,
                mobile,
                colorOf(cfg.accentColor),
                colorOf,
                target,
                tmp,
                pair
            )
            // Images around the current position load right away.
            ensureNearby(track.sections, pair.ia, pair.ib)
            // So does the device model of a scripted section nearby.
            {
                const all = track.sections
                const lo = Math.max(0, Math.min(pair.ia, pair.ib) - 1)
                const hi = Math.min(
                    all.length - 1,
                    Math.max(pair.ia, pair.ib) + 1
                )
                for (let i = lo; i <= hi; i++)
                    if (all[i].scripted) getScript().preload(all[i].script)
            }

            updateDebug(cfg, nowMs)

            // Transition smoothing on every numeric property.
            const a = first ? 1 : followFactor(dt, cfg.transitionSmoothing)
            let delta = 0
            for (let i = 0; i < STATE_KEYS.length; i++) {
                const k = STATE_KEYS[i]
                const diff = target[k] - cur[k]
                if (Math.abs(diff) < 1e-4) cur[k] = target[k]
                else {
                    cur[k] += diff * a
                    delta = Math.max(delta, Math.abs(diff * a))
                }
            }

            // Cursor steering.
            if (!cfg.mouseFollow || reduced) {
                tx = 0.2
                ty = 0.05
            }
            const ma = 1 - Math.exp(-dt * 3)
            const pmx = mx
            const pmy = my
            mx += (tx - mx) * ma
            my += (ty - my) * ma
            const mouseMoving = Math.abs(mx - pmx) + Math.abs(my - pmy) > 1e-5

            // Idle animation — independent of scroll, never freezes.
            const spinRate =
                cfg.autoSpin && !reduced
                    ? 0.24 * cfg.rotationSpeed * cur.speed
                    : 0
            rot += dt * spinRate
            const idleTime = !reduced && cfg.animationSpeed !== 0
            if (idleTime) time += dt * 0.6 * cfg.animationSpeed
            if (cfg.scriptIdle && !reduced)
                sTime += dt * Math.max(0, cfg.scriptIdleSpeed)

            const camTarget = CAM_SPAN - cfg.cameraDistance
            const camDiff = camTarget - camera.position.z
            if (first || Math.abs(camDiff) < 1e-4) camera.position.z = camTarget
            else camera.position.z += camDiff * (1 - Math.exp(-dt * 5))

            const secs = track.sections
            const sA = secs[pair.ia] || secs[0]
            const sB = secs[pair.ib] || sA
            const dual =
                pair.ia !== pair.ib &&
                pair.p > 0 &&
                pair.p < 1 &&
                sourceKey(sA) !== sourceKey(sB)
            const animates = (s: NormSection) =>
                s.scripted
                    ? cfg.scriptIdle && cfg.scriptIdleSpeed > 0
                    : s.shape === "image"
                      ? cfg.imageSway > 0 ||
                        cfg.imageWave > 0 ||
                        cfg.shimmer > 0
                      : s.shape !== "empty" && getShape(s.shape).deform !== null
            const scriptIdleOn =
                !reduced && cfg.scriptIdle && cfg.scriptIdleSpeed > 0
            const idleMoving =
                (idleTime &&
                    (cfg.floatAmount > 0 ||
                        animates(sA) ||
                        (dual &&
                            (animates(sB) ||
                                cfg.scramble ||
                                cfg.glitch > 0)))) ||
                (scriptIdleOn && (sA.scripted || (dual && sB.scripted)))

            const changed =
                first ||
                needsRender ||
                imagesDirty ||
                fadingIn ||
                spinRate !== 0 ||
                idleMoving ||
                delta > 1e-4 ||
                smoothY !== prevSmoothY ||
                mouseMoving ||
                Math.abs(camDiff) > 1e-4 ||
                w !== gw ||
                h !== gh
            if (!changed) return

            const q = QUALITY[cfg.quality] || QUALITY.balanced
            drawFrame(
                cfg,
                w,
                h,
                Math.min(window.devicePixelRatio || 1, q.dpr),
                cfg.scramble && !reduced,
                nowMs
            )
            first = false
            needsRender = false
            imagesDirty = false
        }

        let raf = 0
        let lastDraw = 0
        function loop(now: number) {
            raf = window.requestAnimationFrame(loop)
            if (!visible) return
            const cfg = live.current
            let fps = renderer
                ? (QUALITY[cfg.quality] || QUALITY.balanced).fps
                : 15
            // A scripted section turns the device with the scroll: run it at display rate
            // (Quality "Low" keeps its own cap).
            if (scriptUsed && cfg.quality !== "low") fps = 60
            if (lastDraw && now - lastDraw < 1000 / fps - 1) return
            const dt = lastDraw
                ? Math.min(0.1, (now - lastDraw) / 1000)
                : 1 / 60
            lastDraw = now
            tick(dt)
        }
        raf = window.requestAnimationFrame(loop)
        redrawRef.current = () => {
            needsRender = true
        }

        return () => {
            window.cancelAnimationFrame(raf)
            redrawRef.current = null
            window.removeEventListener("pointermove", onPointerMove)
            window.removeEventListener("resize", onResize)
            window.removeEventListener("load", onLoad)
            if (reducedQuery && reducedQuery.removeEventListener) {
                reducedQuery.removeEventListener("change", onReducedChange)
            }
            removeDebug()
            hostRO.disconnect()
            bodyRO.disconnect()
            if (io) io.disconnect()
            stopImages()
            if (script) script.dispose()
            shapes.forEach(disposeShape)
            shapes.clear()
            if (rtA) rtA.dispose()
            if (rtB) rtB.dispose()
            if (renderer) {
                renderer.dispose()
                renderer.forceContextLoss()
            }
            if (out.parentNode) out.parentNode.removeChild(out)
            if (ownsHost && host.parentNode) host.parentNode.removeChild(host)
        }
        // Only these remount the engine; every other control is read live.
    }, [isStatic, settings.enabled, settings.layer])

    if (!settings.enabled) {
        return (
            <div
                aria-hidden="true"
                style={{
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none",
                    ...props.style,
                }}
            />
        )
    }

    let badge: React.ReactNode = null
    if (isStatic) {
        const list = normSections(settings)
        const idx = Math.max(
            0,
            Math.min(list.length - 1, Math.round(settings.previewSection) - 1)
        )
        const sec = list[idx]
        const title = sec.scripted
            ? `Script · ${SCRIPT_NAMES[sec.scriptPreview - 1] || SCRIPT_NAMES[0]}`
            : SHAPE_TITLES[SHAPE_OPTIONS.indexOf(sec.shape)] || sec.shape
        badge = (
            <div
                style={{
                    position: "absolute",
                    left: 8,
                    bottom: 8,
                    zIndex: 1,
                    padding: "4px 8px",
                    borderRadius: 6,
                    background: "rgba(127,127,127,0.14)",
                    color: "rgba(110,110,110,0.95)",
                    font: "500 10px/1.3 Inter, system-ui, sans-serif",
                    pointerEvents: "none",
                    whiteSpace: "nowrap",
                }}
            >
                ASCII Motion · {idx + 1}/{list.length} {sec.name} · {title}
                {settings.layer === "fixed"
                    ? " · fills viewport when live"
                    : ""}
            </div>
        )
    }

    return (
        <div
            ref={mountRef}
            aria-hidden="true"
            role="presentation"
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                overflow: "hidden",
                ...props.style,
                pointerEvents: isStatic ? undefined : "none",
            }}
        >
            {badge}
        </div>
    )
}

// ─── Property controls ───────────────────────────────────────────────────────

type ControlProps = Partial<Settings>

/**
 * Hide script settings unless this Sections item has "Use Scripted
 * Animation" on. Framer passes the item's own values to nested controls; if
 * it ever passes the component's props instead, settings stay visible
 * rather than becoming unreachable.
 */
function hideScript(p: unknown): boolean {
    if (!p || typeof p !== "object") return false
    const o = p as Record<string, unknown>
    if ("sections" in o) return false
    return !o.scripted
}

function anyScripted(p: ControlProps): boolean {
    return (
        Array.isArray(p.sections) && p.sections.some((s) => !!(s && s.scripted))
    )
}

function vhControl(title: string, defaultValue: number, description?: string) {
    return {
        type: ControlType.Number as const,
        title,
        defaultValue,
        min: -200,
        max: 5000,
        step: 5,
        unit: "vh",
        ...(description ? { description } : {}),
    }
}

/** One milestone of the scripted sequence: position, timing, camera angle. */
function milestoneControl(k: number, description: string) {
    const d = MS_DEFAULTS[k]
    return {
        type: ControlType.Object as const,
        title: `${k + 1} · ${SCRIPT_NAMES[k]}`,
        buttonTitle: "Milestone",
        description,
        hidden: hideScript,
        controls: {
            x: {
                type: ControlType.Number as const,
                title: "Position X",
                defaultValue: d.x,
                min: -50,
                max: 150,
                step: 1,
                unit: "%",
            },
            y: {
                type: ControlType.Number as const,
                title: "Position Y",
                defaultValue: d.y,
                min: -50,
                max: 150,
                step: 1,
                unit: "%",
            },
            scale: {
                type: ControlType.Number as const,
                title: "Scale",
                defaultValue: d.scale,
                min: 0.1,
                max: 4,
                step: 0.05,
            },
            transformStart: vhControl(
                "Transform Start",
                d.transformStart,
                "From the section start. The move into this milestone."
            ),
            transformEnd: vhControl("Transform End", d.transformEnd),
            idleStart: vhControl(
                "Idle Start",
                d.idleStart,
                "The device rests here with idle motion."
            ),
            idleEnd: vhControl("Idle End", d.idleEnd),
            turn: {
                type: ControlType.Number as const,
                title: "Turn",
                defaultValue: d.turn,
                min: -720,
                max: 720,
                step: 1,
                unit: "°",
                description:
                    "Camera angle around the device when the idle begins. 0 = front, 180 = back (customer display). Going past 360 keeps turning the same way.",
            },
            tilt: {
                type: ControlType.Number as const,
                title: "Tilt",
                defaultValue: d.tilt,
                min: -10,
                max: 88,
                step: 1,
                unit: "°",
                description:
                    "Camera height: 0 = level with the device, 88 = from above.",
            },
            roll: {
                type: ControlType.Number as const,
                title: "Roll",
                defaultValue: d.roll,
                min: -45,
                max: 45,
                step: 1,
                unit: "°",
            },
            distance: {
                type: ControlType.Number as const,
                title: "Distance",
                defaultValue: d.distance,
                min: 0.4,
                max: 3,
                step: 0.01,
                description: "Camera distance factor. Lower = closer.",
            },
            idleTurn: {
                type: ControlType.Number as const,
                title: "Idle Turn",
                defaultValue: d.idleTurn,
                min: -90,
                max: 90,
                step: 1,
                unit: "°",
                description:
                    "How far the camera drifts round between Idle Start and Idle End.",
            },
            idleTilt: {
                type: ControlType.Number as const,
                title: "Idle Tilt",
                defaultValue: d.idleTilt,
                min: -45,
                max: 45,
                step: 1,
                unit: "°",
            },
        },
    }
}

function timingControls() {
    const out: Record<string, ReturnType<typeof vhControl>> = {}
    EL_KEYS.forEach((k, i) => {
        out[k] = vhControl(`${EL_TITLES[i]} Start`, EL_DEFAULTS[k][0])
        out[k + "End"] = vhControl(`${EL_TITLES[i]} End`, EL_DEFAULTS[k][1])
    })
    return out
}

addPropertyControls(FullPageAsciiMotion, {
    // ── Global ───────────────────────────────────────────────────────────
    enabled: {
        type: ControlType.Boolean,
        title: "Enabled",
        defaultValue: DEFAULTS.enabled,
    },
    layer: {
        type: ControlType.Enum,
        title: "Layer",
        options: ["fixed", "frame"],
        optionTitles: ["Fixed (Viewport)", "Fill Frame"],
        defaultValue: DEFAULTS.layer,
        displaySegmentedControl: true,
        description: "Fixed renders one full-viewport layer on <body>.",
    },
    zIndex: {
        type: ControlType.Number,
        title: "Z-Index",
        defaultValue: DEFAULTS.zIndex,
        min: -10,
        max: 9999,
        step: 1,
        displayStepper: true,
        description:
            "-1 places it behind content (needs transparent section fills).",
    },
    pointerEvents: {
        type: ControlType.Enum,
        title: "Pointer",
        options: ["none", "auto"],
        optionTitles: ["Pass Through", "Capture"],
        defaultValue: DEFAULTS.pointerEvents,
        displaySegmentedControl: true,
    },
    quality: {
        type: ControlType.Enum,
        title: "Quality",
        options: ["low", "balanced", "high"],
        optionTitles: ["Low", "Balanced", "High"],
        defaultValue: DEFAULTS.quality,
        displaySegmentedControl: true,
        description:
            "Low 24fps · 1x  /  Balanced 30fps · 2x  /  High 60fps · 2x",
    },
    cell: {
        type: ControlType.Number,
        title: "Char Size",
        defaultValue: DEFAULTS.cell,
        min: 7,
        max: 32,
        step: 1,
        unit: "px",
    },
    characters: {
        type: ControlType.String,
        title: "Characters",
        defaultValue: DEFAULTS.characters,
        placeholder: "dark → bright",
    },
    inkColor: {
        type: ControlType.Color,
        title: "Char Color",
        defaultValue: DEFAULTS.inkColor,
    },
    gradient: {
        type: ControlType.Boolean,
        title: "Gradient",
        defaultValue: DEFAULTS.gradient,
    },
    inkColor2: {
        type: ControlType.Color,
        title: "Char Color 2",
        defaultValue: DEFAULTS.inkColor2,
        description: "Bottom of the viewport gradient.",
        hidden: (p: ControlProps) => !p.gradient,
    },
    accentColor: {
        type: ControlType.Color,
        title: "Accent",
        defaultValue: DEFAULTS.accentColor,
        description: "Brightest glyphs. Sections can override.",
    },
    landColor: {
        type: ControlType.Color,
        title: "Earth Land",
        defaultValue: DEFAULTS.landColor,
    },
    seaColor: {
        type: ControlType.Color,
        title: "Earth Sea",
        defaultValue: DEFAULTS.seaColor,
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Background",
        defaultValue: DEFAULTS.backgroundColor,
    },
    intensity: {
        type: ControlType.Number,
        title: "Opacity",
        defaultValue: DEFAULTS.intensity,
        min: 0,
        max: 1,
        step: 0.01,
    },
    centerFade: {
        type: ControlType.Number,
        title: "Center Fade",
        defaultValue: DEFAULTS.centerFade,
        min: 0,
        max: 1,
        step: 0.05,
        description: "Dims glyphs behind centered headlines and buttons.",
    },
    cameraDistance: {
        type: ControlType.Number,
        title: "Zoom",
        defaultValue: DEFAULTS.cameraDistance,
        min: 2.8,
        max: 8,
        step: 0.1,
    },

    // ── Animation ────────────────────────────────────────────────────────
    autoSpin: {
        type: ControlType.Boolean,
        title: "Auto-Spin",
        defaultValue: DEFAULTS.autoSpin,
    },
    rotationSpeed: {
        type: ControlType.Number,
        title: "Base Rotation",
        defaultValue: DEFAULTS.rotationSpeed,
        min: 0,
        max: 5,
        step: 0.05,
        description: "Multiplied by each section's rotation.",
    },
    animationSpeed: {
        type: ControlType.Number,
        title: "Idle Speed",
        defaultValue: DEFAULTS.animationSpeed,
        min: 0,
        max: 3,
        step: 0.1,
        description: "Deformation, floating and breathing speed.",
    },
    mouseFollow: {
        type: ControlType.Boolean,
        title: "Cursor Steer",
        defaultValue: DEFAULTS.mouseFollow,
    },
    followStrength: {
        type: ControlType.Number,
        title: "Steer Amount",
        defaultValue: DEFAULTS.followStrength,
        min: 0,
        max: 3,
        step: 0.1,
        hidden: (p: ControlProps) => p.mouseFollow === false,
    },
    floatAmount: {
        type: ControlType.Number,
        title: "Idle Float",
        defaultValue: DEFAULTS.floatAmount,
        min: 0,
        max: 2,
        step: 0.05,
    },
    chaos: {
        type: ControlType.Number,
        title: "Chaos",
        defaultValue: DEFAULTS.chaos,
        min: 0,
        max: 1,
        step: 0.05,
        description: "Randomness of the Chaos shape variants.",
    },
    breathing: {
        type: ControlType.Number,
        title: "Breathing",
        defaultValue: DEFAULTS.breathing,
        min: 0,
        max: 100,
        step: 1,
        description: "Surface breathing of Chaos shapes and the Plane field.",
    },
    morphAmount: {
        type: ControlType.Number,
        title: "Shape Morph",
        defaultValue: DEFAULTS.morphAmount,
        min: 0,
        max: 1,
        step: 0.05,
        description: "How far shapes melt into a shared form mid-transition.",
    },
    morphSpin: {
        type: ControlType.Number,
        title: "Morph Spin",
        defaultValue: DEFAULTS.morphSpin,
        min: 0,
        max: 720,
        step: 15,
        unit: "°",
        description: "Extra rotation added across each section transition.",
    },
    scramble: {
        type: ControlType.Boolean,
        title: "Glyph Scramble",
        defaultValue: DEFAULTS.scramble,
        description: "Scrambled characters along the shape-change front.",
    },
    transitionSmoothing: {
        type: ControlType.Number,
        title: "Smoothing",
        defaultValue: DEFAULTS.transitionSmoothing,
        min: 0,
        max: 1,
        step: 0.05,
        description: "Easing of position, scale, speed, opacity and color.",
    },
    transitionStyle: {
        type: ControlType.Enum,
        title: "Morph Style",
        options: ["morph", "dissolve", "wipe", "radial"],
        optionTitles: ["Density Morph", "Dissolve", "Wipe Up", "Radial"],
        defaultValue: DEFAULTS.transitionStyle,
        description:
            "Shape of the front where one section's glyphs replace the next.",
    },
    frontAccent: {
        type: ControlType.Boolean,
        title: "Front Accent",
        defaultValue: DEFAULTS.frontAccent,
        description: "Color the scrambled front with the accent.",
        hidden: (p: ControlProps) => p.scramble === false,
    },
    glitch: {
        type: ControlType.Number,
        title: "Glitch",
        defaultValue: DEFAULTS.glitch,
        min: 0,
        max: 1,
        step: 0.05,
        description: "Rows slide sideways mid-transition.",
    },

    // ── Image sections ───────────────────────────────────────────────────
    imageSize: {
        type: ControlType.Number,
        title: "Image Size",
        defaultValue: DEFAULTS.imageSize,
        min: 10,
        max: 150,
        step: 1,
        unit: "%",
        description:
            "Image sections: height at Scale 1, in % of the viewport height.",
    },
    imageCharacters: {
        type: ControlType.String,
        title: "Image Chars",
        defaultValue: DEFAULTS.imageCharacters,
        placeholder: "light → dense",
    },
    edgeCharacters: {
        type: ControlType.String,
        title: "Edge Chars",
        defaultValue: DEFAULTS.edgeCharacters,
        description: "Horizontal, ↘ diagonal, vertical, ↗ diagonal.",
    },
    imageTone: {
        type: ControlType.Enum,
        title: "Image Tone",
        options: ["darkOnLight", "lightOnDark"],
        optionTitles: ["Dark on Light", "Light on Dark"],
        defaultValue: DEFAULTS.imageTone,
        displaySegmentedControl: true,
        description:
            "Light page: dark image areas become dense glyphs. Dark page: the opposite.",
    },
    imageColors: {
        type: ControlType.Enum,
        title: "Image Colors",
        options: ["ink", "duotone", "original"],
        optionTitles: ["Ink", "Duotone", "Original"],
        defaultValue: DEFAULTS.imageColors,
        displaySegmentedControl: true,
    },
    autoLevels: {
        type: ControlType.Boolean,
        title: "Auto Levels",
        defaultValue: DEFAULTS.autoLevels,
        description: "Stretch each image's tones over the full glyph range.",
    },
    contrast: {
        type: ControlType.Number,
        title: "Contrast",
        defaultValue: DEFAULTS.contrast,
        min: 0.3,
        max: 3,
        step: 0.05,
    },
    brightness: {
        type: ControlType.Number,
        title: "Density",
        defaultValue: DEFAULTS.brightness,
        min: -0.5,
        max: 0.5,
        step: 0.01,
        description: "Shifts image glyphs lighter (−) or denser (+).",
    },
    threshold: {
        type: ControlType.Number,
        title: "Cutoff",
        defaultValue: DEFAULTS.threshold,
        min: 0,
        max: 0.6,
        step: 0.01,
        description: "Image areas lighter than this stay empty.",
    },
    edgeGlyphs: {
        type: ControlType.Number,
        title: "Edge Lines",
        defaultValue: DEFAULTS.edgeGlyphs,
        min: 0,
        max: 1,
        step: 0.05,
        description: "Draw image contours with edge glyphs (0 = off).",
    },
    edgeFade: {
        type: ControlType.Number,
        title: "Edge Fade",
        defaultValue: DEFAULTS.edgeFade,
        min: 0,
        max: 1,
        step: 0.05,
        description: "Softens the image's rectangular border.",
    },
    bgTolerance: {
        type: ControlType.Number,
        title: "BG Tolerance",
        defaultValue: DEFAULTS.bgTolerance,
        min: 0.02,
        max: 0.6,
        step: 0.01,
        description: "How much background “Img Remove BG” takes away.",
    },
    imageSway: {
        type: ControlType.Number,
        title: "Image Sway",
        defaultValue: DEFAULTS.imageSway,
        min: 0,
        max: 1,
        step: 0.05,
        description: "Slow 3D tilt of images while idle.",
    },
    imageWave: {
        type: ControlType.Number,
        title: "Image Wave",
        defaultValue: DEFAULTS.imageWave,
        min: 0,
        max: 1,
        step: 0.05,
    },
    shimmer: {
        type: ControlType.Number,
        title: "Shimmer",
        defaultValue: DEFAULTS.shimmer,
        min: 0,
        max: 1,
        step: 0.05,
        description: "Random glyph flicker on images.",
    },
    imageTwist: {
        type: ControlType.Number,
        title: "Image Twist",
        defaultValue: DEFAULTS.imageTwist,
        min: -45,
        max: 45,
        step: 1,
        unit: "°",
        description: "Image rotation peaking halfway through a transition.",
    },
    imageZoom: {
        type: ControlType.Number,
        title: "Image Zoom",
        defaultValue: DEFAULTS.imageZoom,
        min: 0,
        max: 0.5,
        step: 0.01,
        description: "Outgoing image grows, incoming one settles in.",
    },

    // ── Scripted sequence: idle animation ───────────────────────────────
    scriptIdle: {
        type: ControlType.Boolean,
        title: "Script Idle",
        defaultValue: DEFAULTS.scriptIdle,
        description:
            "The device floats and tilts in depth while not scrolling.",
        hidden: (p: ControlProps) => !anyScripted(p),
    },
    scriptIdleIntensity: {
        type: ControlType.Number,
        title: "Idle Intensity",
        defaultValue: DEFAULTS.scriptIdleIntensity,
        min: 0,
        max: 2,
        step: 0.05,
        hidden: (p: ControlProps) => !anyScripted(p) || p.scriptIdle === false,
    },
    scriptIdleSpeed: {
        type: ControlType.Number,
        title: "Idle Speed",
        defaultValue: DEFAULTS.scriptIdleSpeed,
        min: 0,
        max: 3,
        step: 0.05,
        hidden: (p: ControlProps) => !anyScripted(p) || p.scriptIdle === false,
    },
    scriptFloat: {
        type: ControlType.Number,
        title: "Idle Float",
        defaultValue: DEFAULTS.scriptFloat,
        min: 0,
        max: 3,
        step: 0.05,
        description: "Drift along X and Y.",
        hidden: (p: ControlProps) => !anyScripted(p) || p.scriptIdle === false,
    },
    scriptDepth: {
        type: ControlType.Number,
        title: "Idle Depth",
        defaultValue: DEFAULTS.scriptDepth,
        min: 0,
        max: 3,
        step: 0.05,
        description: "Movement toward and away from the camera (Z).",
        hidden: (p: ControlProps) => !anyScripted(p) || p.scriptIdle === false,
    },
    scriptRotation: {
        type: ControlType.Number,
        title: "Idle 3D Tilt",
        defaultValue: DEFAULTS.scriptRotation,
        min: 0,
        max: 2,
        step: 0.05,
        description: "Small rotation around the X, Y and Z axes.",
        hidden: (p: ControlProps) => !anyScripted(p) || p.scriptIdle === false,
    },

    // ── Scroll ───────────────────────────────────────────────────────────
    detection: {
        type: ControlType.Enum,
        title: "Detection",
        options: ["ids", "manual", "progress"],
        optionTitles: ["Scroll Sections", "Manual Range", "Page Progress"],
        defaultValue: DEFAULTS.detection,
        description:
            "Scroll Sections: range measured from each picked section. List order = scroll order.",
    },
    trigger: {
        type: ControlType.Number,
        title: "Trigger",
        defaultValue: DEFAULTS.trigger,
        min: 0,
        max: 100,
        step: 1,
        unit: "%",
        description: "Viewport line that decides which section is active.",
        hidden: (p: ControlProps) =>
            (p.detection || DEFAULTS.detection) !== "ids",
    },
    anchor: {
        type: ControlType.Enum,
        title: "Morph Zone",
        options: ["before", "centered", "after"],
        optionTitles: ["Before", "Centered", "After"],
        defaultValue: DEFAULTS.anchor,
        displaySegmentedControl: true,
        description:
            "Where each morph sits relative to the boundary between sections.",
        hidden: (p: ControlProps) =>
            (p.detection || DEFAULTS.detection) !== "ids",
    },
    manualUnit: {
        type: ControlType.Enum,
        title: "Range Unit",
        options: ["vh", "px"],
        optionTitles: ["VH", "PX"],
        defaultValue: DEFAULTS.manualUnit,
        displaySegmentedControl: true,
        hidden: (p: ControlProps) =>
            (p.detection || DEFAULTS.detection) !== "manual",
    },
    scrollSmoothing: {
        type: ControlType.Number,
        title: "Scroll Smooth",
        defaultValue: DEFAULTS.scrollSmoothing,
        min: 0,
        max: 1,
        step: 0.05,
        description: "Filters fast or jerky scrolling.",
    },
    sectionTransitions: {
        type: ControlType.Boolean,
        title: "Transitions",
        defaultValue: DEFAULTS.sectionTransitions,
        description: "Off = switch at the zone midpoint.",
    },
    respectReducedMotion: {
        type: ControlType.Boolean,
        title: "Reduced Motion",
        defaultValue: DEFAULTS.respectReducedMotion,
        enabledTitle: "Respect",
        disabledTitle: "Ignore",
    },
    debug: {
        type: ControlType.Boolean,
        title: "Debug",
        defaultValue: DEFAULTS.debug,
        description: "Preview only: shows which section IDs were found.",
    },

    // ── Responsive ───────────────────────────────────────────────────────
    mobileBreakpoint: {
        type: ControlType.Number,
        title: "Mobile Below",
        defaultValue: DEFAULTS.mobileBreakpoint,
        min: 0,
        max: 1600,
        step: 10,
        unit: "px",
    },
    mobileScale: {
        type: ControlType.Number,
        title: "Mobile Scale",
        defaultValue: DEFAULTS.mobileScale,
        min: 0.2,
        max: 2,
        step: 0.05,
    },
    mobileCharSize: {
        type: ControlType.Number,
        title: "Mobile Char",
        defaultValue: DEFAULTS.mobileCharSize,
        min: 0,
        max: 32,
        step: 1,
        unit: "px",
        description: "Minimum char size on mobile (0 = off).",
    },
    previewSection: {
        type: ControlType.Number,
        title: "Canvas Preview",
        defaultValue: DEFAULTS.previewSection,
        min: 1,
        max: 20,
        step: 1,
        displayStepper: true,
        description: "Which section the editor canvas shows.",
    },

    // ── Sections ─────────────────────────────────────────────────────────
    sections: {
        type: ControlType.Array,
        title: "Sections",
        maxCount: 20,
        defaultValue: DEFAULT_SECTIONS,
        control: {
            type: ControlType.Object,
            buttonTitle: "Section",
            controls: {
                section: {
                    type: ControlType.Link,
                    title: "Section",
                    description:
                        "Pick this page, then its Scroll Section. Range is measured automatically.",
                },
                name: {
                    type: ControlType.String,
                    title: "Label",
                    defaultValue: "",
                    placeholder: "Auto (section name)",
                },
                shape: {
                    type: ControlType.Enum,
                    title: "Shape",
                    options: SHAPE_OPTIONS,
                    optionTitles: SHAPE_TITLES,
                    defaultValue: "knot",
                    description:
                        "Pick “Image (Upload)” to use your own picture below.",
                },
                scripted: {
                    type: ControlType.Boolean,
                    title: "Use Scripted Animation",
                    defaultValue: false,
                    description:
                        "The Next Touch sequence: the device drawn live as ASCII from its geometry, with QR code, data cloud, card and checkmark, driven by scroll inside this section. Replaces the shape.",
                },
                scriptModel: {
                    type: ControlType.File,
                    title: "Device Model",
                    allowedFileTypes: ["json"],
                    description:
                        "The geometry file packed from the STEP model (nexttouch-geo.json). Upload it here once; Framer hosts it.",
                    hidden: hideScript,
                },
                scriptModelUrl: {
                    type: ControlType.String,
                    title: "Model URL",
                    defaultValue: "",
                    placeholder: "https://…/nexttouch-geo.json",
                    description:
                        "Instead of the upload: where the geometry file is hosted (the host must allow cross-origin requests).",
                    hidden: hideScript,
                },
                scriptSize: {
                    type: ControlType.Number,
                    title: "Device Size",
                    defaultValue: 62,
                    min: 10,
                    max: 150,
                    step: 1,
                    unit: "%",
                    description:
                        "Relative size of the device (× Scale × milestone scale). At 62 it is about half the viewport high.",
                    hidden: hideScript,
                },
                scriptLook: {
                    type: ControlType.Object,
                    title: "Device Look",
                    buttonTitle: "Look",
                    hidden: hideScript,
                    controls: {
                        contour: {
                            type: ControlType.Number,
                            title: "Contour",
                            defaultValue: 0.45,
                            min: 0,
                            max: 1,
                            step: 0.05,
                            description:
                                "A quiet hairline drawing of the device's edges under the characters, fading towards the back. 0 = off.",
                        },
                        contourColor: {
                            type: ControlType.Color,
                            title: "Contour Color",
                            optional: true,
                            description: "Empty = the global ink.",
                        },
                        detail: {
                            type: ControlType.Number,
                            title: "Detail Cell",
                            defaultValue: 0.55,
                            min: 0.35,
                            max: 1,
                            step: 0.05,
                            description:
                                "Cell size of the detailed elements (QR, receipt, card, checkmark) relative to the page's Char Size. Smaller characters read as finer detail.",
                        },
                        checkColor: {
                            type: ControlType.Color,
                            title: "Checkmark",
                            defaultValue: "#16A05A",
                        },
                        bodyTone: {
                            type: ControlType.Number,
                            title: "Body Tone",
                            defaultValue: 0.5,
                            min: 0,
                            max: 1,
                            step: 0.05,
                            description:
                                "Characters on the surfaces, picked from the ramp by their shading, like the other ASCII shapes. 0 = contour only.",
                        },
                        screenTone: {
                            type: ControlType.Number,
                            title: "Screen Tone",
                            defaultValue: 0.5,
                            min: 0,
                            max: 1,
                            step: 0.05,
                            description:
                                "Density of the even texture on the two displays.",
                        },
                        edgeAngle: {
                            type: ControlType.Number,
                            title: "Edge Angle",
                            defaultValue: 28,
                            min: 8,
                            max: 70,
                            step: 1,
                            unit: "°",
                            description:
                                "Edges between faces that meet at more than this angle are drawn. Higher = fewer lines.",
                        },
                        minEdge: {
                            type: ControlType.Number,
                            title: "Skip Short Edges",
                            defaultValue: 6,
                            min: 0,
                            max: 40,
                            step: 1,
                            unit: "mm",
                            description:
                                "Edges shorter than this on the real device are left out.",
                        },
                        details: {
                            type: ControlType.Boolean,
                            title: "Small Parts",
                            defaultValue: false,
                            description: "Ports, screws and feet.",
                        },
                        panel: {
                            type: ControlType.Boolean,
                            title: "Dark Screen Panel",
                            defaultValue: false,
                            description:
                                "A dark panel under the QR code and the checkmark, with light characters. Off = pure ASCII on the page colour.",
                        },
                        opacity: {
                            type: ControlType.Number,
                            title: "Opacity",
                            defaultValue: 1,
                            min: 0,
                            max: 1,
                            step: 0.05,
                            description:
                                "Of the device and its ASCII elements. Independent of the global Intensity and the section's Opacity.",
                        },
                        elementColor: {
                            type: ControlType.Color,
                            title: "Element Color",
                            optional: true,
                            description:
                                "Ink of the data cloud and card. Empty = the global ink, or a contrast colour if that ink is too subtle on this page.",
                        },
                        scramble: {
                            type: ControlType.Boolean,
                            title: "Scramble Turns",
                            defaultValue: true,
                            description:
                                "Glyphs scramble while the device turns to a new camera angle.",
                        },
                        particles: {
                            type: ControlType.Number,
                            title: "Handover Particles",
                            defaultValue: 0.6,
                            min: 0,
                            max: 1,
                            step: 0.05,
                            description:
                                "Glyphs that fly between the device and the neighbouring sections' shapes (0 = off).",
                        },
                    },
                },
                m1: milestoneControl(0, "The device assembles from the previous section's glyphs while the camera tilts up from a plan view."),
                m2: milestoneControl(1, "Close-up of the customer display; the QR code builds there."),
                m3: milestoneControl(2, "Wide back view: the QR dissolves into data flowing to the NAV node."),
                m4: milestoneControl(3, "The customer's phone receives the e-receipt from NAV."),
                m5: milestoneControl(4, "Front view: the device splits into the four old devices."),
                m6: milestoneControl(5, "The four devices merge back into one."),
                m7: milestoneControl(
                    6,
                    "Payment at the customer display; the idle turn lifts the camera so both checkmarks show."
                ),
                m8: milestoneControl(
                    7,
                    "Remote access: panels lift off the large display, linked to the phone. The next section's transition then morphs the glyphs on."
                ),
                scriptTiming: {
                    type: ControlType.Object,
                    title: "Element Timing",
                    buttonTitle: "Timing",
                    description:
                        "When each ASCII element plays, in VH from the section start.",
                    hidden: hideScript,
                    controls: timingControls(),
                },
                script3d: {
                    type: ControlType.Object,
                    title: "3D Motion",
                    buttonTitle: "3D",
                    hidden: hideScript,
                    controls: {
                        perspective: {
                            type: ControlType.Number,
                            title: "Perspective",
                            defaultValue: 1.6,
                            min: 0.7,
                            max: 3,
                            step: 0.05,
                            description:
                                "Camera distance in viewport heights. Lower = stronger perspective.",
                        },
                        cloudDepth: {
                            type: ControlType.Number,
                            title: "Data Cloud Depth",
                            defaultValue: 0.3,
                            min: 0,
                            max: 0.6,
                            step: 0.01,
                            description:
                                "How far the data cloud floats in front of the screen.",
                        },
                        dataCount: {
                            type: ControlType.Number,
                            title: "Data Particles",
                            defaultValue: 340,
                            min: 0,
                            max: 900,
                            step: 20,
                        },
                    },
                },
                scriptDof: {
                    type: ControlType.Object,
                    title: "Depth of Field",
                    buttonTitle: "Focus",
                    description:
                        "Focus sits on the device; whatever comes close to the camera goes soft. The device stays sharp.",
                    hidden: hideScript,
                    controls: {
                        blur: {
                            type: ControlType.Number,
                            title: "Blur",
                            defaultValue: 1.2,
                            min: 0,
                            max: 3,
                            step: 0.05,
                            description: "0 = off.",
                        },
                        focus: {
                            type: ControlType.Number,
                            title: "Focus Distance",
                            defaultValue: 0,
                            min: -0.2,
                            max: 0.6,
                            step: 0.01,
                            description:
                                "0 = on the device; higher = closer to the camera.",
                        },
                        range: {
                            type: ControlType.Number,
                            title: "Focus Range",
                            defaultValue: 0.06,
                            min: 0,
                            max: 0.4,
                            step: 0.01,
                            description:
                                "Depth that stays sharp around the focus.",
                        },
                        pulls: {
                            type: ControlType.Number,
                            title: "Focus Pulls",
                            defaultValue: 2,
                            min: 0,
                            max: 4,
                            step: 1,
                            displayStepper: true,
                            description:
                                "How many times focus moves into the data cloud and back.",
                        },
                    },
                },
                scriptPreview: {
                    type: ControlType.Enum,
                    title: "Canvas State",
                    options: [1, 2, 3, 4, 5, 6, 7, 8],
                    optionTitles: SCRIPT_NAMES,
                    defaultValue: 1,
                    description: "Which milestone the editor canvas shows.",
                    hidden: hideScript,
                },
                image: {
                    type: ControlType.ResponsiveImage,
                    title: "Image",
                    description: "Used when Shape = Image (Upload).",
                },
                invert: {
                    type: ControlType.Boolean,
                    title: "Img Invert",
                    defaultValue: false,
                },
                removeBg: {
                    type: ControlType.Boolean,
                    title: "Img Remove BG",
                    defaultValue: false,
                    description:
                        "Cuts away a plain background color from the edges.",
                },
                rotation: {
                    type: ControlType.Number,
                    title: "Img Rotation",
                    defaultValue: 0,
                    min: -180,
                    max: 180,
                    step: 1,
                    unit: "°",
                },
                positionX: {
                    type: ControlType.Number,
                    title: "Position X",
                    defaultValue: 50,
                    min: -50,
                    max: 150,
                    step: 1,
                    unit: "%",
                },
                positionY: {
                    type: ControlType.Number,
                    title: "Position Y",
                    defaultValue: 50,
                    min: -50,
                    max: 150,
                    step: 1,
                    unit: "%",
                },
                scale: {
                    type: ControlType.Number,
                    title: "Scale",
                    defaultValue: 1,
                    min: 0,
                    max: 5,
                    step: 0.05,
                },
                rotationSpeed: {
                    type: ControlType.Number,
                    title: "Spin Speed",
                    defaultValue: 1,
                    min: 0,
                    max: 5,
                    step: 0.05,
                    description: "3D shapes.",
                },
                direction: {
                    type: ControlType.Enum,
                    title: "Direction",
                    options: ["cw", "ccw"],
                    optionTitles: ["Forward", "Reverse"],
                    defaultValue: "cw",
                    displaySegmentedControl: true,
                },
                charSize: {
                    type: ControlType.Number,
                    title: "Char Size",
                    defaultValue: 0,
                    min: 0,
                    max: 32,
                    step: 1,
                    unit: "px",
                    description: "0 = global char size.",
                },
                opacity: {
                    type: ControlType.Number,
                    title: "Opacity",
                    defaultValue: 1,
                    min: 0,
                    max: 1,
                    step: 0.01,
                },
                accentColor: {
                    type: ControlType.Color,
                    title: "Accent",
                    optional: true,
                    description: "Empty or transparent = global accent.",
                },
                transition: {
                    type: ControlType.Number,
                    title: "Transition",
                    defaultValue: 60,
                    min: 0,
                    max: 300,
                    step: 5,
                    unit: "vh",
                    description:
                        "Length of the morph into this section (gaps between sections are used automatically).",
                },
                start: {
                    type: ControlType.Number,
                    title: "Manual Start",
                    defaultValue: 0,
                    min: 0,
                    max: 100000,
                    step: 10,
                    description: "Only used in Manual Range mode.",
                },
                end: {
                    type: ControlType.Number,
                    title: "Manual End",
                    defaultValue: 60,
                    min: 0,
                    max: 100000,
                    step: 10,
                    description: "Only used in Manual Range mode.",
                },
                mobileX: {
                    type: ControlType.Number,
                    title: "Mobile X",
                    defaultValue: -1,
                    min: -1,
                    max: 100,
                    step: 1,
                    description: "-1 = same as desktop.",
                },
                mobileY: {
                    type: ControlType.Number,
                    title: "Mobile Y",
                    defaultValue: -1,
                    min: -1,
                    max: 100,
                    step: 1,
                    description: "-1 = same as desktop.",
                },
            },
        },
    },
})

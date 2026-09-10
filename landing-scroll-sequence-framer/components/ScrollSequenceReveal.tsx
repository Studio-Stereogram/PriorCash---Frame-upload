import * as React from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"
import {
    motion,
    useMotionValue,
    useReducedMotion,
    useScroll,
    useSpring,
    useTransform,
} from "framer-motion"

type Props = {
    style?: React.CSSProperties
    mode: "sequence" | "video"
    frameBaseUrl: string
    frameCount: number
    frameStartIndex: number
    framePad: number
    frameExtension: string
    videoMp4: string
    videoWebm: string
    poster: string
    scrollLength: number
    objectFit: "contain" | "cover"
    backgroundColor: string
    startScale: number
    endScale: number
    startOpacity: number
    endOpacity: number
    mediaScale: number
    sequenceMapping: "linear" | "scenes"
    scenes: Scene[]
    snapToScenes: boolean
    snapRange: number
    snapDelay: number
    snapSpeedLimit: number
    preloadRadius: number
    maxCanvasDpr: number
    animateOnCanvas: boolean
}

type Scene = {
    enabled: boolean
    name: string
    rangeMode: "percent" | "frames"
    scrollFrom: number
    scrollTo: number
    frameFrom: number
    frameTo: number
    frameFromPercent: number
    frameToPercent: number
}

const DEFAULT_FRAME_BASE =
    "https://YOUR-CDN.example.com/landing-sequence/frame-"
const DEFAULT_LANDING_MP4 =
    "https://prior-cash-frame-upload.vercel.app/landing-scroll-sequence-framer/assets/landing-scroll-1280.mp4"
const DEFAULT_LANDING_WEBM =
    "https://prior-cash-frame-upload.vercel.app/landing-scroll-sequence-framer/assets/landing-scroll-1280.webm"
const DEFAULT_LANDING_POSTER =
    "https://prior-cash-frame-upload.vercel.app/landing-scroll-sequence-framer/assets/landing-poster.jpg"

function frameUrl(
    baseUrl: string,
    index: number,
    pad: number,
    extension: string
) {
    return `${baseUrl}${String(index).padStart(pad, "0")}.${extension.replace(
        ".",
        ""
    )}`
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max)
}

function progressToFrameIndex(
    progress: number,
    frameCount: number,
    scenes: Scene[]
) {
    const lastFrameIndex = Math.max(0, frameCount - 1)
    const safeProgress = clamp(progress, 0, 1)
    const activeScenes = getActiveScenes(scenes)

    if (!activeScenes.length) return Math.round(safeProgress * lastFrameIndex)

    const progressPercent = safeProgress * 100
    if (progressPercent < activeScenes[0].scrollFrom) {
        return sceneStartFrame(activeScenes[0], lastFrameIndex)
    }

    for (let index = 0; index < activeScenes.length; index += 1) {
        const scene = activeScenes[index]

        if (progressPercent >= scene.scrollFrom && progressPercent <= scene.scrollTo) {
            const sceneProgress =
                (progressPercent - scene.scrollFrom) /
                (scene.scrollTo - scene.scrollFrom)
            const from = sceneStartFrame(scene, lastFrameIndex)
            const to = sceneEndFrame(scene, lastFrameIndex)

            return Math.round(from + clamp(sceneProgress, 0, 1) * (to - from))
        }

        if (progressPercent < scene.scrollFrom) {
            const previousScene = activeScenes[Math.max(0, index - 1)]
            return sceneEndFrame(previousScene, lastFrameIndex)
        }
    }

    return sceneEndFrame(activeScenes[activeScenes.length - 1], lastFrameIndex)
}

function getActiveScenes(scenes: Scene[]) {
    return scenes
        .filter((scene) => scene.enabled && scene.scrollTo > scene.scrollFrom)
        .sort((a, b) => a.scrollFrom - b.scrollFrom)
}

function nearestSceneSnapProgress(
    progress: number,
    scenes: Scene[],
    snapRange: number
) {
    const activeScenes = getActiveScenes(scenes)
    if (!activeScenes.length) return null

    const points = activeScenes.flatMap((scene) => [
        clamp(scene.scrollFrom, 0, 100) / 100,
        clamp(scene.scrollTo, 0, 100) / 100,
    ])
    const range = clamp(snapRange, 0, 20) / 100
    let bestPoint: number | null = null
    let bestDistance = Infinity

    for (const point of points) {
        const distance = Math.abs(point - progress)
        if (distance < bestDistance) {
            bestDistance = distance
            bestPoint = point
        }
    }

    return bestPoint !== null && bestDistance <= range ? bestPoint : null
}

function sceneStartFrame(scene: Scene, lastFrameIndex: number) {
    if (scene.rangeMode === "percent") {
        return Math.round(
            (clamp(scene.frameFromPercent, 0, 100) / 100) * lastFrameIndex
        )
    }

    return clamp(Math.round(scene.frameFrom) - 1, 0, lastFrameIndex)
}

function sceneEndFrame(scene: Scene, lastFrameIndex: number) {
    if (scene.rangeMode === "percent") {
        return Math.round(
            (clamp(scene.frameToPercent, 0, 100) / 100) * lastFrameIndex
        )
    }

    return clamp(Math.round(scene.frameTo) - 1, 0, lastFrameIndex)
}

function useElementSize(ref: React.RefObject<HTMLElement>) {
    const [size, setSize] = React.useState({ width: 0, height: 0 })

    React.useEffect(() => {
        if (!ref.current || typeof ResizeObserver === "undefined") return

        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect
            setSize({ width, height })
        })

        observer.observe(ref.current)
        return () => observer.disconnect()
    }, [ref])

    return size
}

function drawCoverContain(
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    canvasWidth: number,
    canvasHeight: number,
    fit: Props["objectFit"],
    mediaScale: number
) {
    const imageRatio = image.naturalWidth / image.naturalHeight
    const canvasRatio = canvasWidth / canvasHeight
    const useCover = fit === "cover"
    const fillByWidth = useCover
        ? imageRatio < canvasRatio
        : imageRatio > canvasRatio

    const width =
        (fillByWidth ? canvasWidth : canvasHeight * imageRatio) * mediaScale
    const height =
        (fillByWidth ? canvasWidth / imageRatio : canvasHeight) * mediaScale
    const x = (canvasWidth - width) / 2
    const y = (canvasHeight - height) / 2

    context.clearRect(0, 0, canvasWidth, canvasHeight)
    context.drawImage(image, x, y, width, height)
}

export default function ScrollSequenceReveal(props: Props) {
    const {
        style,
        mode,
        frameBaseUrl,
        frameCount,
        frameStartIndex,
        framePad,
        frameExtension,
        videoMp4,
        videoWebm,
        poster,
        scrollLength,
        objectFit,
        backgroundColor,
        startScale,
        endScale,
        startOpacity,
        endOpacity,
        mediaScale,
        sequenceMapping,
        scenes,
        snapToScenes,
        snapRange,
        snapDelay,
        snapSpeedLimit,
        preloadRadius,
        maxCanvasDpr,
        animateOnCanvas,
    } = props

    const sectionRef = React.useRef<HTMLDivElement>(null)
    const stageRef = React.useRef<HTMLDivElement>(null)
    const canvasRef = React.useRef<HTMLCanvasElement>(null)
    const imageCache = React.useRef(new Map<number, HTMLImageElement>())
    const rafRef = React.useRef<number | null>(null)
    const currentFrameRef = React.useRef(-1)
    const reducedMotion = useReducedMotion()
    const size = useElementSize(stageRef)
    const isCanvas = RenderTarget.current() === RenderTarget.canvas
    const shouldRenderSequence =
        mode === "sequence" && !reducedMotion && (!isCanvas || animateOnCanvas)

    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start start", "end end"],
    })

    const visualProgressTarget = useMotionValue(0)
    const visualProgress = useSpring(visualProgressTarget, {
        stiffness: 140,
        damping: 34,
        mass: 0.25,
    })

    const scale = useTransform(
        visualProgress,
        [0, 1],
        [startScale, endScale]
    )
    const opacity = useTransform(
        visualProgress,
        [0, 0.08, 0.92, 1],
        [startOpacity, 1, 1, endOpacity]
    )

    const lastFrameIndex = Math.max(0, frameCount - 1)
    const safeFrameBaseUrl = frameBaseUrl || DEFAULT_FRAME_BASE

    const loadFrame = React.useCallback(
        (index: number) => {
            const safeIndex = clamp(index, 0, lastFrameIndex)
            const cached = imageCache.current.get(safeIndex)
            if (cached) return cached

            const image = new Image()
            image.decoding = "async"
            image.loading = "eager"
            image.src = frameUrl(
                safeFrameBaseUrl,
                safeIndex + frameStartIndex,
                framePad,
                frameExtension
            )
            imageCache.current.set(safeIndex, image)
            return image
        },
        [
            frameExtension,
            framePad,
            frameStartIndex,
            lastFrameIndex,
            safeFrameBaseUrl,
        ]
    )

    const renderFrame = React.useCallback(
        (index: number) => {
            const canvas = canvasRef.current
            if (!canvas || !size.width || !size.height) return

            const dpr = clamp(window.devicePixelRatio || 1, 1, maxCanvasDpr)
            const canvasWidth = Math.round(size.width * dpr)
            const canvasHeight = Math.round(size.height * dpr)

            if (canvas.width !== canvasWidth || canvas.height !== canvasHeight) {
                canvas.width = canvasWidth
                canvas.height = canvasHeight
                canvas.style.width = `${size.width}px`
                canvas.style.height = `${size.height}px`
            }

            const requestedFrame = index
            const image = loadFrame(requestedFrame)
            const context = canvas.getContext("2d", { alpha: true })
            if (!context) return

            const paint = () => {
                if (requestedFrame !== currentFrameRef.current) return
                drawCoverContain(
                    context,
                    image,
                    canvasWidth,
                    canvasHeight,
                    objectFit,
                    mediaScale
                )
            }

            if (image.complete && image.naturalWidth > 0) {
                paint()
            } else {
                image.onload = paint
            }
        },
        [loadFrame, maxCanvasDpr, mediaScale, objectFit, size.height, size.width]
    )

    React.useEffect(() => {
        if (!shouldRenderSequence) return

        currentFrameRef.current = 0
        renderFrame(0)

        const unsubscribe = visualProgress.on("change", (latest) => {
            const nextFrame =
                sequenceMapping === "scenes"
                    ? progressToFrameIndex(latest, frameCount, scenes || [])
                    : Math.round(clamp(latest, 0, 1) * lastFrameIndex)
            if (nextFrame === currentFrameRef.current) return

            currentFrameRef.current = nextFrame

            if (rafRef.current) cancelAnimationFrame(rafRef.current)
            rafRef.current = requestAnimationFrame(() => {
                renderFrame(nextFrame)

                const min = clamp(nextFrame - preloadRadius, 0, lastFrameIndex)
                const max = clamp(nextFrame + preloadRadius, 0, lastFrameIndex)
                for (let i = min; i <= max; i += 1) loadFrame(i)

                for (const cachedIndex of imageCache.current.keys()) {
                    if (Math.abs(cachedIndex - nextFrame) > preloadRadius * 3) {
                        imageCache.current.delete(cachedIndex)
                    }
                }
            })
        })

        return () => {
            unsubscribe()
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
    }, [
        lastFrameIndex,
        frameCount,
        loadFrame,
        preloadRadius,
        reducedMotion,
        renderFrame,
        scenes,
        sequenceMapping,
        shouldRenderSequence,
        visualProgress,
    ])

    React.useEffect(() => {
        let snapTimer: number | null = null
        const lastSample = { progress: scrollYProgress.get(), time: performance.now() }
        let lastSpeed = 0

        const clearSnapTimer = () => {
            if (snapTimer) {
                window.clearTimeout(snapTimer)
                snapTimer = null
            }
        }

        const unsubscribe = scrollYProgress.on("change", (latest) => {
            const now = performance.now()
            const elapsed = Math.max(16, now - lastSample.time)
            lastSpeed = (Math.abs(latest - lastSample.progress) / elapsed) * 100000
            lastSample.progress = latest
            lastSample.time = now

            clearSnapTimer()
            visualProgressTarget.set(latest)

            if (
                !shouldRenderSequence ||
                !snapToScenes ||
                sequenceMapping !== "scenes" ||
                lastSpeed > snapSpeedLimit
            ) {
                return
            }

            snapTimer = window.setTimeout(() => {
                const snapPoint = nearestSceneSnapProgress(
                    scrollYProgress.get(),
                    scenes || [],
                    snapRange
                )

                if (snapPoint === null || lastSpeed > snapSpeedLimit) return
                visualProgressTarget.set(snapPoint)
            }, snapDelay)
        })

        visualProgressTarget.set(scrollYProgress.get())

        return () => {
            clearSnapTimer()
            unsubscribe()
        }
    }, [
        scenes,
        scrollYProgress,
        sequenceMapping,
        shouldRenderSequence,
        snapDelay,
        snapRange,
        snapSpeedLimit,
        snapToScenes,
        visualProgressTarget,
    ])

    const sectionHeight = `${scrollLength}vh`
    const showVideo = mode === "video" || reducedMotion
    const showCanvasPlaceholder = mode === "sequence" && !shouldRenderSequence
    const resolvedPoster = poster || DEFAULT_LANDING_POSTER
    const resolvedMp4 = videoMp4 || DEFAULT_LANDING_MP4
    const resolvedWebm = videoWebm || DEFAULT_LANDING_WEBM

    if (isCanvas && !animateOnCanvas) {
        return (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    minHeight: 240,
                    overflow: "hidden",
                    background: backgroundColor || "transparent",
                    ...style,
                }}
            >
                {resolvedPoster ? (
                    <img
                        src={resolvedPoster}
                        alt=""
                        draggable={false}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit,
                            display: "block",
                            transform: `scale(${mediaScale})`,
                        }}
                    />
                ) : (
                    <div
                        style={{
                            display: "grid",
                            width: "100%",
                            height: "100%",
                            placeItems: "center",
                            padding: 24,
                            color: "#5f6876",
                            background: backgroundColor || "transparent",
                            fontSize: 14,
                            textAlign: "center",
                        }}
                    >
                        Scroll animation preview is disabled on Framer canvas.
                    </div>
                )}
            </div>
        )
    }

    return (
        <section
            ref={sectionRef}
            style={{
                position: "relative",
                height: sectionHeight,
                width: "100%",
                background: backgroundColor || "transparent",
                ...style,
            }}
        >
            <div
                ref={stageRef}
                style={{
                    position: "sticky",
                    top: 0,
                    width: "100%",
                    height: "100vh",
                    overflow: "hidden",
                    background: backgroundColor || "transparent",
                }}
            >
                <motion.div
                    style={{
                        width: "100%",
                        height: "100%",
                        scale,
                        opacity,
                        willChange: "transform, opacity",
                    }}
                >
                    {showCanvasPlaceholder ? (
                        <div
                            style={{
                                display: "grid",
                                width: "100%",
                                height: "100%",
                                placeItems: "center",
                                padding: 24,
                                color: "#5f6876",
                                background: backgroundColor || "transparent",
                                fontSize: 14,
                                textAlign: "center",
                            }}
                        >
                            Scroll sequence disabled on Framer canvas. Use
                            Preview or publish to play it.
                        </div>
                    ) : showVideo ? (
                        <video
                            playsInline
                            muted
                            autoPlay
                            loop
                            preload="metadata"
                            poster={resolvedPoster}
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit,
                                display: "block",
                                transform: `scale(${mediaScale})`,
                            }}
                        >
                            {resolvedWebm && (
                                <source src={resolvedWebm} type="video/webm" />
                            )}
                            {resolvedMp4 && (
                                <source src={resolvedMp4} type="video/mp4" />
                            )}
                        </video>
                    ) : (
                        <canvas
                            ref={canvasRef}
                            aria-label="Product scroll animation"
                            role="img"
                            style={{
                                width: "100%",
                                height: "100%",
                                display: "block",
                            }}
                        />
                    )}
                </motion.div>
            </div>
        </section>
    )
}

ScrollSequenceReveal.defaultProps = {
    mode: "video",
    frameBaseUrl: DEFAULT_FRAME_BASE,
    frameCount: 120,
    frameStartIndex: 1,
    framePad: 4,
    frameExtension: "jpg",
    videoMp4: DEFAULT_LANDING_MP4,
    videoWebm: DEFAULT_LANDING_WEBM,
    poster: DEFAULT_LANDING_POSTER,
    scrollLength: 450,
    objectFit: "contain",
    backgroundColor: "rgba(0, 0, 0, 0)",
    startScale: 0.92,
    endScale: 1.04,
    startOpacity: 0,
    endOpacity: 1,
    mediaScale: 1.035,
    sequenceMapping: "linear",
    scenes: [
        {
            enabled: true,
            name: "Intro",
            rangeMode: "frames",
            scrollFrom: 0,
            scrollTo: 100,
            frameFrom: 1,
            frameTo: 120,
            frameFromPercent: 0,
            frameToPercent: 100,
        },
    ],
    snapToScenes: true,
    snapRange: 3,
    snapDelay: 120,
    snapSpeedLimit: 38,
    preloadRadius: 5,
    maxCanvasDpr: 1.5,
    animateOnCanvas: false,
}

addPropertyControls(ScrollSequenceReveal, {
    mode: {
        type: ControlType.Enum,
        title: "Mode",
        options: ["sequence", "video"],
        optionTitles: ["Sequence", "Video"],
    },
    frameBaseUrl: {
        type: ControlType.String,
        title: "Frames URL",
        placeholder: DEFAULT_FRAME_BASE,
        hidden: ({ mode }) => mode !== "sequence",
    },
    frameCount: {
        type: ControlType.Number,
        title: "Frames",
        min: 12,
        max: 1000,
        step: 1,
        hidden: ({ mode }) => mode !== "sequence",
    },
    frameStartIndex: {
        type: ControlType.Number,
        title: "Start",
        min: 0,
        max: 1000,
        step: 1,
        hidden: ({ mode }) => mode !== "sequence",
    },
    framePad: {
        type: ControlType.Number,
        title: "Pad",
        min: 1,
        max: 6,
        step: 1,
        hidden: ({ mode }) => mode !== "sequence",
    },
    frameExtension: {
        type: ControlType.Enum,
        title: "Format",
        options: ["webp", "jpg", "png"],
        optionTitles: ["WebP", "JPG", "PNG"],
        hidden: ({ mode }) => mode !== "sequence",
    },
    videoMp4: {
        type: ControlType.String,
        title: "MP4 URL",
        hidden: ({ mode }) => mode !== "video",
    },
    videoWebm: {
        type: ControlType.String,
        title: "WebM URL",
        hidden: ({ mode }) => mode !== "video",
    },
    poster: {
        type: ControlType.String,
        title: "Poster",
    },
    scrollLength: {
        type: ControlType.Number,
        title: "Scroll vh",
        min: 300,
        max: 3000,
        step: 25,
    },
    objectFit: {
        type: ControlType.Enum,
        title: "Fit",
        options: ["contain", "cover"],
        optionTitles: ["Contain", "Cover"],
    },
    backgroundColor: {
        type: ControlType.Color,
        title: "Bg",
    },
    startScale: {
        type: ControlType.Number,
        title: "Start Scale",
        min: 0.5,
        max: 2,
        step: 0.01,
    },
    endScale: {
        type: ControlType.Number,
        title: "End Scale",
        min: 0.5,
        max: 2,
        step: 0.01,
    },
    startOpacity: {
        type: ControlType.Number,
        title: "Start Opacity",
        min: 0,
        max: 1,
        step: 0.05,
    },
    endOpacity: {
        type: ControlType.Number,
        title: "End Opacity",
        min: 0,
        max: 1,
        step: 0.05,
    },
    mediaScale: {
        type: ControlType.Number,
        title: "Media Scale",
        min: 1,
        max: 1.15,
        step: 0.005,
    },
    sequenceMapping: {
        type: ControlType.Enum,
        title: "Mapping",
        options: ["linear", "scenes"],
        optionTitles: ["Linear", "Scenes"],
        hidden: ({ mode }) => mode !== "sequence",
    },
    scenes: {
        type: ControlType.Array,
        title: "Scenes",
        hidden: ({ mode, sequenceMapping }) =>
            mode !== "sequence" || sequenceMapping !== "scenes",
        control: {
            type: ControlType.Object,
            controls: {
                enabled: {
                    type: ControlType.Boolean,
                    title: "On",
                    defaultValue: true,
                },
                name: {
                    type: ControlType.String,
                    title: "Name",
                    defaultValue: "Scene",
                },
                rangeMode: {
                    type: ControlType.Enum,
                    title: "Range",
                    options: ["percent", "frames"],
                    optionTitles: ["Percent", "Frames"],
                    defaultValue: "frames",
                },
                scrollFrom: {
                    type: ControlType.Number,
                    title: "Scroll From",
                    min: 0,
                    max: 100,
                    step: 1,
                    defaultValue: 0,
                },
                scrollTo: {
                    type: ControlType.Number,
                    title: "Scroll To",
                    min: 0,
                    max: 100,
                    step: 1,
                    defaultValue: 100,
                },
                frameFrom: {
                    type: ControlType.Number,
                    title: "Frame From",
                    min: 1,
                    max: 1000,
                    step: 1,
                    defaultValue: 1,
                    hidden: ({ rangeMode }) => rangeMode !== "frames",
                },
                frameTo: {
                    type: ControlType.Number,
                    title: "Frame To",
                    min: 1,
                    max: 1000,
                    step: 1,
                    defaultValue: 120,
                    hidden: ({ rangeMode }) => rangeMode !== "frames",
                },
                frameFromPercent: {
                    type: ControlType.Number,
                    title: "Frame From %",
                    min: 0,
                    max: 100,
                    step: 1,
                    defaultValue: 0,
                    hidden: ({ rangeMode }) => rangeMode !== "percent",
                },
                frameToPercent: {
                    type: ControlType.Number,
                    title: "Frame To %",
                    min: 0,
                    max: 100,
                    step: 1,
                    defaultValue: 100,
                    hidden: ({ rangeMode }) => rangeMode !== "percent",
                },
            },
        },
    },
    snapToScenes: {
        type: ControlType.Boolean,
        title: "Snap",
        enabledTitle: "On",
        disabledTitle: "Off",
        hidden: ({ mode, sequenceMapping }) =>
            mode !== "sequence" || sequenceMapping !== "scenes",
    },
    snapRange: {
        type: ControlType.Number,
        title: "Snap Range %",
        min: 0,
        max: 20,
        step: 0.5,
        hidden: ({ mode, sequenceMapping, snapToScenes }) =>
            mode !== "sequence" || sequenceMapping !== "scenes" || !snapToScenes,
    },
    snapDelay: {
        type: ControlType.Number,
        title: "Snap Delay",
        min: 0,
        max: 500,
        step: 10,
        hidden: ({ mode, sequenceMapping, snapToScenes }) =>
            mode !== "sequence" || sequenceMapping !== "scenes" || !snapToScenes,
    },
    snapSpeedLimit: {
        type: ControlType.Number,
        title: "Snap Speed",
        min: 5,
        max: 160,
        step: 1,
        hidden: ({ mode, sequenceMapping, snapToScenes }) =>
            mode !== "sequence" || sequenceMapping !== "scenes" || !snapToScenes,
    },
    preloadRadius: {
        type: ControlType.Number,
        title: "Preload",
        min: 2,
        max: 80,
        step: 1,
        hidden: ({ mode }) => mode !== "sequence",
    },
    maxCanvasDpr: {
        type: ControlType.Number,
        title: "Max DPR",
        min: 1,
        max: 2,
        step: 0.25,
        hidden: ({ mode }) => mode !== "sequence",
    },
    animateOnCanvas: {
        type: ControlType.Boolean,
        title: "Canvas",
        enabledTitle: "Animate",
        disabledTitle: "Static",
        hidden: ({ mode }) => mode !== "sequence",
    },
})

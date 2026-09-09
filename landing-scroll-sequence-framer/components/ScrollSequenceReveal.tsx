import * as React from "react"
import { addPropertyControls, ControlType } from "framer"
import {
    motion,
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
    preloadRadius: number
    maxCanvasDpr: number
}

const DEFAULT_FRAME_BASE =
    "https://YOUR-CDN.example.com/landing-sequence/frame-"

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
    fit: Props["objectFit"]
) {
    const imageRatio = image.naturalWidth / image.naturalHeight
    const canvasRatio = canvasWidth / canvasHeight
    const useCover = fit === "cover"
    const fillByWidth = useCover
        ? imageRatio < canvasRatio
        : imageRatio > canvasRatio

    const width = fillByWidth ? canvasWidth : canvasHeight * imageRatio
    const height = fillByWidth ? canvasWidth / imageRatio : canvasHeight
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
        preloadRadius,
        maxCanvasDpr,
    } = props

    const sectionRef = React.useRef<HTMLDivElement>(null)
    const stageRef = React.useRef<HTMLDivElement>(null)
    const canvasRef = React.useRef<HTMLCanvasElement>(null)
    const imageCache = React.useRef(new Map<number, HTMLImageElement>())
    const rafRef = React.useRef<number | null>(null)
    const currentFrameRef = React.useRef(-1)
    const reducedMotion = useReducedMotion()
    const size = useElementSize(stageRef)

    const { scrollYProgress } = useScroll({
        target: sectionRef,
        offset: ["start start", "end end"],
    })

    const smoothProgress = useSpring(scrollYProgress, {
        stiffness: 140,
        damping: 34,
        mass: 0.25,
    })

    const scale = useTransform(
        smoothProgress,
        [0, 1],
        [startScale, endScale]
    )
    const opacity = useTransform(
        smoothProgress,
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
                safeIndex + 1,
                framePad,
                frameExtension
            )
            imageCache.current.set(safeIndex, image)
            return image
        },
        [frameExtension, framePad, lastFrameIndex, safeFrameBaseUrl]
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

            const image = loadFrame(index)
            const context = canvas.getContext("2d", { alpha: false })
            if (!context) return

            const paint = () =>
                drawCoverContain(
                    context,
                    image,
                    canvasWidth,
                    canvasHeight,
                    objectFit
                )

            if (image.complete && image.naturalWidth > 0) {
                paint()
            } else {
                image.onload = paint
            }
        },
        [loadFrame, maxCanvasDpr, objectFit, size.height, size.width]
    )

    React.useEffect(() => {
        if (mode !== "sequence" || reducedMotion) return

        renderFrame(0)

        const unsubscribe = smoothProgress.on("change", (latest) => {
            const nextFrame = Math.round(clamp(latest, 0, 1) * lastFrameIndex)
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
        loadFrame,
        mode,
        preloadRadius,
        reducedMotion,
        renderFrame,
        smoothProgress,
    ])

    const sectionHeight = `${scrollLength}vh`
    const showVideo = mode === "video" || reducedMotion

    return (
        <section
            ref={sectionRef}
            style={{
                position: "relative",
                height: sectionHeight,
                width: "100%",
                background: backgroundColor,
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
                    background: backgroundColor,
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
                    {showVideo ? (
                        <video
                            playsInline
                            muted
                            autoPlay
                            loop
                            preload="metadata"
                            poster={poster}
                            style={{
                                width: "100%",
                                height: "100%",
                                objectFit,
                                display: "block",
                            }}
                        >
                            {videoWebm && (
                                <source src={videoWebm} type="video/webm" />
                            )}
                            {videoMp4 && (
                                <source src={videoMp4} type="video/mp4" />
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
    mode: "sequence",
    frameBaseUrl: DEFAULT_FRAME_BASE,
    frameCount: 120,
    framePad: 4,
    frameExtension: "jpg",
    videoMp4: "",
    videoWebm: "",
    poster: "",
    scrollLength: 450,
    objectFit: "contain",
    backgroundColor: "#F4F7F8",
    startScale: 0.92,
    endScale: 1.04,
    startOpacity: 0,
    endOpacity: 1,
    preloadRadius: 5,
    maxCanvasDpr: 1.5,
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
        max: 240,
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
        max: 600,
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
    preloadRadius: {
        type: ControlType.Number,
        title: "Preload",
        min: 2,
        max: 20,
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
})

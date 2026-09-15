import * as React from "react"
import { addPropertyControls, ControlType, RenderTarget } from "framer"

type Props = {
    enabled: boolean
    targets: string
    msPer100vh: number
    minDuration: number
    maxDuration: number
    offset: number
    disabledOnCanvas: boolean
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max)
}

function easeInOutCubic(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function parseTargets(targets: string) {
    return new Set(
        targets
            .split(",")
            .map((target) => target.trim().replace(/^#/, ""))
            .filter(Boolean)
    )
}

function getAnchorIdFromHref(rawHref: string | null) {
    if (!rawHref) return null

    try {
        const url = new URL(rawHref, window.location.href)
        if (url.pathname !== window.location.pathname || !url.hash) return null
        return decodeURIComponent(url.hash.slice(1))
    } catch {
        if (!rawHref.startsWith("#")) return null
        return decodeURIComponent(rawHref.slice(1))
    }
}

function selectorEscape(value: string) {
    return window.CSS?.escape ? CSS.escape(value) : value.replace(/"/g, '\\"')
}

function findAnchorElement(id: string) {
    const escapedId = selectorEscape(id)

    return (
        document.getElementById(id) ||
        document.querySelector(`[name="${escapedId}"]`) ||
        document.querySelector(`[data-framer-name="${escapedId}"]`)
    )
}

export default function SmoothAnchorController(props: Props) {
    const {
        targets,
        msPer100vh,
        minDuration,
        maxDuration,
        offset,
        disabledOnCanvas,
    } = props
    const rafRef = React.useRef<number | null>(null)
    const isCanvas = RenderTarget.current() === RenderTarget.canvas

    React.useEffect(() => {
        if (!enabled) return
        if (disabledOnCanvas && isCanvas) return

        const allowedTargets = parseTargets(targets)
        if (!allowedTargets.size) return

        const onClick = (event: MouseEvent) => {
            const target = event.target
            if (!(target instanceof Element)) return

            const link = target.closest("a")
            if (!link) return

            const targetId = getAnchorIdFromHref(link.getAttribute("href"))
            if (!targetId || !allowedTargets.has(targetId)) return

            const anchorElement = findAnchorElement(targetId)
            if (!anchorElement) return

            event.preventDefault()
            event.stopPropagation()

            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current)
                rafRef.current = null
            }

            const startY = window.scrollY
            const targetY =
                anchorElement.getBoundingClientRect().top + window.scrollY - offset
            const distance = targetY - startY
            const distanceInVh = Math.abs(distance) / window.innerHeight
            const duration = clamp(
                distanceInVh * msPer100vh,
                minDuration,
                maxDuration
            )
            const startTime = performance.now()

            const tick = (now: number) => {
                const progress = clamp((now - startTime) / duration, 0, 1)
                window.scrollTo(0, startY + distance * easeInOutCubic(progress))

                if (progress < 1) {
                    rafRef.current = requestAnimationFrame(tick)
                    return
                }

                rafRef.current = null
                window.history.pushState(null, "", `#${targetId}`)
            }

            rafRef.current = requestAnimationFrame(tick)
        }

        document.addEventListener("click", onClick, true)

        return () => {
            document.removeEventListener("click", onClick, true)
            if (rafRef.current) cancelAnimationFrame(rafRef.current)
        }
    }, [
        disabledOnCanvas,
        enabled,
        isCanvas,
        maxDuration,
        minDuration,
        msPer100vh,
        offset,
        targets,
    ])

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                minWidth: 20,
                minHeight: 20,
                pointerEvents: "none",
                opacity: isCanvas ? 0.25 : 0,
                borderRadius: 6,
                background:
                    "repeating-linear-gradient(135deg, #0614f4 0 2px, transparent 2px 8px)",
            }}
        />
    )
}

SmoothAnchorController.defaultProps = {
    enabled: false,
    targets: "scroll-1, scroll-2, scroll-3, scroll-4",
    msPer100vh: 120,
    minDuration: 900,
    maxDuration: 5200,
    offset: 0,
    disabledOnCanvas: true,
}

addPropertyControls(SmoothAnchorController, {
    enabled: {
        type: ControlType.Boolean,
        title: "Enabled",
        enabledTitle: "On",
        disabledTitle: "Off",
    },
    targets: {
        type: ControlType.String,
        title: "Targets",
        placeholder: "scroll-1, scroll-2, scroll-3, scroll-4",
        hidden: ({ enabled }) => !enabled,
    },
    msPer100vh: {
        type: ControlType.Number,
        title: "Speed",
        min: 40,
        max: 400,
        step: 10,
        hidden: ({ enabled }) => !enabled,
    },
    minDuration: {
        type: ControlType.Number,
        title: "Min",
        min: 200,
        max: 3000,
        step: 100,
        hidden: ({ enabled }) => !enabled,
    },
    maxDuration: {
        type: ControlType.Number,
        title: "Max",
        min: 1000,
        max: 12000,
        step: 100,
        hidden: ({ enabled }) => !enabled,
    },
    offset: {
        type: ControlType.Number,
        title: "Offset",
        min: -500,
        max: 500,
        step: 10,
        hidden: ({ enabled }) => !enabled,
    },
    disabledOnCanvas: {
        type: ControlType.Boolean,
        title: "Canvas",
        enabledTitle: "Off",
        disabledTitle: "On",
        hidden: ({ enabled }) => !enabled,
    },
})

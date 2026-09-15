import * as React from "react"
import { addPropertyControls, ControlType } from "framer"

type Props = {
    label: string
    target: string
    iconSource: "builtin" | "slot"
    builtinIcon: "up" | "down"
    icon?: React.ReactNode
    iconPosition: "left" | "right"
    behavior: "native" | "smooth"
    msPer100vh: number
    minDuration: number
    maxDuration: number
    offset: number
    width: number | string
    height: number | string
    radius: number
    background: string
    hoverBackground: string
    color: string
    borderColor: string
    borderWidth: number
    hoverRingColor: string
    hoverRingWidth: number
    gap: number
    paddingX: number
    fontSize: number
    fontWeight: number
    iconSize: number
    showLabel: boolean
}

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max)
}

function easeInOutCubic(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function cleanTarget(target: string) {
    return target.trim().replace(/^#/, "")
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

function smoothScrollTo(
    element: Element,
    msPer100vh: number,
    minDuration: number,
    maxDuration: number,
    offset: number
) {
    const startY = window.scrollY
    const targetY = element.getBoundingClientRect().top + window.scrollY - offset
    const distance = targetY - startY
    const distanceInVh = Math.abs(distance) / window.innerHeight
    const duration = clamp(distanceInVh * msPer100vh, minDuration, maxDuration)
    const startTime = performance.now()
    let raf = 0

    const tick = (now: number) => {
        const progress = clamp((now - startTime) / duration, 0, 1)
        window.scrollTo(0, startY + distance * easeInOutCubic(progress))

        if (progress < 1) {
            raf = requestAnimationFrame(tick)
        }
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
}

function ChevronIcon({
    direction,
    size,
}: {
    direction: "up" | "down"
    size: number
}) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            focusable="false"
            style={{
                display: "block",
                transform: direction === "down" ? "rotate(180deg)" : "none",
            }}
        >
            <path
                d="M6.75 14.25L12 9l5.25 5.25"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    )
}

export default function ProductAnchorButton(props: Props) {
    const {
        label,
        target,
        iconSource,
        builtinIcon,
        icon,
        iconPosition,
        behavior,
        msPer100vh,
        minDuration,
        maxDuration,
        offset,
        width,
        height,
        radius,
        background,
        hoverBackground,
        color,
        borderColor,
        borderWidth,
        hoverRingColor,
        hoverRingWidth,
        gap,
        paddingX,
        fontSize,
        fontWeight,
        iconSize,
        showLabel,
    } = props
    const [hovered, setHovered] = React.useState(false)
    const cancelScrollRef = React.useRef<(() => void) | null>(null)
    const targetId = cleanTarget(target)

    React.useEffect(() => {
        return () => cancelScrollRef.current?.()
    }, [])

    const goToTarget = (event: React.MouseEvent<HTMLAnchorElement>) => {
        if (!targetId) return

        const element = findAnchorElement(targetId)
        if (!element) return

        if (behavior === "native") return

        event.preventDefault()
        cancelScrollRef.current?.()
        cancelScrollRef.current = smoothScrollTo(
            element,
            msPer100vh,
            minDuration,
            maxDuration,
            offset
        )
        window.history.pushState(null, "", `#${targetId}`)
    }

    const resolvedIcon =
        iconSource === "builtin" ? (
            <ChevronIcon direction={builtinIcon} size={iconSize} />
        ) : (
            icon
        )

    const iconElement = resolvedIcon ? (
        <span
            style={{
                display: "grid",
                width: iconSize,
                height: iconSize,
                placeItems: "center",
                flex: "0 0 auto",
            }}
        >
            {resolvedIcon}
        </span>
    ) : null

    return (
        <a
            href={`#${targetId}`}
            onClick={goToTarget}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                position: "relative",
                display: "inline-flex",
                width,
                height,
                alignItems: "center",
                justifyContent: "center",
                gap,
                padding: `0 ${paddingX}px`,
                border: `${borderWidth}px solid ${borderColor}`,
                borderRadius: radius,
                color,
                background: hovered ? hoverBackground : background,
                fontSize,
                fontWeight,
                lineHeight: 1,
                textDecoration: "none",
                whiteSpace: "nowrap",
                cursor: "pointer",
                userSelect: "none",
                transition:
                    "background-color 160ms ease, border-color 160ms ease, transform 160ms ease",
                transform: hovered ? "translateY(-1px)" : "translateY(0)",
            }}
        >
            <span
                aria-hidden="true"
                style={{
                    position: "absolute",
                    inset: -4,
                    border: `${hoverRingWidth}px solid ${hoverRingColor}`,
                    borderRadius: radius + 4,
                    opacity: hovered ? 1 : 0,
                    pointerEvents: "none",
                    transition: "opacity 160ms ease",
                }}
            />
            {iconPosition === "left" && iconElement}
            {showLabel && <span>{label}</span>}
            {iconPosition === "right" && iconElement}
        </a>
    )
}

ProductAnchorButton.defaultProps = {
    label: "Termék",
    target: "scroll-1",
    iconSource: "builtin",
    builtinIcon: "up",
    iconPosition: "left",
    behavior: "native",
    msPer100vh: 120,
    minDuration: 900,
    maxDuration: 5200,
    offset: 0,
    width: 48,
    height: 48,
    radius: 8,
    background: "#F4F7F8",
    hoverBackground: "#EAF0F3",
    color: "#111827",
    borderColor: "rgba(17, 24, 39, 0.08)",
    borderWidth: 1,
    hoverRingColor: "#0614F4",
    hoverRingWidth: 1,
    gap: 0,
    paddingX: 0,
    fontSize: 15,
    fontWeight: 600,
    iconSize: 18,
    showLabel: false,
}

addPropertyControls(ProductAnchorButton, {
    label: {
        type: ControlType.String,
        title: "Label",
    },
    target: {
        type: ControlType.Enum,
        title: "Target",
        options: ["scroll-1", "scroll-2", "scroll-3", "scroll-4"],
        optionTitles: ["T6", "T11", "Moon", "Pair"],
    },
    iconSource: {
        type: ControlType.Enum,
        title: "Icon",
        options: ["builtin", "slot"],
        optionTitles: ["Built-in", "Slot"],
    },
    builtinIcon: {
        type: ControlType.Enum,
        title: "Variant",
        options: ["up", "down"],
        optionTitles: ["Up", "Down"],
        hidden: ({ iconSource }) => iconSource !== "builtin",
    },
    icon: {
        type: ControlType.ComponentInstance,
        title: "Icon Slot",
        hidden: ({ iconSource }) => iconSource !== "slot",
    },
    iconPosition: {
        type: ControlType.Enum,
        title: "Icon Pos",
        options: ["left", "right"],
        optionTitles: ["Left", "Right"],
    },
    behavior: {
        type: ControlType.Enum,
        title: "Scroll",
        options: ["native", "smooth"],
        optionTitles: ["Native", "Smooth"],
    },
    msPer100vh: {
        type: ControlType.Number,
        title: "Speed",
        min: 40,
        max: 400,
        step: 10,
        hidden: ({ behavior }) => behavior !== "smooth",
    },
    minDuration: {
        type: ControlType.Number,
        title: "Min",
        min: 200,
        max: 3000,
        step: 100,
        hidden: ({ behavior }) => behavior !== "smooth",
    },
    maxDuration: {
        type: ControlType.Number,
        title: "Max",
        min: 1000,
        max: 12000,
        step: 100,
        hidden: ({ behavior }) => behavior !== "smooth",
    },
    offset: {
        type: ControlType.Number,
        title: "Offset",
        min: -500,
        max: 500,
        step: 10,
        hidden: ({ behavior }) => behavior !== "smooth",
    },
    showLabel: {
        type: ControlType.Boolean,
        title: "Label",
        enabledTitle: "Show",
        disabledTitle: "Hide",
    },
    background: {
        type: ControlType.Color,
        title: "Bg",
    },
    hoverBackground: {
        type: ControlType.Color,
        title: "Hover Bg",
    },
    color: {
        type: ControlType.Color,
        title: "Text",
    },
    borderColor: {
        type: ControlType.Color,
        title: "Border",
    },
    borderWidth: {
        type: ControlType.Number,
        title: "Border W",
        min: 0,
        max: 4,
        step: 1,
    },
    hoverRingColor: {
        type: ControlType.Color,
        title: "Hover Ring",
    },
    hoverRingWidth: {
        type: ControlType.Number,
        title: "Ring W",
        min: 0,
        max: 4,
        step: 1,
    },
    radius: {
        type: ControlType.Number,
        title: "Radius",
        min: 0,
        max: 32,
        step: 1,
    },
    gap: {
        type: ControlType.Number,
        title: "Gap",
        min: 0,
        max: 32,
        step: 1,
        hidden: ({ showLabel }) => !showLabel,
    },
    paddingX: {
        type: ControlType.Number,
        title: "Pad X",
        min: 0,
        max: 48,
        step: 1,
        hidden: ({ showLabel }) => !showLabel,
    },
    fontSize: {
        type: ControlType.Number,
        title: "Font",
        min: 10,
        max: 32,
        step: 1,
        hidden: ({ showLabel }) => !showLabel,
    },
    fontWeight: {
        type: ControlType.Number,
        title: "Weight",
        min: 300,
        max: 900,
        step: 50,
        hidden: ({ showLabel }) => !showLabel,
    },
    iconSize: {
        type: ControlType.Number,
        title: "Icon Size",
        min: 10,
        max: 40,
        step: 1,
    },
})

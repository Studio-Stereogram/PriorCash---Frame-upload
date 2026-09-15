import * as React from "react"
import type { ComponentType, MouseEvent } from "react"

type AnyProps = Record<string, any>

const DEFAULT_DURATION = 1800
const DEFAULT_OFFSET = 0

function easeInOutCubic(t: number) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function getHashTarget(rawHref?: string) {
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

function findTargetElement(id: string) {
    if (!id) return null
    const escapedId = window.CSS?.escape ? CSS.escape(id) : id.replace(/"/g, '\\"')

    return (
        document.getElementById(id) ||
        document.querySelector(`[name="${escapedId}"]`) ||
        document.querySelector(`[data-framer-name="${escapedId}"]`)
    )
}

function scrollToElement(element: Element, duration: number, offset: number) {
    const startY = window.scrollY
    const rect = element.getBoundingClientRect()
    const targetY = rect.top + window.scrollY - offset
    const distance = targetY - startY
    const startTime = performance.now()

    const tick = (now: number) => {
        const elapsed = now - startTime
        const progress = Math.min(elapsed / duration, 1)
        const eased = easeInOutCubic(progress)

        window.scrollTo(0, startY + distance * eased)

        if (progress < 1) requestAnimationFrame(tick)
    }

    requestAnimationFrame(tick)
}

function getHrefFromEvent(event: MouseEvent<HTMLElement>, props: AnyProps) {
    const currentTarget = event.currentTarget
    const nearestLink = currentTarget.closest?.("a")

    return (
        props.href ||
        props.link ||
        props.url ||
        currentTarget.getAttribute?.("href") ||
        nearestLink?.getAttribute("href") ||
        undefined
    )
}

function createSlowAnchorOverride(duration: number, offset = DEFAULT_OFFSET) {
    return function slowAnchorOverride(Component: ComponentType<AnyProps>) {
        return function SlowAnchorComponent(props: AnyProps) {
            const handleClick = (event: MouseEvent<HTMLElement>) => {
                props.onClick?.(event)
                if (event.defaultPrevented) return

                const href = getHrefFromEvent(event, props)
                const targetId = getHashTarget(href)
                if (!targetId) return

                const element = findTargetElement(targetId)
                if (!element) return

                event.preventDefault()
                scrollToElement(element, duration, offset)

                window.history.pushState(null, "", `#${targetId}`)
            }

            return <Component {...props} onClick={handleClick} />
        }
    }
}

export const withSlowAnchor = createSlowAnchorOverride(DEFAULT_DURATION)
export const withSlowAnchorFast = createSlowAnchorOverride(1300)
export const withSlowAnchorMedium = createSlowAnchorOverride(1800)
export const withSlowAnchorSlow = createSlowAnchorOverride(2400)

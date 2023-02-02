import createGlobe from 'cobe'
import { useEffect, useRef, useState } from 'react'

export default function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState<number>()

  useEffect(() => {
    if (!canvasRef.current || typeof window === 'undefined' || !size) {
      return
    }

    let phi = 5.35

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: size * 2,
      height: size * 2,
      phi: 0,
      theta: 0,
      dark: 1,
      diffuse: 0.85,
      mapSamples: 12500,
      mapBrightness: 3.5,
      baseColor: [0.3, 0.3, 0.3],
      markerColor: [0, 0.4, 1],
      glowColor: [0, 0, 0],
      markers: [
        { location: [37.7595, -122.4367], size: 0.02 },
        { location: [20.7128, -74.006], size: 0.05 },
        { location: [5.7128, -74.006], size: 0.05 },
        { location: [140.7128, -74.006], size: 0.05 },
        { location: [40.7128, -74.006], size: 0.05 },
      ],
      onRender: (state) => {
        state.phi = phi
        phi += 0.003
      },
    })

    return () => {
      setSize(undefined)
      globe.destroy()
    }
  }, [size])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    setSize(Math.min(window.innerWidth - 40, 640))

    function handleResize(event: UIEvent) {
      if (!(event.target instanceof Window)) {
        return
      }

      setSize(Math.min(event.target.innerWidth - 40, 640))
    }

    window.addEventListener('resize', handleResize, { passive: true })

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  if (!size) {
    return null
  }

  return (
    <div className="relative mx-auto h-60 w-full overflow-hidden after:absolute after:top-1/2 after:left-0 after:right-0 after:z-40 after:mx-auto after:h-40 after:w-40 after:bg-brand-main after:bg-opacity-30 after:blur-3xl md:h-80">
      <canvas
        className="globe-canvas bg-black fill-black md:-ml-10"
        ref={canvasRef}
        width={size * 2}
        height={size * 2}
        style={{ width: size, height: size }}
      />
    </div>
  )
}

import createGlobe from 'cobe'
import { useEffect, useRef } from 'react'

export default function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current || typeof window === 'undefined') {
      return
    }

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: 600 * 2,
      height: 600 * 2,
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
        { location: [37.7595, -122.4367], size: 0.05 },
        { location: [40.7128, -74.006], size: 0.05 },
      ],
      onRender: (state) => {
        state.phi = 5.35
      },
    })

    return () => {
      globe.destroy()
    }
  }, [])

  return (
    <div className="relative mx-auto max-h-[300px] w-full overflow-hidden after:absolute after:top-1/2 after:left-0 after:right-0 after:z-40 after:mx-auto after:h-40 after:w-40 after:bg-brand-main after:bg-opacity-30 after:blur-3xl">
      <canvas
        className="globe-canvas bg-black"
        ref={canvasRef}
        style={{ width: 600, height: 600 }}
      />
    </div>
  )
}

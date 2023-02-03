import createGlobe from 'cobe'
import { useEffect, useRef, useState } from 'react'
import { useInView } from 'react-intersection-observer'

export default function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState<number>()
  const { ref, inView } = useInView()
  const currentSize = Math.min(size || 0, 600)

  useEffect(() => {
    if (!canvasRef.current || typeof window === 'undefined' || !currentSize) {
      return
    }

    let phi = 0

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: currentSize * 2,
      height: currentSize * 2,
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

        if (inView) {
          phi += 0.003
        }
      },
    })

    return () => {
      globe.destroy()
    }
  }, [inView, currentSize])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    setSize(window.innerWidth - 40)

    function handleResize(event: UIEvent) {
      if (!(event.target instanceof Window)) {
        return
      }

      setSize(event.target.innerWidth - 40)
    }

    window.addEventListener('resize', handleResize, { passive: true })

    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <div
      ref={ref}
      className="relative mx-auto h-60 w-full overflow-hidden after:absolute after:top-1/2 after:left-0 after:right-0 after:z-40 after:mx-auto after:h-40 after:w-40 after:bg-brand-main after:bg-opacity-30 after:blur-3xl md:h-80"
    >
      {size && (
        <canvas
          className="globe-canvas mx-auto bg-black fill-black md:-translate-x-5 lg:-translate-x-16 xl:translate-x-0"
          ref={canvasRef}
          width={currentSize * 2}
          height={currentSize * 2}
          style={{ width: currentSize, height: currentSize }}
        />
      )}
    </div>
  )
}

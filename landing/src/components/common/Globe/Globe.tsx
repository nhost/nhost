import createGlobe from 'cobe'
import { useEffect, useRef, useState } from 'react'
import { useInView } from 'react-intersection-observer'
import { Glow } from '../Glow'

export default function Globe() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState<number>()
  const { ref, inView } = useInView()
  const currentSize = Math.min(size || 0, 600)

  useEffect(() => {
    if (!canvasRef.current || typeof window === 'undefined' || !currentSize) {
      return
    }

    let phi = 4

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: currentSize * 2,
      height: currentSize * 2,
      phi: 4,
      theta: 0,
      dark: 1,
      diffuse: 0.85,
      mapSamples: 12500,
      mapBrightness: 3.5,
      baseColor: [0.3, 0.3, 0.3],
      markerColor: [0, 0.4, 1],
      glowColor: [0, 0, 0],
      markers: [
        // Virginia
        { location: [37.431573, -78.656894], size: 0.05 },
        // Frankfurt
        { location: [50.110922, 8.682112], size: 0.05 },
        // London
        { location: [51.509865, -0.118092], size: 0.05 },
        // Mumbai
        { location: [19.075984, 72.877656], size: 0.05 },
        //  Sao Paulo
        { location: [-23.55052, -46.633309], size: 0.05 },
        // Singapore
        { location: [1.352083, 103.819836], size: 0.05 },
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
      className="relative mx-auto h-60 w-full overflow-hidden md:h-80"
    >
      <Glow className="backface-hidden top-1/2 left-0 right-0 z-40 mx-auto h-40 w-40 bg-opacity-30 blur-3xl" />

      {size && (
        <canvas
          className="globe-canvas absolute left-1/2 z-0 mx-auto -translate-x-1/2 bg-black fill-black"
          ref={canvasRef}
          width={currentSize * 2}
          height={currentSize * 2}
          style={{ width: currentSize, height: currentSize }}
        />
      )}
    </div>
  )
}

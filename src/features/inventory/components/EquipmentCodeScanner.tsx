import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

type ScannerControls = {
  stop: () => void
}

type EquipmentCodeScannerProps = {
  onDetected: (rawText: string) => void
  onClose: () => void
}

export function EquipmentCodeScanner({
  onDetected,
  onClose,
}: EquipmentCodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const controlsRef = useRef<ScannerControls | null>(null)
  const hasDetectedRef = useRef(false)

  const [scannerStatus, setScannerStatus] = useState<
    'starting' | 'scanning' | 'detected' | 'error'
  >('starting')
  const [scannerError, setScannerError] = useState<string | null>(null)
  const [detectedValue, setDetectedValue] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const reader = new BrowserMultiFormatReader()

    async function startScanner() {
      if (!videoRef.current) {
        return
      }

      setScannerStatus('starting')
      setScannerError(null)

      try {
        const controls = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: {
                ideal: 'environment',
              },
            },
            audio: false,
          },
          videoRef.current,
          (result, error, callbackControls) => {
            if (!isMounted || hasDetectedRef.current) {
              return
            }

            if (result) {
              const rawText = result.getText().trim()

              if (!rawText) {
                return
              }

              hasDetectedRef.current = true
              controlsRef.current = callbackControls as ScannerControls

              setDetectedValue(rawText)
              setScannerStatus('detected')
              onDetected(rawText)

              callbackControls.stop()
              return
            }

            if (error) {
              // ZXing emits normal "not found" scan attempts continuously.
              // They should not be surfaced as UI errors.
            }
          },
        )

        controlsRef.current = controls as ScannerControls

        if (isMounted && !hasDetectedRef.current) {
          setScannerStatus('scanning')
        }
      } catch (error) {
        if (!isMounted) {
          return
        }

        setScannerStatus('error')

        if (error instanceof Error) {
          setScannerError(error.message)
        } else {
          setScannerError(
            'Unable to access the camera. Check browser permissions and try again.',
          )
        }
      }
    }

    void startScanner()

    return () => {
      isMounted = false
      controlsRef.current?.stop()
      controlsRef.current = null
    }
  }, [onDetected])

  function handleClose() {
    controlsRef.current?.stop()
    controlsRef.current = null
    onClose()
  }

  return (
    <article className="rounded-2xl border border-[#ffda00] bg-[#fff8d6] p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div>
          <p className="text-sm font-medium text-[#5d4a00]">
            Smart Inventory Capture
          </p>

          <h3 className="mt-1 text-xl font-semibold text-[#171717]">
            Scan Axis Box Code
          </h3>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5d4a00]">
            Point the camera at the QR code, Data Matrix, or barcode on the
            product box. The system will analyze the decoded content and try to
            identify part number, serial number and catalog information.
          </p>
        </div>

        <button
          type="button"
          onClick={handleClose}
          className="text-sm font-semibold text-[#171717] transition hover:text-black hover:underline"
        >
          Close
        </button>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
        <div className="overflow-hidden rounded-2xl border border-[#d8d8d4] bg-black">
          <video
            ref={videoRef}
            muted
            playsInline
            className="aspect-video h-full w-full object-cover"
          />
        </div>

        <div className="rounded-2xl border border-[#ead272] bg-white/70 p-5">
          <p className="text-sm font-semibold text-[#171717]">
            Scanner Status
          </p>

          {scannerStatus === 'starting' && (
            <p className="mt-3 text-sm leading-6 text-[#555555]">
              Requesting camera access...
            </p>
          )}

          {scannerStatus === 'scanning' && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-blue-800">
                Camera active. Waiting for a readable code.
              </p>

              <p className="mt-2 text-sm leading-6 text-[#555555]">
                Keep the code centered and avoid reflections when possible.
              </p>
            </div>
          )}

          {scannerStatus === 'detected' && (
            <div className="mt-3">
              <p className="text-sm font-semibold text-emerald-800">
                Code detected successfully.
              </p>

              <p className="mt-2 text-sm leading-6 text-[#555555]">
                The decoded content has been sent for interpretation.
              </p>
            </div>
          )}

          {scannerStatus === 'error' && (
            <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-800">
                Camera access failed
              </p>

              <p className="mt-2 text-sm leading-6 text-red-700">
                {scannerError ??
                  'Unable to start the camera scanner. Check browser permissions and try again.'}
              </p>
            </div>
          )}

          {detectedValue && (
            <div className="mt-5 rounded-2xl border border-[#e5e5e2] bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#777777]">
                Raw decoded content
              </p>

              <p className="mt-2 break-all text-sm leading-6 text-[#171717]">
                {detectedValue}
              </p>
            </div>
          )}
        </div>
      </div>
    </article>
  )
}
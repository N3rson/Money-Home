import { useEffect, useRef, useState } from 'preact/hooks';

/** Camera preview that reads a QR code (jsQR, loaded only when needed). */
export function Scanner({ onCode }: { onCode: (text: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('nocamera');
        const [{ default: jsQR }, media] = await Promise.all([
          import('jsqr'),
          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }),
        ]);
        stream = media;
        if (stopped) return;
        const v = video.current!;
        v.srcObject = media;
        v.setAttribute('playsinline', 'true');
        v.muted = true;
        await v.play();
        setReady(true);
        const tick = () => {
          if (stopped || !ctx) return;
          if (v.readyState >= 2 && v.videoWidth) {
            const w = Math.min(720, v.videoWidth);
            const h = Math.round((v.videoHeight * w) / v.videoWidth);
            canvas.width = w;
            canvas.height = h;
            ctx.drawImage(v, 0, 0, w, h);
            const found = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
            if (found?.data) {
              stopped = true;
              onCode(found.data);
              return;
            }
          }
          timer = setTimeout(tick, 160);
        };
        tick();
      } catch (e) {
        const name = (e as { name?: string }).name;
        setError(
          name === 'NotAllowedError'
            ? 'Brak zgody na aparat. Zezwól w ustawieniach telefonu albo wklej kod poniżej.'
            : 'Nie mogę włączyć aparatu. Wklej kod poniżej.',
        );
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div class="scanner">
      {error ? (
        <p class="scanner-msg">{error}</p>
      ) : (
        <>
          <video ref={video} muted playsInline aria-label="Podgląd aparatu" />
          <span class="scanner-frame" aria-hidden="true" />
          {!ready && <p class="scanner-msg">Włączam aparat…</p>}
        </>
      )}
    </div>
  );
}

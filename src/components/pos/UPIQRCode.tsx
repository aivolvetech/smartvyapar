import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface Props {
  value: string;
  size?: number;
}

export default function UPIQRCode({ value, size = 200 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, value, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      }, (err) => {
        if (err) console.error('Failed to generate QR Code', err);
      });
    }
  }, [value, size]);

  return <canvas ref={canvasRef} style={{ display: 'block', margin: '0 auto', maxWidth: '100%', borderRadius: '4px' }} />;
}

declare module 'qrcode' {
  interface QRCodeCanvasOptions {
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }

  interface QRCodeApi {
    toCanvas(
      canvas: HTMLCanvasElement,
      text: string,
      options: QRCodeCanvasOptions,
      callback: (error: Error | null | undefined) => void,
    ): void;
  }

  const QRCode: QRCodeApi;
  export default QRCode;
}

declare module "qrcode" {
  export type QRCodeToStringOptions = Record<string, unknown>;
  export type QRCodeToBufferOptions = Record<string, unknown>;

  const QRCode: {
    toString: (text: string, options?: QRCodeToStringOptions) => Promise<string>;
    toBuffer: (text: string, options?: QRCodeToBufferOptions) => Promise<Buffer>;
  };

  export default QRCode;
}

// Type stub for pdf-parse — no @types package exists for this module
declare module 'pdf-parse' {
  interface PDFData {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown> | null;
    text: string;
    version: string;
  }

  interface PDFOptions {
    pagerender?: (pageData: any) => string | Promise<string>;
    max?: number;
  }

  function pdfParse(buffer: Buffer, options?: PDFOptions): Promise<PDFData>;
  export = pdfParse;
}

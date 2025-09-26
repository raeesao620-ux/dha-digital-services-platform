import { apiRequest } from "@/lib/queryClient";

// PDF Service for handling all PDF generation operations
export class PDFService {
  private static instance: PDFService;

  private constructor() {}

  static getInstance(): PDFService {
    if (!PDFService.instance) {
      PDFService.instance = new PDFService();
    }
    return PDFService.instance;
  }

  // Helper function to trigger file download
  private downloadFile(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  // Helper function to convert base64 to blob
  private base64ToBlob(base64: string, contentType: string = "application/pdf"): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  }

  // Generate work permit PDF
  async generateWorkPermit(data: any): Promise<{ success: boolean; filename?: string; error?: string }> {
    try {
      const response = await apiRequest("POST", "/api/pdf/generate/work-permit", data);
      const responseData = await response.json();

      if (responseData.pdf) {
        const blob = this.base64ToBlob(responseData.pdf);
        const filename = responseData.filename || `work_permit_${Date.now()}.pdf`;
        this.downloadFile(blob, filename);
        return { success: true, filename };
      }

      return { success: false, error: "No PDF data received" };
    } catch (error: any) {
      console.error("Error generating work permit:", error);
      return { success: false, error: error.message || "Failed to generate work permit" };
    }
  }

  // Generate asylum visa PDF
  async generateAsylumVisa(data: any): Promise<{ success: boolean; filename?: string; error?: string }> {
    try {
      const response = await apiRequest("POST", "/api/pdf/generate/asylum-visa", data);
      const responseData = await response.json();

      if (responseData.pdf) {
        const blob = this.base64ToBlob(responseData.pdf);
        const filename = responseData.filename || `asylum_visa_${Date.now()}.pdf`;
        this.downloadFile(blob, filename);
        return { success: true, filename };
      }

      return { success: false, error: "No PDF data received" };
    } catch (error: any) {
      console.error("Error generating asylum visa:", error);
      return { success: false, error: error.message || "Failed to generate asylum visa" };
    }
  }

  // Generate birth certificate PDF
  async generateBirthCertificate(data: any): Promise<{ success: boolean; filename?: string; error?: string }> {
    try {
      const response = await apiRequest("POST", "/api/pdf/generate/birth-certificate", data);
      const responseData = await response.json();

      if (responseData.pdf) {
        const blob = this.base64ToBlob(responseData.pdf);
        const filename = responseData.filename || `birth_certificate_${Date.now()}.pdf`;
        this.downloadFile(blob, filename);
        return { success: true, filename };
      }

      return { success: false, error: "No PDF data received" };
    } catch (error: any) {
      console.error("Error generating birth certificate:", error);
      return { success: false, error: error.message || "Failed to generate birth certificate" };
    }
  }

  // Generate passport PDF
  async generatePassport(data: any): Promise<{ success: boolean; filename?: string; error?: string }> {
    try {
      const response = await apiRequest("POST", "/api/pdf/generate/passport", data);
      const responseData = await response.json();

      if (responseData.pdf) {
        const blob = this.base64ToBlob(responseData.pdf);
        const filename = responseData.filename || `passport_${Date.now()}.pdf`;
        this.downloadFile(blob, filename);
        return { success: true, filename };
      }

      return { success: false, error: "No PDF data received" };
    } catch (error: any) {
      console.error("Error generating passport:", error);
      return { success: false, error: error.message || "Failed to generate passport" };
    }
  }

  // Generate refugee permit PDF
  async generateRefugeePermit(data: any): Promise<{ success: boolean; filename?: string; error?: string }> {
    try {
      const response = await apiRequest("POST", "/api/pdf/generate/refugee-permit", data);
      const responseData = await response.json();

      if (responseData.pdf) {
        const blob = this.base64ToBlob(responseData.pdf);
        const filename = responseData.filename || `refugee_permit_${Date.now()}.pdf`;
        this.downloadFile(blob, filename);
        return { success: true, filename };
      }

      return { success: false, error: "No PDF data received" };
    } catch (error: any) {
      console.error("Error generating refugee permit:", error);
      return { success: false, error: error.message || "Failed to generate refugee permit" };
    }
  }

  // Generate study permit PDF
  async generateStudyPermit(data: any): Promise<{ success: boolean; filename?: string; error?: string }> {
    try {
      const response = await apiRequest("POST", "/api/pdf/generate/study-permit", data);
      const responseData = await response.json();

      if (responseData.pdf) {
        const blob = this.base64ToBlob(responseData.pdf);
        const filename = responseData.filename || `study_permit_${Date.now()}.pdf`;
        this.downloadFile(blob, filename);
        return { success: true, filename };
      }

      return { success: false, error: "No PDF data received" };
    } catch (error: any) {
      console.error("Error generating study permit:", error);
      return { success: false, error: error.message || "Failed to generate study permit" };
    }
  }

  // Generate diplomatic passport PDF
  async generateDiplomaticPassport(data: any): Promise<{ success: boolean; filename?: string; error?: string }> {
    try {
      const response = await apiRequest("POST", "/api/pdf/generate/diplomatic-passport", data);
      const responseData = await response.json();

      if (responseData.pdf) {
        const blob = this.base64ToBlob(responseData.pdf);
        const filename = responseData.filename || `diplomatic_passport_${Date.now()}.pdf`;
        this.downloadFile(blob, filename);
        return { success: true, filename };
      }

      return { success: false, error: "No PDF data received" };
    } catch (error: any) {
      console.error("Error generating diplomatic passport:", error);
      return { success: false, error: error.message || "Failed to generate diplomatic passport" };
    }
  }

  // Generate any document by type
  async generateDocument(documentType: string, data: any): Promise<{ success: boolean; filename?: string; error?: string }> {
    try {
      const response = await apiRequest("POST", `/api/pdf/generate/${documentType}`, data);
      const responseData = await response.json();

      if (responseData.pdf) {
        const blob = this.base64ToBlob(responseData.pdf);
        const filename = responseData.filename || `${documentType}_${Date.now()}.pdf`;
        this.downloadFile(blob, filename);
        return { success: true, filename };
      }

      return { success: false, error: "No PDF data received" };
    } catch (error: any) {
      console.error(`Error generating ${documentType}:`, error);
      return { success: false, error: error.message || `Failed to generate ${documentType}` };
    }
  }

  // Preview PDF (returns base64 data for preview)
  async previewDocument(documentType: string, data: any): Promise<{ success: boolean; pdfData?: string; error?: string }> {
    try {
      const response = await apiRequest("POST", `/api/pdf/preview/${documentType}`, data);
      const responseData = await response.json();

      if (responseData.pdf) {
        return { success: true, pdfData: responseData.pdf };
      }

      return { success: false, error: "No PDF data received" };
    } catch (error: any) {
      console.error(`Error previewing ${documentType}:`, error);
      return { success: false, error: error.message || `Failed to preview ${documentType}` };
    }
  }

  // Download existing PDF by reference
  async downloadExistingPDF(documentId: string, filename?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiRequest("GET", `/api/pdf/download/${documentId}`);
      const responseData = await response.json();

      if (responseData.pdf) {
        const blob = this.base64ToBlob(responseData.pdf);
        const downloadName = filename || responseData.filename || `document_${documentId}.pdf`;
        this.downloadFile(blob, downloadName);
        return { success: true };
      }

      return { success: false, error: "No PDF data received" };
    } catch (error: any) {
      console.error("Error downloading PDF:", error);
      return { success: false, error: error.message || "Failed to download PDF" };
    }
  }

  // Batch generate multiple PDFs
  async batchGeneratePDFs(documents: Array<{ type: string; data: any }>): Promise<{ 
    success: boolean; 
    results?: Array<{ type: string; success: boolean; filename?: string; error?: string }>;
    error?: string;
  }> {
    try {
      const results = await Promise.all(
        documents.map(async (doc) => {
          const result = await this.generateDocument(doc.type, doc.data);
          return { type: doc.type, ...result };
        })
      );

      const allSuccessful = results.every(r => r.success);
      return { 
        success: allSuccessful, 
        results 
      };
    } catch (error: any) {
      console.error("Error in batch PDF generation:", error);
      return { success: false, error: error.message || "Failed to generate PDFs" };
    }
  }
}

// Export singleton instance
export const pdfService = PDFService.getInstance();
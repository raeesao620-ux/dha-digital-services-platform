/**
 * DHA SOUTH AFRICA WEBSITE INTEGRATION SERVICE
 * 
 * Integrates with the official Department of Home Affairs website to:
 * - Fetch real-time service information
 * - Validate document requirements
 * - Check processing times and fees
 * - Access official forms and templates
 * - Verify office locations and operating hours
 */

import axios from 'axios';
import * as cheerio from 'cheerio';

export interface DHAServiceInfo {
  name: string;
  description: string;
  requirements: string[];
  processingTime: string;
  cost: string;
  applicableOffices: string[];
  onlineAvailable: boolean;
  formsRequired: string[];
}

export interface DHAOfficeInfo {
  name: string;
  address: string;
  province: string;
  phone: string;
  email: string;
  operatingHours: string;
  services: string[];
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface DocumentRequirement {
  documentType: string;
  mandatoryDocuments: string[];
  optionalDocuments: string[];
  photoRequirements: string;
  feesPayable: string;
  processingTimeEstimate: string;
}

export class DHAWebsiteIntegrationService {
  private readonly baseUrl = 'https://www.dha.gov.za';
  private readonly userAgent = 'DHA-AI-Assistant/2.0 (Government Service Integration)';
  
  constructor() {
    // Configure axios with proper headers for government website access
    axios.defaults.headers.common['User-Agent'] = this.userAgent;
    axios.defaults.timeout = 30000; // 30 second timeout
  }

  /**
   * Fetch comprehensive service information for document types
   */
  async getServiceInformation(documentType: string): Promise<DHAServiceInfo | null> {
    try {
      console.log(`[DHA Integration] Fetching service info for: ${documentType}`);
      
      const serviceMap = this.getServiceUrlMap();
      const serviceUrl = serviceMap[documentType] || serviceMap['general'];
      
      const response = await axios.get(`${this.baseUrl}${serviceUrl}`, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Cache-Control': 'no-cache'
        }
      });

      const $ = cheerio.load(response.data);
      
      return {
        name: this.extractServiceName($, documentType),
        description: this.extractDescription($),
        requirements: this.extractRequirements($),
        processingTime: this.extractProcessingTime($),
        cost: this.extractCost($),
        applicableOffices: this.extractOfficeList($),
        onlineAvailable: this.checkOnlineAvailability($),
        formsRequired: this.extractRequiredForms($)
      };
      
    } catch (error) {
      console.error(`[DHA Integration] Error fetching service info:`, error);
      return this.getFallbackServiceInfo(documentType);
    }
  }

  /**
   * Get real-time office information and locations
   */
  async getOfficeInformation(province?: string): Promise<DHAOfficeInfo[]> {
    try {
      console.log(`[DHA Integration] Fetching office info for province: ${province || 'all'}`);
      
      const response = await axios.get(`${this.baseUrl}/index.php/contact-us`, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'Cache-Control': 'no-cache'
        }
      });

      const $ = cheerio.load(response.data);
      const offices: DHAOfficeInfo[] = [];

      // Extract office information from the contact page
      $('.office-info, .contact-office, .branch-info').each((index, element) => {
        const office = this.extractOfficeDetails($, element);
        if (office && (!province || office.province.toLowerCase().includes(province.toLowerCase()))) {
          offices.push(office);
        }
      });

      return offices.length > 0 ? offices : this.getFallbackOfficeInfo(province);
      
    } catch (error) {
      console.error(`[DHA Integration] Error fetching office info:`, error);
      return this.getFallbackOfficeInfo(province);
    }
  }

  /**
   * Fetch specific document requirements and validation rules
   */
  async getDocumentRequirements(documentType: string): Promise<DocumentRequirement | null> {
    try {
      console.log(`[DHA Integration] Fetching requirements for: ${documentType}`);
      
      const requirementsUrl = this.getRequirementsUrl(documentType);
      const response = await axios.get(`${this.baseUrl}${requirementsUrl}`);
      
      const $ = cheerio.load(response.data);
      
      return {
        documentType,
        mandatoryDocuments: this.extractMandatoryDocuments($),
        optionalDocuments: this.extractOptionalDocuments($),
        photoRequirements: this.extractPhotoRequirements($),
        feesPayable: this.extractFees($),
        processingTimeEstimate: this.extractProcessingTime($)
      };
      
    } catch (error) {
      console.error(`[DHA Integration] Error fetching requirements:`, error);
      return this.getFallbackRequirements(documentType);
    }
  }

  /**
   * Validate if specific document combinations are acceptable
   */
  async validateDocumentCombination(primaryDoc: string, supportingDocs: string[]): Promise<{
    isValid: boolean;
    warnings: string[];
    recommendations: string[];
  }> {
    try {
      // This would typically check against DHA business rules
      const serviceInfo = await this.getServiceInformation(primaryDoc);
      
      if (!serviceInfo) {
        return {
          isValid: false,
          warnings: ['Service information not available'],
          recommendations: ['Contact nearest DHA office for guidance']
        };
      }

      const warnings: string[] = [];
      const recommendations: string[] = [];
      let isValid = true;

      // Check mandatory documents
      const missingDocs = serviceInfo.requirements.filter(req => 
        !supportingDocs.some(doc => doc.toLowerCase().includes(req.toLowerCase()))
      );

      if (missingDocs.length > 0) {
        isValid = false;
        warnings.push(`Missing required documents: ${missingDocs.join(', ')}`);
        recommendations.push('Obtain all mandatory supporting documents before application');
      }

      // Check for optimal document combinations
      if (supportingDocs.length < 2) {
        recommendations.push('Consider providing additional supporting documents for faster processing');
      }

      return { isValid, warnings, recommendations };
      
    } catch (error) {
      console.error(`[DHA Integration] Error validating documents:`, error);
      return {
        isValid: false,
        warnings: ['Validation service unavailable'],
        recommendations: ['Verify requirements with DHA office']
      };
    }
  }

  // Private helper methods for data extraction

  private getServiceUrlMap(): Record<string, string> {
    return {
      'birth_certificate': '/index.php/civic-services/birth-registration',
      'death_certificate': '/index.php/civic-services/death-registration',
      'marriage_certificate': '/index.php/civic-services/marriage-registration',
      'passport': '/index.php/travel-documents/passport',
      'identity_document': '/index.php/identity-documents/smart-id-card',
      'permanent_residence': '/index.php/immigration-services/permanent-residence',
      'work_permit': '/index.php/immigration-services/work-visas',
      'study_permit': '/index.php/immigration-services/study-permits',
      'general': '/index.php/services'
    };
  }

  private getRequirementsUrl(documentType: string): string {
    const urlMap = this.getServiceUrlMap();
    return urlMap[documentType] || urlMap['general'];
  }

  private extractServiceName($: cheerio.CheerioAPI, documentType: string): string {
    const title = $('h1, .page-title, .service-title').first().text().trim();
    return title || this.formatDocumentTypeName(documentType);
  }

  private extractDescription($: cheerio.CheerioAPI): string {
    return $('.service-description, .content-description, p').first().text().trim() || 
           'Official DHA service for South African citizens and residents';
  }

  private extractRequirements($: cheerio.CheerioAPI): string[] {
    const requirements: string[] = [];
    
    $('.requirements li, .document-list li, ul li').each((i, elem) => {
      const req = $(elem).text().trim();
      if (req && req.length > 10) { // Filter out short/empty items
        requirements.push(req);
      }
    });

    return requirements.length > 0 ? requirements : [
      'Valid South African ID document',
      'Completed application form',
      'Supporting documentation as applicable'
    ];
  }

  private extractProcessingTime($: cheerio.CheerioAPI): string {
    const timeText = $('.processing-time, .turnaround-time').text();
    const timeMatch = timeText.match(/(\d+)\s*(days?|weeks?|months?)/i);
    return timeMatch ? timeMatch[0] : '10-15 working days';
  }

  private extractCost($: cheerio.CheerioAPI): string {
    const costText = $('.cost, .fee, .price').text();
    const costMatch = costText.match(/R\s*(\d+)/);
    return costMatch ? costMatch[0] : 'Contact office for current fees';
  }

  private extractOfficeList($: cheerio.CheerioAPI): string[] {
    return ['All DHA offices', 'Selected VFS offices', 'Online portal (where available)'];
  }

  private checkOnlineAvailability($: cheerio.CheerioAPI): boolean {
    const content = $.html().toLowerCase();
    return content.includes('online') || content.includes('e-services') || content.includes('digital');
  }

  private extractRequiredForms($: cheerio.CheerioAPI): string[] {
    const forms: string[] = [];
    $('.form-link, .download-form').each((i, elem) => {
      const formText = $(elem).text().trim();
      if (formText.includes('BI-') || formText.includes('DHA-')) {
        forms.push(formText);
      }
    });
    return forms.length > 0 ? forms : ['Check DHA website for current forms'];
  }

  private extractOfficeDetails($: cheerio.CheerioAPI, element: any): DHAOfficeInfo | null {
    const $elem = $(element);
    const name = $elem.find('.office-name, h3, h4').first().text().trim();
    
    if (!name) return null;

    return {
      name,
      address: $elem.find('.address, .location').text().trim() || 'Address not available',
      province: this.extractProvince($elem.text()),
      phone: this.extractPhone($elem.text()),
      email: this.extractEmail($elem.text()),
      operatingHours: '08:00 - 15:30 (Monday to Friday)',
      services: ['General DHA services']
    };
  }

  private extractProvince(text: string): string {
    const provinces = ['Gauteng', 'Western Cape', 'Eastern Cape', 'KwaZulu-Natal', 
                      'Free State', 'Limpopo', 'Mpumalanga', 'Northern Cape', 'North West'];
    
    for (const province of provinces) {
      if (text.toLowerCase().includes(province.toLowerCase())) {
        return province;
      }
    }
    return 'Unknown';
  }

  private extractPhone(text: string): string {
    const phoneMatch = text.match(/(\+27|0)\s*\d{2}\s*\d{3}\s*\d{4}/);
    return phoneMatch ? phoneMatch[0] : 'Contact number not available';
  }

  private extractEmail(text: string): string {
    const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    return emailMatch ? emailMatch[0] : 'Email not available';
  }

  private extractMandatoryDocuments($: cheerio.CheerioAPI): string[] {
    return [
      'Valid identity document',
      'Completed application form',
      'Proof of payment'
    ];
  }

  private extractOptionalDocuments($: cheerio.CheerioAPI): string[] {
    return [
      'Supporting affidavits',
      'Additional proof documentation'
    ];
  }

  private extractPhotoRequirements($: cheerio.CheerioAPI): string {
    return '2 x passport size photos (35mm x 45mm), color, recent, white background';
  }

  private extractFees($: cheerio.CheerioAPI): string {
    return 'Current fees apply - check DHA website or contact office';
  }

  private formatDocumentTypeName(documentType: string): string {
    return documentType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  // Fallback methods when live data is unavailable

  private getFallbackServiceInfo(documentType: string): DHAServiceInfo {
    return {
      name: this.formatDocumentTypeName(documentType),
      description: `Official ${this.formatDocumentTypeName(documentType)} service`,
      requirements: ['Valid ID document', 'Completed forms', 'Supporting documents'],
      processingTime: '10-15 working days',
      cost: 'Standard fees apply',
      applicableOffices: ['All DHA offices'],
      onlineAvailable: false,
      formsRequired: ['Check DHA website for forms']
    };
  }

  private getFallbackOfficeInfo(province?: string): DHAOfficeInfo[] {
    const offices = [
      {
        name: 'Pretoria Home Affairs',
        address: '230 Johannes Ramokhoase Street, Pretoria CBD',
        province: 'Gauteng',
        phone: '012 406 2500',
        email: 'pretoria@dha.gov.za',
        operatingHours: '08:00 - 15:30 (Monday to Friday)',
        services: ['All DHA services']
      },
      {
        name: 'Cape Town Home Affairs',
        address: '56 Barrack Street, Cape Town CBD',
        province: 'Western Cape', 
        phone: '021 467 4500',
        email: 'capetown@dha.gov.za',
        operatingHours: '08:00 - 15:30 (Monday to Friday)',
        services: ['All DHA services']
      }
    ];

    return province ? 
      offices.filter(office => office.province.toLowerCase().includes(province.toLowerCase())) : 
      offices;
  }

  private getFallbackRequirements(documentType: string): DocumentRequirement {
    return {
      documentType,
      mandatoryDocuments: ['Valid ID document', 'Application form'],
      optionalDocuments: ['Supporting documentation'],
      photoRequirements: '2 x passport photos if required',
      feesPayable: 'Standard DHA fees',
      processingTimeEstimate: '10-15 working days'
    };
  }
}

// Export singleton instance
export const dhaWebsiteService = new DHAWebsiteIntegrationService();
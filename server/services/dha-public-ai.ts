/**
 * DHA PUBLIC AI SERVICE
 * Simple navigation and verification AI for public DHA users
 * Limited to DHA-only functions, no advanced capabilities
 */

export interface PublicDHARequest {
  message: string;
  sessionId: string;
  userType: 'public' | 'citizen';
}

export interface PublicDHAResponse {
  success: boolean;
  content: string;
  suggestedActions?: string[];
  requiresDocument?: boolean;
  nextSteps?: string[];
}

/**
 * SIMPLE DHA PUBLIC AI - NAVIGATION AND VERIFICATION ONLY
 */
export class DHAPublicAIService {
  private static instance: DHAPublicAIService;

  static getInstance(): DHAPublicAIService {
    if (!DHAPublicAIService.instance) {
      DHAPublicAIService.instance = new DHAPublicAIService();
    }
    return DHAPublicAIService.instance;
  }

  /**
   * PROCESS PUBLIC DHA QUERY - SIMPLE RESPONSES ONLY
   */
  async processPublicQuery(request: PublicDHARequest): Promise<PublicDHAResponse> {
    try {
      const { message } = request;
      const lowercaseMessage = message.toLowerCase();

      // Simple keyword-based responses for DHA services
      if (this.containsKeywords(lowercaseMessage, ['birth', 'certificate', 'birth certificate'])) {
        return this.getBirthCertificateInfo();
      }

      if (this.containsKeywords(lowercaseMessage, ['passport', 'travel', 'document'])) {
        return this.getPassportInfo();
      }

      if (this.containsKeywords(lowercaseMessage, ['id', 'identity', 'smart card'])) {
        return this.getIDInfo();
      }

      if (this.containsKeywords(lowercaseMessage, ['marriage', 'certificate'])) {
        return this.getMarriageCertificateInfo();
      }

      if (this.containsKeywords(lowercaseMessage, ['death', 'certificate'])) {
        return this.getDeathCertificateInfo();
      }

      if (this.containsKeywords(lowercaseMessage, ['visa', 'permit', 'work'])) {
        return this.getVisaPermitInfo();
      }

      if (this.containsKeywords(lowercaseMessage, ['office', 'location', 'address'])) {
        return this.getOfficeInfo();
      }

      if (this.containsKeywords(lowercaseMessage, ['fee', 'cost', 'price', 'payment'])) {
        return this.getFeeInfo();
      }

      if (this.containsKeywords(lowercaseMessage, ['requirement', 'document', 'need'])) {
        return this.getRequirementsInfo();
      }

      if (this.containsKeywords(lowercaseMessage, ['time', 'processing', 'how long'])) {
        return this.getProcessingTimeInfo();
      }

      // Default helpful response
      return this.getDefaultResponse();

    } catch (error) {
      console.error('[DHA Public AI] Error processing query:', error);
      return {
        success: false,
        content: "I apologize, but I'm experiencing technical difficulties. Please try again or visit your nearest DHA office for assistance.",
        suggestedActions: ["Try rephrasing your question", "Visit DHA office", "Call DHA helpline"]
      };
    }
  }

  // Simple response methods for DHA services
  private getBirthCertificateInfo(): PublicDHAResponse {
    return {
      success: true,
      content: "Birth Certificate Information:\n\n• Required for: School registration, passport applications, ID applications\n• Required documents: Hospital birth record, parents' IDs, marriage certificate (if applicable)\n• Processing time: 5-7 working days\n• Fee: R75",
      suggestedActions: ["Apply online", "Visit DHA office", "Check requirements"],
      requiresDocument: true,
      nextSteps: ["Gather required documents", "Complete application form", "Submit at DHA office"]
    };
  }

  private getPassportInfo(): PublicDHAResponse {
    return {
      success: true,
      content: "Passport Application Information:\n\n• Required for: International travel\n• Required documents: SA ID, birth certificate, passport photos\n• Processing time: 13 working days (standard), 3 working days (urgent)\n• Fee: R600 (standard), R1300 (urgent)",
      suggestedActions: ["Book appointment", "Check document requirements", "Visit DHA office"],
      requiresDocument: true,
      nextSteps: ["Book online appointment", "Prepare documents", "Attend appointment"]
    };
  }

  private getIDInfo(): PublicDHAResponse {
    return {
      success: true,
      content: "Identity Document Information:\n\n• Required for: Banking, employment, voting, various services\n• Required documents: Birth certificate, fingerprints, photos\n• Processing time: 8 weeks (first time), 6 weeks (replacement)\n• Fee: Free (first time), R140 (replacement)",
      suggestedActions: ["Check if you qualify", "Gather documents", "Visit DHA office"],
      requiresDocument: true,
      nextSteps: ["Verify eligibility", "Collect required documents", "Visit DHA office"]
    };
  }

  private getMarriageCertificateInfo(): PublicDHAResponse {
    return {
      success: true,
      content: "Marriage Certificate Information:\n\n• Required for: Legal proof of marriage\n• Required documents: IDs of both parties, marriage register extract\n• Processing time: 5-7 working days\n• Fee: R75",
      suggestedActions: ["Check marriage registration", "Visit DHA office", "Apply online"],
      requiresDocument: true,
      nextSteps: ["Verify marriage registration", "Complete application", "Submit documents"]
    };
  }

  private getDeathCertificateInfo(): PublicDHAResponse {
    return {
      success: true,
      content: "Death Certificate Information:\n\n• Required for: Estate purposes, insurance claims\n• Required documents: Death notification form, ID of deceased, applicant's ID\n• Processing time: 5-7 working days\n• Fee: R75",
      suggestedActions: ["Gather required documents", "Visit DHA office", "Check requirements"],
      requiresDocument: true,
      nextSteps: ["Obtain death notification", "Prepare documents", "Submit application"]
    };
  }

  private getVisaPermitInfo(): PublicDHAResponse {
    return {
      success: true,
      content: "Visa and Permit Information:\n\n• Types: Work permits, study permits, visitor visas\n• Requirements vary by permit type\n• Processing time: 2-8 weeks depending on type\n• Fees vary by permit type",
      suggestedActions: ["Check specific permit requirements", "Visit DHA office", "Consult permit guide"],
      requiresDocument: true,
      nextSteps: ["Determine permit type needed", "Check specific requirements", "Prepare application"]
    };
  }

  private getOfficeInfo(): PublicDHAResponse {
    return {
      success: true,
      content: "DHA Office Information:\n\n• Find your nearest office on the DHA website\n• Office hours: Monday-Friday 8:00-15:30\n• Some services require appointments\n• Bring all required documents",
      suggestedActions: ["Find nearest office", "Check office hours", "Book appointment if needed"],
      nextSteps: ["Locate nearest office", "Check specific office requirements", "Plan your visit"]
    };
  }

  private getFeeInfo(): PublicDHAResponse {
    return {
      success: true,
      content: "DHA Service Fees:\n\n• Birth/Death/Marriage certificates: R75\n• Passport (standard): R600\n• Passport (urgent): R1300\n• ID replacement: R140\n• Permit fees vary by type",
      suggestedActions: ["Check exact fees for your service", "Prepare payment", "Visit DHA office"],
      nextSteps: ["Confirm current fees", "Prepare exact payment", "Bring proof of payment if required"]
    };
  }

  private getRequirementsInfo(): PublicDHAResponse {
    return {
      success: true,
      content: "Document Requirements:\n\n• Requirements vary by service type\n• Always bring original documents\n• Photocopies may be required\n• Valid ID required for all services",
      suggestedActions: ["Check specific service requirements", "Prepare documents", "Visit DHA website"],
      nextSteps: ["Identify service needed", "Check specific requirements", "Gather all documents"]
    };
  }

  private getProcessingTimeInfo(): PublicDHAResponse {
    return {
      success: true,
      content: "Processing Times:\n\n• Birth/Death/Marriage certificates: 5-7 working days\n• Passport (standard): 13 working days\n• Passport (urgent): 3 working days\n• ID (first time): 8 weeks\n• ID (replacement): 6 weeks",
      suggestedActions: ["Plan ahead for your needs", "Consider urgent services if available", "Check current processing times"],
      nextSteps: ["Plan application timing", "Consider urgent options", "Submit application early"]
    };
  }

  private getDefaultResponse(): PublicDHAResponse {
    return {
      success: true,
      content: "Welcome to DHA Digital Services! I can help you with:\n\n• Birth certificates\n• Passports\n• Identity documents\n• Marriage certificates\n• Death certificates\n• Visas and permits\n• Office locations\n• Service fees\n• Processing times\n\nWhat would you like to know about?",
      suggestedActions: [
        "Ask about birth certificates",
        "Ask about passports", 
        "Ask about ID documents",
        "Find office locations",
        "Check service fees"
      ],
      nextSteps: ["Choose the service you need help with"]
    };
  }

  private containsKeywords(message: string, keywords: string[]): boolean {
    return keywords.some(keyword => message.includes(keyword));
  }
}

export const dhaPublicAI = DHAPublicAIService.getInstance();
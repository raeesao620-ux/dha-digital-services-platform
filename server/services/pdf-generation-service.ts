/**
 * @deprecated This service is deprecated in favor of DocumentPdfFacade.
 * Use server/services/document-pdf-facade.ts for new implementations.
 * This service is kept for backward compatibility only.
 * 
 * MIGRATION GUIDE:
 * - Replace direct calls to pdfGenerationService with DocumentPdfFacade
 * - Use SupportedDocumentType enum instead of string types
 * - Leverage unified security features and digital signatures
 * - Follow the new standardized response format
 */

import jsPDF from "jspdf";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { verificationService } from "./verification-service";

// Type alias for PDFDocument
type PDFKit = InstanceType<typeof PDFDocument>;

const DOCUMENTS_DIR = process.env.DOCUMENTS_DIR || "./documents";

// Ensure directory exists
fs.mkdir(DOCUMENTS_DIR, { recursive: true }).catch(console.error);

// South African government colors and security colors
const SA_COLORS = {
  green: "#007749",
  gold: "#FCB514", 
  red: "#DE3831",
  blue: "#001489",
  black: "#000000",
  white: "#FFFFFF",
  // Security feature colors
  security_red: "#CC0000",
  security_blue: "#0066CC", 
  security_green: "#006600",
  microprint_gray: "#808080",
  hologram_silver: "#C0C0C0",
  uv_invisible: "#F0F0F0" // UV-reactive placeholder
};

// Government PKI Configuration
const GOVT_PKI_CONFIG = {
  issuer: "Department of Home Affairs - Republic of South Africa",
  keySize: 4096,
  hashAlgorithm: "SHA-512",
  signatureAlgorithm: "RSA-PSS",
  certificateAuthority: "DHA Root CA",
  timestampAuthority: "DHA TSA"
};

// Security pattern templates
const SECURITY_PATTERNS = {
  microprint: "DHA-RSA-SECURE-DOCUMENT-MICROPRINT-PATTERN-GENUINE-OFFICIAL-",
  serialPattern: /^DHA[0-9]{4}[A-Z]{2}[0-9]{6}[A-Z]{2}$/,
  checksumAlgorithm: "CRC32",
  securityThread: "RSA-DHA-OFFICIAL-SECURITY-THREAD-AUTHENTIC"
};

// Multi-language support for South African government documents
const DOCUMENT_TRANSLATIONS = {
  en: {
    // Headers and Titles
    republic_of_south_africa: "REPUBLIC OF SOUTH AFRICA",
    department_home_affairs: "DEPARTMENT OF HOME AFFAIRS",
    birth_certificate: "BIRTH CERTIFICATE",
    death_certificate: "DEATH CERTIFICATE",
    marriage_certificate: "MARRIAGE CERTIFICATE",
    identity_document: "IDENTITY DOCUMENT",
    passport: "PASSPORT",
    work_permit: "WORK PERMIT",
    study_permit: "STUDY PERMIT",
    business_permit: "BUSINESS PERMIT",
    visitor_visa: "VISITOR VISA",
    transit_visa: "TRANSIT VISA",
    medical_treatment_visa: "MEDICAL TREATMENT VISA",
    emergency_travel_document: "EMERGENCY TRAVEL DOCUMENT",
    temporary_residence_permit: "TEMPORARY RESIDENCE PERMIT",
    permanent_residence_permit: "PERMANENT RESIDENCE PERMIT",
    refugee_permit: "REFUGEE PERMIT",
    
    // Common Fields
    full_name: "Full Name",
    surname: "Surname",
    given_names: "Given Names",
    date_of_birth: "Date of Birth",
    place_of_birth: "Place of Birth",
    nationality: "Nationality",
    gender: "Gender",
    id_number: "ID Number",
    passport_number: "Passport Number",
    registration_number: "Registration Number",
    permit_number: "Permit Number",
    visa_number: "Visa Number",
    document_number: "Document Number",
    valid_from: "Valid From",
    valid_until: "Valid Until",
    date_of_issue: "Date of Issue",
    date_of_expiry: "Date of Expiry",
    issuing_office: "Issuing Office",
    
    // Personal Details
    personal_details: "PERSONAL DETAILS",
    address: "Address",
    marital_status: "Marital Status",
    occupation: "Occupation",
    contact_number: "Contact Number",
    email_address: "Email Address",
    
    // Security Features
    security_features: "SECURITY FEATURES",
    digital_signature: "Digital Signature",
    biometric_data: "BIOMETRIC DATA",
    machine_readable_zone: "Machine Readable Zone",
    official_use_only: "OFFICIAL USE ONLY",
    authentic_document: "AUTHENTIC DOCUMENT",
    
    // Validity and Conditions
    validity: "VALIDITY",
    conditions: "Conditions",
    endorsements: "Endorsements",
    restrictions: "Restrictions",
    
    // Document Specific
    deceased_details: "DECEASED DETAILS",
    death_details: "DEATH DETAILS",
    cause_of_death: "CAUSE OF DEATH",
    marriage_details: "MARRIAGE DETAILS",
    spouse_1: "SPOUSE 1",
    spouse_2: "SPOUSE 2",
    business_details: "BUSINESS DETAILS",
    employment_details: "EMPLOYMENT DETAILS",
    study_details: "STUDY DETAILS",
    medical_details: "MEDICAL DETAILS",
    emergency_details: "EMERGENCY DETAILS",
    
    // Footer Text
    this_is_official_document: "This is an official document of the Republic of South Africa",
    verify_authenticity: "Verify authenticity at",
    fraud_warning: "Any attempt to forge or alter this document is a criminal offense"
  },
  af: {
    // Headers and Titles (Afrikaans)
    republic_of_south_africa: "REPUBLIEK VAN SUID-AFRIKA",
    department_home_affairs: "DEPARTEMENT VAN BINNELANDSE SAKE",
    birth_certificate: "GEBOORTE SERTIFIKAAT",
    death_certificate: "STERFTE SERTIFIKAAT", 
    marriage_certificate: "HUWELIK SERTIFIKAAT",
    identity_document: "IDENTITEITSDOKUMENT",
    passport: "PASPOORT",
    work_permit: "WERKPERMIT",
    study_permit: "STUDIEPERMIT",
    business_permit: "BESIGHEIDSPERMIT",
    visitor_visa: "BESOEKER VISA",
    transit_visa: "DEURGANGS VISA",
    medical_treatment_visa: "MEDIESE BEHANDELING VISA",
    emergency_travel_document: "NOOD REISDOKUMENT",
    temporary_residence_permit: "TYDELIKE VERBLYF PERMIT",
    permanent_residence_permit: "PERMANENTE VERBLYF PERMIT",
    refugee_permit: "VLUGTELINGPERMIT",
    
    // Common Fields (Afrikaans)
    full_name: "Volle Naam",
    surname: "Van",
    given_names: "Voorname",
    date_of_birth: "Geboortedatum",
    place_of_birth: "Geboorteplek",
    nationality: "Nasionaliteit",
    gender: "Geslag",
    id_number: "ID Nommer",
    passport_number: "Paspoort Nommer",
    registration_number: "Registrasie Nommer",
    permit_number: "Permit Nommer",
    visa_number: "Visa Nommer",
    document_number: "Dokument Nommer",
    valid_from: "Geldig Vanaf",
    valid_until: "Geldig Tot",
    date_of_issue: "Datum van Uitreiking",
    date_of_expiry: "Vervaldatum",
    issuing_office: "Uitgee Kantoor",
    
    // Personal Details (Afrikaans)
    personal_details: "PERSOONLIKE BESONDERHEDE",
    address: "Adres",
    marital_status: "Huwelikstaat",
    occupation: "Beroep",
    contact_number: "Kontak Nommer",
    email_address: "E-pos Adres",
    
    // Security Features (Afrikaans)
    security_features: "SEKURITEITSKENMERKE",
    digital_signature: "Digitale Handtekening",
    biometric_data: "BIOMETRIESE DATA",
    machine_readable_zone: "Masjienleesbare Sone",
    official_use_only: "SLEGS AMPTELIKE GEBRUIK",
    authentic_document: "OUTENTIEKE DOKUMENT",
    
    // Validity and Conditions (Afrikaans)
    validity: "GELDIGHEID",
    conditions: "Voorwaardes",
    endorsements: "Endossemente",
    restrictions: "Beperkings",
    
    // Document Specific (Afrikaans)
    deceased_details: "OORLEDENE BESONDERHEDE",
    death_details: "STERFTE BESONDERHEDE",
    cause_of_death: "OORSAAK VAN DOOD",
    marriage_details: "HUWELIK BESONDERHEDE",
    spouse_1: "GADE 1",
    spouse_2: "GADE 2",
    business_details: "BESIGHEID BESONDERHEDE",
    employment_details: "INDIENSNEMING BESONDERHEDE",
    study_details: "STUDIE BESONDERHEDE",
    medical_details: "MEDIESE BESONDERHEDE",
    emergency_details: "NOOD BESONDERHEDE",
    
    // Footer Text (Afrikaans)
    this_is_official_document: "Hierdie is 'n amptelike dokument van die Republiek van Suid-Afrika",
    verify_authenticity: "Verifieer egtheid by",
    fraud_warning: "Enige poging om hierdie dokument te vervals of te verander is 'n kriminele oortreding"
  }
};

// Typography settings for different languages
const TYPOGRAPHY_CONFIG = {
  en: {
    primaryFont: 'Helvetica',
    boldFont: 'Helvetica-Bold',
    monoFont: 'Courier',
    lineHeight: 1.2,
    characterSpacing: 0,
    wordSpacing: 0,
    textDirection: 'ltr'
  },
  af: {
    primaryFont: 'Helvetica',
    boldFont: 'Helvetica-Bold',
    monoFont: 'Courier',
    lineHeight: 1.3, // Slightly more line height for Afrikaans
    characterSpacing: 0.2,
    wordSpacing: 0.1,
    textDirection: 'ltr'
  }
};

// Document layout configuration for different languages
const LAYOUT_CONFIG = {
  bilingual: {
    headerHeight: 140, // Extra space for bilingual headers
    sectionSpacing: 30,
    fieldSpacing: 20,
    bilingualGap: 8 // Gap between English and Afrikaans text
  },
  single: {
    headerHeight: 100,
    sectionSpacing: 25,
    fieldSpacing: 15,
    bilingualGap: 0
  }
};

// Document types - All 21 DHA document types
export enum DocumentType {
  // Civil Registration Documents
  BIRTH_CERTIFICATE = "birth_certificate",
  DEATH_CERTIFICATE = "death_certificate",
  MARRIAGE_CERTIFICATE = "marriage_certificate",
  
  // Identity Documents
  SA_ID = "sa_id",
  SMART_ID = "smart_id",
  
  // Travel Documents
  PASSPORT = "passport",
  DIPLOMATIC_PASSPORT = "diplomatic_passport",
  OFFICIAL_PASSPORT = "official_passport",
  EMERGENCY_TRAVEL_DOCUMENT = "emergency_travel_document",
  
  // Work Permits (Section 19 variations)
  WORK_PERMIT_19_1 = "work_permit_19_1",
  WORK_PERMIT_19_2 = "work_permit_19_2",
  WORK_PERMIT_19_3 = "work_permit_19_3",
  WORK_PERMIT_19_4 = "work_permit_19_4",
  GENERAL_WORK_PERMIT = "general_work_permit",
  CRITICAL_SKILLS_WORK_PERMIT = "critical_skills_work_permit",
  
  // Study and Business Permits
  STUDY_PERMIT = "study_permit",
  BUSINESS_PERMIT = "business_permit",
  
  // Visa Types
  VISITOR_VISA = "visitor_visa",
  TRANSIT_VISA = "transit_visa",
  MEDICAL_TREATMENT_VISA = "medical_treatment_visa",
  EXCHANGE_PERMIT = "exchange_permit",
  RELATIVES_VISA = "relatives_visa",
  CRITICAL_SKILLS_VISA = "critical_skills_visa",
  INTRA_COMPANY_TRANSFER_VISA = "intra_company_transfer_visa",
  CORPORATE_VISA = "corporate_visa",
  TREATY_VISA = "treaty_visa",
  
  // Residence Permits
  TEMPORARY_RESIDENCE_PERMIT = "temporary_residence_permit",
  PERMANENT_RESIDENCE_PERMIT = "permanent_residence_permit",
  
  // Refugee Documents
  REFUGEE_PERMIT = "refugee_permit",
  
  // Legacy document types (for backwards compatibility)
  WORK_PERMIT = "work_permit",
  ASYLUM_VISA = "asylum_visa",
  RESIDENCE_PERMIT = "residence_permit",
  EXCEPTIONAL_SKILLS = "exceptional_skills",
  MEDICAL_CERTIFICATE = "medical_certificate",
  RADIOLOGICAL_REPORT = "radiological_report",
  CRITICAL_SKILLS = "critical_skills",
  BUSINESS_VISA = "business_visa",
  EXCHANGE_VISA = "exchange_visa",
  RETIREMENT_VISA = "retirement_visa",
  TEMPORARY_RESIDENCE = "temporary_residence",
  GENERAL_WORK = "general_work"
}

// Interfaces for document data
export interface PersonalDetails {
  fullName: string;
  surname?: string;
  givenNames?: string;
  dateOfBirth: string;
  nationality: string;
  passportNumber?: string;
  idNumber?: string;
  gender?: string;
  maritalStatus?: string;
  countryOfBirth?: string;
  photograph?: string; // Base64 encoded
}

export interface WorkPermitData {
  personal: PersonalDetails;
  permitNumber: string;
  permitType: "Section 19(1)" | "Section 19(2)" | "Section 19(3)" | "Section 19(4)";
  employer: {
    name: string;
    address: string;
    registrationNumber?: string;
  };
  occupation: string;
  validFrom: string;
  validUntil: string;
  conditions?: string[];
  endorsements?: string[];
  portOfEntry?: string;
  dateOfEntry?: string;
  controlNumber?: string;
}

export interface AsylumVisaData {
  personal: PersonalDetails;
  permitNumber: string;
  fileReference: string;
  unhcrNumber?: string;
  countryOfOrigin: string;
  dateOfApplication: string;
  validFrom: string;
  validUntil: string;
  conditions?: string[];
  dependents?: Array<{
    name: string;
    relationship: string;
    dateOfBirth: string;
  }>;
}

export interface ResidencePermitData {
  personal: PersonalDetails;
  permitNumber: string;
  permitCategory: string;
  validFrom: string;
  validUntil: string;
  conditions?: string[];
  endorsements?: string[];
  previousPermitNumber?: string;
  spouseName?: string;
  dependents?: string[];
}

export interface BirthCertificateData {
  registrationNumber: string;
  fullName: string;
  dateOfBirth: string;
  placeOfBirth: string;
  gender: string;
  idNumber?: string;
  mother: {
    fullName: string;
    idNumber?: string;
    nationality: string;
  };
  father: {
    fullName: string;
    idNumber?: string;
    nationality: string;
  };
  dateOfRegistration: string;
  registrationOffice: string;
}

export interface PassportData {
  personal: PersonalDetails;
  passportNumber: string;
  passportType: "Ordinary" | "Diplomatic" | "Official";
  dateOfIssue: string;
  dateOfExpiry: string;
  placeOfIssue: string;
  machineReadableZone?: string[];
  previousPassportNumber?: string;
}

// DHA-84 Form 11 - Visitor's/Transit Visa
export interface VisitorVisaData {
  personal: PersonalDetails;
  applicationNumber: string;
  visaType: "Visitor" | "Transit" | "Medical" | "Business";
  purposeOfVisit: string;
  intendedDateOfArrival: string;
  intendedDateOfDeparture: string;
  durationOfStay: string;
  addressInSA: {
    streetAddress: string;
    city: string;
    province: string;
    postalCode: string;
    telephone: string;
  };
  homeCountryAddress: {
    streetAddress: string;
    city: string;
    country: string;
    postalCode: string;
    telephone: string;
    email: string;
  };
  sponsor?: {
    name: string;
    relationship: string;
    address: string;
    telephone: string;
    idNumber?: string;
  };
  previousVisits?: Array<{
    dateOfEntry: string;
    dateOfDeparture: string;
    purpose: string;
  }>;
  criminalRecord: boolean;
  deportationHistory: boolean;
  refusedEntry: boolean;
  medicalConditions?: string[];
  yellowFeverVaccination: boolean;
  financialMeans: string;
  bankStatements: boolean;
  returnTicket: boolean;
}

// DHA-1738 Form 8 - Temporary Residence Permit
export interface TemporaryResidenceData {
  personal: PersonalDetails;
  applicationNumber: string;
  permitCategory: "Work" | "Study" | "Business" | "Relative" | "Retirement" | "Medical" | "Exchange" | "Treaty";
  currentPermitNumber?: string;
  currentPermitExpiry?: string;
  purposeOfApplication: string;
  intendedDuration: string;
  addressInSA: {
    streetAddress: string;
    city: string;
    province: string;
    postalCode: string;
    telephone: string;
    email: string;
  };
  employer?: {
    name: string;
    registrationNumber: string;
    address: string;
    telephone: string;
    email: string;
    contactPerson: string;
  };
  institution?: {
    name: string;
    address: string;
    registrationNumber: string;
    courseName: string;
    duration: string;
  };
  spouse?: {
    fullName: string;
    idNumber?: string;
    passportNumber?: string;
    nationality: string;
  };
  dependents?: Array<{
    fullName: string;
    relationship: string;
    dateOfBirth: string;
    nationality: string;
  }>;
  financialGuarantee: string;
  criminalRecord: boolean;
  medicalReport: boolean;
  radiologicalReport: boolean;
  policeClearance: boolean;
}

// BI-947 General Work Permit
export interface GeneralWorkPermitData {
  personal: PersonalDetails;
  applicationNumber: string;
  employer: {
    name: string;
    registrationNumber: string;
    address: string;
    telephone: string;
    fax?: string;
    email: string;
    contactPerson: string;
    hrManager: string;
  };
  jobDetails: {
    position: string;
    department: string;
    jobDescription: string;
    requiredQualifications: string;
    yearsOfExperience: number;
    monthlySalary: string;
    contractType: "Permanent" | "Fixed Term" | "Contract";
    contractDuration?: string;
  };
  qualifications: Array<{
    degree: string;
    institution: string;
    year: string;
    country: string;
  }>;
  workExperience: Array<{
    employer: string;
    position: string;
    duration: string;
    responsibilities: string;
  }>;
  laborMarketTesting: {
    advertised: boolean;
    newspaperName?: string;
    dateAdvertised?: string;
    numberOfApplicants?: number;
    reasonForForeignHire: string;
  };
  replacementPlan: {
    hasplan: boolean;
    trainingSAcitizen: boolean;
    timeframe?: string;
    details?: string;
  };
}

// Medical Certificate Template
export interface MedicalCertificateData {
  certificateNumber: string;
  patient: PersonalDetails;
  doctor: {
    fullName: string;
    qualifications: string;
    practiceNumber: string;
    address: string;
    telephone: string;
  };
  examinationDate: string;
  medicalHistory: {
    chronicConditions: string[];
    currentMedications: string[];
    allergies: string[];
    previousSurgeries: string[];
  };
  physicalExamination: {
    height: string;
    weight: string;
    bloodPressure: string;
    heartRate: string;
    generalHealth: "Excellent" | "Good" | "Fair" | "Poor";
  };
  tuberculosisScreening: {
    tested: boolean;
    testDate?: string;
    result?: "Negative" | "Positive";
    treatmentRequired?: boolean;
  };
  otherInfectiousDiseases: {
    tested: boolean;
    diseases?: string[];
  };
  mentalHealth: {
    assessment: "Normal" | "Requires Further Evaluation";
    details?: string;
  };
  fitnessForPurpose: {
    fitForWork: boolean;
    fitForStudy: boolean;
    fitForResidence: boolean;
    restrictions?: string[];
  };
  additionalNotes?: string;
}

// Death Certificate Template
export interface DeathCertificateData {
  registrationNumber: string;
  deceasedDetails: {
    fullName: string;
    surname: string;
    givenNames: string;
    dateOfBirth: string;
    dateOfDeath: string;
    timeOfDeath: string;
    placeOfDeath: string;
    gender: string;
    idNumber?: string;
    nationality: string;
    maritalStatus: string;
    occupation?: string;
    usualResidence: string;
  };
  deathDetails: {
    causeOfDeath: {
      immediate: string;
      underlying: string;
      other?: string[];
    };
    mannerOfDeath: "Natural" | "Accident" | "Suicide" | "Homicide" | "Undetermined";
    certifyingDoctor: {
      fullName: string;
      qualifications: string;
      practiceNumber: string;
      address: string;
      contactNumber: string;
    };
    postMortem: boolean;
    postMortemFindings?: string;
  };
  informantDetails: {
    fullName: string;
    relationship: string;
    address: string;
    contactNumber: string;
    idNumber?: string;
  };
  registrationDetails: {
    dateOfRegistration: string;
    registrationOffice: string;
    registrarName: string;
    registrarSignature: string;
  };
}

// Marriage Certificate Template
export interface MarriageCertificateData {
  registrationNumber: string;
  marriageDetails: {
    dateOfMarriage: string;
    placeOfMarriage: string;
    typeOfMarriage: "Civil" | "Religious" | "Customary" | "Civil Union";
    marriageOfficer: {
      fullName: string;
      designation: string;
      registrationNumber: string;
    };
  };
  spouse1: {
    fullName: string;
    surname: string;
    givenNames: string;
    dateOfBirth: string;
    nationality: string;
    idNumber?: string;
    passportNumber?: string;
    maritalStatus: string;
    occupation?: string;
    address: string;
  };
  spouse2: {
    fullName: string;
    surname: string;
    givenNames: string;
    dateOfBirth: string;
    nationality: string;
    idNumber?: string;
    passportNumber?: string;
    maritalStatus: string;
    occupation?: string;
    address: string;
  };
  witnesses: Array<{
    fullName: string;
    idNumber?: string;
    address: string;
    signature: string;
  }>;
  registrationDetails: {
    dateOfRegistration: string;
    registrationOffice: string;
    registrarName: string;
    registrarSignature: string;
  };
}

// South African ID Card Template
export interface SouthAfricanIdData {
  idNumber: string;
  smartCardNumber?: string;
  personal: {
    fullName: string;
    surname: string;
    givenNames: string;
    dateOfBirth: string;
    placeOfBirth: string;
    gender: string;
    nationality: string;
    citizenshipStatus: "Citizen" | "Permanent Resident";
  };
  physicalDetails: {
    height?: string;
    eyeColor?: string;
    photograph: string; // Base64 encoded
    signature: string; // Base64 encoded
  };
  address: {
    streetAddress: string;
    suburb: string;
    city: string;
    province: string;
    postalCode: string;
  };
  biometricData: {
    fingerprints: string[]; // Base64 encoded fingerprint templates
    faceTemplate?: string; // Base64 encoded face biometric
  };
  issuanceDetails: {
    dateOfIssue: string;
    dateOfExpiry: string;
    issuingOffice: string;
    smartChipData?: string; // RFID/NFC data
  };
}

// Business Permit Template
export interface BusinessPermitData {
  personal: PersonalDetails;
  permitNumber: string;
  businessDetails: {
    businessName: string;
    registrationNumber: string;
    businessType: string;
    businessAddress: string;
    businessActivity: string;
    investmentAmount: string;
    employmentCreated: number;
    businessPlan: string;
  };
  financialDetails: {
    sourceOfFunds: string;
    bankDetails: {
      bankName: string;
      accountNumber: string;
      accountType: string;
    };
    auditorDetails?: {
      firmName: string;
      contactPerson: string;
      address: string;
    };
  };
  validFrom: string;
  validUntil: string;
  conditions?: string[];
  endorsements?: string[];
}

// Transit Visa Template
export interface TransitVisaData {
  personal: PersonalDetails;
  visaNumber: string;
  transitDetails: {
    entryPort: string;
    exitPort: string;
    transitDuration: string; // in hours
    finalDestination: string;
    flightDetails: {
      arrivalFlight: string;
      arrivalDate: string;
      arrivalTime: string;
      departureFlight: string;
      departureDate: string;
      departureTime: string;
    };
  };
  travelDocument: {
    passportNumber: string;
    issuingCountry: string;
    expiryDate: string;
  };
  validFrom: string;
  validUntil: string;
  conditions?: string[];
}

// Medical Treatment Visa Template
export interface MedicalTreatmentVisaData {
  personal: PersonalDetails;
  visaNumber: string;
  medicalDetails: {
    condition: string;
    treatmentRequired: string;
    urgency: "Emergency" | "Urgent" | "Scheduled";
    estimatedDuration: string;
    medicalInstitution: {
      name: string;
      address: string;
      contactNumber: string;
      registrationNumber: string;
      specialization: string;
    };
    attendingDoctor: {
      fullName: string;
      qualifications: string;
      practiceNumber: string;
      specialization: string;
    };
  };
  financialArrangements: {
    paymentMethod: "Medical Aid" | "Cash" | "Insurance" | "Government";
    medicalAidDetails?: {
      schemeName: string;
      membershipNumber: string;
      principalMember: string;
    };
    estimatedCost: string;
  };
  accompaniedBy?: Array<{
    fullName: string;
    relationship: string;
    passportNumber: string;
    nationality: string;
  }>;
  validFrom: string;
  validUntil: string;
  conditions?: string[];
}

// Emergency Travel Document Template
export interface EmergencyTravelDocumentData {
  personal: PersonalDetails;
  documentNumber: string;
  emergencyDetails: {
    emergencyType: "Lost Passport" | "Stolen Passport" | "Emergency Travel" | "Medical Emergency" | "Other";
    circumstances: string;
    policeReference?: string;
    reportDate?: string;
  };
  validityDetails: {
    validFrom: string;
    validUntil: string;
    purpose: "Single Journey" | "Multiple Journey" | "Emergency Return";
    destinationCountries: string[];
    restrictions?: string[];
  };
  issuingDetails: {
    issuingOffice: string;
    issuingOfficer: string;
    emergencyContactSA: {
      name: string;
      relationship: string;
      contactNumber: string;
      address: string;
    };
  };
  replacementDetails?: {
    originalPassportNumber?: string;
    originalIssueDate?: string;
    originalExpiryDate?: string;
  };
}

// Radiological Report Template
export interface RadiologicalReportData {
  reportNumber: string;
  patient: PersonalDetails;
  radiologist: {
    fullName: string;
    qualifications: string;
    practiceNumber: string;
    facility: string;
    address: string;
  };
  examinationDate: string;
  examType: "Chest X-Ray" | "CT Scan" | "MRI" | "Other";
  indication: string;
  findings: {
    lungs: {
      normal: boolean;
      abnormalities?: string[];
    };
    heart: {
      normal: boolean;
      size?: string;
      abnormalities?: string[];
    };
    bones: {
      normal: boolean;
      abnormalities?: string[];
    };
    otherFindings?: string[];
  };
  tuberculosisScreening: {
    signsOfActiveTB: boolean;
    signsOfOldTB: boolean;
    furtherTestingRequired: boolean;
    details?: string;
  };
  impression: string;
  recommendations: string[];
}

// Critical Skills Visa
export interface CriticalSkillsData {
  personal: PersonalDetails;
  applicationNumber: string;
  criticalSkillCategory: string;
  qualifications: Array<{
    degree: string;
    field: string;
    institution: string;
    country: string;
    year: string;
    saricStatus?: string; // South African Qualifications Authority
  }>;
  professionalRegistration?: {
    body: string;
    registrationNumber: string;
    validUntil: string;
  };
  experience: Array<{
    employer: string;
    position: string;
    duration: string;
    keyAchievements: string[];
  }>;
  jobOffer?: {
    employer: string;
    position: string;
    salary: string;
    startDate: string;
  };
  confirmationLetter: boolean;
  motivationLetter: boolean;
}

// Business Visa
export interface BusinessVisaData {
  personal: PersonalDetails;
  applicationNumber: string;
  businessDetails: {
    companyName: string;
    registrationNumber: string;
    businessType: string;
    yearsInOperation: number;
    annualTurnover: string;
    numberOfEmployees: number;
  };
  purposeOfVisit: string;
  businessActivities: string[];
  investmentAmount?: string;
  jobCreation?: {
    numberOfJobs: number;
    timeline: string;
  };
  businessPlan: boolean;
  financialStatements: boolean;
  taxClearance: boolean;
  partners?: Array<{
    name: string;
    nationality: string;
    shareholding: string;
  }>;
}

// Retirement Visa
export interface RetirementVisaData {
  personal: PersonalDetails;
  applicationNumber: string;
  retirementIncome: {
    monthlyPension: string;
    otherIncome?: string;
    totalMonthly: string;
    currency: string;
  };
  netWorth: string;
  propertyInSA?: {
    owned: boolean;
    address?: string;
    value?: string;
  };
  dependents: Array<{
    name: string;
    relationship: string;
    age: number;
  }>;
  healthInsurance: {
    provider: string;
    policyNumber: string;
    coverage: string;
  };
  criminalRecord: boolean;
  intendedAddress: string;
}

export class PDFGenerationService {
  
  /**
   * Get translation for a key in specified language
   */
  private getTranslation(key: string, language: 'en' | 'af' = 'en'): string {
    const translations = DOCUMENT_TRANSLATIONS[language];
    return translations[key as keyof typeof translations] || key;
  }
  
  /**
   * Add bilingual text (English + Afrikaans) to document
   */
  private addBilingualText(
    doc: PDFKit, 
    textKey: string, 
    x: number, 
    y: number, 
    options: {
      fontSize?: number;
      font?: string;
      color?: string;
      width?: number;
      align?: string;
      isBold?: boolean;
    } = {}
  ): number {
    const {
      fontSize = 10,
      font = 'Helvetica',
      color = SA_COLORS.black,
      width = 500,
      align = 'left',
      isBold = false
    } = options;
    
    const fontName = isBold ? (font === 'Helvetica' ? 'Helvetica-Bold' : font) : font;
    
    doc.save();
    doc.fontSize(fontSize)
       .font(fontName)
       .fillColor(color);
    
    // English text
    const englishText = this.getTranslation(textKey, 'en');
    doc.text(englishText, x, y, { width, align: align as any });
    
    // Afrikaans text (slightly smaller and below)
    const afrikaansText = this.getTranslation(textKey, 'af');
    doc.fontSize(fontSize * 0.9)
       .fillColor(color)
       .fillOpacity(0.8)
       .text(afrikaansText, x, y + (fontSize * 1.2), { width, align: align as any });
    
    doc.restore();
    
    // Return the total height used
    return (fontSize * 1.2) + (fontSize * 0.9 * 1.3);
  }
  
  /**
   * Add single language text with proper typography
   */
  private addLanguageText(
    doc: PDFKit,
    text: string,
    language: 'en' | 'af',
    x: number,
    y: number,
    options: {
      fontSize?: number;
      font?: string;
      color?: string;
      width?: number;
      align?: string;
    } = {}
  ): void {
    const typography = TYPOGRAPHY_CONFIG[language];
    const {
      fontSize = 10,
      font = typography.primaryFont,
      color = SA_COLORS.black,
      width = 500,
      align = 'left'
    } = options;
    
    doc.save();
    doc.fontSize(fontSize)
       .font(font)
       .fillColor(color);
    
    // Apply language-specific typography settings
    if (typography.characterSpacing) {
      doc.text(text, x, y, { 
        width, 
        align: align as any,
        characterSpacing: typography.characterSpacing
      });
    } else {
      doc.text(text, x, y, { width, align: align as any });
    }
    
    doc.restore();
  }
  
  /**
   * Add government header with bilingual support
   */
  private addBilingualGovernmentHeader(doc: PDFKit, documentTitle: string): number {
    const pageWidth = doc.page.width;
    let yPos = 30;
    
    // South African coat of arms placeholder
    doc.save();
    doc.circle(pageWidth / 2, yPos + 25, 20)
       .fillColor(SA_COLORS.gold)
       .fill()
       .strokeColor(SA_COLORS.green)
       .lineWidth(2)
       .stroke();
    doc.restore();
    
    yPos += 60;
    
    // Republic of South Africa - Bilingual
    yPos += this.addBilingualText(doc, 'republic_of_south_africa', 0, yPos, {
      fontSize: 14,
      font: 'Helvetica-Bold',
      color: SA_COLORS.green,
      width: pageWidth,
      align: 'center',
      isBold: true
    });
    
    yPos += 10;
    
    // Department of Home Affairs - Bilingual
    yPos += this.addBilingualText(doc, 'department_home_affairs', 0, yPos, {
      fontSize: 12,
      color: SA_COLORS.blue,
      width: pageWidth,
      align: 'center'
    });
    
    yPos += 20;
    
    // Document title - Bilingual
    const documentTitleKey = documentTitle.toLowerCase().replace(/\s+/g, '_');
    yPos += this.addBilingualText(doc, documentTitleKey, 0, yPos, {
      fontSize: 18,
      font: 'Helvetica-Bold',
      color: SA_COLORS.black,
      width: pageWidth,
      align: 'center',
      isBold: true
    });
    
    // Add decorative line
    doc.save();
    doc.strokeColor(SA_COLORS.gold)
       .lineWidth(2)
       .moveTo(50, yPos + 10)
       .lineTo(pageWidth - 50, yPos + 10)
       .stroke();
    doc.restore();
    
    return yPos + 20;
  }
  
  /**
   * Add bilingual field with label and value
   */
  private addBilingualField(
    doc: PDFKit,
    labelKey: string,
    value: string,
    x: number,
    y: number,
    options: {
      labelWidth?: number;
      fontSize?: number;
      valueColor?: string;
    } = {}
  ): number {
    const { labelWidth = 150, fontSize = 10, valueColor = SA_COLORS.black } = options;
    
    // English label
    const englishLabel = this.getTranslation(labelKey, 'en');
    doc.fontSize(fontSize)
       .font('Helvetica-Bold')
       .fillColor(SA_COLORS.green)
       .text(englishLabel, x, y, { width: labelWidth });
    
    // Afrikaans label (smaller, below English)
    const afrikaansLabel = this.getTranslation(labelKey, 'af');
    doc.fontSize(fontSize * 0.9)
       .fillColor(SA_COLORS.green)
       .fillOpacity(0.8)
       .text(afrikaansLabel, x, y + (fontSize * 1.1), { width: labelWidth });
    
    // Value (aligned to the right of labels)
    doc.fontSize(fontSize)
       .font('Helvetica')
       .fillColor(valueColor)
       .fillOpacity(1)
       .text(value, x + labelWidth + 10, y, { width: 300 });
    
    return (fontSize * 1.1) + (fontSize * 0.9 * 1.3) + 5; // Total height used
  }
  
  /**
   * Format date according to South African standards
   */
  private formatSADate(dateString: string, language: 'en' | 'af' = 'en'): string {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    
    const monthNames = {
      en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      af: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Des']
    };
    
    const monthName = monthNames[language][month - 1];
    return `${day} ${monthName} ${year}`;
  }
  
  /**
   * Add government footer with security information
   */
  private addBilingualGovernmentFooter(doc: PDFKit): void {
    const pageHeight = doc.page.height;
    const pageWidth = doc.page.width;
    const footerY = pageHeight - 80;
    
    // Security line
    doc.save();
    doc.strokeColor(SA_COLORS.security_blue)
       .lineWidth(1)
       .moveTo(30, footerY)
       .lineTo(pageWidth - 30, footerY)
       .stroke();
    doc.restore();
    
    // Official document notice - Bilingual
    this.addBilingualText(doc, 'this_is_official_document', 30, footerY + 10, {
      fontSize: 8,
      color: SA_COLORS.security_blue,
      width: pageWidth - 60,
      align: 'center'
    });
    
    // Verification URL
    doc.fontSize(8)
       .font('Helvetica')
       .fillColor(SA_COLORS.blue)
       .text('verify.dha.gov.za', 30, footerY + 45, {
         width: pageWidth - 60,
         align: 'center'
       });
    
    // Fraud warning - Bilingual
    this.addBilingualText(doc, 'fraud_warning', 30, footerY + 55, {
      fontSize: 7,
      color: SA_COLORS.security_red,
      width: pageWidth - 60,
      align: 'center'
    });
  }
  
  /**
   * Generate ICAO-compliant Machine Readable Zone (MRZ) for travel documents
   */
  private generateMRZ(documentType: string, passportNumber: string, surname: string, givenNames: string, nationality: string, dateOfBirth: string, gender: string, expiryDate: string, personalNumber?: string): string[] {
    // Format dates for MRZ (YYMMDD format)
    const formatMRZDate = (dateStr: string) => {
      const date = new Date(dateStr);
      const year = date.getFullYear().toString().slice(-2);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return year + month + day;
    };
    
    // Calculate check digit using ICAO standard
    const calculateCheckDigit = (data: string) => {
      const weights = [7, 3, 1];
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const char = data[i];
        let value = 0;
        if (char >= '0' && char <= '9') {
          value = parseInt(char);
        } else if (char >= 'A' && char <= 'Z') {
          value = char.charCodeAt(0) - 'A'.charCodeAt(0) + 10;
        } else if (char === '<') {
          value = 0;
        }
        sum += value * weights[i % 3];
      }
      return (sum % 10).toString();
    };
    
    // Pad and truncate strings to fit MRZ format
    const padRight = (str: string, length: number) => {
      return (str + '<'.repeat(length)).substring(0, length);
    };
    
    // Clean and format names (remove special characters, convert to uppercase)
    const cleanName = (name: string) => {
      return name.toUpperCase()
                 .replace(/[^A-Z\s]/g, '')
                 .replace(/\s+/g, '<');
    };
    
    const formattedSurname = cleanName(surname);
    const formattedGivenNames = cleanName(givenNames);
    const formattedDOB = formatMRZDate(dateOfBirth);
    const formattedExpiry = formatMRZDate(expiryDate);
    const genderCode = gender.toUpperCase().charAt(0);
    
    let mrz: string[] = [];
    
    if (documentType === 'passport' || documentType === 'emergency_travel_document') {
      // TD-3 format (passport)
      // Line 1: P<COUNTRY<SURNAME<<GIVEN<NAMES<<<<<<<<<<<<<<<
      const line1 = 'P<ZAF' + padRight(formattedSurname + '<<' + formattedGivenNames, 39);
      
      // Line 2: PASSPORT_NUMBER<CHECK_DIGIT<NATIONALITY<DOB<CHECK_DIGIT<GENDER<EXPIRY<CHECK_DIGIT<PERSONAL_NUMBER<CHECK_DIGIT<OVERALL_CHECK_DIGIT
      const passportField = padRight(passportNumber, 9);
      const passportCheckDigit = calculateCheckDigit(passportField);
      const dobCheckDigit = calculateCheckDigit(formattedDOB);
      const expiryCheckDigit = calculateCheckDigit(formattedExpiry);
      const personalNumberField = padRight(personalNumber || '', 14);
      const personalNumberCheckDigit = calculateCheckDigit(personalNumberField);
      
      // Calculate overall check digit for line 2 (excluding the last check digit itself)
      const line2ForOverallCheck = passportField + passportCheckDigit + nationality + formattedDOB + dobCheckDigit + genderCode + formattedExpiry + expiryCheckDigit + personalNumberField + personalNumberCheckDigit;
      const overallCheckDigit = calculateCheckDigit(line2ForOverallCheck);
      
      const line2 = passportField + passportCheckDigit + nationality + formattedDOB + dobCheckDigit + genderCode + formattedExpiry + expiryCheckDigit + personalNumberField + personalNumberCheckDigit + overallCheckDigit;
      
      mrz = [line1, line2];
    } else if (documentType === 'sa_id' || documentType === 'smart_id') {
      // TD-1 format (ID card) - 3 lines of 30 characters each
      // Line 1: I<COUNTRY<DOCUMENT_NUMBER<CHECK_DIGIT<<<<<<<<<<<<<
      const line1 = 'I<ZAF' + padRight(passportNumber, 9) + calculateCheckDigit(padRight(passportNumber, 9)) + '<'.repeat(15);
      
      // Line 2: DOB<CHECK_DIGIT<GENDER<EXPIRY<CHECK_DIGIT<NATIONALITY<<<<<<<
      const line2 = formattedDOB + calculateCheckDigit(formattedDOB) + genderCode + formattedExpiry + calculateCheckDigit(formattedExpiry) + nationality + '<'.repeat(7);
      
      // Line 3: SURNAME<<GIVEN<NAMES<<<<<<<<<<<<<<<<<<<
      const line3 = padRight(formattedSurname + '<<' + formattedGivenNames, 30);
      
      mrz = [line1, line2, line3];
    }
    
    return mrz;
  }
  
  /**
   * Add MRZ to travel document
   */
  private addMRZToDocument(doc: PDFKit, mrz: string[], x: number, y: number): void {
    doc.save();
    
    // MRZ background
    doc.rect(x - 5, y - 5, 350, (mrz.length * 15) + 10)
       .fillColor('#f0f0f0')
       .fill();
    
    // MRZ text using monospace font
    doc.font('Courier')
       .fontSize(10)
       .fillColor(SA_COLORS.black);
    
    mrz.forEach((line, index) => {
      doc.text(line, x, y + (index * 15), {
        characterSpacing: 1.2,
        width: 340
      });
    });
    
    // Add holographic overlay on MRZ for security
    this.addHolographicEffect(doc, x - 5, y - 5, 350, (mrz.length * 15) + 10);
    
    doc.restore();
  }
  
  /**
   * Generate RFID/NFC chip data placeholder for smart documents
   */
  private generateRFIDData(documentType: string, personalData: any): any {
    const chipData = {
      chipId: crypto.randomBytes(8).toString('hex').toUpperCase(),
      encryptionKey: crypto.randomBytes(16).toString('hex'),
      digitalSignature: crypto.randomBytes(32).toString('hex'),
      biometricTemplates: {
        face: crypto.randomBytes(64).toString('base64'),
        fingerprints: [
          crypto.randomBytes(32).toString('base64'),
          crypto.randomBytes(32).toString('base64')
        ]
      },
      personalData: {
        name: personalData.fullName,
        dateOfBirth: personalData.dateOfBirth,
        nationality: personalData.nationality,
        documentNumber: personalData.passportNumber || personalData.idNumber
      },
      securityFeatures: {
        activationDate: new Date().toISOString(),
        expirationDate: new Date(Date.now() + (10 * 365 * 24 * 60 * 60 * 1000)).toISOString(),
        accessLevel: documentType === 'passport' ? 'INTERNATIONAL' : 'NATIONAL',
        encryptionLevel: 'AES-256'
      },
      metadata: {
        issuer: 'DHA-RSA',
        version: '2.0',
        standard: 'ISO/IEC 14443',
        compliance: ['ICAO-9303', 'NIST-SP-800-73']
      }
    };
    
    return JSON.stringify(chipData);
  }
  
  /**
   * Add RFID/NFC chip indicator to smart documents
   */
  private addRFIDChipIndicator(doc: PDFKit, x: number, y: number): void {
    doc.save();
    
    // RFID chip background
    doc.rect(x, y, 30, 20)
       .fillColor(SA_COLORS.gold)
       .fill()
       .strokeColor(SA_COLORS.black)
       .lineWidth(1)
       .stroke();
    
    // Chip contact points
    const contacts = [
      [x + 5, y + 3], [x + 15, y + 3], [x + 25, y + 3],
      [x + 5, y + 8], [x + 15, y + 8], [x + 25, y + 8],
      [x + 5, y + 13], [x + 15, y + 13], [x + 25, y + 13]
    ];
    
    contacts.forEach(([cx, cy]) => {
      doc.circle(cx, cy, 1)
         .fillColor(SA_COLORS.black)
         .fill();
    });
    
    // NFC waves indicator
    doc.strokeColor(SA_COLORS.security_blue)
       .lineWidth(0.5);
    
    for (let i = 1; i <= 3; i++) {
      doc.circle(x + 35, y + 10, 5 * i)
         .stroke();
    }
    
    // Add text
    doc.fontSize(6)
       .font('Helvetica')
       .fillColor(SA_COLORS.black)
       .text('RFID', x, y + 22);
    
    doc.restore();
  }
  
  /**
   * Generate biometric data placeholders for documents
   */
  private generateBiometricPlaceholders(documentType: string): any {
    return {
      faceTemplate: {
        algorithm: 'ISO/IEC 19794-5',
        template: crypto.randomBytes(1024).toString('base64'),
        quality: Math.floor(Math.random() * 40) + 60, // 60-100 quality score
        captureDate: new Date().toISOString(),
        resolution: '640x480',
        colorSpace: 'RGB24'
      },
      fingerprintTemplates: [
        {
          position: 'RIGHT_THUMB',
          algorithm: 'ISO/IEC 19794-2',
          template: crypto.randomBytes(512).toString('base64'),
          quality: Math.floor(Math.random() * 30) + 70,
          captureDate: new Date().toISOString(),
          resolution: '500dpi'
        },
        {
          position: 'RIGHT_INDEX',
          algorithm: 'ISO/IEC 19794-2', 
          template: crypto.randomBytes(512).toString('base64'),
          quality: Math.floor(Math.random() * 30) + 70,
          captureDate: new Date().toISOString(),
          resolution: '500dpi'
        }
      ],
      irisTemplate: documentType === 'passport' ? {
        algorithm: 'ISO/IEC 19794-6',
        template: crypto.randomBytes(2048).toString('base64'),
        quality: Math.floor(Math.random() * 25) + 75,
        captureDate: new Date().toISOString(),
        eye: 'BOTH'
      } : null,
      signatureTemplate: {
        algorithm: 'ISO/IEC 19794-7',
        template: crypto.randomBytes(256).toString('base64'),
        captureDate: new Date().toISOString(),
        dynamicFeatures: true
      }
    };
  }
  
  /**
   * Add biometric data indicators to document
   */
  private addBiometricIndicators(doc: PDFKit, x: number, y: number, biometricData: any): void {
    doc.save();
    
    doc.fontSize(8)
       .font('Helvetica-Bold')
       .fillColor(SA_COLORS.security_blue)
       .text('BIOMETRIC DATA', x, y);
    
    let indicatorY = y + 15;
    
    // Face biometric indicator
    if (biometricData.faceTemplate) {
      doc.fontSize(6)
         .text(`✓ Face Template (Quality: ${biometricData.faceTemplate.quality})`, x, indicatorY);
      indicatorY += 10;
    }
    
    // Fingerprint indicators
    if (biometricData.fingerprintTemplates) {
      biometricData.fingerprintTemplates.forEach((fp: any, index: number) => {
        doc.text(`✓ ${fp.position} (Quality: ${fp.quality})`, x, indicatorY);
        indicatorY += 10;
      });
    }
    
    // Iris indicator (for passports)
    if (biometricData.irisTemplate) {
      doc.text(`✓ Iris Template (Quality: ${biometricData.irisTemplate.quality})`, x, indicatorY);
      indicatorY += 10;
    }
    
    // Signature indicator
    if (biometricData.signatureTemplate) {
      doc.text('✓ Digital Signature Template', x, indicatorY);
    }
    
    doc.restore();
  }
  
  /**
   * Generate prominent Braille pattern with larger dots and better spacing
   */
  private addProminentBraillePattern(doc: PDFKit, text: string, x: number, y: number): void {
    const brailleText = verificationService.generateBraillePattern(text);
    
    // Add background for Braille section
    doc.save();
    doc.rect(x - 5, y - 5, 400, 35)
       .fill('#f0f0f0');
    
    // Add label
    doc.fillColor(SA_COLORS.black)
       .fontSize(8)
       .font('Helvetica')
       .text('Braille Reference (Grade 1):', x, y - 3);
    
    // Add prominent Braille dots with larger size
    doc.fontSize(20)
       .font('Helvetica')
       .fillColor(SA_COLORS.black)
       .text(brailleText, x, y + 10, { width: 390 });
    
    doc.restore();
  }
  
  /**
   * Add enhanced holographic security strip with rainbow gradient
   */
  private addEnhancedHolographicStrip(doc: PDFKit, y: number): void {
    const pageWidth = 565;
    const stripHeight = 30;
    
    // Create rainbow gradient effect
    const colors = [
      { offset: 0, color: [255, 0, 0, 0.3] },    // Red
      { offset: 0.17, color: [255, 165, 0, 0.3] }, // Orange
      { offset: 0.33, color: [255, 255, 0, 0.3] }, // Yellow
      { offset: 0.5, color: [0, 255, 0, 0.3] },    // Green
      { offset: 0.67, color: [0, 0, 255, 0.3] },   // Blue
      { offset: 0.83, color: [75, 0, 130, 0.3] },  // Indigo
      { offset: 1, color: [238, 130, 238, 0.3] }   // Violet
    ];
    
    // Draw gradient strips
    const stripWidth = pageWidth / colors.length;
    colors.forEach((color, index) => {
      doc.save();
      doc.rect(25 + (index * stripWidth), y, stripWidth, stripHeight)
         .fillOpacity(0.3)
         .fillColor(`rgb(${color.color[0]}, ${color.color[1]}, ${color.color[2]})`)
         .fill();
      doc.restore();
    });
    
    // Add SECURE text overlay
    doc.save();
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .fillOpacity(0.2)
       .fillColor(SA_COLORS.black);
    
    for (let i = 0; i < 5; i++) {
      doc.text('SECURE', 50 + (i * 110), y + 8);
    }
    
    // Add shimmer pattern lines
    doc.strokeOpacity(0.1)
       .strokeColor(SA_COLORS.gold);
    
    for (let i = 0; i < 20; i++) {
      doc.moveTo(25 + (i * 30), y)
         .lineTo(25 + (i * 30) + 10, y + stripHeight)
         .stroke();
    }
    
    doc.restore();
  }
  
  /**
   * Add functional QR code with live verification link
   */
  private async addLiveVerificationQRCode(
    doc: PDFKit, 
    documentType: string,
    documentNumber: string,
    documentData: any,
    x: number, 
    y: number
  ): Promise<{ code: string; hashtags: string[] }> {
    // Register document with verification service
    const verification = await verificationService.registerDocument(
      documentType,
      documentNumber,
      documentData
    );
    
    // Create QR code with verification URL
    const qrData = verification.url;
    const qrCode = await QRCode.toDataURL(qrData, {
      width: 200, // Larger QR code (2+ inches at 72 DPI)
      margin: 1,
      color: { dark: SA_COLORS.black, light: SA_COLORS.white }
    });
    
    // Add QR code background
    doc.save();
    doc.rect(x - 10, y - 10, 140, 180)
       .fill('#ffffff')
       .stroke(SA_COLORS.green);
    
    // Add QR code image
    doc.image(qrCode, x, y, { width: 120, height: 120 });
    
    // Add SCAN TO VERIFY text
    doc.fillColor(SA_COLORS.green)
       .fontSize(12)
       .font('Helvetica-Bold')
       .text('SCAN FOR LIVE', x, y + 125, { width: 120, align: 'center' })
       .text('VERIFICATION', x, y + 140, { width: 120, align: 'center' });
    
    // Add verification URL
    doc.fillColor(SA_COLORS.black)
       .fontSize(7)
       .font('Helvetica')
       .text(`Verify at: ${verification.url}`, x - 5, y + 155, { width: 130, align: 'center' });
    
    doc.restore();
    
    return { code: verification.code, hashtags: verification.hashtags };
  }
  
  /**
   * Add hashtag section for social media tracking
   */
  private addHashtagSection(doc: PDFKit, hashtags: string[], x: number, y: number): void {
    doc.save();
    
    // Add hashtag box
    doc.rect(x - 5, y - 5, 520, 35)
       .fill('#f8f8f8')
       .stroke(SA_COLORS.blue);
    
    // Add hashtag icon
    doc.fillColor(SA_COLORS.blue)
       .fontSize(16)
       .font('Helvetica-Bold')
       .text('#', x, y + 2);
    
    // Add hashtags
    doc.fillColor(SA_COLORS.black)
       .fontSize(9)
       .font('Helvetica');
    
    const hashtagText = hashtags.join(' ');
    doc.text(hashtagText, x + 20, y + 5, { width: 490 });
    
    doc.restore();
  }
  
  /**
   * Add verification status indicator
   */
  private addVerificationStatusIndicator(doc: PDFKit, x: number, y: number): void {
    doc.save();
    
    // Add status box
    doc.rect(x, y, 200, 60)
       .fill('#e8f5e9')
       .stroke(SA_COLORS.green);
    
    // Add verified stamp
    doc.circle(x + 30, y + 30, 20)
       .lineWidth(2)
       .stroke(SA_COLORS.green);
    
    // Add checkmark
    doc.strokeColor(SA_COLORS.green)
       .lineWidth(3)
       .moveTo(x + 20, y + 30)
       .lineTo(x + 27, y + 37)
       .lineTo(x + 40, y + 23)
       .stroke();
    
    // Add text
    doc.fillColor(SA_COLORS.green)
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('VERIFIED', x + 60, y + 15);
    
    doc.fillColor(SA_COLORS.black)
       .fontSize(8)
       .font('Helvetica')
       .text('Authenticity Guaranteed', x + 60, y + 30)
       .text('Scan QR for live status', x + 60, y + 42);
    
    doc.restore();
  }
  
  /**
   * Generate Work Permit PDF (Section 19 permits)
   */
  async generateWorkPermitPDF(data: WorkPermitData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 30,
          info: {
            Title: `Work Permit - ${data.permitNumber}`,
            Author: 'Department of Home Affairs',
            Subject: 'Work Permit',
            Keywords: 'DHA, Work Permit, South Africa'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add watermark
        this.addPDFKitWatermark(doc);

        // Add multi-layer security features
        const serialNumber = this.addMultiLayerSecurity(doc, 'WP', data.permitNumber);

        // Add header with coat of arms
        this.addGovernmentHeader(doc, "WORK PERMIT");

        // Add control number
        doc.fontSize(10)
           .fillColor(SA_COLORS.black)
           .text(`Control No: ${data.controlNumber || this.generateControlNumber()}`, 400, 100, { align: 'right' });

        // Main title
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text(`WORK PERMIT`, 50, 140, { align: 'center', width: 515 });
        
        doc.fontSize(14)
           .text(`${data.permitType}`, 50, 160, { align: 'center', width: 515 });

        // Permit number box with holographic overlay
        doc.rect(180, 190, 235, 30)
           .stroke(SA_COLORS.green);
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text(`Permit No: ${data.permitNumber}`, 190, 200, { align: 'center', width: 215 });
        
        // Add holographic effect over permit number
        this.addHolographicEffect(doc, 175, 185, 245, 40);

        // Personal details section
        let yPos = 250;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('PERSONAL DETAILS', 50, yPos);
        
        yPos += 25;
        doc.font('Helvetica')
           .fillColor(SA_COLORS.black)
           .fontSize(11);

        const personalDetails = [
          { label: 'Full Name:', value: data.personal.fullName },
          { label: 'Date of Birth:', value: data.personal.dateOfBirth },
          { label: 'Nationality:', value: data.personal.nationality },
          { label: 'Passport Number:', value: data.personal.passportNumber || 'N/A' },
          { label: 'Gender:', value: data.personal.gender || 'Not specified' }
        ];

        personalDetails.forEach(detail => {
          doc.font('Helvetica-Bold')
             .text(detail.label, 50, yPos, { continued: true, width: 130 })
             .font('Helvetica')
             .text(` ${detail.value}`, { width: 350 });
          yPos += 20;
        });

        // Employment details section
        yPos += 10;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('EMPLOYMENT DETAILS', 50, yPos);
        
        yPos += 25;
        doc.font('Helvetica')
           .fillColor(SA_COLORS.black)
           .fontSize(11);

        const employmentDetails = [
          { label: 'Employer:', value: data.employer.name },
          { label: 'Employer Address:', value: data.employer.address },
          { label: 'Occupation:', value: data.occupation },
          { label: 'Valid From:', value: data.validFrom },
          { label: 'Valid Until:', value: data.validUntil }
        ];

        employmentDetails.forEach(detail => {
          doc.font('Helvetica-Bold')
             .text(detail.label, 50, yPos, { continued: true, width: 130 })
             .font('Helvetica')
             .text(` ${detail.value}`, { width: 350 });
          yPos += 20;
        });

        // Conditions section
        if (data.conditions && data.conditions.length > 0) {
          yPos += 10;
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor(SA_COLORS.green)
             .text('CONDITIONS', 50, yPos);
          
          yPos += 20;
          doc.font('Helvetica')
             .fillColor(SA_COLORS.black)
             .fontSize(10);

          data.conditions.forEach((condition, index) => {
            doc.text(`${index + 1}. ${condition}`, 50, yPos, { width: 500 });
            yPos += 18;
          });
        }

        // Add prominent Braille pattern at top
        this.addProminentBraillePattern(doc, data.permitNumber, 50, 90);
        
        // Add enhanced holographic security strip
        this.addEnhancedHolographicStrip(doc, 370);
        
        // Add functional QR code with live verification
        const verification = await this.addLiveVerificationQRCode(
          doc,
          'work_permit',
          data.permitNumber,
          data,
          430,
          420
        );
        
        // Add hashtag section
        this.addHashtagSection(doc, verification.hashtags, 50, 640);
        
        // Add verification status indicator
        this.addVerificationStatusIndicator(doc, 50, 560);
        
        // Add UV reactive indicator around QR code
        this.addUVReactiveIndicator(doc, 445, 395, 110, 110);

        // Add barcode
        this.addBarcode(doc, data.permitNumber, 50, 520);

        // Official stamp area
        this.addOfficialStampArea(doc, 350, 550);

        // Footer
        this.addGovernmentFooter(doc);

        // Important notice
        doc.fontSize(8)
           .font('Helvetica')
           .fillColor(SA_COLORS.red)
           .text('IMPORTANT: This permit must be kept in your passport at all times.', 50, 700, { align: 'center', width: 515 });
        
        doc.fontSize(7)
           .fillColor(SA_COLORS.black)
           .text('For verification: Tel: 0800 60 11 90 | Email: info@dha.gov.za | Website: www.dha.gov.za', 50, 720, { align: 'center', width: 515 });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Asylum Seeker Temporary Visa PDF
   */
  async generateAsylumVisaPDF(data: AsylumVisaData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 30,
          info: {
            Title: `Asylum Seeker Permit - ${data.permitNumber}`,
            Author: 'Department of Home Affairs',
            Subject: 'Asylum Seeker Temporary Visa',
            Keywords: 'DHA, Asylum, Refugee, South Africa'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add watermark
        this.addPDFKitWatermark(doc);

        // Add multi-layer security features
        const serialNumber = this.addMultiLayerSecurity(doc, 'ASV', data.permitNumber);

        // Add header
        this.addGovernmentHeader(doc, "ASYLUM SEEKER TEMPORARY VISA");

        // File reference
        doc.fontSize(10)
           .fillColor(SA_COLORS.black)
           .text(`File Ref: ${data.fileReference}`, 400, 100, { align: 'right' });

        // Main title
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text(`ASYLUM SEEKER`, 50, 140, { align: 'center', width: 515 });
        
        doc.fontSize(14)
           .text(`TEMPORARY VISA`, 50, 160, { align: 'center', width: 515 });

        // Section 22 notice
        doc.fontSize(12)
           .font('Helvetica')
           .text(`(Issued in terms of Section 22 of the Refugees Act, 1998)`, 50, 180, { align: 'center', width: 515 });

        // Permit number box with Braille reference
        doc.rect(180, 210, 235, 30)
           .stroke(SA_COLORS.gold);
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text(`Permit No: ${data.permitNumber}`, 190, 220, { align: 'center', width: 215 });
        
        // Add prominent Braille pattern at top
        this.addProminentBraillePattern(doc, data.permitNumber, 50, 90);
        
        // Add enhanced holographic security strip
        this.addEnhancedHolographicStrip(doc, 300);

        // Personal details
        let yPos = 260;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('APPLICANT DETAILS', 50, yPos);
        
        yPos += 25;
        doc.font('Helvetica')
           .fillColor(SA_COLORS.black)
           .fontSize(11);

        const applicantDetails = [
          { label: 'Full Name:', value: data.personal.fullName },
          { label: 'Date of Birth:', value: data.personal.dateOfBirth },
          { label: 'Country of Origin:', value: data.countryOfOrigin },
          { label: 'Nationality:', value: data.personal.nationality },
          { label: 'Gender:', value: data.personal.gender || 'Not specified' },
          { label: 'UNHCR Number:', value: data.unhcrNumber || 'Pending' },
          { label: 'Date of Application:', value: data.dateOfApplication }
        ];

        applicantDetails.forEach(detail => {
          doc.font('Helvetica-Bold')
             .text(detail.label, 50, yPos, { continued: true, width: 130 })
             .font('Helvetica')
             .text(` ${detail.value}`, { width: 350 });
          yPos += 20;
        });

        // Validity period
        yPos += 10;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('VALIDITY PERIOD', 50, yPos);
        
        yPos += 25;
        doc.font('Helvetica')
           .fillColor(SA_COLORS.black)
           .fontSize(11);

        doc.font('Helvetica-Bold')
           .text('Valid From:', 50, yPos, { continued: true, width: 100 })
           .font('Helvetica')
           .text(` ${data.validFrom}`, { continued: true, width: 150 })
           .font('Helvetica-Bold')
           .text('   Valid Until:', { continued: true, width: 100 })
           .font('Helvetica')
           .text(` ${data.validUntil}`);

        // Dependents section
        if (data.dependents && data.dependents.length > 0) {
          yPos += 30;
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor(SA_COLORS.green)
             .text('DEPENDENTS', 50, yPos);
          
          yPos += 20;
          doc.font('Helvetica')
             .fillColor(SA_COLORS.black)
             .fontSize(10);

          data.dependents.forEach((dependent, index) => {
            doc.text(`${index + 1}. ${dependent.name} (${dependent.relationship}) - DOB: ${dependent.dateOfBirth}`, 50, yPos, { width: 500 });
            yPos += 18;
          });
        }

        // Rights and restrictions
        yPos += 20;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('RIGHTS AND RESTRICTIONS', 50, yPos);
        
        yPos += 20;
        doc.font('Helvetica')
           .fillColor(SA_COLORS.black)
           .fontSize(10);

        const rights = [
          'Right to remain in South Africa pending the outcome of asylum application',
          'Right to work and study (subject to conditions)',
          'Right to basic health care services',
          'Must report to Refugee Reception Office every 3 months for renewal',
          'Must not leave South Africa without prior authorization'
        ];

        rights.forEach((right, index) => {
          doc.text(`• ${right}`, 50, yPos, { width: 500 });
          yPos += 18;
        });

        // Add QR code with serial number
        const qrData = `DHA-ASYLUM:${data.permitNumber}:${data.fileReference}:${serialNumber}`;
        QRCode.toDataURL(qrData, {
          width: 100,
          margin: 1,
          color: { dark: SA_COLORS.black, light: SA_COLORS.white }
        }).then(qrCode => {
          doc.image(qrCode, 450, 500, { width: 100 });
        });
        
        // Add holographic strip near QR
        this.addHolographicEffect(doc, 430, 495, 10, 110);

        // Add barcode
        this.addBarcode(doc, data.fileReference, 50, 600);

        // Official stamp
        this.addOfficialStampArea(doc, 350, 630);

        // Footer
        doc.fontSize(8)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.red)
           .text('WARNING: This document does not constitute a right to permanent residence', 50, 720, { align: 'center', width: 515 });
        
        doc.fontSize(7)
           .fillColor(SA_COLORS.black)
           .text('Refugee Reception Offices: Cape Town | Durban | Musina | Pretoria | Port Elizabeth', 50, 740, { align: 'center', width: 515 });
        
        doc.text('24hr Hotline: 0800 60 11 90 | www.dha.gov.za', 50, 755, { align: 'center', width: 515 });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Permanent Residence Permit PDF
   */
  async generateResidencePermitPDF(data: ResidencePermitData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 30,
          info: {
            Title: `Permanent Residence Permit - ${data.permitNumber}`,
            Author: 'Department of Home Affairs',
            Subject: 'Permanent Residence Permit',
            Keywords: 'DHA, Permanent Residence, South Africa'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add watermark
        this.addPDFKitWatermark(doc);

        // Add multi-layer security with microtext border
        const serialNumber = this.addMultiLayerSecurity(doc, 'PR', data.permitNumber);
        
        // Add specific microtext border pattern for residence permit
        this.addMicrotextPattern(doc, 'PERMANENT RESIDENCE RSA ', 0, 30, 595, 10);
        this.addMicrotextPattern(doc, 'PERMANENT RESIDENCE RSA ', 0, 802, 595, 10);

        // Add header
        this.addGovernmentHeader(doc, "PERMANENT RESIDENCE PERMIT");

        // Main title
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .text(`PERMANENT RESIDENCE PERMIT`, 50, 140, { align: 'center', width: 515 });

        // Permit category
        doc.fontSize(14)
           .text(`Category: ${data.permitCategory}`, 50, 165, { align: 'center', width: 515 });

        // Permit number with special border and holographic overlay
        doc.rect(150, 195, 295, 35)
           .lineWidth(2)
           .stroke(SA_COLORS.gold);
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text(`Permit No: ${data.permitNumber}`, 160, 207, { align: 'center', width: 275 });
        
        // Add holographic overlay on permit box
        this.addHolographicEffect(doc, 150, 195, 295, 35);

        // Personal details
        let yPos = 250;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('HOLDER DETAILS', 50, yPos);
        
        yPos += 25;
        doc.font('Helvetica')
           .fillColor(SA_COLORS.black)
           .fontSize(11);

        const holderDetails = [
          { label: 'Full Name:', value: data.personal.fullName },
          { label: 'Date of Birth:', value: data.personal.dateOfBirth },
          { label: 'Nationality:', value: data.personal.nationality },
          { label: 'Passport Number:', value: data.personal.passportNumber || 'N/A' },
          { label: 'ID Number:', value: data.personal.idNumber || 'To be issued' },
          { label: 'Gender:', value: data.personal.gender || 'Not specified' },
          { label: 'Marital Status:', value: data.personal.maritalStatus || 'Not specified' }
        ];

        holderDetails.forEach(detail => {
          doc.font('Helvetica-Bold')
             .text(detail.label, 50, yPos, { continued: true, width: 130 })
             .font('Helvetica')
             .text(` ${detail.value}`, { width: 350 });
          yPos += 20;
        });

        // Validity
        yPos += 10;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('VALIDITY', 50, yPos);
        
        yPos += 25;
        doc.font('Helvetica')
           .fillColor(SA_COLORS.black)
           .fontSize(11);

        doc.font('Helvetica-Bold')
           .text('Issue Date:', 50, yPos, { continued: true, width: 100 })
           .font('Helvetica')
           .text(` ${data.validFrom}`, { width: 200 });
        
        yPos += 20;
        doc.font('Helvetica-Bold')
           .text('Status:', 50, yPos, { continued: true, width: 100 })
           .font('Helvetica')
           .text(` PERMANENT`, { width: 200 });

        // Conditions and endorsements
        if (data.conditions && data.conditions.length > 0) {
          yPos += 25;
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor(SA_COLORS.green)
             .text('CONDITIONS', 50, yPos);
          
          yPos += 20;
          doc.font('Helvetica')
             .fillColor(SA_COLORS.black)
             .fontSize(10);

          data.conditions.forEach(condition => {
            doc.text(`• ${condition}`, 50, yPos, { width: 500 });
            yPos += 18;
          });
        }

        // Rights section
        yPos += 20;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('RIGHTS AND PRIVILEGES', 50, yPos);
        
        yPos += 20;
        doc.font('Helvetica')
           .fillColor(SA_COLORS.black)
           .fontSize(10);

        const rights = [
          'Right to permanently reside in the Republic of South Africa',
          'Right to work without requiring a work permit',
          'Right to study at any educational institution',
          'Access to social services and benefits',
          'May apply for South African citizenship after qualifying period'
        ];

        rights.forEach(right => {
          doc.text(`✓ ${right}`, 50, yPos, { width: 500 });
          yPos += 18;
        });

        // QR Code
        const qrData = `DHA-PR:${data.permitNumber}`;
        QRCode.toDataURL(qrData, {
          width: 120,
          margin: 1,
          color: { dark: SA_COLORS.black, light: SA_COLORS.white }
        }).then(qrCode => {
          doc.image(qrCode, 440, 540, { width: 120 });
        });

        // Barcode
        this.addBarcode(doc, data.permitNumber, 50, 630);

        // Official stamp
        this.addOfficialStampArea(doc, 350, 650);

        // Footer
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.blue)
           .text('This permit confirms permanent residence status in the Republic of South Africa', 50, 720, { align: 'center', width: 515 });
        
        doc.fontSize(7)
           .fillColor(SA_COLORS.black)
           .text('Department of Home Affairs | www.dha.gov.za | Call Centre: 0800 60 11 90', 50, 740, { align: 'center', width: 515 });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Birth Certificate PDF
   */
  async generateBirthCertificatePDF(data: BirthCertificateData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
          info: {
            Title: `Birth Certificate - ${data.registrationNumber}`,
            Author: 'Department of Home Affairs',
            Subject: 'Birth Certificate',
            Keywords: 'DHA, Birth Certificate, South Africa'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Decorative border
        doc.rect(20, 20, 555, 802)
           .lineWidth(2)
           .stroke(SA_COLORS.green);
        
        doc.rect(25, 25, 545, 792)
           .lineWidth(1)
           .stroke(SA_COLORS.gold);

        // Add guilloche background pattern for birth certificate
        this.addGuillochePattern(doc, 30, 30, 535, 782);

        // Add watermark
        this.addPDFKitWatermark(doc);

        // Add multi-layer security
        const serialNumber = this.addMultiLayerSecurity(doc, 'BC', data.registrationNumber);

        // Government header with coat of arms
        this.addGovernmentHeader(doc, "BIRTH CERTIFICATE", true);

        // Title
        doc.fontSize(24)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('BIRTH CERTIFICATE', 50, 150, { align: 'center', width: 495 });
        
        doc.fontSize(12)
           .font('Helvetica')
           .fillColor(SA_COLORS.black)
           .text('(Abridged)', 50, 180, { align: 'center', width: 495 });

        // Registration number with microtext border
        this.addMicrotextPattern(doc, 'REPUBLIC OF SOUTH AFRICA ', 175, 205, 245, 45);
        doc.rect(180, 210, 235, 35)
           .lineWidth(2)
           .stroke(SA_COLORS.green);
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text(`Registration No: ${data.registrationNumber}`, 190, 223, { align: 'center', width: 215 });
        
        // Add holographic overlay on registration box
        this.addHolographicEffect(doc, 180, 210, 235, 35);

        // Child's details
        let yPos = 270;
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('PARTICULARS OF CHILD', 50, yPos);
        
        yPos += 30;
        doc.font('Helvetica')
           .fillColor(SA_COLORS.black)
           .fontSize(12);

        const childDetails = [
          { label: 'Full Name:', value: data.fullName },
          { label: 'Date of Birth:', value: data.dateOfBirth },
          { label: 'Place of Birth:', value: data.placeOfBirth },
          { label: 'Gender:', value: data.gender },
          { label: 'Identity Number:', value: data.idNumber || 'To be issued' }
        ];

        childDetails.forEach(detail => {
          doc.font('Helvetica-Bold')
             .text(detail.label, 50, yPos, { width: 180, align: 'right' })
             .font('Helvetica')
             .text(detail.value, 240, yPos, { width: 300 });
          yPos += 25;
        });

        // Mother's details
        yPos += 20;
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('PARTICULARS OF MOTHER', 50, yPos);
        
        yPos += 30;
        doc.font('Helvetica')
           .fillColor(SA_COLORS.black)
           .fontSize(12);

        const motherDetails = [
          { label: 'Full Name:', value: data.mother.fullName },
          { label: 'Identity Number:', value: data.mother.idNumber || 'Not provided' },
          { label: 'Nationality:', value: data.mother.nationality }
        ];

        motherDetails.forEach(detail => {
          doc.font('Helvetica-Bold')
             .text(detail.label, 50, yPos, { width: 180, align: 'right' })
             .font('Helvetica')
             .text(detail.value, 240, yPos, { width: 300 });
          yPos += 25;
        });

        // Father's details
        yPos += 20;
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('PARTICULARS OF FATHER', 50, yPos);
        
        yPos += 30;
        doc.font('Helvetica')
           .fillColor(SA_COLORS.black)
           .fontSize(12);

        const fatherDetails = [
          { label: 'Full Name:', value: data.father.fullName },
          { label: 'Identity Number:', value: data.father.idNumber || 'Not provided' },
          { label: 'Nationality:', value: data.father.nationality }
        ];

        fatherDetails.forEach(detail => {
          doc.font('Helvetica-Bold')
             .text(detail.label, 50, yPos, { width: 180, align: 'right' })
             .font('Helvetica')
             .text(detail.value, 240, yPos, { width: 300 });
          yPos += 25;
        });

        // Registration details
        yPos += 20;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .text('Date of Registration:', 50, yPos, { width: 180, align: 'right' })
           .font('Helvetica')
           .text(data.dateOfRegistration, 240, yPos, { width: 300 });
        
        yPos += 25;
        doc.font('Helvetica-Bold')
           .text('Registration Office:', 50, yPos, { width: 180, align: 'right' })
           .font('Helvetica')
           .text(data.registrationOffice, 240, yPos, { width: 300 });

        // QR Code with serial number
        const qrData = `DHA-BC:${data.registrationNumber}:${serialNumber}`;
        QRCode.toDataURL(qrData, {
          width: 100,
          margin: 1,
          color: { dark: SA_COLORS.black, light: SA_COLORS.white }
        }).then(qrCode => {
          doc.image(qrCode, 450, 620, { width: 100 });
          doc.fontSize(8)
             .text('Verification Code', 460, 725);
        });
        
        // Add UV reactive areas
        this.addUVReactiveIndicator(doc, 50, 100, 60, 60);
        this.addUVReactiveIndicator(doc, 485, 100, 60, 60);

        // Official stamp area
        this.addOfficialStampArea(doc, 100, 650, true);

        // Signature line
        doc.moveTo(320, 700)
           .lineTo(450, 700)
           .stroke();
        doc.fontSize(10)
           .text('Registrar-General', 350, 705);

        // Footer
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.blue)
           .text('This is an official document of the Republic of South Africa', 50, 750, { align: 'center', width: 495 });
        
        doc.fontSize(8)
           .fillColor(SA_COLORS.black)
           .text('Department of Home Affairs | www.dha.gov.za', 50, 770, { align: 'center', width: 495 });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Passport PDF
   */
  async generatePassportPDF(data: PassportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: [297, 420], // Passport page size (A6)
          margin: 20,
          info: {
            Title: `Passport - ${data.passportNumber}`,
            Author: 'Department of Home Affairs',
            Subject: 'South African Passport',
            Keywords: 'DHA, Passport, South Africa'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Page 1 - Cover (simplified representation)
        doc.rect(0, 0, 297, 420)
           .fill(SA_COLORS.green);
        
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.gold)
           .text('REPUBLIC OF', 0, 100, { align: 'center', width: 297 });
        doc.text('SOUTH AFRICA', 0, 120, { align: 'center', width: 297 });
        
        // Coat of arms placeholder
        doc.circle(148.5, 210, 40)
           .lineWidth(2)
           .stroke(SA_COLORS.gold);
        
        doc.fontSize(14)
           .text('PASSPORT', 0, 280, { align: 'center', width: 297 });
        doc.fontSize(12)
           .text('PASPOORT', 0, 300, { align: 'center', width: 297 });

        // Page 2 - Data page
        doc.addPage();
        
        // Add holographic overlay on data page
        this.addHolographicEffect(doc, 0, 0, 297, 50);
        
        // Add guilloche pattern background
        this.addGuillochePattern(doc, 10, 60, 277, 350);
        
        // Header
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('SOUTH AFRICAN PASSPORT', 20, 20, { align: 'center', width: 257 });
        
        // Passport type
        doc.fontSize(9)
           .fillColor(SA_COLORS.black)
           .text(`Type/Tipe: ${data.passportType.charAt(0)}`, 20, 40);
        
        doc.text(`Passport No./Paspoortnr: ${data.passportNumber}`, 20, 55);

        // Photo area
        doc.rect(20, 75, 80, 100)
           .stroke(SA_COLORS.black);
        doc.fontSize(8)
           .text('PHOTO', 45, 120);

        // Personal details
        let yPos = 75;
        const xLabel = 110;
        const xValue = 110;
        
        doc.fontSize(8)
           .font('Helvetica');
        
        const details = [
          { label: 'Surname/Van', value: data.personal.surname || data.personal.fullName.split(' ').pop() || '' },
          { label: 'Given names/Voorname', value: data.personal.givenNames || data.personal.fullName.split(' ').slice(0, -1).join(' ') || '' },
          { label: 'Nationality/Nasionaliteit', value: 'SOUTH AFRICAN' },
          { label: 'Date of birth/Geboortedatum', value: data.personal.dateOfBirth },
          { label: 'Gender/Geslag', value: data.personal.gender || 'M' },
          { label: 'Place of birth/Geboorteplek', value: data.personal.countryOfBirth || 'SOUTH AFRICA' },
          { label: 'Date of issue/Datum van uitreiking', value: data.dateOfIssue },
          { label: 'Date of expiry/Datum van verstryking', value: data.dateOfExpiry },
          { label: 'Authority/Owerheid', value: 'DHA PRETORIA' }
        ];

        details.forEach(detail => {
          doc.fontSize(7)
             .fillColor('#666666')
             .text(detail.label, xLabel, yPos);
          doc.fontSize(9)
             .fillColor(SA_COLORS.black)
             .font('Helvetica-Bold')
             .text(detail.value, xValue, yPos + 10);
          yPos += 20;
        });

        // Machine Readable Zone with holographic overlay
        yPos = 280;
        doc.rect(20, yPos - 5, 257, 50)
           .fill('#f0f0f0');
        
        // Add holographic security overlay on MRZ
        this.addHolographicEffect(doc, 20, yPos - 5, 257, 50);
        
        doc.font('Courier')
           .fontSize(10)
           .fillColor(SA_COLORS.black);
        
        // Use enhanced MRZ generation
        const mrzLines = data.machineReadableZone || this.generatePassportMRZ(data);
        mrzLines.forEach((line, index) => {
          doc.text(line, 25, yPos + (index * 15));
        });
        
        // Add UV reactive indicators on passport
        this.addUVReactiveIndicator(doc, 20, 75, 30, 30);
        this.addUVReactiveIndicator(doc, 247, 75, 30, 30);

        // Signature area
        doc.moveTo(20, 350)
           .lineTo(100, 350)
           .stroke();
        doc.fontSize(7)
           .font('Helvetica')
           .text('Signature/Handtekening', 20, 355);

        // QR code for verification with serial number
        const serialNumber = this.addSerialNumber(doc, 120, 370, 'PP');
        const qrData = `DHA-PASSPORT:${data.passportNumber}:${serialNumber}`;
        QRCode.toDataURL(qrData, {
          width: 60,
          margin: 1,
          color: { dark: SA_COLORS.black, light: SA_COLORS.white }
        }).then(qrCode => {
          doc.image(qrCode, 217, 340, { width: 60 });
        });
        
        // Add microtext at bottom
        this.addMicrotextPattern(doc, 'RSA GOV ', 20, 395, 257, 5);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Helper method to add government header with coat of arms
   */
  private addGovernmentHeader(doc: PDFKit, documentType: string, ornate: boolean = false) {
    // Header background
    doc.rect(0, 0, 595, 80)
       .fill(SA_COLORS.green);
    
    // Coat of arms placeholder (left)
    doc.circle(60, 40, 25)
       .lineWidth(2)
       .stroke(SA_COLORS.gold);
    doc.fontSize(8)
       .fillColor(SA_COLORS.gold)
       .text('RSA', 48, 36);

    // Department name
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor(SA_COLORS.white)
       .text('REPUBLIC OF SOUTH AFRICA', 100, 20);
    doc.fontSize(12)
       .text('Department of Home Affairs', 100, 38);
    doc.fontSize(10)
       .font('Helvetica')
       .text('Lefapha la Ditaba tsa Selegae', 100, 54);

    // DHA Logo (right)
    doc.rect(500, 15, 80, 50)
       .lineWidth(1)
       .stroke(SA_COLORS.gold);
    doc.fontSize(18)
       .font('Helvetica-Bold')
       .fillColor(SA_COLORS.gold)
       .text('DHA', 520, 35);
  }

  /**
   * Helper method to add watermark
   */
  private addPDFKitWatermark(doc: PDFKit) {
    doc.save();
    doc.opacity(0.05);
    doc.fontSize(60)
       .font('Helvetica-Bold')
       .fillColor(SA_COLORS.green);
    
    // Rotate and add watermark text
    doc.rotate(-45, { origin: [297, 421] })
       .text('REPUBLIC OF', 100, 300)
       .text('SOUTH AFRICA', 80, 370);
    
    doc.restore();
  }

  /**
   * Helper method to add barcode
   */
  private addBarcode(doc: PDFKit, data: string, x: number, y: number) {
    // Simple barcode representation using lines
    const barcodeData = this.generateBarcodePattern(data);
    const barWidth = 1.5;
    const barHeight = 40;
    
    doc.fontSize(8)
       .fillColor(SA_COLORS.black)
       .text('|||||||||||||||||||||||||||||||||||||||||||', x, y, { characterSpacing: -2 });
    
    doc.fontSize(10)
       .text(data, x, y + 45);
  }

  /**
   * Helper method to add official stamp area
   */
  private addOfficialStampArea(doc: PDFKit, x: number, y: number, withDate: boolean = true) {
    // Stamp circle
    doc.circle(x + 40, y + 40, 35)
       .lineWidth(2)
       .stroke(SA_COLORS.red);
    
    doc.circle(x + 40, y + 40, 30)
       .lineWidth(1)
       .stroke(SA_COLORS.red);
    
    // Stamp text
    doc.fontSize(8)
       .fillColor(SA_COLORS.red)
       .text('DEPARTMENT OF', x + 5, y + 20, { width: 70, align: 'center' });
    doc.text('HOME AFFAIRS', x + 5, y + 30, { width: 70, align: 'center' });
    
    if (withDate) {
      const today = new Date().toLocaleDateString('en-ZA');
      doc.fontSize(10)
         .text(today, x + 5, y + 45, { width: 70, align: 'center' });
    }
    
    doc.fontSize(7)
       .text('OFFICIAL', x + 5, y + 60, { width: 70, align: 'center' });
  }

  /**
   * Helper method to add government footer
   */
  private addGovernmentFooter(doc: PDFKit) {
    const pageHeight = doc.page.height;
    const footerY = pageHeight - 60;
    
    doc.moveTo(30, footerY)
       .lineTo(565, footerY)
       .stroke(SA_COLORS.green);
    
    doc.fontSize(7)
       .fillColor(SA_COLORS.black)
       .text('This document is the property of the Government of the Republic of South Africa', 30, footerY + 5, { align: 'center', width: 535 });
  }

  /**
   * Generate control number
   */
  private generateControlNumber(): string {
    const prefix = 'DHA';
    const year = new Date().getFullYear().toString().substr(-2);
    const random = Math.floor(Math.random() * 999999).toString().padStart(6, '0');
    return `${prefix}-${year}${random}`;
  }

  /**
   * Add holographic effect simulation
   * Creates an iridescent pattern overlay to simulate holographic security features
   */
  private addHolographicEffect(doc: PDFKit, x: number, y: number, width: number, height: number) {
    doc.save();
    doc.opacity(0.15);
    
    // Create gradient-like effect with multiple overlapping patterns
    const colors = [SA_COLORS.blue, SA_COLORS.gold, SA_COLORS.green];
    const patterns = [
      { type: 'circle', size: 3 },
      { type: 'hexagon', size: 4 },
      { type: 'wave', amplitude: 2 }
    ];
    
    // Draw holographic pattern layers
    for (let i = 0; i < 3; i++) {
      doc.fillColor(colors[i]);
      doc.opacity(0.05 + (i * 0.02));
      
      // Create repeating pattern
      for (let px = x; px < x + width; px += 10) {
        for (let py = y; py < y + height; py += 10) {
          if (patterns[i].type === 'circle') {
            doc.circle(px, py, patterns[i].size || 3)
               .fill();
          } else if (patterns[i].type === 'hexagon') {
            // Simplified hexagon pattern
            const size = patterns[i].size || 4;
            doc.polygon([px, py], [px+size, py+2], [px+size, py+6], [px, py+8], [px-size, py+6], [px-size, py+2])
               .fill();
          } else if (patterns[i].type === 'wave') {
            // Wave pattern
            doc.moveTo(px, py)
               .bezierCurveTo(px+5, py-2, px+5, py+2, px+10, py)
               .stroke();
          }
        }
      }
    }
    
    // Add "HOLOGRAM" text indicator
    doc.opacity(0.1);
    doc.fontSize(8);
    doc.fillColor(SA_COLORS.blue);
    doc.text('SECURE', x + width/2 - 20, y + height/2 - 5);
    
    doc.restore();
  }

  /**
   * Generate Braille pattern for text
   * Converts text to Grade 1 Braille (simplified version)
   */
  private addBraillePattern(doc: PDFKit, text: string, x: number, y: number) {
    // Simplified Braille mapping (Grade 1)
    const brailleMap: { [key: string]: string } = {
      'A': '\u2801', 'B': '\u2803', 'C': '\u2809', 'D': '\u2819', 'E': '\u2811',
      'F': '\u280b', 'G': '\u281b', 'H': '\u2813', 'I': '\u280a', 'J': '\u281a',
      'K': '\u2805', 'L': '\u2807', 'M': '\u280d', 'N': '\u281d', 'O': '\u2815',
      'P': '\u280f', 'Q': '\u281f', 'R': '\u2817', 'S': '\u280e', 'T': '\u281e',
      'U': '\u2825', 'V': '\u2827', 'W': '\u283a', 'X': '\u282d', 'Y': '\u283d',
      'Z': '\u2835', '0': '\u281a', '1': '\u2801', '2': '\u2803', '3': '\u2809',
      '4': '\u2819', '5': '\u2811', '6': '\u280b', '7': '\u281b', '8': '\u2813',
      '9': '\u280a', '-': '\u2824', ' ': '\u2800'
    };
    
    // Convert text to uppercase and create Braille pattern
    const upperText = text.toUpperCase().substring(0, 20); // Limit length
    let brailleX = x;
    
    doc.save();
    doc.fillColor(SA_COLORS.black);
    
    // Draw Braille dots
    for (const char of upperText) {
      if (brailleMap[char]) {
        // Draw dot pattern (simplified representation)
        const pattern = brailleMap[char];
        
        // Create 2x3 dot matrix for each character
        const dotPositions = [
          [0, 0], [4, 0],   // Top row
          [0, 4], [4, 4],   // Middle row
          [0, 8], [4, 8]    // Bottom row
        ];
        
        // Draw dots based on character pattern
        const charCode = pattern.charCodeAt(0);
        for (let i = 0; i < 6; i++) {
          if (charCode & (1 << i)) {
            const [dx, dy] = dotPositions[i];
            doc.circle(brailleX + dx, y + dy, 0.8)
               .fill();
          }
        }
        brailleX += 10; // Move to next character position
      }
    }
    
    // Add description below
    doc.fontSize(6)
       .fillColor(SA_COLORS.black)
       .opacity(0.5)
       .text('Braille Reference', x, y + 15);
    
    doc.restore();
  }

  /**
   * Add microtext security pattern
   * Creates tiny repeated text that's difficult to reproduce
   */
  private addMicrotextPattern(doc: PDFKit, text: string, x: number, y: number, width: number, height: number) {
    doc.save();
    doc.fontSize(2); // Very small text
    doc.opacity(0.1);
    doc.fillColor(SA_COLORS.green);
    
    const microtext = text.repeat(20);
    const lineHeight = 3;
    
    // Fill area with microtext
    for (let yPos = y; yPos < y + height; yPos += lineHeight) {
      doc.text(microtext, x, yPos, {
        width: width,
        lineBreak: false,
        continued: false
      });
    }
    
    doc.restore();
  }

  /**
   * Add guilloche pattern (like on banknotes)
   * Creates intricate geometric patterns
   */
  private addGuillochePattern(doc: PDFKit, x: number, y: number, width: number, height: number) {
    doc.save();
    doc.opacity(0.05);
    doc.lineWidth(0.3);
    
    // Create spiral/wave patterns
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const maxRadius = Math.min(width, height) / 2;
    
    // Draw concentric circular patterns
    for (let r = 10; r < maxRadius; r += 5) {
      doc.circle(centerX, centerY, r)
         .stroke(SA_COLORS.gold);
    }
    
    // Add intersecting wave patterns
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const endX = centerX + Math.cos(angle) * maxRadius;
      const endY = centerY + Math.sin(angle) * maxRadius;
      
      doc.moveTo(centerX, centerY)
         .bezierCurveTo(
           centerX + Math.cos(angle + 0.5) * (maxRadius/2),
           centerY + Math.sin(angle + 0.5) * (maxRadius/2),
           endX - Math.cos(angle - 0.5) * (maxRadius/2),
           endY - Math.sin(angle - 0.5) * (maxRadius/2),
           endX,
           endY
         )
         .stroke(SA_COLORS.green);
    }
    
    doc.restore();
  }

  /**
   * Add UV-reactive area indicator
   * Marks areas that would be UV-reactive (for documentation purposes)
   */
  private addUVReactiveIndicator(doc: PDFKit, x: number, y: number, width: number, height: number) {
    doc.save();
    
    // Draw dashed border to indicate UV area
    doc.lineWidth(0.5);
    doc.dash(2, { space: 2 });
    doc.opacity(0.2);
    doc.rect(x, y, width, height)
       .stroke(SA_COLORS.blue);
    
    // Add UV indicator text
    doc.fontSize(6);
    doc.opacity(0.3);
    doc.fillColor(SA_COLORS.blue);
    doc.text('UV', x + width - 15, y + 2);
    
    doc.undash();
    doc.restore();
  }

  /**
   * Generate check digit for serial numbers
   * Uses Luhn algorithm for validation
   */
  private generateCheckDigit(number: string): string {
    const digits = number.replace(/\D/g, '').split('').map(Number);
    let sum = 0;
    let isEven = false;
    
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = digits[i];
      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }
      sum += digit;
      isEven = !isEven;
    }
    
    const checkDigit = (10 - (sum % 10)) % 10;
    return checkDigit.toString();
  }

  /**
   * Add sequential serial number with check digit
   */
  private addSerialNumber(doc: PDFKit, x: number, y: number, prefix: string = 'SN') {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    const baseNumber = timestamp.substr(-6) + random;
    const checkDigit = this.generateCheckDigit(baseNumber);
    const serialNumber = `${prefix}-${baseNumber}-${checkDigit}`;
    
    doc.save();
    doc.fontSize(9);
    doc.font('Helvetica');
    doc.fillColor(SA_COLORS.black);
    doc.text(`Serial: ${serialNumber}`, x, y);
    doc.restore();
    
    return serialNumber;
  }

  /**
   * Add multi-layer security features
   * Combines multiple security elements for maximum protection
   */
  private addMultiLayerSecurity(doc: PDFKit, documentType: string, permitNumber: string) {
    const pageWidth = 595;
    const pageHeight = 842;
    
    // Layer 1: Guilloche background pattern
    this.addGuillochePattern(doc, 50, 100, pageWidth - 100, pageHeight - 200);
    
    // Layer 2: Microtext borders
    this.addMicrotextPattern(doc, `${documentType} RSA GOV `, 0, 0, pageWidth, 20);
    this.addMicrotextPattern(doc, `SECURE DOCUMENT `, 0, pageHeight - 20, pageWidth, 20);
    
    // Layer 3: Holographic strips (vertical)
    this.addHolographicEffect(doc, 30, 100, 15, pageHeight - 200);
    this.addHolographicEffect(doc, pageWidth - 45, 100, 15, pageHeight - 200);
    
    // Layer 4: UV-reactive areas
    this.addUVReactiveIndicator(doc, 100, 200, 100, 30);
    this.addUVReactiveIndicator(doc, pageWidth - 200, 200, 100, 30);
    
    // Layer 5: Braille reference (for accessibility)
    this.addBraillePattern(doc, permitNumber.substring(0, 10), 50, pageHeight - 100);
    
    // Layer 6: Serial number with check digit
    const serialNumber = this.addSerialNumber(doc, pageWidth - 150, 50, documentType.substring(0, 3));
    
    // Add security features legend
    this.addSecurityLegend(doc, 50, pageHeight - 150);
    
    return serialNumber;
  }

  /**
   * Add security features legend
   * Shows what security features are present
   */
  private addSecurityLegend(doc: PDFKit, x: number, y: number) {
    doc.save();
    
    doc.fontSize(7);
    doc.font('Helvetica');
    doc.fillColor(SA_COLORS.black);
    doc.opacity(0.6);
    
    doc.text('Security Features:', x, y);
    
    const features = [
      '\u2713 Holographic security strip',
      '\u2713 Guilloche pattern background',
      '\u2713 Microtext borders',
      '\u2713 UV-reactive elements',
      '\u2713 Braille reference',
      '\u2713 Serial number with check digit',
      '\u2713 QR code verification',
      '\u2713 Watermark'
    ];
    
    let yPos = y + 10;
    doc.fontSize(6);
    
    features.forEach(feature => {
      doc.text(feature, x + 5, yPos);
      yPos += 8;
    });
    
    // Add verification instructions box
    doc.rect(x - 5, y - 5, 120, yPos - y + 10)
       .lineWidth(0.5)
       .stroke(SA_COLORS.green);
    
    doc.restore();
  }

  /**
   * Extract data from existing PDF (placeholder - requires pdf parsing library)
   * This would normally use a PDF parsing library to extract form data
   */
  async extractDataFromPDF(pdfBuffer: Buffer): Promise<any> {
    // Placeholder implementation
    // In a real implementation, this would use a library like pdf-parse or pdfjs-dist
    // to extract text and form field data from the PDF
    
    console.log('PDF data extraction requested. Buffer size:', pdfBuffer.length);
    
    // Return mock extracted data for demonstration
    return {
      extractedText: 'Document text content',
      formFields: {},
      metadata: {
        title: 'Extracted Document',
        author: 'DHA',
        creationDate: new Date()
      }
    };
  }

  /**
   * Generate machine-readable zone for passport
   */
  private generatePassportMRZ(data: PassportData): string[] {
    // Generate ICAO compliant Machine Readable Zone
    const surname = data.personal.surname || data.personal.fullName.split(' ').pop() || '';
    const givenNames = data.personal.givenNames || data.personal.fullName.split(' ').slice(0, -1).join(' ') || '';
    const line1 = `P<ZAF${surname.toUpperCase().replace(/[^A-Z]/g, '').padEnd(20, '<')}<<${givenNames.toUpperCase().replace(/[^A-Z]/g, '').padEnd(17, '<')}`;
    const dateOfBirth = data.personal.dateOfBirth.replace(/-/g, '').substring(2, 8);
    const dateOfExpiry = data.dateOfExpiry.replace(/-/g, '').substring(2, 8);
    const line2 = `${data.passportNumber.padEnd(9, '<')}${this.generateCheckDigit(data.passportNumber)}ZAF${dateOfBirth}${this.generateCheckDigit(dateOfBirth)}${data.personal.gender?.charAt(0) || 'M'}${dateOfExpiry}${this.generateCheckDigit(dateOfExpiry)}<<<<<<<<<<<<<`;
    return [line1.substring(0, 44), line2.substring(0, 44)];
  }

  /**
   * Generate barcode pattern
   */
  private generateBarcodePattern(data: string): string {
    // Simple hash-based pattern generation
    let pattern = '';
    for (let i = 0; i < data.length; i++) {
      const charCode = data.charCodeAt(i);
      pattern += charCode % 2 === 0 ? '1' : '0';
    }
    return pattern.padEnd(30, '10');
  }

  /**
   * Add watermark to any PDF using jsPDF
   */
  addWatermark(pdf: jsPDF, text: string = 'REPUBLIC OF SOUTH AFRICA'): void {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    pdf.saveGraphicsState();
    pdf.setGState(new (pdf as any).GState({ opacity: 0.1 }));
    pdf.setFontSize(40);
    pdf.setTextColor(0, 119, 73); // SA Green
    
    // Center and rotate text
    pdf.text(text, pageWidth / 2, pageHeight / 2, {
      angle: -45,
      align: 'center'
    });
    
    pdf.restoreGraphicsState();
  }

  /**
   * Add QR code to PDF using jsPDF
   */
  async addQRCode(pdf: jsPDF, data: string, x: number, y: number, size: number = 30): Promise<void> {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(data, {
        width: size * 4, // Higher resolution
        margin: 1,
        color: {
          dark: SA_COLORS.black,
          light: SA_COLORS.white
        }
      });
      
      pdf.addImage(qrCodeDataUrl, 'PNG', x, y, size, size);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  }

  /**
   * Add barcode to PDF using jsPDF
   */
  addBarcodeJsPDF(pdf: jsPDF, trackingNumber: string, x: number, y: number): void {
    // Simple barcode representation
    pdf.setFontSize(8);
    pdf.setFont('courier', 'normal');
    
    // Generate barcode pattern
    const pattern = this.generateBarcodePattern(trackingNumber);
    let barcodeX = x;
    
    pdf.setFillColor(0, 0, 0);
    pattern.split('').forEach((bit) => {
      if (bit === '1') {
        pdf.rect(barcodeX, y, 1, 10, 'F');
      }
      barcodeX += 2;
    });
    
    // Add human-readable text below barcode
    pdf.setFontSize(10);
    pdf.text(trackingNumber, x, y + 15);
  }

  /**
   * Add official stamp to PDF using jsPDF
   */
  addOfficialStampJsPDF(pdf: jsPDF, x: number, y: number, date: string = new Date().toLocaleDateString('en-ZA')): void {
    // Outer circle
    pdf.setDrawColor(222, 56, 49); // SA Red
    pdf.setLineWidth(0.5);
    pdf.circle(x, y, 15, 'S');
    
    // Inner circle
    pdf.circle(x, y, 12, 'S');
    
    // Stamp text
    pdf.setFontSize(6);
    pdf.setTextColor(222, 56, 49);
    pdf.text('DEPARTMENT OF', x, y - 8, { align: 'center' });
    pdf.text('HOME AFFAIRS', x, y - 4, { align: 'center' });
    pdf.text(date, x, y + 2, { align: 'center' });
    pdf.text('OFFICIAL', x, y + 6, { align: 'center' });
    
    // Reset colors
    pdf.setTextColor(0, 0, 0);
    pdf.setDrawColor(0, 0, 0);
  }

  /**
   * Generate exceptional skills permit PDF
   */
  async generateExceptionalSkillsPermitPDF(data: WorkPermitData): Promise<Buffer> {
    // Similar implementation to work permit but with different styling and sections
    const modifiedData = {
      ...data,
      permitType: "Exceptional Skills" as any,
      conditions: [
        ...(data.conditions || []),
        "Holder possesses exceptional skills in their field",
        "Must contribute to skills transfer and development"
      ]
    };
    
    return this.generateWorkPermitPDF(modifiedData);
  }

  /**
   * Generate refugee permit PDF
   */
  async generateRefugeePermitPDF(data: AsylumVisaData): Promise<Buffer> {
    // Similar to asylum visa but with refugee-specific content
    return this.generateAsylumVisaPDF(data);
  }

  /**
   * Generate DHA-84 Visitor's/Transit Visa PDF (Form 11)
   */
  async generateVisitorVisaPDF(data: VisitorVisaData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 30,
          info: {
            Title: `DHA-84 Visitor Visa - ${data.applicationNumber}`,
            Author: 'Department of Home Affairs',
            Subject: 'Visitor/Transit Visa Application',
            Keywords: 'DHA-84, Form 11, Visitor Visa, South Africa'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add watermark
        this.addPDFKitWatermark(doc);

        // Add multi-layer security features
        const formNumber = `DHA-84/${new Date().getFullYear()}/${Math.random().toString(36).substr(2, 7).toUpperCase()}`;
        this.addMultiLayerSecurity(doc, 'DHA-84', formNumber);

        // Header with official form number
        this.addGovernmentHeader(doc, "REPUBLIC OF SOUTH AFRICA");
        
        // Form title and number
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.black)
           .text('DEPARTMENT OF HOME AFFAIRS', 50, 100, { align: 'center', width: 515 });
        
        doc.fontSize(16)
           .text('APPLICATION FOR VISITOR\'S/TRANSIT VISA', 50, 120, { align: 'center', width: 515 });
        
        doc.fontSize(12)
           .text('(FORM 11 - REGULATION 9(1))', 50, 145, { align: 'center', width: 515 });
        
        doc.fontSize(10)
           .font('Helvetica')
           .text(`Application No: ${data.applicationNumber}`, 50, 170)
           .text(`Form No: ${formNumber}`, 400, 170);

        // Section A: Personal Particulars
        let yPos = 200;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('SECTION A: PERSONAL PARTICULARS', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);

        const personalFields = [
          { label: 'Full Name:', value: data.personal.fullName },
          { label: 'Surname:', value: data.personal.surname || '' },
          { label: 'Given Names:', value: data.personal.givenNames || '' },
          { label: 'Date of Birth:', value: data.personal.dateOfBirth },
          { label: 'Country of Birth:', value: data.personal.countryOfBirth || '' },
          { label: 'Nationality:', value: data.personal.nationality },
          { label: 'Passport Number:', value: data.personal.passportNumber || '' },
          { label: 'Gender:', value: data.personal.gender || '' },
          { label: 'Marital Status:', value: data.personal.maritalStatus || '' }
        ];

        personalFields.forEach(field => {
          doc.font('Helvetica-Bold')
             .text(field.label, 50, yPos, { continued: true, width: 150 })
             .font('Helvetica')
             .text(` ${field.value}`, { width: 350 });
          yPos += 18;
        });

        // Section B: Travel Information
        yPos += 10;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('SECTION B: TRAVEL INFORMATION', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);

        const travelFields = [
          { label: 'Type of Visa:', value: data.visaType },
          { label: 'Purpose of Visit:', value: data.purposeOfVisit },
          { label: 'Intended Date of Arrival:', value: data.intendedDateOfArrival },
          { label: 'Intended Date of Departure:', value: data.intendedDateOfDeparture },
          { label: 'Duration of Stay:', value: data.durationOfStay },
          { label: 'Return Ticket:', value: data.returnTicket ? 'Yes' : 'No' }
        ];

        travelFields.forEach(field => {
          doc.font('Helvetica-Bold')
             .text(field.label, 50, yPos, { continued: true, width: 150 })
             .font('Helvetica')
             .text(` ${field.value}`, { width: 350 });
          yPos += 18;
        });

        // Address in South Africa
        yPos += 10;
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .text('Address in South Africa:', 50, yPos);
        yPos += 15;
        doc.fontSize(10)
           .font('Helvetica')
           .text(data.addressInSA.streetAddress, 50, yPos);
        yPos += 15;
        doc.text(`${data.addressInSA.city}, ${data.addressInSA.province} ${data.addressInSA.postalCode}`, 50, yPos);
        yPos += 15;
        doc.text(`Tel: ${data.addressInSA.telephone}`, 50, yPos);

        // Add new page for additional sections
        doc.addPage();
        yPos = 50;

        // Section C: Background/Security Questions
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('SECTION C: BACKGROUND QUESTIONS', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);

        const backgroundQuestions = [
          { question: 'Do you have a criminal record?', answer: data.criminalRecord ? 'Yes' : 'No' },
          { question: 'Have you ever been deported from any country?', answer: data.deportationHistory ? 'Yes' : 'No' },
          { question: 'Have you ever been refused entry to any country?', answer: data.refusedEntry ? 'Yes' : 'No' }
        ];

        backgroundQuestions.forEach(item => {
          doc.text(item.question, 50, yPos);
          doc.font('Helvetica-Bold')
             .text(item.answer, 400, yPos)
             .font('Helvetica');
          yPos += 20;
        });

        // Section D: Health Declaration
        yPos += 10;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('SECTION D: HEALTH DECLARATION', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        doc.text('Yellow Fever Vaccination:', 50, yPos, { continued: true });
        doc.font('Helvetica-Bold')
           .text(` ${data.yellowFeverVaccination ? 'Yes' : 'No'}`, { width: 100 })
           .font('Helvetica');
        
        if (data.medicalConditions && data.medicalConditions.length > 0) {
          yPos += 20;
          doc.text('Medical Conditions:', 50, yPos);
          yPos += 15;
          data.medicalConditions.forEach(condition => {
            doc.text(`• ${condition}`, 70, yPos);
            yPos += 15;
          });
        }

        // Section E: Financial Status
        yPos += 10;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('SECTION E: FINANCIAL STATUS', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        doc.text('Proof of Financial Means:', 50, yPos, { continued: true });
        doc.text(` ${data.financialMeans}`, { width: 350 });
        yPos += 18;
        doc.text('Bank Statements Attached:', 50, yPos, { continued: true });
        doc.font('Helvetica-Bold')
           .text(` ${data.bankStatements ? 'Yes' : 'No'}`)
           .font('Helvetica');

        // Add security features
        this.addEnhancedHolographicStrip(doc, 420);
        
        // Add functional QR code with live verification
        const verification = await this.addLiveVerificationQRCode(
          doc,
          'visitor_visa',
          data.applicationNumber,
          data,
          430,
          480
        );
        
        // Add hashtags
        this.addHashtagSection(doc, verification.hashtags, 50, 700);
        
        // Declaration section
        yPos = 650;
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .text('DECLARATION', 50, yPos);
        
        yPos += 15;
        doc.fontSize(9)
           .font('Helvetica')
           .text('I declare that the information furnished in this application is true and correct.', 50, yPos, { width: 500 });
        
        yPos += 30;
        doc.text('Signature: _______________________', 50, yPos);
        doc.text('Date: _______________________', 300, yPos);

        // Footer
        this.addGovernmentFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate DHA-1738 Temporary Residence Permit PDF (Form 8)
   */
  async generateTemporaryResidencePDF(data: TemporaryResidenceData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 30,
          info: {
            Title: `DHA-1738 Temporary Residence - ${data.applicationNumber}`,
            Author: 'Department of Home Affairs',
            Subject: 'Temporary Residence Permit Application',
            Keywords: 'DHA-1738, Form 8, Temporary Residence, South Africa'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add watermark
        this.addPDFKitWatermark(doc);

        // Form number with category
        const formNumber = `DHA-1738/${data.permitCategory}/${new Date().getFullYear()}/${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        this.addMultiLayerSecurity(doc, 'DHA-1738', formNumber);

        // Header
        this.addGovernmentHeader(doc, "TEMPORARY RESIDENCE PERMIT");

        // Form title
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.black)
           .text('APPLICATION FOR TEMPORARY RESIDENCE PERMIT', 50, 100, { align: 'center', width: 515 });
        
        doc.fontSize(12)
           .text('(FORM 8 - REGULATION 9(9))', 50, 125, { align: 'center', width: 515 });
        
        doc.fontSize(11)
           .fillColor(SA_COLORS.blue)
           .text(`Category: ${data.permitCategory}`, 50, 150, { align: 'center', width: 515 });
        
        doc.fontSize(10)
           .fillColor(SA_COLORS.black)
           .font('Helvetica')
           .text(`Application No: ${data.applicationNumber}`, 50, 175)
           .text(`Form No: ${formNumber}`, 350, 175);

        // Section A: Personal Particulars
        let yPos = 210;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('SECTION A: PERSONAL PARTICULARS', 50, yPos);
        
        yPos += 25;
        this.addPersonalDetailsSection(doc, data.personal, 50, yPos);
        yPos += 180;

        // Section B: Current Permit Status
        if (data.currentPermitNumber) {
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor(SA_COLORS.green)
             .text('SECTION B: CURRENT PERMIT STATUS', 50, yPos);
          
          yPos += 25;
          doc.fontSize(10)
             .font('Helvetica')
             .fillColor(SA_COLORS.black);
          
          doc.text(`Current Permit Number: ${data.currentPermitNumber}`, 50, yPos);
          yPos += 18;
          doc.text(`Current Permit Expiry: ${data.currentPermitExpiry || 'N/A'}`, 50, yPos);
          yPos += 25;
        }

        // Section C: Purpose and Duration
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('SECTION C: PURPOSE AND DURATION', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        doc.text(`Purpose of Application: ${data.purposeOfApplication}`, 50, yPos);
        yPos += 18;
        doc.text(`Intended Duration: ${data.intendedDuration}`, 50, yPos);
        yPos += 25;

        // Add page for employer/institution details
        doc.addPage();
        yPos = 50;

        // Section D: Employer/Institution Details (conditional)
        if (data.employer) {
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor(SA_COLORS.green)
             .text('SECTION D: EMPLOYER DETAILS', 50, yPos);
          
          yPos += 25;
          doc.fontSize(10)
             .font('Helvetica')
             .fillColor(SA_COLORS.black);
          
          const employerFields = [
            { label: 'Company Name:', value: data.employer.name },
            { label: 'Registration No:', value: data.employer.registrationNumber },
            { label: 'Address:', value: data.employer.address },
            { label: 'Telephone:', value: data.employer.telephone },
            { label: 'Email:', value: data.employer.email },
            { label: 'Contact Person:', value: data.employer.contactPerson }
          ];
          
          employerFields.forEach(field => {
            doc.font('Helvetica-Bold')
               .text(field.label, 50, yPos, { continued: true, width: 130 })
               .font('Helvetica')
               .text(` ${field.value}`, { width: 370 });
            yPos += 18;
          });
          yPos += 10;
        }

        if (data.institution) {
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor(SA_COLORS.green)
             .text('SECTION D: INSTITUTION DETAILS', 50, yPos);
          
          yPos += 25;
          doc.fontSize(10)
             .font('Helvetica')
             .fillColor(SA_COLORS.black);
          
          const institutionFields = [
            { label: 'Institution Name:', value: data.institution.name },
            { label: 'Address:', value: data.institution.address },
            { label: 'Registration No:', value: data.institution.registrationNumber },
            { label: 'Course:', value: data.institution.courseName },
            { label: 'Duration:', value: data.institution.duration }
          ];
          
          institutionFields.forEach(field => {
            doc.font('Helvetica-Bold')
               .text(field.label, 50, yPos, { continued: true, width: 130 })
               .font('Helvetica')
               .text(` ${field.value}`, { width: 370 });
            yPos += 18;
          });
          yPos += 10;
        }

        // Section E: Supporting Documents
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('SECTION E: SUPPORTING DOCUMENTS CHECKLIST', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        const documents = [
          { name: 'Police Clearance Certificate', attached: data.policeClearance },
          { name: 'Medical Report', attached: data.medicalReport },
          { name: 'Radiological Report', attached: data.radiologicalReport },
          { name: 'Financial Guarantee', attached: data.financialGuarantee ? true : false },
          { name: 'Criminal Record Check', attached: !data.criminalRecord }
        ];
        
        documents.forEach(docItem => {
          doc.text(`☐ ${docItem.name}`, 50, yPos, { continued: true });
          doc.font('Helvetica-Bold')
             .text(docItem.attached ? ' ✓' : ' ✗', 250, yPos)
             .font('Helvetica');
          yPos += 18;
        });

        // Add security features
        this.addEnhancedHolographicStrip(doc, 400);
        
        // Add QR code
        const verification = await this.addLiveVerificationQRCode(
          doc,
          'temporary_residence',
          data.applicationNumber,
          data,
          430,
          450
        );
        
        // Add hashtags
        this.addHashtagSection(doc, verification.hashtags, 50, 650);

        // Footer
        this.addGovernmentFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate BI-947 General Work Permit PDF
   */
  async generateGeneralWorkPermitPDF(data: GeneralWorkPermitData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 30,
          info: {
            Title: `BI-947 General Work Permit - ${data.applicationNumber}`,
            Author: 'Department of Home Affairs',
            Subject: 'General Work Permit Application',
            Keywords: 'BI-947, General Work, Work Permit, South Africa'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add watermark
        this.addPDFKitWatermark(doc);

        // Form number
        const formNumber = `BI-947/${new Date().getFullYear()}/${Math.random().toString(36).substr(2, 7).toUpperCase()}`;
        this.addMultiLayerSecurity(doc, 'BI-947', formNumber);

        // Header
        this.addGovernmentHeader(doc, "GENERAL WORK PERMIT");

        // Form title
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.black)
           .text('APPLICATION FOR GENERAL WORK PERMIT', 50, 100, { align: 'center', width: 515 });
        
        doc.fontSize(12)
           .text('(FORM BI-947)', 50, 125, { align: 'center', width: 515 });
        
        doc.fontSize(10)
           .font('Helvetica')
           .text(`Application No: ${data.applicationNumber}`, 50, 150)
           .text(`Form No: ${formNumber}`, 350, 150);

        // Section A: Personal Information
        let yPos = 180;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('SECTION A: APPLICANT INFORMATION', 50, yPos);
        
        yPos += 25;
        this.addPersonalDetailsSection(doc, data.personal, 50, yPos);
        yPos += 180;

        // Section B: Employer Information
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('SECTION B: EMPLOYER INFORMATION', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        const employerFields = [
          { label: 'Company Name:', value: data.employer.name },
          { label: 'Registration No:', value: data.employer.registrationNumber },
          { label: 'Business Address:', value: data.employer.address },
          { label: 'Telephone:', value: data.employer.telephone },
          { label: 'Email:', value: data.employer.email },
          { label: 'Contact Person:', value: data.employer.contactPerson },
          { label: 'HR Manager:', value: data.employer.hrManager }
        ];
        
        employerFields.forEach(field => {
          if (yPos > 750) {
            doc.addPage();
            yPos = 50;
          }
          doc.font('Helvetica-Bold')
             .text(field.label, 50, yPos, { continued: true, width: 130 })
             .font('Helvetica')
             .text(` ${field.value}`, { width: 370 });
          yPos += 18;
        });

        // Add new page for job details
        doc.addPage();
        yPos = 50;

        // Section C: Job Details
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('SECTION C: JOB DETAILS', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        doc.text(`Position: ${data.jobDetails.position}`, 50, yPos);
        yPos += 18;
        doc.text(`Department: ${data.jobDetails.department}`, 50, yPos);
        yPos += 18;
        doc.text(`Monthly Salary: ${data.jobDetails.monthlySalary}`, 50, yPos);
        yPos += 18;
        doc.text(`Contract Type: ${data.jobDetails.contractType}`, 50, yPos);
        yPos += 18;
        if (data.jobDetails.contractDuration) {
          doc.text(`Contract Duration: ${data.jobDetails.contractDuration}`, 50, yPos);
          yPos += 18;
        }
        
        yPos += 10;
        doc.text('Job Description:', 50, yPos);
        yPos += 15;
        doc.fontSize(9)
           .text(data.jobDetails.jobDescription, 70, yPos, { width: 450 });
        yPos += 60;

        // Section D: Labor Market Testing
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('SECTION D: LABOR MARKET TESTING', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        doc.text(`Position Advertised: ${data.laborMarketTesting.advertised ? 'Yes' : 'No'}`, 50, yPos);
        yPos += 18;
        if (data.laborMarketTesting.advertised) {
          doc.text(`Newspaper: ${data.laborMarketTesting.newspaperName || 'N/A'}`, 50, yPos);
          yPos += 18;
          doc.text(`Date Advertised: ${data.laborMarketTesting.dateAdvertised || 'N/A'}`, 50, yPos);
          yPos += 18;
          doc.text(`Number of Applicants: ${data.laborMarketTesting.numberOfApplicants || 'N/A'}`, 50, yPos);
          yPos += 18;
        }
        doc.text('Reason for Foreign Hire:', 50, yPos);
        yPos += 15;
        doc.fontSize(9)
           .text(data.laborMarketTesting.reasonForForeignHire, 70, yPos, { width: 450 });
        yPos += 40;

        // Section E: Skills Transfer Plan
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('SECTION E: SKILLS TRANSFER AND REPLACEMENT PLAN', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        doc.text(`Replacement Plan in Place: ${data.replacementPlan.hasplan ? 'Yes' : 'No'}`, 50, yPos);
        yPos += 18;
        doc.text(`Training SA Citizen: ${data.replacementPlan.trainingSAcitizen ? 'Yes' : 'No'}`, 50, yPos);
        yPos += 18;
        if (data.replacementPlan.timeframe) {
          doc.text(`Timeframe: ${data.replacementPlan.timeframe}`, 50, yPos);
          yPos += 18;
        }
        if (data.replacementPlan.details) {
          doc.text('Plan Details:', 50, yPos);
          yPos += 15;
          doc.fontSize(9)
             .text(data.replacementPlan.details, 70, yPos, { width: 450 });
        }

        // Add security features
        this.addEnhancedHolographicStrip(doc, 600);
        
        // Add QR code
        const verification = await this.addLiveVerificationQRCode(
          doc,
          'general_work_permit',
          data.applicationNumber,
          data,
          430,
          620
        );

        // Footer
        this.addGovernmentFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Medical Certificate PDF
   */
  async generateMedicalCertificatePDF(data: MedicalCertificateData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 30,
          info: {
            Title: `Medical Certificate - ${data.certificateNumber}`,
            Author: 'Department of Home Affairs',
            Subject: 'Medical Certificate for Immigration',
            Keywords: 'Medical Certificate, Health, Immigration, South Africa'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add watermark
        this.addPDFKitWatermark(doc);

        // Certificate number
        const certNumber = `MED/${new Date().getFullYear()}/${data.certificateNumber}`;
        this.addMultiLayerSecurity(doc, 'MED', certNumber);

        // Header
        this.addGovernmentHeader(doc, "MEDICAL CERTIFICATE");

        // Title
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.black)
           .text('MEDICAL CERTIFICATE', 50, 100, { align: 'center', width: 515 });
        
        doc.fontSize(12)
           .text('FOR IMMIGRATION PURPOSES', 50, 125, { align: 'center', width: 515 });
        
        doc.fontSize(10)
           .font('Helvetica')
           .text(`Certificate No: ${certNumber}`, 50, 150)
           .text(`Date: ${data.examinationDate}`, 400, 150);

        // Patient Information
        let yPos = 180;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('PATIENT INFORMATION', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        doc.text(`Full Name: ${data.patient.fullName}`, 50, yPos);
        yPos += 18;
        doc.text(`Date of Birth: ${data.patient.dateOfBirth}`, 50, yPos);
        yPos += 18;
        doc.text(`Nationality: ${data.patient.nationality}`, 50, yPos);
        yPos += 18;
        doc.text(`Passport Number: ${data.patient.passportNumber || 'N/A'}`, 50, yPos);
        yPos += 25;

        // Physical Examination
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('PHYSICAL EXAMINATION', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        doc.text(`Height: ${data.physicalExamination.height}`, 50, yPos);
        doc.text(`Weight: ${data.physicalExamination.weight}`, 200, yPos);
        yPos += 18;
        doc.text(`Blood Pressure: ${data.physicalExamination.bloodPressure}`, 50, yPos);
        doc.text(`Heart Rate: ${data.physicalExamination.heartRate}`, 200, yPos);
        yPos += 18;
        doc.text(`General Health: ${data.physicalExamination.generalHealth}`, 50, yPos);
        yPos += 25;

        // Tuberculosis Screening
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('TUBERCULOSIS SCREENING', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        doc.text(`TB Test Performed: ${data.tuberculosisScreening.tested ? 'Yes' : 'No'}`, 50, yPos);
        yPos += 18;
        if (data.tuberculosisScreening.tested) {
          doc.text(`Test Date: ${data.tuberculosisScreening.testDate || 'N/A'}`, 50, yPos);
          yPos += 18;
          doc.text(`Result: ${data.tuberculosisScreening.result || 'N/A'}`, 50, yPos);
          yPos += 18;
          doc.text(`Treatment Required: ${data.tuberculosisScreening.treatmentRequired ? 'Yes' : 'No'}`, 50, yPos);
          yPos += 18;
        }
        yPos += 10;

        // Fitness for Purpose
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('FITNESS FOR PURPOSE', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        doc.text(`Fit for Work: ${data.fitnessForPurpose.fitForWork ? 'Yes' : 'No'}`, 50, yPos);
        yPos += 18;
        doc.text(`Fit for Study: ${data.fitnessForPurpose.fitForStudy ? 'Yes' : 'No'}`, 50, yPos);
        yPos += 18;
        doc.text(`Fit for Residence: ${data.fitnessForPurpose.fitForResidence ? 'Yes' : 'No'}`, 50, yPos);
        yPos += 25;

        // Doctor's Details and Signature
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('MEDICAL PRACTITIONER DETAILS', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        doc.text(`Doctor: ${data.doctor.fullName}`, 50, yPos);
        yPos += 18;
        doc.text(`Qualifications: ${data.doctor.qualifications}`, 50, yPos);
        yPos += 18;
        doc.text(`Practice Number: ${data.doctor.practiceNumber}`, 50, yPos);
        yPos += 18;
        doc.text(`Address: ${data.doctor.address}`, 50, yPos);
        yPos += 30;
        
        doc.text('Signature: _______________________', 50, yPos);
        doc.text('Date: _______________________', 300, yPos);
        
        // Add official stamp area
        this.addOfficialStampArea(doc, 400, yPos - 20);

        // Add QR code
        const verification = await this.addLiveVerificationQRCode(
          doc,
          'medical_certificate',
          data.certificateNumber,
          data,
          430,
          yPos + 50
        );

        // Footer
        this.addGovernmentFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Radiological Report PDF
   */
  async generateRadiologicalReportPDF(data: RadiologicalReportData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 30,
          info: {
            Title: `Radiological Report - ${data.reportNumber}`,
            Author: 'Department of Home Affairs',
            Subject: 'Radiological Report for Immigration',
            Keywords: 'Radiological Report, X-Ray, Immigration, South Africa'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add watermark
        this.addPDFKitWatermark(doc);

        // Report number
        const reportNumber = `RAD/${new Date().getFullYear()}/${data.reportNumber}`;
        this.addMultiLayerSecurity(doc, 'RAD', reportNumber);

        // Header
        this.addGovernmentHeader(doc, "RADIOLOGICAL REPORT");

        // Title
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.black)
           .text('RADIOLOGICAL REPORT', 50, 100, { align: 'center', width: 515 });
        
        doc.fontSize(12)
           .text('FOR IMMIGRATION PURPOSES', 50, 125, { align: 'center', width: 515 });
        
        doc.fontSize(10)
           .font('Helvetica')
           .text(`Report No: ${reportNumber}`, 50, 150)
           .text(`Date: ${data.examinationDate}`, 400, 150);

        // Patient Information
        let yPos = 180;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('PATIENT INFORMATION', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        doc.text(`Full Name: ${data.patient.fullName}`, 50, yPos);
        yPos += 18;
        doc.text(`Date of Birth: ${data.patient.dateOfBirth}`, 50, yPos);
        yPos += 18;
        doc.text(`Nationality: ${data.patient.nationality}`, 50, yPos);
        yPos += 25;

        // Examination Details
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('EXAMINATION DETAILS', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        doc.text(`Examination Type: ${data.examType}`, 50, yPos);
        yPos += 18;
        doc.text(`Indication: ${data.indication}`, 50, yPos);
        yPos += 25;

        // Findings
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('FINDINGS', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        // Lungs
        doc.font('Helvetica-Bold')
           .text('Lungs:', 50, yPos);
        doc.font('Helvetica')
           .text(data.findings.lungs.normal ? ' Normal' : ' Abnormal', 100, yPos);
        yPos += 18;
        if (!data.findings.lungs.normal && data.findings.lungs.abnormalities) {
          data.findings.lungs.abnormalities.forEach(abnormality => {
            doc.text(`• ${abnormality}`, 70, yPos);
            yPos += 15;
          });
        }
        
        // Heart
        doc.font('Helvetica-Bold')
           .text('Heart:', 50, yPos);
        doc.font('Helvetica')
           .text(data.findings.heart.normal ? ' Normal' : ' Abnormal', 100, yPos);
        yPos += 18;
        
        // TB Screening
        yPos += 10;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('TUBERCULOSIS SCREENING', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        doc.text(`Signs of Active TB: ${data.tuberculosisScreening.signsOfActiveTB ? 'Yes' : 'No'}`, 50, yPos);
        yPos += 18;
        doc.text(`Signs of Old TB: ${data.tuberculosisScreening.signsOfOldTB ? 'Yes' : 'No'}`, 50, yPos);
        yPos += 18;
        doc.text(`Further Testing Required: ${data.tuberculosisScreening.furtherTestingRequired ? 'Yes' : 'No'}`, 50, yPos);
        yPos += 25;

        // Impression
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('IMPRESSION', 50, yPos);
        
        yPos += 20;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black)
           .text(data.impression, 50, yPos, { width: 500 });
        yPos += 40;

        // Recommendations
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('RECOMMENDATIONS', 50, yPos);
        
        yPos += 20;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        data.recommendations.forEach(rec => {
          doc.text(`• ${rec}`, 50, yPos);
          yPos += 15;
        });
        yPos += 20;

        // Radiologist Details
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('RADIOLOGIST DETAILS', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        doc.text(`Radiologist: ${data.radiologist.fullName}`, 50, yPos);
        yPos += 18;
        doc.text(`Qualifications: ${data.radiologist.qualifications}`, 50, yPos);
        yPos += 18;
        doc.text(`Practice Number: ${data.radiologist.practiceNumber}`, 50, yPos);
        yPos += 18;
        doc.text(`Facility: ${data.radiologist.facility}`, 50, yPos);
        yPos += 30;
        
        doc.text('Signature: _______________________', 50, yPos);
        doc.text('Date: _______________________', 300, yPos);

        // Add QR code
        const verification = await this.addLiveVerificationQRCode(
          doc,
          'radiological_report',
          data.reportNumber,
          data,
          430,
          yPos + 20
        );

        // Footer
        this.addGovernmentFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Critical Skills Visa PDF
   */
  async generateCriticalSkillsVisaPDF(data: CriticalSkillsData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 30,
          info: {
            Title: `Critical Skills Visa - ${data.applicationNumber}`,
            Author: 'Department of Home Affairs',
            Subject: 'Critical Skills Visa Application',
            Keywords: 'Critical Skills, Visa, Immigration, South Africa'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add watermark
        this.addPDFKitWatermark(doc);

        // Form number
        const formNumber = `CSV/${new Date().getFullYear()}/${data.applicationNumber}`;
        this.addMultiLayerSecurity(doc, 'CSV', formNumber);

        // Header
        this.addGovernmentHeader(doc, "CRITICAL SKILLS VISA");

        // Title
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.black)
           .text('CRITICAL SKILLS VISA APPLICATION', 50, 100, { align: 'center', width: 515 });
        
        doc.fontSize(12)
           .text('SECTION 19(4) OF THE IMMIGRATION ACT', 50, 125, { align: 'center', width: 515 });
        
        doc.fontSize(10)
           .font('Helvetica')
           .text(`Application No: ${data.applicationNumber}`, 50, 150)
           .text(`Form No: ${formNumber}`, 350, 150);

        // Personal Information
        let yPos = 180;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('APPLICANT INFORMATION', 50, yPos);
        
        yPos += 25;
        this.addPersonalDetailsSection(doc, data.personal, 50, yPos);
        yPos += 180;

        // Critical Skill Category
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('CRITICAL SKILL CATEGORY', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black)
           .text(`Category: ${data.criticalSkillCategory}`, 50, yPos);
        yPos += 25;

        // Qualifications
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('QUALIFICATIONS', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        data.qualifications.forEach((qual, index) => {
          if (yPos > 700) {
            doc.addPage();
            yPos = 50;
          }
          doc.font('Helvetica-Bold')
             .text(`${index + 1}. ${qual.degree}`, 50, yPos);
          doc.font('Helvetica');
          yPos += 15;
          doc.text(`   Field: ${qual.field}`, 50, yPos);
          yPos += 15;
          doc.text(`   Institution: ${qual.institution}, ${qual.country}`, 50, yPos);
          yPos += 15;
          doc.text(`   Year: ${qual.year}`, 50, yPos);
          if (qual.saricStatus) {
            yPos += 15;
            doc.text(`   SAQA Status: ${qual.saricStatus}`, 50, yPos);
          }
          yPos += 20;
        });

        // Professional Registration
        if (data.professionalRegistration) {
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor(SA_COLORS.green)
             .text('PROFESSIONAL REGISTRATION', 50, yPos);
          
          yPos += 25;
          doc.fontSize(10)
             .font('Helvetica')
             .fillColor(SA_COLORS.black);
          
          doc.text(`Professional Body: ${data.professionalRegistration.body}`, 50, yPos);
          yPos += 18;
          doc.text(`Registration Number: ${data.professionalRegistration.registrationNumber}`, 50, yPos);
          yPos += 18;
          doc.text(`Valid Until: ${data.professionalRegistration.validUntil}`, 50, yPos);
          yPos += 25;
        }

        // Job Offer (if applicable)
        if (data.jobOffer) {
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor(SA_COLORS.green)
             .text('JOB OFFER', 50, yPos);
          
          yPos += 25;
          doc.fontSize(10)
             .font('Helvetica')
             .fillColor(SA_COLORS.black);
          
          doc.text(`Employer: ${data.jobOffer.employer}`, 50, yPos);
          yPos += 18;
          doc.text(`Position: ${data.jobOffer.position}`, 50, yPos);
          yPos += 18;
          doc.text(`Salary: ${data.jobOffer.salary}`, 50, yPos);
          yPos += 18;
          doc.text(`Start Date: ${data.jobOffer.startDate}`, 50, yPos);
        }

        // Add security features
        this.addEnhancedHolographicStrip(doc, 550);
        
        // Add QR code
        const verification = await this.addLiveVerificationQRCode(
          doc,
          'critical_skills_visa',
          data.applicationNumber,
          data,
          430,
          570
        );

        // Footer
        this.addGovernmentFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Business Visa PDF
   */
  async generateBusinessVisaPDF(data: BusinessVisaData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 30,
          info: {
            Title: `Business Visa - ${data.applicationNumber}`,
            Author: 'Department of Home Affairs',
            Subject: 'Business Visa Application',
            Keywords: 'Business Visa, Investment, South Africa'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add watermark
        this.addPDFKitWatermark(doc);

        // Form number
        const formNumber = `BV/${new Date().getFullYear()}/${data.applicationNumber}`;
        this.addMultiLayerSecurity(doc, 'BV', formNumber);

        // Header
        this.addGovernmentHeader(doc, "BUSINESS VISA");

        // Title
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.black)
           .text('BUSINESS VISA APPLICATION', 50, 100, { align: 'center', width: 515 });
        
        doc.fontSize(10)
           .font('Helvetica')
           .text(`Application No: ${data.applicationNumber}`, 50, 130)
           .text(`Form No: ${formNumber}`, 350, 130);

        // Personal Information
        let yPos = 160;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('APPLICANT INFORMATION', 50, yPos);
        
        yPos += 25;
        this.addPersonalDetailsSection(doc, data.personal, 50, yPos);
        yPos += 180;

        // Business Details
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('BUSINESS DETAILS', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        doc.text(`Company Name: ${data.businessDetails.companyName}`, 50, yPos);
        yPos += 18;
        doc.text(`Registration Number: ${data.businessDetails.registrationNumber}`, 50, yPos);
        yPos += 18;
        doc.text(`Business Type: ${data.businessDetails.businessType}`, 50, yPos);
        yPos += 18;
        doc.text(`Years in Operation: ${data.businessDetails.yearsInOperation}`, 50, yPos);
        yPos += 18;
        doc.text(`Annual Turnover: ${data.businessDetails.annualTurnover}`, 50, yPos);
        yPos += 18;
        doc.text(`Number of Employees: ${data.businessDetails.numberOfEmployees}`, 50, yPos);
        yPos += 25;

        // Investment Details
        if (data.investmentAmount) {
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor(SA_COLORS.green)
             .text('INVESTMENT DETAILS', 50, yPos);
          
          yPos += 25;
          doc.fontSize(10)
             .font('Helvetica')
             .fillColor(SA_COLORS.black);
          
          doc.text(`Investment Amount: ${data.investmentAmount}`, 50, yPos);
          yPos += 18;
          if (data.jobCreation) {
            doc.text(`Jobs to be Created: ${data.jobCreation.numberOfJobs}`, 50, yPos);
            yPos += 18;
            doc.text(`Timeline: ${data.jobCreation.timeline}`, 50, yPos);
            yPos += 18;
          }
        }

        // Supporting Documents
        yPos += 10;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('SUPPORTING DOCUMENTS', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        doc.text(`Business Plan: ${data.businessPlan ? '✓ Attached' : '✗ Not Attached'}`, 50, yPos);
        yPos += 18;
        doc.text(`Financial Statements: ${data.financialStatements ? '✓ Attached' : '✗ Not Attached'}`, 50, yPos);
        yPos += 18;
        doc.text(`Tax Clearance: ${data.taxClearance ? '✓ Attached' : '✗ Not Attached'}`, 50, yPos);

        // Add security features
        this.addEnhancedHolographicStrip(doc, 550);
        
        // Add QR code
        const verification = await this.addLiveVerificationQRCode(
          doc,
          'business_visa',
          data.applicationNumber,
          data,
          430,
          570
        );

        // Footer
        this.addGovernmentFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Retirement Visa PDF
   */
  async generateRetirementVisaPDF(data: RetirementVisaData): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 30,
          info: {
            Title: `Retirement Visa - ${data.applicationNumber}`,
            Author: 'Department of Home Affairs',
            Subject: 'Retirement Visa Application',
            Keywords: 'Retirement Visa, Immigration, South Africa'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add watermark
        this.addPDFKitWatermark(doc);

        // Form number
        const formNumber = `RV/${new Date().getFullYear()}/${data.applicationNumber}`;
        this.addMultiLayerSecurity(doc, 'RV', formNumber);

        // Header
        this.addGovernmentHeader(doc, "RETIREMENT VISA");

        // Title
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.black)
           .text('RETIREMENT VISA APPLICATION', 50, 100, { align: 'center', width: 515 });
        
        doc.fontSize(10)
           .font('Helvetica')
           .text(`Application No: ${data.applicationNumber}`, 50, 130)
           .text(`Form No: ${formNumber}`, 350, 130);

        // Personal Information
        let yPos = 160;
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('APPLICANT INFORMATION', 50, yPos);
        
        yPos += 25;
        this.addPersonalDetailsSection(doc, data.personal, 50, yPos);
        yPos += 180;

        // Financial Information
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('FINANCIAL INFORMATION', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        doc.text(`Monthly Pension: ${data.retirementIncome.monthlyPension}`, 50, yPos);
        yPos += 18;
        if (data.retirementIncome.otherIncome) {
          doc.text(`Other Income: ${data.retirementIncome.otherIncome}`, 50, yPos);
          yPos += 18;
        }
        doc.text(`Total Monthly Income: ${data.retirementIncome.totalMonthly} ${data.retirementIncome.currency}`, 50, yPos);
        yPos += 18;
        doc.text(`Net Worth: ${data.netWorth}`, 50, yPos);
        yPos += 25;

        // Property in South Africa
        if (data.propertyInSA && data.propertyInSA.owned) {
          doc.fontSize(12)
             .font('Helvetica-Bold')
             .fillColor(SA_COLORS.green)
             .text('PROPERTY IN SOUTH AFRICA', 50, yPos);
          
          yPos += 25;
          doc.fontSize(10)
             .font('Helvetica')
             .fillColor(SA_COLORS.black);
          
          doc.text(`Property Owned: Yes`, 50, yPos);
          yPos += 18;
          if (data.propertyInSA.address) {
            doc.text(`Address: ${data.propertyInSA.address}`, 50, yPos);
            yPos += 18;
          }
          if (data.propertyInSA.value) {
            doc.text(`Estimated Value: ${data.propertyInSA.value}`, 50, yPos);
            yPos += 18;
          }
          yPos += 10;
        }

        // Health Insurance
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.green)
           .text('HEALTH INSURANCE', 50, yPos);
        
        yPos += 25;
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor(SA_COLORS.black);
        
        doc.text(`Provider: ${data.healthInsurance.provider}`, 50, yPos);
        yPos += 18;
        doc.text(`Policy Number: ${data.healthInsurance.policyNumber}`, 50, yPos);
        yPos += 18;
        doc.text(`Coverage: ${data.healthInsurance.coverage}`, 50, yPos);

        // Add security features
        this.addEnhancedHolographicStrip(doc, 550);
        
        // Add QR code
        const verification = await this.addLiveVerificationQRCode(
          doc,
          'retirement_visa',
          data.applicationNumber,
          data,
          430,
          570
        );

        // Footer
        this.addGovernmentFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Helper method to add personal details section
   */
  private addPersonalDetailsSection(doc: PDFKit, personal: PersonalDetails, x: number, y: number): void {
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(SA_COLORS.black);
    
    const fields = [
      { label: 'Full Name:', value: personal.fullName },
      { label: 'Surname:', value: personal.surname || '' },
      { label: 'Given Names:', value: personal.givenNames || '' },
      { label: 'Date of Birth:', value: personal.dateOfBirth },
      { label: 'Country of Birth:', value: personal.countryOfBirth || '' },
      { label: 'Nationality:', value: personal.nationality },
      { label: 'Passport Number:', value: personal.passportNumber || '' },
      { label: 'ID Number:', value: personal.idNumber || 'N/A' },
      { label: 'Gender:', value: personal.gender || '' },
      { label: 'Marital Status:', value: personal.maritalStatus || '' }
    ];
    
    let yPos = y;
    fields.forEach(field => {
      doc.font('Helvetica-Bold')
         .text(field.label, x, yPos, { continued: true, width: 130 })
         .font('Helvetica')
         .text(` ${field.value}`, { width: 370 });
      yPos += 18;
    });
  }

  /**
   * Generate study permit PDF
   */
  async generateStudyPermitPDF(data: {
    personal: PersonalDetails;
    permitNumber: string;
    institution: string;
    course: string;
    duration: string;
    validFrom: string;
    validUntil: string;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 30
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add watermark and header
        this.addPDFKitWatermark(doc);
        this.addGovernmentHeader(doc, "STUDY PERMIT");

        // Title
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text('STUDY PERMIT', 50, 140, { align: 'center', width: 515 });

        // Content sections
        let yPos = 200;
        
        // Personal details
        doc.fontSize(12)
           .fillColor(SA_COLORS.green)
           .text('STUDENT DETAILS', 50, yPos);
        
        yPos += 25;
        doc.fontSize(11)
           .fillColor(SA_COLORS.black);
        
        doc.text(`Name: ${data.personal.fullName}`, 50, yPos);
        yPos += 20;
        doc.text(`Passport: ${data.personal.passportNumber}`, 50, yPos);
        yPos += 20;
        doc.text(`Nationality: ${data.personal.nationality}`, 50, yPos);
        
        // Institution details
        yPos += 30;
        doc.fontSize(12)
           .fillColor(SA_COLORS.green)
           .text('INSTITUTION DETAILS', 50, yPos);
        
        yPos += 25;
        doc.fontSize(11)
           .fillColor(SA_COLORS.black);
        
        doc.text(`Institution: ${data.institution}`, 50, yPos);
        yPos += 20;
        doc.text(`Course: ${data.course}`, 50, yPos);
        yPos += 20;
        doc.text(`Duration: ${data.duration}`, 50, yPos);
        yPos += 20;
        doc.text(`Valid From: ${data.validFrom} To: ${data.validUntil}`, 50, yPos);

        // QR code
        const qrData = `DHA-STUDY:${data.permitNumber}`;
        QRCode.toDataURL(qrData, {
          width: 100,
          margin: 1
        }).then(qrCode => {
          doc.image(qrCode, 450, 400, { width: 100 });
        });

        // Footer
        this.addGovernmentFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Death Certificate PDF
   */
  async generateDeathCertificatePDF(data: DeathCertificateData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 30
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add security features and header
        this.addPDFKitWatermark(doc);
        this.addGovernmentHeader(doc, "DEATH CERTIFICATE");

        // Title
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .text('DEATH CERTIFICATE', 50, 140, { align: 'center', width: 515 });

        // Registration details
        let yPos = 180;
        doc.fontSize(11)
           .fillColor(SA_COLORS.green)
           .text(`Registration Number: ${data.registrationNumber}`, 50, yPos);

        // Deceased details section
        yPos += 40;
        doc.fontSize(14)
           .fillColor(SA_COLORS.green)
           .text('DECEASED DETAILS', 50, yPos);

        yPos += 25;
        doc.fontSize(10)
           .fillColor(SA_COLORS.black);

        const deceasedFields = [
          { label: 'Full Name:', value: data.deceasedDetails.fullName },
          { label: 'Date of Birth:', value: data.deceasedDetails.dateOfBirth },
          { label: 'Date of Death:', value: data.deceasedDetails.dateOfDeath },
          { label: 'Time of Death:', value: data.deceasedDetails.timeOfDeath },
          { label: 'Place of Death:', value: data.deceasedDetails.placeOfDeath },
          { label: 'Gender:', value: data.deceasedDetails.gender },
          { label: 'Nationality:', value: data.deceasedDetails.nationality },
          { label: 'ID Number:', value: data.deceasedDetails.idNumber || 'N/A' }
        ];

        deceasedFields.forEach(field => {
          doc.font('Helvetica-Bold')
             .text(field.label, 50, yPos, { continued: true, width: 120 })
             .font('Helvetica')
             .text(` ${field.value}`, { width: 350 });
          yPos += 18;
        });

        // Cause of death section
        yPos += 20;
        doc.fontSize(14)
           .fillColor(SA_COLORS.green)
           .text('CAUSE OF DEATH', 50, yPos);

        yPos += 25;
        doc.fontSize(10)
           .fillColor(SA_COLORS.black)
           .font('Helvetica-Bold')
           .text('Immediate Cause:', 50, yPos, { continued: true })
           .font('Helvetica')
           .text(` ${data.deathDetails.causeOfDeath.immediate}`);

        yPos += 18;
        doc.font('Helvetica-Bold')
           .text('Underlying Cause:', 50, yPos, { continued: true })
           .font('Helvetica')
           .text(` ${data.deathDetails.causeOfDeath.underlying}`);

        yPos += 18;
        doc.font('Helvetica-Bold')
           .text('Manner of Death:', 50, yPos, { continued: true })
           .font('Helvetica')
           .text(` ${data.deathDetails.mannerOfDeath}`);

        // Certifying doctor section
        yPos += 30;
        doc.fontSize(14)
           .fillColor(SA_COLORS.green)
           .text('CERTIFYING DOCTOR', 50, yPos);

        yPos += 25;
        doc.fontSize(10)
           .fillColor(SA_COLORS.black);

        const doctorFields = [
          { label: 'Doctor Name:', value: data.deathDetails.certifyingDoctor.fullName },
          { label: 'Qualifications:', value: data.deathDetails.certifyingDoctor.qualifications },
          { label: 'Practice Number:', value: data.deathDetails.certifyingDoctor.practiceNumber }
        ];

        doctorFields.forEach(field => {
          doc.font('Helvetica-Bold')
             .text(field.label, 50, yPos, { continued: true, width: 120 })
             .font('Helvetica')
             .text(` ${field.value}`, { width: 350 });
          yPos += 18;
        });

        // QR code for verification
        const qrData = `DHA-DEATH:${data.registrationNumber}`;
        QRCode.toDataURL(qrData, {
          width: 100,
          margin: 1
        }).then(qrCode => {
          doc.image(qrCode, 450, 600, { width: 100 });
        });

        // Footer
        this.addGovernmentFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Marriage Certificate PDF
   */
  async generateMarriageCertificatePDF(data: MarriageCertificateData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 30
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add security features and header
        this.addPDFKitWatermark(doc);
        this.addGovernmentHeader(doc, "MARRIAGE CERTIFICATE");

        // Title
        doc.fontSize(18)
           .font('Helvetica-Bold')
           .text('MARRIAGE CERTIFICATE', 50, 140, { align: 'center', width: 515 });

        // Registration details
        let yPos = 180;
        doc.fontSize(11)
           .fillColor(SA_COLORS.green)
           .text(`Registration Number: ${data.registrationNumber}`, 50, yPos);

        // Marriage details section
        yPos += 40;
        doc.fontSize(14)
           .fillColor(SA_COLORS.green)
           .text('MARRIAGE DETAILS', 50, yPos);

        yPos += 25;
        doc.fontSize(10)
           .fillColor(SA_COLORS.black);

        const marriageFields = [
          { label: 'Date of Marriage:', value: data.marriageDetails.dateOfMarriage },
          { label: 'Place of Marriage:', value: data.marriageDetails.placeOfMarriage },
          { label: 'Type of Marriage:', value: data.marriageDetails.typeOfMarriage },
          { label: 'Marriage Officer:', value: data.marriageDetails.marriageOfficer.fullName }
        ];

        marriageFields.forEach(field => {
          doc.font('Helvetica-Bold')
             .text(field.label, 50, yPos, { continued: true, width: 120 })
             .font('Helvetica')
             .text(` ${field.value}`, { width: 350 });
          yPos += 18;
        });

        // Spouse 1 section
        yPos += 30;
        doc.fontSize(14)
           .fillColor(SA_COLORS.green)
           .text('SPOUSE 1', 50, yPos);

        yPos += 25;
        doc.fontSize(10)
           .fillColor(SA_COLORS.black);

        const spouse1Fields = [
          { label: 'Full Name:', value: data.spouse1.fullName },
          { label: 'Date of Birth:', value: data.spouse1.dateOfBirth },
          { label: 'Nationality:', value: data.spouse1.nationality },
          { label: 'ID Number:', value: data.spouse1.idNumber || 'N/A' }
        ];

        spouse1Fields.forEach(field => {
          doc.font('Helvetica-Bold')
             .text(field.label, 50, yPos, { continued: true, width: 120 })
             .font('Helvetica')
             .text(` ${field.value}`, { width: 350 });
          yPos += 18;
        });

        // Spouse 2 section
        yPos += 30;
        doc.fontSize(14)
           .fillColor(SA_COLORS.green)
           .text('SPOUSE 2', 50, yPos);

        yPos += 25;
        doc.fontSize(10)
           .fillColor(SA_COLORS.black);

        const spouse2Fields = [
          { label: 'Full Name:', value: data.spouse2.fullName },
          { label: 'Date of Birth:', value: data.spouse2.dateOfBirth },
          { label: 'Nationality:', value: data.spouse2.nationality },
          { label: 'ID Number:', value: data.spouse2.idNumber || 'N/A' }
        ];

        spouse2Fields.forEach(field => {
          doc.font('Helvetica-Bold')
             .text(field.label, 50, yPos, { continued: true, width: 120 })
             .font('Helvetica')
             .text(` ${field.value}`, { width: 350 });
          yPos += 18;
        });

        // QR code for verification
        const qrData = `DHA-MARRIAGE:${data.registrationNumber}`;
        QRCode.toDataURL(qrData, {
          width: 100,
          margin: 1
        }).then(qrCode => {
          doc.image(qrCode, 450, 600, { width: 100 });
        });

        // Footer
        this.addGovernmentFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate South African ID Card PDF
   */
  async generateSouthAfricanIdPDF(data: SouthAfricanIdData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: [350, 220], // Credit card sized
          margin: 10
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add background pattern for security
        doc.rect(0, 0, 350, 220)
           .fillColor('#f8f9fa')
           .fill();

        // Add SA flag colors stripe
        doc.rect(0, 0, 350, 10)
           .fillColor(SA_COLORS.green)
           .fill();

        // Header with "SOUTH AFRICA" text
        doc.fontSize(12)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.black)
           .text('REPUBLIC OF SOUTH AFRICA', 15, 20);

        doc.fontSize(10)
           .text('IDENTITY DOCUMENT', 15, 35);

        // ID Number prominently displayed
        doc.fontSize(14)
           .font('Helvetica-Bold')
           .text(`ID: ${data.idNumber}`, 15, 55);

        // Personal details in compact format
        doc.fontSize(9)
           .font('Helvetica');

        let yPos = 80;
        const personalFields = [
          { label: 'Name:', value: data.personal.fullName },
          { label: 'DOB:', value: data.personal.dateOfBirth },
          { label: 'Gender:', value: data.personal.gender },
          { label: 'Nationality:', value: data.personal.nationality }
        ];

        personalFields.forEach(field => {
          doc.font('Helvetica-Bold')
             .text(field.label, 15, yPos, { continued: true, width: 50 })
             .font('Helvetica')
             .text(` ${field.value}`, { width: 150 });
          yPos += 12;
        });

        // Address section
        yPos += 10;
        doc.font('Helvetica-Bold')
           .text('Address:', 15, yPos);
        yPos += 12;
        doc.font('Helvetica')
           .fontSize(8)
           .text(`${data.address.streetAddress}, ${data.address.suburb}`, 15, yPos);
        yPos += 10;
        doc.text(`${data.address.city}, ${data.address.province} ${data.address.postalCode}`, 15, yPos);

        // Photo placeholder (right side)
        doc.rect(250, 20, 80, 100)
           .stroke();
        doc.fontSize(8)
           .text('PHOTO', 275, 65);

        // Smart card chip placeholder
        doc.rect(250, 130, 25, 20)
           .fillColor('#ffd700')
           .fill()
           .stroke();

        // Issue and expiry dates
        doc.fontSize(8)
           .fillColor(SA_COLORS.black)
           .text(`Issued: ${data.issuanceDetails.dateOfIssue}`, 15, 180);
        doc.text(`Expires: ${data.issuanceDetails.dateOfExpiry}`, 15, 192);

        // QR code for verification (smaller for ID card)
        const qrData = `DHA-ID:${data.idNumber}`;
        QRCode.toDataURL(qrData, {
          width: 60,
          margin: 1
        }).then(qrCode => {
          doc.image(qrCode, 280, 160, { width: 50 });
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Business Permit PDF
   */
  async generateBusinessPermitPDF(data: BusinessPermitData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 30
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add security features and header
        this.addPDFKitWatermark(doc);
        this.addGovernmentHeader(doc, "BUSINESS PERMIT");

        // Title
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text('BUSINESS PERMIT', 50, 140, { align: 'center', width: 515 });

        // Permit details
        let yPos = 180;
        doc.fontSize(11)
           .fillColor(SA_COLORS.green)
           .text(`Permit Number: ${data.permitNumber}`, 50, yPos);

        // Personal details section
        yPos += 40;
        doc.fontSize(12)
           .fillColor(SA_COLORS.green)
           .text('PERMIT HOLDER DETAILS', 50, yPos);

        yPos += 25;
        this.addPersonalDetailsSection(doc, data.personal, 50, yPos);
        yPos += 180;

        // Business details section
        doc.fontSize(12)
           .fillColor(SA_COLORS.green)
           .text('BUSINESS DETAILS', 50, yPos);

        yPos += 25;
        doc.fontSize(10)
           .fillColor(SA_COLORS.black);

        const businessFields = [
          { label: 'Business Name:', value: data.businessDetails.businessName },
          { label: 'Registration Number:', value: data.businessDetails.registrationNumber },
          { label: 'Business Type:', value: data.businessDetails.businessType },
          { label: 'Business Activity:', value: data.businessDetails.businessActivity },
          { label: 'Investment Amount:', value: data.businessDetails.investmentAmount },
          { label: 'Employment Created:', value: data.businessDetails.employmentCreated.toString() }
        ];

        businessFields.forEach(field => {
          doc.font('Helvetica-Bold')
             .text(field.label, 50, yPos, { continued: true, width: 130 })
             .font('Helvetica')
             .text(` ${field.value}`, { width: 370 });
          yPos += 18;
        });

        // Validity section
        yPos += 20;
        doc.fontSize(12)
           .fillColor(SA_COLORS.green)
           .text('VALIDITY', 50, yPos);

        yPos += 25;
        doc.fontSize(10)
           .fillColor(SA_COLORS.black)
           .font('Helvetica-Bold')
           .text(`Valid From: ${data.validFrom} To: ${data.validUntil}`, 50, yPos);

        // QR code for verification
        const qrData = `DHA-BUSINESS:${data.permitNumber}`;
        QRCode.toDataURL(qrData, {
          width: 100,
          margin: 1
        }).then(qrCode => {
          doc.image(qrCode, 450, 600, { width: 100 });
        });

        // Footer
        this.addGovernmentFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Transit Visa PDF
   */
  async generateTransitVisaPDF(data: TransitVisaData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 30
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add security features and header
        this.addPDFKitWatermark(doc);
        this.addGovernmentHeader(doc, "TRANSIT VISA");

        // Title
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text('TRANSIT VISA', 50, 140, { align: 'center', width: 515 });

        // Visa details
        let yPos = 180;
        doc.fontSize(11)
           .fillColor(SA_COLORS.green)
           .text(`Visa Number: ${data.visaNumber}`, 50, yPos);

        // Personal details section
        yPos += 40;
        doc.fontSize(12)
           .fillColor(SA_COLORS.green)
           .text('TRAVELLER DETAILS', 50, yPos);

        yPos += 25;
        this.addPersonalDetailsSection(doc, data.personal, 50, yPos);
        yPos += 180;

        // Transit details section
        doc.fontSize(12)
           .fillColor(SA_COLORS.green)
           .text('TRANSIT DETAILS', 50, yPos);

        yPos += 25;
        doc.fontSize(10)
           .fillColor(SA_COLORS.black);

        const transitFields = [
          { label: 'Entry Port:', value: data.transitDetails.entryPort },
          { label: 'Exit Port:', value: data.transitDetails.exitPort },
          { label: 'Transit Duration:', value: data.transitDetails.transitDuration },
          { label: 'Final Destination:', value: data.transitDetails.finalDestination },
          { label: 'Arrival Flight:', value: data.transitDetails.flightDetails.arrivalFlight },
          { label: 'Departure Flight:', value: data.transitDetails.flightDetails.departureFlight }
        ];

        transitFields.forEach(field => {
          doc.font('Helvetica-Bold')
             .text(field.label, 50, yPos, { continued: true, width: 130 })
             .font('Helvetica')
             .text(` ${field.value}`, { width: 370 });
          yPos += 18;
        });

        // Validity section
        yPos += 20;
        doc.fontSize(12)
           .fillColor(SA_COLORS.green)
           .text('VALIDITY', 50, yPos);

        yPos += 25;
        doc.fontSize(10)
           .fillColor(SA_COLORS.black)
           .font('Helvetica-Bold')
           .text(`Valid From: ${data.validFrom} To: ${data.validUntil}`, 50, yPos);

        // QR code for verification
        const qrData = `DHA-TRANSIT:${data.visaNumber}`;
        QRCode.toDataURL(qrData, {
          width: 100,
          margin: 1
        }).then(qrCode => {
          doc.image(qrCode, 450, 600, { width: 100 });
        });

        // Footer
        this.addGovernmentFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Medical Treatment Visa PDF
   */
  async generateMedicalTreatmentVisaPDF(data: MedicalTreatmentVisaData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 30
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add security features and header
        this.addPDFKitWatermark(doc);
        this.addGovernmentHeader(doc, "MEDICAL TREATMENT VISA");

        // Title
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .text('MEDICAL TREATMENT VISA', 50, 140, { align: 'center', width: 515 });

        // Visa details
        let yPos = 180;
        doc.fontSize(11)
           .fillColor(SA_COLORS.green)
           .text(`Visa Number: ${data.visaNumber}`, 50, yPos);

        // Personal details section
        yPos += 40;
        doc.fontSize(12)
           .fillColor(SA_COLORS.green)
           .text('PATIENT DETAILS', 50, yPos);

        yPos += 25;
        this.addPersonalDetailsSection(doc, data.personal, 50, yPos);
        yPos += 180;

        // Medical details section
        doc.fontSize(12)
           .fillColor(SA_COLORS.green)
           .text('MEDICAL DETAILS', 50, yPos);

        yPos += 25;
        doc.fontSize(10)
           .fillColor(SA_COLORS.black);

        const medicalFields = [
          { label: 'Medical Condition:', value: data.medicalDetails.condition },
          { label: 'Treatment Required:', value: data.medicalDetails.treatmentRequired },
          { label: 'Urgency:', value: data.medicalDetails.urgency },
          { label: 'Estimated Duration:', value: data.medicalDetails.estimatedDuration },
          { label: 'Medical Institution:', value: data.medicalDetails.medicalInstitution.name },
          { label: 'Attending Doctor:', value: data.medicalDetails.attendingDoctor.fullName }
        ];

        medicalFields.forEach(field => {
          doc.font('Helvetica-Bold')
             .text(field.label, 50, yPos, { continued: true, width: 130 })
             .font('Helvetica')
             .text(` ${field.value}`, { width: 370 });
          yPos += 18;
        });

        // Financial arrangements section
        yPos += 20;
        doc.fontSize(12)
           .fillColor(SA_COLORS.green)
           .text('FINANCIAL ARRANGEMENTS', 50, yPos);

        yPos += 25;
        doc.fontSize(10)
           .fillColor(SA_COLORS.black)
           .font('Helvetica-Bold')
           .text(`Payment Method: ${data.financialArrangements.paymentMethod}`, 50, yPos);

        yPos += 18;
        doc.text(`Estimated Cost: ${data.financialArrangements.estimatedCost}`, 50, yPos);

        // Validity section
        yPos += 30;
        doc.fontSize(12)
           .fillColor(SA_COLORS.green)
           .text('VALIDITY', 50, yPos);

        yPos += 25;
        doc.fontSize(10)
           .fillColor(SA_COLORS.black)
           .font('Helvetica-Bold')
           .text(`Valid From: ${data.validFrom} To: ${data.validUntil}`, 50, yPos);

        // QR code for verification
        const qrData = `DHA-MEDICAL:${data.visaNumber}`;
        QRCode.toDataURL(qrData, {
          width: 100,
          margin: 1
        }).then(qrCode => {
          doc.image(qrCode, 450, 600, { width: 100 });
        });

        // Footer
        this.addGovernmentFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate Emergency Travel Document PDF
   */
  async generateEmergencyTravelDocumentPDF(data: EmergencyTravelDocumentData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 30
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Add security features and header
        this.addPDFKitWatermark(doc);
        this.addGovernmentHeader(doc, "EMERGENCY TRAVEL DOCUMENT");

        // Title with emergency designation
        doc.fontSize(16)
           .font('Helvetica-Bold')
           .fillColor(SA_COLORS.red)
           .text('EMERGENCY TRAVEL DOCUMENT', 50, 140, { align: 'center', width: 515 });

        // Document details
        let yPos = 180;
        doc.fontSize(11)
           .fillColor(SA_COLORS.green)
           .text(`Document Number: ${data.documentNumber}`, 50, yPos);

        // Personal details section
        yPos += 40;
        doc.fontSize(12)
           .fillColor(SA_COLORS.green)
           .text('HOLDER DETAILS', 50, yPos);

        yPos += 25;
        this.addPersonalDetailsSection(doc, data.personal, 50, yPos);
        yPos += 180;

        // Emergency details section
        doc.fontSize(12)
           .fillColor(SA_COLORS.green)
           .text('EMERGENCY DETAILS', 50, yPos);

        yPos += 25;
        doc.fontSize(10)
           .fillColor(SA_COLORS.black);

        const emergencyFields = [
          { label: 'Emergency Type:', value: data.emergencyDetails.emergencyType },
          { label: 'Circumstances:', value: data.emergencyDetails.circumstances },
          { label: 'Police Reference:', value: data.emergencyDetails.policeReference || 'N/A' },
          { label: 'Purpose:', value: data.validityDetails.purpose },
          { label: 'Issuing Office:', value: data.issuingDetails.issuingOffice }
        ];

        emergencyFields.forEach(field => {
          doc.font('Helvetica-Bold')
             .text(field.label, 50, yPos, { continued: true, width: 130 })
             .font('Helvetica')
             .text(` ${field.value}`, { width: 370 });
          yPos += 18;
        });

        // Validity section with restrictions
        yPos += 20;
        doc.fontSize(12)
           .fillColor(SA_COLORS.green)
           .text('VALIDITY AND RESTRICTIONS', 50, yPos);

        yPos += 25;
        doc.fontSize(10)
           .fillColor(SA_COLORS.black)
           .font('Helvetica-Bold')
           .text(`Valid From: ${data.validityDetails.validFrom} To: ${data.validityDetails.validUntil}`, 50, yPos);

        yPos += 18;
        doc.text(`Destination Countries: ${data.validityDetails.destinationCountries.join(', ')}`, 50, yPos);

        if (data.validityDetails.restrictions && data.validityDetails.restrictions.length > 0) {
          yPos += 18;
          doc.fillColor(SA_COLORS.red)
             .text(`Restrictions: ${data.validityDetails.restrictions.join('; ')}`, 50, yPos);
        }

        // QR code for verification
        const qrData = `DHA-EMERGENCY:${data.documentNumber}`;
        QRCode.toDataURL(qrData, {
          width: 100,
          margin: 1
        }).then(qrCode => {
          doc.image(qrCode, 450, 600, { width: 100 });
        });

        // Footer
        this.addGovernmentFooter(doc);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

// Export singleton instance
export const pdfGenerationService = new PDFGenerationService();
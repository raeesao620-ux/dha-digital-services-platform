import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  FileDown, Printer, Shield, FileText, CreditCard, Globe, 
  Users, BookOpen, Award, Briefcase, Home, Heart, Building,
  Plane, FileCheck, Activity, Brain
} from "lucide-react";
import { SouthAfricanCoatOfArms, DHALogo } from "@/components/GovernmentAssets";

export default function PDFTestPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [documentType, setDocumentType] = useState("work-permit");
  
  // Form data states
  const [personalData, setPersonalData] = useState({
    fullName: "John Michael Smith",
    surname: "Smith",
    givenNames: "John Michael",
    dateOfBirth: "1985-06-15",
    nationality: "British",
    passportNumber: "GB1234567",
    idNumber: "",
    gender: "Male",
    maritalStatus: "Single",
    countryOfBirth: "United Kingdom"
  });

  const [workPermitData, setWorkPermitData] = useState({
    permitType: "Section 19(1)",
    employer: {
      name: "Tech Solutions (Pty) Ltd",
      address: "123 Main Street, Sandton, Johannesburg, 2196",
      registrationNumber: "2020/123456/07"
    },
    occupation: "Software Engineer",
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    conditions: [
      "May only work for the specified employer",
      "Must not change occupation without permission",
      "Must maintain valid passport throughout stay"
    ]
  });

  // DHA-84 Visitor Visa Data
  const [visitorVisaData, setVisitorVisaData] = useState({
    applicationNumber: `DHA84-${Date.now()}`,
    visaType: "Visitor",
    purposeOfVisit: "Tourism and family visit",
    intendedDateOfArrival: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    intendedDateOfDeparture: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    durationOfStay: "30 days",
    addressInSA: {
      streetAddress: "45 Beach Road, Sea Point",
      city: "Cape Town",
      province: "Western Cape",
      postalCode: "8001",
      telephone: "+27 21 123 4567"
    },
    homeCountryAddress: {
      streetAddress: "123 High Street",
      city: "London",
      country: "United Kingdom",
      postalCode: "SW1A 1AA",
      telephone: "+44 20 1234 5678",
      email: "john.smith@email.com"
    },
    sponsor: {
      name: "David Smith",
      relationship: "Brother",
      address: "45 Beach Road, Sea Point, Cape Town, 8001",
      telephone: "+27 21 123 4567",
      idNumber: "8501015123085"
    },
    criminalRecord: false,
    deportationHistory: false,
    refusedEntry: false,
    yellowFeverVaccination: true,
    financialMeans: "Personal savings and sponsor support",
    bankStatements: true,
    returnTicket: true
  });

  // DHA-1738 Temporary Residence Data
  const [temporaryResidenceData, setTemporaryResidenceData] = useState({
    applicationNumber: `DHA1738-${Date.now()}`,
    permitCategory: "Work",
    currentPermitNumber: "",
    currentPermitExpiry: "",
    purposeOfApplication: "Employment with local company",
    intendedDuration: "3 years",
    addressInSA: {
      streetAddress: "123 Main Street, Sandton",
      city: "Johannesburg",
      province: "Gauteng",
      postalCode: "2196",
      telephone: "+27 11 123 4567",
      email: "john.smith@techsolutions.co.za"
    },
    employer: {
      name: "Tech Solutions (Pty) Ltd",
      registrationNumber: "2020/123456/07",
      address: "123 Main Street, Sandton, Johannesburg, 2196",
      telephone: "+27 11 123 4567",
      email: "hr@techsolutions.co.za",
      contactPerson: "Jane Doe"
    },
    financialGuarantee: "R50,000 per month salary",
    criminalRecord: false,
    medicalReport: true,
    radiologicalReport: true,
    policeClearance: true
  });

  // BI-947 General Work Permit Data
  const [generalWorkData, setGeneralWorkData] = useState({
    applicationNumber: `BI947-${Date.now()}`,
    employer: {
      name: "Innovation Tech (Pty) Ltd",
      registrationNumber: "2021/654321/07",
      address: "456 Tech Avenue, Rosebank, Johannesburg, 2196",
      telephone: "+27 11 987 6543",
      fax: "+27 11 987 6544",
      email: "hr@innovationtech.co.za",
      contactPerson: "Sarah Johnson",
      hrManager: "Mike Wilson"
    },
    jobDetails: {
      position: "Senior Software Engineer",
      department: "Technology",
      jobDescription: "Develop and maintain software applications, lead technical teams, and implement new technologies",
      requiredQualifications: "Bachelor's degree in Computer Science or related field",
      yearsOfExperience: 5,
      monthlySalary: "R75,000",
      contractType: "Permanent",
      contractDuration: ""
    },
    qualifications: [
      {
        degree: "BSc Computer Science",
        institution: "University of Oxford",
        year: "2008",
        country: "United Kingdom"
      }
    ],
    workExperience: [
      {
        employer: "Tech Corp UK",
        position: "Software Developer",
        duration: "5 years",
        responsibilities: "Full-stack development, team leadership"
      }
    ],
    laborMarketTesting: {
      advertised: true,
      newspaperName: "Sunday Times",
      dateAdvertised: "2024-01-15",
      numberOfApplicants: 12,
      reasonForForeignHire: "Specialized skills not available locally"
    },
    replacementPlan: {
      hasplan: true,
      trainingSAcitizen: true,
      timeframe: "2 years",
      details: "Will mentor and train local junior developers"
    }
  });

  // Medical Certificate Data
  const [medicalData, setMedicalData] = useState({
    certificateNumber: `MED-${Date.now()}`,
    patient: personalData,
    doctor: {
      fullName: "Dr. James Anderson",
      qualifications: "MBChB, MMed",
      practiceNumber: "MP0123456",
      address: "123 Medical Centre, Sandton, Johannesburg",
      telephone: "+27 11 555 1234"
    },
    examinationDate: new Date().toISOString().split('T')[0],
    medicalHistory: {
      chronicConditions: [],
      currentMedications: [],
      allergies: [],
      previousSurgeries: []
    },
    physicalExamination: {
      height: "180 cm",
      weight: "75 kg",
      bloodPressure: "120/80",
      heartRate: "72 bpm",
      generalHealth: "Good"
    },
    tuberculosisScreening: {
      tested: true,
      testDate: new Date().toISOString().split('T')[0],
      result: "Negative",
      treatmentRequired: false
    },
    otherInfectiousDiseases: {
      tested: true,
      diseases: []
    },
    mentalHealth: {
      assessment: "Normal",
      details: ""
    },
    fitnessForPurpose: {
      fitForWork: true,
      fitForStudy: true,
      fitForResidence: true,
      restrictions: []
    }
  });

  // Critical Skills Data
  const [criticalSkillsData, setCriticalSkillsData] = useState({
    applicationNumber: `CSV-${Date.now()}`,
    criticalSkillCategory: "Information and Communication Technology",
    qualifications: [
      {
        degree: "MSc Computer Science",
        field: "Artificial Intelligence",
        institution: "MIT",
        country: "USA",
        year: "2010",
        saricStatus: "Evaluated and recognized"
      }
    ],
    professionalRegistration: {
      body: "Institute of IT Professionals South Africa",
      registrationNumber: "IITPSA12345",
      validUntil: "2026-12-31"
    },
    experience: [
      {
        employer: "Tech Giant Inc",
        position: "AI Research Lead",
        duration: "5 years",
        keyAchievements: ["Developed ML algorithms", "Led team of 10", "Published 5 papers"]
      }
    ],
    jobOffer: {
      employer: "SA Tech Innovation Hub",
      position: "Chief AI Officer",
      salary: "R150,000 per month",
      startDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    },
    confirmationLetter: true,
    motivationLetter: true
  });

  // Business Visa Data
  const [businessVisaData, setBusinessVisaData] = useState({
    applicationNumber: `BV-${Date.now()}`,
    businessDetails: {
      companyName: "Global Ventures SA (Pty) Ltd",
      registrationNumber: "2024/111222/07",
      businessType: "Technology and Innovation",
      yearsInOperation: 1,
      annualTurnover: "R10,000,000",
      numberOfEmployees: 25
    },
    purposeOfVisit: "Establish and manage business operations",
    businessActivities: ["Software development", "Technology consulting", "Innovation research"],
    investmentAmount: "R5,000,000",
    jobCreation: {
      numberOfJobs: 15,
      timeline: "Within 12 months"
    },
    businessPlan: true,
    financialStatements: true,
    taxClearance: true,
    partners: [
      {
        name: "John Smith",
        nationality: "British",
        shareholding: "51%"
      }
    ]
  });

  // Retirement Visa Data
  const [retirementVisaData, setRetirementVisaData] = useState({
    applicationNumber: `RV-${Date.now()}`,
    retirementIncome: {
      monthlyPension: "£3,000",
      otherIncome: "£500",
      totalMonthly: "£3,500",
      currency: "GBP"
    },
    netWorth: "£500,000",
    propertyInSA: {
      owned: true,
      address: "123 Retirement Village, Hermanus, Western Cape",
      value: "R2,500,000"
    },
    dependents: [
      {
        name: "Jane Smith",
        relationship: "Spouse",
        age: 62
      }
    ],
    healthInsurance: {
      provider: "Discovery Health",
      policyNumber: "DH123456",
      coverage: "Comprehensive"
    },
    criminalRecord: false,
    intendedAddress: "123 Retirement Village, Hermanus, Western Cape"
  });

  const [asylumData, setAsylumData] = useState({
    fileReference: "CPT-2025-00123",
    unhcrNumber: "ZAF-2025-00456",
    countryOfOrigin: "Democratic Republic of Congo",
    dateOfApplication: new Date().toISOString().split('T')[0],
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dependents: [
      { name: "Jane Smith", relationship: "Spouse", dateOfBirth: "1987-03-22" },
      { name: "Mary Smith", relationship: "Child", dateOfBirth: "2015-08-10" }
    ]
  });

  const [birthCertData, setBirthCertData] = useState({
    fullName: "Sarah Jane Johnson",
    dateOfBirth: "2024-01-15",
    placeOfBirth: "Cape Town, Western Cape",
    gender: "Female",
    mother: {
      fullName: "Emily Johnson",
      idNumber: "8505150123085",
      nationality: "South African"
    },
    father: {
      fullName: "Michael Johnson",
      idNumber: "8301010123084",
      nationality: "South African"
    },
    registrationOffice: "Cape Town Home Affairs"
  });

  const generatePDF = async () => {
    setLoading(true);
    
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
      toast({
        title: "Authentication Required",
        description: "Please log in to generate documents.",
        variant: "destructive"
      });
      setLoading(false);
      return;
    }
    
    try {
      let endpoint = "";
      let requestData: any = {};
      
      switch (documentType) {
        case "work-permit":
          endpoint = "/api/pdf/work-permit";
          requestData = {
            personal: personalData,
            ...workPermitData
          };
          break;
        
        case "visitor-visa":
          endpoint = "/api/pdf/visitor-visa";
          requestData = {
            personal: personalData,
            ...visitorVisaData
          };
          break;
        
        case "temporary-residence":
          endpoint = "/api/pdf/temporary-residence";
          requestData = {
            personal: personalData,
            ...temporaryResidenceData
          };
          break;
        
        case "general-work":
          endpoint = "/api/pdf/general-work";
          requestData = {
            personal: personalData,
            ...generalWorkData
          };
          break;
        
        case "medical-certificate":
          endpoint = "/api/pdf/medical-certificate";
          requestData = medicalData;
          break;
        
        case "radiological-report":
          endpoint = "/api/pdf/radiological-report";
          requestData = {
            reportNumber: `RAD-${Date.now()}`,
            patient: personalData,
            radiologist: {
              fullName: "Dr. Sarah Mitchell",
              qualifications: "MBChB, FCRad",
              practiceNumber: "RP0987654",
              facility: "Sandton Radiology Centre",
              address: "456 Medical Plaza, Sandton"
            },
            examinationDate: new Date().toISOString().split('T')[0],
            examType: "Chest X-Ray",
            indication: "Immigration medical screening",
            findings: {
              lungs: {
                normal: true,
                abnormalities: []
              },
              heart: {
                normal: true,
                size: "Normal",
                abnormalities: []
              },
              bones: {
                normal: true,
                abnormalities: []
              }
            },
            tuberculosisScreening: {
              signsOfActiveTB: false,
              signsOfOldTB: false,
              furtherTestingRequired: false,
              details: ""
            },
            impression: "Normal chest radiograph. No evidence of active tuberculosis or other significant pathology.",
            recommendations: ["No further imaging required", "Suitable for immigration purposes"]
          };
          break;
        
        case "critical-skills":
          endpoint = "/api/pdf/critical-skills";
          requestData = {
            personal: personalData,
            ...criticalSkillsData
          };
          break;
        
        case "business-visa":
          endpoint = "/api/pdf/business-visa";
          requestData = {
            personal: personalData,
            ...businessVisaData
          };
          break;
        
        case "retirement-visa":
          endpoint = "/api/pdf/retirement-visa";
          requestData = {
            personal: personalData,
            ...retirementVisaData
          };
          break;
        
        case "relatives-visa":
          endpoint = "/api/pdf/relatives-visa";
          requestData = {
            personal: personalData,
            ...visitorVisaData,
            visaType: "Relatives",
            purposeOfVisit: "Visiting family members in South Africa"
          };
          break;
        
        case "corporate-visa":
          endpoint = "/api/pdf/corporate-visa";
          requestData = {
            personal: personalData,
            ...businessVisaData,
            businessDetails: {
              ...businessVisaData.businessDetails,
              businessType: "Corporate Entity"
            }
          };
          break;
          
        case "asylum-visa":
          endpoint = "/api/pdf/asylum-visa";
          requestData = {
            personal: personalData,
            ...asylumData
          };
          break;
        
        case "residence-permit":
          endpoint = "/api/pdf/residence-permit";
          requestData = {
            personal: personalData,
            permitCategory: "Direct Residence",
            validFrom: new Date().toISOString().split('T')[0],
            validUntil: "Permanent",
            conditions: ["Must not engage in prohibited activities"]
          };
          break;
        
        case "birth-certificate":
          endpoint = "/api/documents/birth-certificate";
          requestData = {
            // Primary fields that the task specifies the server expects
            childName: birthCertData.fullName,
            dateOfBirth: birthCertData.dateOfBirth,
            placeOfBirth: birthCertData.placeOfBirth,
            gender: birthCertData.gender,
            motherName: birthCertData.mother.fullName,
            motherIdNumber: birthCertData.mother.idNumber,
            fatherName: birthCertData.father.fullName,
            fatherIdNumber: birthCertData.father.idNumber,
            
            // Additional fields that may be required by the server implementation
            childFullName: birthCertData.fullName,
            fullName: birthCertData.fullName,
            motherFullName: birthCertData.mother.fullName,
            fatherFullName: birthCertData.father.fullName,
            issuingAuthority: birthCertData.registrationOffice || "Department of Home Affairs"
          };
          break;
        
        case "passport":
          endpoint = "/api/pdf/passport";
          requestData = {
            personal: personalData,
            passportType: "Ordinary",
            dateOfIssue: new Date().toISOString().split('T')[0],
            dateOfExpiry: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            placeOfIssue: "Pretoria"
          };
          break;
        
        case "study-permit":
          endpoint = "/api/pdf/study-permit";
          requestData = {
            personal: personalData,
            institution: "University of Cape Town",
            course: "Master of Computer Science",
            duration: "2 years",
            validFrom: new Date().toISOString().split('T')[0],
            validUntil: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          };
          break;
          
        default:
          throw new Error("Invalid document type");
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` // Use the validated token from above
        },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        // Log detailed error information for debugging
        console.error(`API Error: ${response.status} ${response.statusText}`);
        console.error(`Endpoint: ${endpoint}`);
        console.error(`Token present: ${!!token}`);
        
        // Handle specific error cases
        if (response.status === 401) {
          // Token might be expired or invalid
          console.error('Authentication failed - token may be expired or invalid');
          localStorage.removeItem('token'); // Clear invalid token
          throw new Error('Authentication failed. Please log in again.');
        } else if (response.status === 403) {
          throw new Error('You do not have permission to generate this document.');
        } else if (response.status === 500) {
          throw new Error('Server error. Please try again later.');
        } else {
          throw new Error(`Failed to generate PDF (Error ${response.status})`);
        }
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${documentType}-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({
        title: "PDF Generated",
        description: `Your ${documentType.replace('-', ' ')} PDF has been generated and downloaded.`,
      });
      
    } catch (error) {
      console.error('PDF generation error:', error);
      
      // Provide more specific error messages
      let errorMessage = "Failed to generate PDF. Please try again.";
      if (error instanceof Error) {
        errorMessage = error.message;
        
        // If it's an authentication error, suggest logging in
        if (error.message.includes('Authentication failed')) {
          // Redirect to login page after a short delay
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        }
      }
      
      toast({
        title: "Generation Failed",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const renderDocumentForm = () => {
    switch(documentType) {
      case "visitor-visa":
        return (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>DHA-84 Visitor's Visa Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Visa Type</Label>
                  <Select 
                    value={visitorVisaData.visaType}
                    onValueChange={(value) => setVisitorVisaData({...visitorVisaData, visaType: value as any})}
                  >
                    <SelectTrigger data-testid="select-visa-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Visitor">Visitor</SelectItem>
                      <SelectItem value="Transit">Transit</SelectItem>
                      <SelectItem value="Medical">Medical</SelectItem>
                      <SelectItem value="Business">Business</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Purpose of Visit</Label>
                  <Input
                    value={visitorVisaData.purposeOfVisit}
                    onChange={(e) => setVisitorVisaData({...visitorVisaData, purposeOfVisit: e.target.value})}
                    data-testid="input-purpose"
                  />
                </div>
                <div>
                  <Label>Intended Arrival Date</Label>
                  <Input
                    type="date"
                    value={visitorVisaData.intendedDateOfArrival}
                    onChange={(e) => setVisitorVisaData({...visitorVisaData, intendedDateOfArrival: e.target.value})}
                    data-testid="input-arrival"
                  />
                </div>
                <div>
                  <Label>Intended Departure Date</Label>
                  <Input
                    type="date"
                    value={visitorVisaData.intendedDateOfDeparture}
                    onChange={(e) => setVisitorVisaData({...visitorVisaData, intendedDateOfDeparture: e.target.value})}
                    data-testid="input-departure"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      
      case "critical-skills":
        return (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Critical Skills Visa Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Critical Skill Category</Label>
                  <Input
                    value={criticalSkillsData.criticalSkillCategory}
                    onChange={(e) => setCriticalSkillsData({...criticalSkillsData, criticalSkillCategory: e.target.value})}
                    data-testid="input-skill-category"
                  />
                </div>
                <div>
                  <Label>Job Offer - Employer</Label>
                  <Input
                    value={criticalSkillsData.jobOffer.employer}
                    onChange={(e) => setCriticalSkillsData({
                      ...criticalSkillsData, 
                      jobOffer: {...criticalSkillsData.jobOffer, employer: e.target.value}
                    })}
                    data-testid="input-employer"
                  />
                </div>
                <div>
                  <Label>Position</Label>
                  <Input
                    value={criticalSkillsData.jobOffer.position}
                    onChange={(e) => setCriticalSkillsData({
                      ...criticalSkillsData,
                      jobOffer: {...criticalSkillsData.jobOffer, position: e.target.value}
                    })}
                    data-testid="input-position"
                  />
                </div>
                <div>
                  <Label>Monthly Salary</Label>
                  <Input
                    value={criticalSkillsData.jobOffer.salary}
                    onChange={(e) => setCriticalSkillsData({
                      ...criticalSkillsData,
                      jobOffer: {...criticalSkillsData.jobOffer, salary: e.target.value}
                    })}
                    data-testid="input-salary"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <SouthAfricanCoatOfArms className="h-16 w-16" />
          <div>
            <h1 className="text-3xl font-bold">DHA Document Generation Test</h1>
            <p className="text-gray-600">Generate official South African government documents</p>
          </div>
        </div>
        <DHALogo className="h-12" />
      </div>

      {/* Document Type Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Select Document Type
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Original Documents */}
            <Button
              variant={documentType === "work-permit" ? "default" : "outline"}
              onClick={() => setDocumentType("work-permit")}
              className="flex flex-col items-center gap-2 h-auto py-3"
              data-testid="button-work-permit"
            >
              <CreditCard className="h-6 w-6" />
              <span className="text-xs">Work Permit</span>
            </Button>
            
            {/* New DHA Documents */}
            <Button
              variant={documentType === "visitor-visa" ? "default" : "outline"}
              onClick={() => setDocumentType("visitor-visa")}
              className="flex flex-col items-center gap-2 h-auto py-3"
              data-testid="button-visitor-visa"
            >
              <Plane className="h-6 w-6" />
              <span className="text-xs">Visitor Visa</span>
              <span className="text-[9px] text-muted-foreground">DHA-84</span>
            </Button>
            
            <Button
              variant={documentType === "temporary-residence" ? "default" : "outline"}
              onClick={() => setDocumentType("temporary-residence")}
              className="flex flex-col items-center gap-2 h-auto py-3"
              data-testid="button-temp-residence"
            >
              <Home className="h-6 w-6" />
              <span className="text-xs">Temp Residence</span>
              <span className="text-[9px] text-muted-foreground">DHA-1738</span>
            </Button>
            
            <Button
              variant={documentType === "general-work" ? "default" : "outline"}
              onClick={() => setDocumentType("general-work")}
              className="flex flex-col items-center gap-2 h-auto py-3"
              data-testid="button-general-work"
            >
              <Briefcase className="h-6 w-6" />
              <span className="text-xs">General Work</span>
              <span className="text-[9px] text-muted-foreground">BI-947</span>
            </Button>
            
            <Button
              variant={documentType === "critical-skills" ? "default" : "outline"}
              onClick={() => setDocumentType("critical-skills")}
              className="flex flex-col items-center gap-2 h-auto py-3"
              data-testid="button-critical-skills"
            >
              <Brain className="h-6 w-6" />
              <span className="text-xs">Critical Skills</span>
            </Button>
            
            <Button
              variant={documentType === "business-visa" ? "default" : "outline"}
              onClick={() => setDocumentType("business-visa")}
              className="flex flex-col items-center gap-2 h-auto py-3"
              data-testid="button-business-visa"
            >
              <Building className="h-6 w-6" />
              <span className="text-xs">Business Visa</span>
            </Button>
            
            <Button
              variant={documentType === "retirement-visa" ? "default" : "outline"}
              onClick={() => setDocumentType("retirement-visa")}
              className="flex flex-col items-center gap-2 h-auto py-3"
              data-testid="button-retirement-visa"
            >
              <Heart className="h-6 w-6" />
              <span className="text-xs">Retirement</span>
            </Button>
            
            <Button
              variant={documentType === "medical-certificate" ? "default" : "outline"}
              onClick={() => setDocumentType("medical-certificate")}
              className="flex flex-col items-center gap-2 h-auto py-3"
              data-testid="button-medical"
            >
              <Activity className="h-6 w-6" />
              <span className="text-xs">Medical Cert</span>
            </Button>
            
            <Button
              variant={documentType === "radiological-report" ? "default" : "outline"}
              onClick={() => setDocumentType("radiological-report")}
              className="flex flex-col items-center gap-2 h-auto py-3"
              data-testid="button-radiological"
            >
              <FileCheck className="h-6 w-6" />
              <span className="text-xs">X-Ray Report</span>
            </Button>
            
            <Button
              variant={documentType === "relatives-visa" ? "default" : "outline"}
              onClick={() => setDocumentType("relatives-visa")}
              className="flex flex-col items-center gap-2 h-auto py-3"
              data-testid="button-relatives-visa"
            >
              <Users className="h-6 w-6" />
              <span className="text-xs">Relatives Visa</span>
            </Button>
            
            <Button
              variant={documentType === "corporate-visa" ? "default" : "outline"}
              onClick={() => setDocumentType("corporate-visa")}
              className="flex flex-col items-center gap-2 h-auto py-3"
              data-testid="button-corporate-visa"
            >
              <Building className="h-6 w-6" />
              <span className="text-xs">Corporate</span>
            </Button>
            
            {/* Original Documents */}
            <Button
              variant={documentType === "asylum-visa" ? "default" : "outline"}
              onClick={() => setDocumentType("asylum-visa")}
              className="flex flex-col items-center gap-2 h-auto py-3"
              data-testid="button-asylum-visa"
            >
              <Shield className="h-6 w-6" />
              <span className="text-xs">Asylum Visa</span>
            </Button>
            
            <Button
              variant={documentType === "residence-permit" ? "default" : "outline"}
              onClick={() => setDocumentType("residence-permit")}
              className="flex flex-col items-center gap-2 h-auto py-3"
              data-testid="button-residence-permit"
            >
              <Globe className="h-6 w-6" />
              <span className="text-xs">Residence</span>
            </Button>
            
            <Button
              variant={documentType === "birth-certificate" ? "default" : "outline"}
              onClick={() => setDocumentType("birth-certificate")}
              className="flex flex-col items-center gap-2 h-auto py-3"
              data-testid="button-birth-certificate"
            >
              <Users className="h-6 w-6" />
              <span className="text-xs">Birth Cert</span>
            </Button>
            
            <Button
              variant={documentType === "passport" ? "default" : "outline"}
              onClick={() => setDocumentType("passport")}
              className="flex flex-col items-center gap-2 h-auto py-3"
              data-testid="button-passport"
            >
              <BookOpen className="h-6 w-6" />
              <span className="text-xs">Passport</span>
            </Button>
            
            <Button
              variant={documentType === "study-permit" ? "default" : "outline"}
              onClick={() => setDocumentType("study-permit")}
              className="flex flex-col items-center gap-2 h-auto py-3"
              data-testid="button-study-permit"
            >
              <Award className="h-6 w-6" />
              <span className="text-xs">Study Permit</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Personal Information Form */}
      {documentType !== "birth-certificate" && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={personalData.fullName}
                  onChange={(e) => setPersonalData({...personalData, fullName: e.target.value})}
                  data-testid="input-fullname"
                />
              </div>
              
              <div>
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={personalData.dateOfBirth}
                  onChange={(e) => setPersonalData({...personalData, dateOfBirth: e.target.value})}
                  data-testid="input-dob"
                />
              </div>
              
              <div>
                <Label htmlFor="nationality">Nationality</Label>
                <Input
                  id="nationality"
                  value={personalData.nationality}
                  onChange={(e) => setPersonalData({...personalData, nationality: e.target.value})}
                  data-testid="input-nationality"
                />
              </div>
              
              <div>
                <Label htmlFor="passportNumber">Passport Number</Label>
                <Input
                  id="passportNumber"
                  value={personalData.passportNumber}
                  onChange={(e) => setPersonalData({...personalData, passportNumber: e.target.value})}
                  data-testid="input-passport"
                />
              </div>
              
              <div>
                <Label htmlFor="gender">Gender</Label>
                <Select 
                  value={personalData.gender}
                  onValueChange={(value) => setPersonalData({...personalData, gender: value})}
                >
                  <SelectTrigger data-testid="select-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="maritalStatus">Marital Status</Label>
                <Select 
                  value={personalData.maritalStatus}
                  onValueChange={(value) => setPersonalData({...personalData, maritalStatus: value})}
                >
                  <SelectTrigger data-testid="select-marital">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Single">Single</SelectItem>
                    <SelectItem value="Married">Married</SelectItem>
                    <SelectItem value="Divorced">Divorced</SelectItem>
                    <SelectItem value="Widowed">Widowed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Document-specific forms */}
      {renderDocumentForm()}

      {/* Birth Certificate Form */}
      {documentType === "birth-certificate" && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Birth Certificate Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="childName">Child's Full Name</Label>
                <Input
                  id="childName"
                  value={birthCertData.fullName}
                  onChange={(e) => setBirthCertData({...birthCertData, fullName: e.target.value})}
                  data-testid="input-child-name"
                />
              </div>
              
              <div>
                <Label htmlFor="childDob">Date of Birth</Label>
                <Input
                  id="childDob"
                  type="date"
                  value={birthCertData.dateOfBirth}
                  onChange={(e) => setBirthCertData({...birthCertData, dateOfBirth: e.target.value})}
                  data-testid="input-child-dob"
                />
              </div>
              
              <div>
                <Label htmlFor="placeOfBirth">Place of Birth</Label>
                <Input
                  id="placeOfBirth"
                  value={birthCertData.placeOfBirth}
                  onChange={(e) => setBirthCertData({...birthCertData, placeOfBirth: e.target.value})}
                  data-testid="input-place-birth"
                />
              </div>
              
              <div>
                <Label htmlFor="childGender">Gender</Label>
                <Select 
                  value={birthCertData.gender}
                  onValueChange={(value) => setBirthCertData({...birthCertData, gender: value})}
                >
                  <SelectTrigger data-testid="select-child-gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="col-span-2">
                <h3 className="font-semibold mb-2">Mother's Information</h3>
              </div>
              
              <div>
                <Label htmlFor="motherName">Mother's Full Name</Label>
                <Input
                  id="motherName"
                  value={birthCertData.mother.fullName}
                  onChange={(e) => setBirthCertData({
                    ...birthCertData,
                    mother: {...birthCertData.mother, fullName: e.target.value}
                  })}
                  data-testid="input-mother-name"
                />
              </div>
              
              <div>
                <Label htmlFor="motherID">Mother's ID Number</Label>
                <Input
                  id="motherID"
                  value={birthCertData.mother.idNumber}
                  onChange={(e) => setBirthCertData({
                    ...birthCertData,
                    mother: {...birthCertData.mother, idNumber: e.target.value}
                  })}
                  data-testid="input-mother-id"
                />
              </div>
              
              <div className="col-span-2">
                <h3 className="font-semibold mb-2">Father's Information</h3>
              </div>
              
              <div>
                <Label htmlFor="fatherName">Father's Full Name</Label>
                <Input
                  id="fatherName"
                  value={birthCertData.father.fullName}
                  onChange={(e) => setBirthCertData({
                    ...birthCertData,
                    father: {...birthCertData.father, fullName: e.target.value}
                  })}
                  data-testid="input-father-name"
                />
              </div>
              
              <div>
                <Label htmlFor="fatherID">Father's ID Number</Label>
                <Input
                  id="fatherID"
                  value={birthCertData.father.idNumber}
                  onChange={(e) => setBirthCertData({
                    ...birthCertData,
                    father: {...birthCertData.father, idNumber: e.target.value}
                  })}
                  data-testid="input-father-id"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate Button */}
      <Card>
        <CardContent className="pt-6">
          <Button
            onClick={generatePDF}
            disabled={loading}
            className="w-full"
            size="lg"
            data-testid="button-generate"
          >
            {loading ? (
              <>
                <Printer className="mr-2 h-5 w-5 animate-spin" />
                Generating PDF...
              </>
            ) : (
              <>
                <FileDown className="mr-2 h-5 w-5" />
                Generate & Download PDF
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Information Card */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>About This Test Page</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            This page allows you to test the generation of various South African government documents 
            with all official security features including:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
            <li>DHA-84 (Form 11) - Visitor's/Transit Visa Application</li>
            <li>DHA-1738 (Form 8) - Temporary Residence Permit</li>
            <li>BI-947 - General Work Permit</li>
            <li>Medical and Radiological Reports for Immigration</li>
            <li>Critical Skills, Business, and Retirement Visas</li>
            <li>All documents include security features: Braille patterns, QR codes, holographic strips</li>
            <li>Live verification system with hashtag tracking</li>
            <li>Official form numbers and control codes</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
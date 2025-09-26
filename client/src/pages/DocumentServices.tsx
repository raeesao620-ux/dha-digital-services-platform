import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { pdfService } from "@/services/pdf-service";
import { 
  FileText, Download, Eye, Shield, CheckCircle, QrCode, Calendar, User, Hash,
  Baby, Heart, Plane, Skull, Briefcase, CreditCard, UserCheck, Search,
  Building2, Scan, Clock, AlertTriangle, FileCheck, Camera, Upload,
  ShieldCheck, UserX, Globe, Flag, Building, MapPin, Phone, Mail,
  Package, Truck, Printer, CheckSquare, XCircle, RefreshCw, Info,
  Users, Fingerprint, Lock, Unlock, AlertCircle, ChevronRight,
  HelpCircle, Send, Save, Archive, Trash2, Edit3, Copy, Share2
} from "lucide-react";

// ==================== FORM SCHEMAS ====================

// Refugee Document Schema
const refugeeDocumentSchema = z.object({
  documentType: z.enum(["section22_permit", "asylum_permit", "refugee_id", "refugee_travel"]),
  unhcrNumber: z.string().optional(),
  countryOfOrigin: z.string().min(1, "Country of origin is required"),
  dateOfEntry: z.string().min(1, "Date of entry is required"),
  campLocation: z.string().optional(),
  dependents: z.array(z.object({
    fullName: z.string(),
    relationship: z.string(),
    dateOfBirth: z.string(),
  })).optional(),
  permitNumber: z.string().optional(),
  permitExpiryDate: z.string().optional(),
  maroonPassportNumber: z.string().optional(),
  biometricConsent: z.boolean(),
  deliveryMethod: z.enum(["collection", "courier", "registered_mail"]),
  collectionPoint: z.string().optional(),
  deliveryAddress: z.object({
    street: z.string(),
    city: z.string(),
    province: z.string(),
    postalCode: z.string(),
  }).optional(),
  notificationPreferences: z.object({
    sms: z.boolean(),
    email: z.boolean(),
  }),
});

// Diplomatic Passport Schema
const diplomaticPassportSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  placeOfBirth: z.string().min(1, "Place of birth is required"),
  sex: z.enum(["M", "F", "X"]),
  nationality: z.string().min(1, "Nationality is required"),
  diplomaticNoteNumber: z.string().min(1, "Diplomatic note number is required"),
  embassy: z.string().min(1, "Embassy is required"),
  consulate: z.string().optional(),
  diplomaticRank: z.string().min(1, "Diplomatic rank is required"),
  immunityStatus: z.enum(["full", "partial", "none"]),
  countryOfAccreditation: z.string().min(1, "Country of accreditation is required"),
  previousDiplomaticPassports: z.array(z.string()).optional(),
  emergencyContactEmbassy: z.string().min(1, "Emergency contact is required"),
  viennaConventionCompliant: z.boolean(),
  specialClearanceRequired: z.boolean(),
  deliveryMethod: z.enum(["diplomatic_pouch", "embassy_collection", "secure_courier"]),
  notificationPreferences: z.object({
    sms: z.boolean(),
    email: z.boolean(),
    diplomaticChannel: z.boolean(),
  }),
});

// Standard Document Schema (for existing documents)
const standardDocumentSchema = z.object({
  documentType: z.enum([
    "birth_certificate", "marriage_certificate", "death_certificate",
    "passport", "id_card", "work_permit", "permanent_visa"
  ]),
  fullName: z.string().min(1, "Full name is required"),
  idNumber: z.string().optional(),
  deliveryMethod: z.enum(["collection", "courier", "registered_mail"]),
  collectionPoint: z.string().optional(),
  deliveryAddress: z.object({
    street: z.string(),
    city: z.string(),
    province: z.string(),
    postalCode: z.string(),
  }).optional(),
  urgentProcessing: z.boolean(),
  notificationPreferences: z.object({
    sms: z.boolean(),
    email: z.boolean(),
  }),
});

// ==================== PROGRESS STEPPER COMPONENT ====================

interface ProgressStepperProps {
  steps: {
    id: string;
    title: string;
    description: string;
    status: "pending" | "in_progress" | "completed" | "failed";
    estimatedTime?: string;
  }[];
  currentStep: number;
}

function ProgressStepper({ steps, currentStep }: ProgressStepperProps) {
  return (
    <div className="w-full px-4 py-6">
      <div className="progress-stepper">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`progress-step ${
              step.status === "completed" ? "completed" : 
              step.status === "in_progress" ? "active" : ""
            }`}
            data-testid={`progress-step-${step.id}`}
          >
            <div className="progress-step-indicator">
              {step.status === "completed" ? (
                <CheckCircle className="h-5 w-5" />
              ) : step.status === "failed" ? (
                <XCircle className="h-5 w-5 text-red-600" />
              ) : step.status === "in_progress" ? (
                <RefreshCw className="h-5 w-5 animate-spin" />
              ) : (
                <span>{index + 1}</span>
              )}
            </div>
            <div className="progress-step-label">
              <div className="font-semibold text-xs">{step.title}</div>
              {step.estimatedTime && (
                <div className="text-xs text-muted-foreground mt-1">
                  {step.estimatedTime}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== DHA OFFICE SELECTOR ====================

function DhaOfficeSelector({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
  type DHAOffice = {
    id: string;
    officeName: string;
    province: string;
    city: string;
    hasRefugeeServices: boolean;
    hasDiplomaticServices: boolean;
  };

  const { data: offices, isLoading } = useQuery<DHAOffice[]>({
    queryKey: ["/api/dha-offices"],
  });

  const provinces = [
    "Gauteng", "Western Cape", "KwaZulu-Natal", "Eastern Cape",
    "Free State", "Limpopo", "Mpumalanga", "Northern Cape", "North West"
  ];

  const filteredOffices: DHAOffice[] = offices || [
    { id: "1", officeName: "Pretoria Head Office", province: "Gauteng", city: "Pretoria", hasRefugeeServices: true, hasDiplomaticServices: true },
    { id: "2", officeName: "Cape Town Regional Office", province: "Western Cape", city: "Cape Town", hasRefugeeServices: true, hasDiplomaticServices: false },
    { id: "3", officeName: "Durban Regional Office", province: "KwaZulu-Natal", city: "Durban", hasRefugeeServices: true, hasDiplomaticServices: false },
    { id: "4", officeName: "Johannesburg Regional Office", province: "Gauteng", city: "Johannesburg", hasRefugeeServices: false, hasDiplomaticServices: false },
  ];

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger data-testid="select-dha-office">
        <SelectValue placeholder="Select a DHA office for collection" />
      </SelectTrigger>
      <SelectContent>
        {provinces.map(province => (
          <div key={province}>
            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
              {province}
            </div>
            {filteredOffices
              .filter(office => office.province === province)
              .map(office => (
                <SelectItem key={office.id} value={office.id}>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <span>{office.officeName}</span>
                    {office.hasRefugeeServices && (
                      <Badge variant="outline" className="refugee-badge text-xs">
                        Refugee
                      </Badge>
                    )}
                    {office.hasDiplomaticServices && (
                      <Badge variant="outline" className="diplomatic-badge text-xs">
                        Diplomatic
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
          </div>
        ))}
      </SelectContent>
    </Select>
  );
}

// ==================== MAIN DOCUMENT SERVICES COMPONENT ====================

export default function DocumentServices() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("standard");
  const [showVerificationProgress, setShowVerificationProgress] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [previewPDFData, setPreviewPDFData] = useState<string | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<string | null>(null);
  
  type VerificationStep = {
    id: string;
    title: string;
    description: string;
    status: "pending" | "in_progress" | "completed";
    estimatedTime: string;
  };
  
  const [verificationSteps, setVerificationSteps] = useState<VerificationStep[]>([
    { id: "application_review", title: "Application Review", description: "Reviewing your application", status: "pending", estimatedTime: "15 min" },
    { id: "biometric_capture", title: "Biometric Capture", description: "Capturing biometric data", status: "pending", estimatedTime: "10 min" },
    { id: "document_verification", title: "Document Verification", description: "Verifying supporting documents", status: "pending", estimatedTime: "30 min" },
    { id: "security_clearance", title: "Security Clearance", description: "Security background check", status: "pending", estimatedTime: "2-3 days" },
    { id: "quality_check", title: "Quality Check", description: "Final quality assurance", status: "pending", estimatedTime: "20 min" },
    { id: "approval", title: "Approval", description: "Final approval and processing", status: "pending", estimatedTime: "1 day" },
  ]);

  // Form for Standard Documents
  const standardForm = useForm<z.infer<typeof standardDocumentSchema>>({
    resolver: zodResolver(standardDocumentSchema),
    defaultValues: {
      documentType: "passport",
      urgentProcessing: false,
      deliveryMethod: "collection",
      notificationPreferences: {
        sms: true,
        email: true,
      },
    },
  });

  // Form for Refugee Documents
  const refugeeForm = useForm<z.infer<typeof refugeeDocumentSchema>>({
    resolver: zodResolver(refugeeDocumentSchema),
    defaultValues: {
      documentType: "section22_permit",
      biometricConsent: false,
      deliveryMethod: "collection",
      notificationPreferences: {
        sms: true,
        email: true,
      },
    },
  });

  // Form for Diplomatic Passports
  const diplomaticForm = useForm<z.infer<typeof diplomaticPassportSchema>>({
    resolver: zodResolver(diplomaticPassportSchema),
    defaultValues: {
      sex: "M",
      immunityStatus: "full",
      viennaConventionCompliant: true,
      specialClearanceRequired: false,
      deliveryMethod: "embassy_collection",
      notificationPreferences: {
        sms: false,
        email: true,
        diplomaticChannel: true,
      },
    },
  });

  // PDF Generation Handlers
  const generatePDF = async (documentType: string, formData: any) => {
    setIsGeneratingPDF(true);
    try {
      let result;
      switch (documentType) {
        case "birth_certificate":
          result = await pdfService.generateBirthCertificate({
            personal: {
              fullName: formData.fullName,
              dateOfBirth: formData.dateOfBirth || new Date().toISOString(),
              nationality: "South African",
              idNumber: formData.idNumber,
            },
            certificateNumber: `BC-${Date.now()}`,
            placeOfBirth: "Johannesburg",
            registrationDate: new Date().toISOString(),
          });
          break;
        case "passport":
          result = await pdfService.generatePassport({
            personal: {
              fullName: formData.fullName,
              dateOfBirth: formData.dateOfBirth || new Date().toISOString(),
              nationality: "South African",
              passportNumber: `ZA${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
              idNumber: formData.idNumber,
            },
            passportNumber: `ZA${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
            issueDate: new Date().toISOString(),
            expiryDate: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString(),
          });
          break;
        case "work_permit":
          result = await pdfService.generateWorkPermit({
            personal: {
              fullName: formData.fullName,
              dateOfBirth: formData.dateOfBirth || new Date().toISOString(),
              nationality: formData.nationality || "Foreign National",
              passportNumber: formData.passportNumber,
            },
            permitNumber: `WP-${Date.now()}`,
            permitType: "Section 19(1)",
            employer: {
              name: formData.employerName || "Company Name",
              address: formData.employerAddress || "Address",
            },
            occupation: formData.occupation || "Professional",
            validFrom: new Date().toISOString(),
            validUntil: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000).toISOString(),
          });
          break;
        default:
          result = await pdfService.generateDocument(documentType, formData);
      }

      if (result.success) {
        toast({
          title: "PDF Generated Successfully",
          description: `Your ${documentType.replace(/_/g, " ")} has been downloaded.`,
          className: "bg-green-50 border-green-200",
        });
      } else {
        toast({
          title: "PDF Generation Failed",
          description: result.error || "An error occurred while generating the PDF.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("PDF generation error:", error);
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const previewPDF = async (documentType: string, formData: any) => {
    setIsGeneratingPDF(true);
    try {
      const result = await pdfService.previewDocument(documentType, {
        personal: {
          fullName: formData.fullName,
          dateOfBirth: formData.dateOfBirth || new Date().toISOString(),
          nationality: "South African",
          idNumber: formData.idNumber,
        },
      });

      if (result.success && result.pdfData) {
        setPreviewPDFData(result.pdfData);
        setShowPDFPreview(true);
      } else {
        toast({
          title: "Preview Failed",
          description: result.error || "Could not generate preview.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("PDF preview error:", error);
      toast({
        title: "Error",
        description: "Failed to preview PDF.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Submit handlers
  const submitStandardDocument = useMutation({
    mutationFn: async (data: z.infer<typeof standardDocumentSchema>) => {
      return apiRequest("POST", "/api/documents/standard", data);
    },
    onSuccess: () => {
      toast({
        title: "Application Submitted",
        description: "Your document application has been submitted successfully.",
      });
      setShowVerificationProgress(true);
      simulateVerificationProgress();
    },
  });

  const submitRefugeeDocument = useMutation({
    mutationFn: async (data: z.infer<typeof refugeeDocumentSchema>) => {
      return apiRequest("POST", "/api/documents/refugee", data);
    },
    onSuccess: () => {
      toast({
        title: "Refugee Document Application Submitted",
        description: "Your application has been submitted for processing.",
      });
      setShowVerificationProgress(true);
      simulateVerificationProgress();
    },
  });

  const submitDiplomaticPassport = useMutation({
    mutationFn: async (data: z.infer<typeof diplomaticPassportSchema>) => {
      return apiRequest("POST", "/api/documents/diplomatic", data);
    },
    onSuccess: () => {
      toast({
        title: "Diplomatic Passport Application Submitted",
        description: "Your diplomatic passport application has been submitted.",
      });
      setShowVerificationProgress(true);
      simulateVerificationProgress();
    },
  });

  // Simulate verification progress
  const simulateVerificationProgress = () => {
    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < verificationSteps.length) {
        setVerificationSteps(prev => prev.map((step, index) => {
          if (index === stepIndex) {
            return { ...step, status: "in_progress" };
          } else if (index < stepIndex) {
            return { ...step, status: "completed" };
          }
          return step;
        }));
        
        setTimeout(() => {
          setVerificationSteps(prev => prev.map((step, index) => {
            if (index === stepIndex) {
              return { ...step, status: "completed" };
            }
            return step;
          }));
          stepIndex++;
        }, 2000);
      } else {
        clearInterval(interval);
      }
    }, 3000);
  };

  return (
    <div className="container mx-auto py-8 max-w-7xl">
      {/* Official Government Header */}
      <div className="sa-government-header mb-8 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Shield className="h-8 w-8" />
              Department of Home Affairs - Document Services
            </h1>
            <p className="text-white/90 mt-2">
              Official Document Application and Processing Portal
            </p>
          </div>
          <div className="sa-coat-of-arms" />
        </div>
      </div>

      {/* Government Notice */}
      <Alert className="government-notice mb-6">
        <Info className="h-4 w-4" />
        <AlertTitle>Important Notice</AlertTitle>
        <AlertDescription>
          All applications are subject to verification and security clearance. Processing times may vary.
          Ensure all information provided is accurate and complete to avoid delays.
        </AlertDescription>
      </Alert>

      {/* Verification Progress */}
      {showVerificationProgress && (
        <Card className="government-card mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              Application Verification Progress
            </CardTitle>
            <CardDescription>
              Your application is being processed through our secure verification workflow
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProgressStepper 
              steps={verificationSteps} 
              currentStep={verificationSteps.findIndex(s => s.status === "in_progress")}
            />
            <div className="mt-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Estimated Total Time: 3-5 business days</span>
                </div>
                <Badge variant="outline" className="dha-badge">
                  Application ID: DHA-2024-{Math.random().toString(36).substr(2, 9).toUpperCase()}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="standard" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Standard Documents
          </TabsTrigger>
          <TabsTrigger value="refugee" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Refugee & Asylum
          </TabsTrigger>
          <TabsTrigger value="diplomatic" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Diplomatic Services
          </TabsTrigger>
        </TabsList>

        {/* Standard Documents Tab */}
        <TabsContent value="standard">
          <Card className="government-card">
            <CardHeader className="bg-gradient-to-r from-green-50 to-yellow-50 border-b">
              <CardTitle>Standard Document Application</CardTitle>
              <CardDescription>
                Apply for birth certificates, passports, ID cards, and other standard documents
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Form {...standardForm}>
                <form onSubmit={standardForm.handleSubmit((data) => submitStandardDocument.mutate(data))} className="space-y-6">
                  <div className="form-section">
                    <h3 className="form-section-title">Document Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={standardForm.control}
                        name="documentType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Document Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-document-type">
                                  <SelectValue placeholder="Select document type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="birth_certificate">Birth Certificate</SelectItem>
                                <SelectItem value="marriage_certificate">Marriage Certificate</SelectItem>
                                <SelectItem value="death_certificate">Death Certificate</SelectItem>
                                <SelectItem value="passport">Passport</SelectItem>
                                <SelectItem value="id_card">ID Card</SelectItem>
                                <SelectItem value="work_permit">Work Permit</SelectItem>
                                <SelectItem value="permanent_visa">Permanent Visa</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={standardForm.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter your full name" data-testid="input-full-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={standardForm.control}
                        name="idNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>ID Number (Optional)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter your ID number" data-testid="input-id-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={standardForm.control}
                        name="urgentProcessing"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-urgent"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                Urgent Processing (Additional fees apply)
                              </FormLabel>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="form-section">
                    <h3 className="form-section-title">Delivery Options</h3>
                    <div className="space-y-4">
                      <FormField
                        control={standardForm.control}
                        name="deliveryMethod"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Delivery Method</FormLabel>
                            <FormControl>
                              <RadioGroup
                                onValueChange={field.onChange}
                                defaultValue={field.value}
                                className="flex flex-col space-y-2"
                              >
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="collection" id="collection" />
                                  <Label htmlFor="collection" className="flex items-center gap-2 cursor-pointer">
                                    <Building2 className="h-4 w-4" />
                                    Collection at DHA Office
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="courier" id="courier" />
                                  <Label htmlFor="courier" className="flex items-center gap-2 cursor-pointer">
                                    <Truck className="h-4 w-4" />
                                    Courier Delivery (R150)
                                  </Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <RadioGroupItem value="registered_mail" id="registered_mail" />
                                  <Label htmlFor="registered_mail" className="flex items-center gap-2 cursor-pointer">
                                    <Mail className="h-4 w-4" />
                                    Registered Mail (R75)
                                  </Label>
                                </div>
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {standardForm.watch("deliveryMethod") === "collection" && (
                        <FormField
                          control={standardForm.control}
                          name="collectionPoint"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Collection Point</FormLabel>
                              <FormControl>
                                <DhaOfficeSelector value={field.value} onChange={field.onChange} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="government-button-secondary"
                        onClick={() => {
                          const formData = standardForm.getValues();
                          previewPDF(formData.documentType, formData);
                        }}
                        disabled={isGeneratingPDF}
                        data-testid="button-preview-pdf"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview PDF
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="government-button-secondary"
                        onClick={() => {
                          const formData = standardForm.getValues();
                          generatePDF(formData.documentType, formData);
                        }}
                        disabled={isGeneratingPDF}
                        data-testid="button-generate-pdf"
                      >
                        {isGeneratingPDF ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Printer className="h-4 w-4 mr-2" />
                            Generate PDF
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="flex gap-4">
                      <Button type="button" variant="outline" className="government-button-secondary">
                        <Save className="h-4 w-4 mr-2" />
                        Save Draft
                      </Button>
                      <Button type="submit" className="government-button" disabled={submitStandardDocument.isPending}>
                        {submitStandardDocument.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Submit Application
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Refugee & Asylum Tab */}
        <TabsContent value="refugee">
          <Card className="government-card">
            <CardHeader className="refugee-header">
              <CardTitle className="text-white">Refugee & Asylum Seeker Documents</CardTitle>
              <CardDescription className="text-white/90">
                Apply for Section 22 permits, asylum permits, refugee IDs, and travel documents
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Alert className="mb-6 border-orange-200 bg-orange-50">
                <Users className="h-4 w-4 text-orange-600" />
                <AlertTitle>UNHCR Integration</AlertTitle>
                <AlertDescription>
                  This service is integrated with UNHCR systems. Your UNHCR reference number will be verified automatically.
                </AlertDescription>
              </Alert>

              <Form {...refugeeForm}>
                <form onSubmit={refugeeForm.handleSubmit((data) => submitRefugeeDocument.mutate(data))} className="space-y-6">
                  <div className="form-section">
                    <h3 className="form-section-title">Refugee Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={refugeeForm.control}
                        name="documentType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Document Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-refugee-document">
                                  <SelectValue placeholder="Select document type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="section22_permit">
                                  <div className="flex items-center gap-2">
                                    <Badge className="refugee-badge">Section 22</Badge>
                                    Refugee Status Permit
                                  </div>
                                </SelectItem>
                                <SelectItem value="asylum_permit">
                                  <div className="flex items-center gap-2">
                                    <Badge className="refugee-badge">Asylum</Badge>
                                    Asylum Seeker Temporary Permit
                                  </div>
                                </SelectItem>
                                <SelectItem value="refugee_id">
                                  <div className="flex items-center gap-2">
                                    <Badge className="refugee-badge">ID</Badge>
                                    Refugee Identity Document
                                  </div>
                                </SelectItem>
                                <SelectItem value="refugee_travel">
                                  <div className="flex items-center gap-2">
                                    <Badge className="refugee-badge">Travel</Badge>
                                    Refugee Travel Document (Maroon Passport)
                                  </div>
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={refugeeForm.control}
                        name="unhcrNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>UNHCR Reference Number</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter UNHCR number" data-testid="input-unhcr-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={refugeeForm.control}
                        name="countryOfOrigin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country of Origin</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter country of origin" data-testid="input-country-origin" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={refugeeForm.control}
                        name="dateOfEntry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Date of Entry to South Africa</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" data-testid="input-date-entry" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={refugeeForm.control}
                        name="campLocation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Camp/Reception Location (if applicable)</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter camp location" data-testid="input-camp-location" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={refugeeForm.control}
                        name="biometricConsent"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-biometric-consent"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                I consent to biometric data collection
                              </FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Required for identity verification and security clearance
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="government-button-secondary"
                        onClick={() => {
                          const formData = refugeeForm.getValues();
                          const documentType = formData.documentType === "section22_permit" ? "refugee_permit" : 
                                             formData.documentType === "asylum_permit" ? "asylum_visa" : 
                                             formData.documentType;
                          generatePDF(documentType, formData);
                        }}
                        disabled={isGeneratingPDF}
                        data-testid="button-generate-refugee-pdf"
                      >
                        {isGeneratingPDF ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Printer className="h-4 w-4 mr-2" />
                            Generate Document
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="flex gap-4">
                      <Button type="submit" className="government-button" disabled={submitRefugeeDocument.isPending}>
                        {submitRefugeeDocument.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Submit Application
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Diplomatic Services Tab */}
        <TabsContent value="diplomatic">
          <Card className="government-card">
            <CardHeader className="diplomatic-header">
              <CardTitle className="text-white">Diplomatic Passport Services</CardTitle>
              <CardDescription className="text-white/90">
                Apply for diplomatic passports with special clearance and Vienna Convention compliance
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Alert className="mb-6 border-purple-200 bg-purple-50">
                <ShieldCheck className="h-4 w-4 text-purple-600" />
                <AlertTitle>Diplomatic Clearance Required</AlertTitle>
                <AlertDescription>
                  All diplomatic passport applications require embassy verification and special security clearance.
                  Processing may take 5-10 business days.
                </AlertDescription>
              </Alert>

              <Form {...diplomaticForm}>
                <form onSubmit={diplomaticForm.handleSubmit((data) => submitDiplomaticPassport.mutate(data))} className="space-y-6">
                  <div className="form-section">
                    <h3 className="form-section-title">Diplomatic Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={diplomaticForm.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Full Name</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter full name" data-testid="input-diplomatic-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={diplomaticForm.control}
                        name="diplomaticNoteNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Diplomatic Note Number</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter diplomatic note number" data-testid="input-note-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={diplomaticForm.control}
                        name="embassy"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Embassy</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter embassy name" data-testid="input-embassy" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={diplomaticForm.control}
                        name="diplomaticRank"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Diplomatic Rank</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-diplomatic-rank">
                                  <SelectValue placeholder="Select diplomatic rank" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="ambassador">Ambassador</SelectItem>
                                <SelectItem value="consul_general">Consul General</SelectItem>
                                <SelectItem value="consul">Consul</SelectItem>
                                <SelectItem value="first_secretary">First Secretary</SelectItem>
                                <SelectItem value="second_secretary">Second Secretary</SelectItem>
                                <SelectItem value="third_secretary">Third Secretary</SelectItem>
                                <SelectItem value="attache">Attaché</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={diplomaticForm.control}
                        name="immunityStatus"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Diplomatic Immunity Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-immunity-status">
                                  <SelectValue placeholder="Select immunity status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="full">Full Immunity</SelectItem>
                                <SelectItem value="partial">Partial Immunity</SelectItem>
                                <SelectItem value="none">No Immunity</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={diplomaticForm.control}
                        name="countryOfAccreditation"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Country of Accreditation</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Enter country" data-testid="input-accreditation" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="mt-4 space-y-4">
                      <FormField
                        control={diplomaticForm.control}
                        name="viennaConventionCompliant"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-vienna"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                Vienna Convention Compliant
                              </FormLabel>
                              <p className="text-xs text-muted-foreground">
                                I confirm compliance with Vienna Convention on Diplomatic Relations
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={diplomaticForm.control}
                        name="specialClearanceRequired"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                data-testid="checkbox-clearance"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>
                                Special Security Clearance Required
                              </FormLabel>
                              <p className="text-xs text-muted-foreground">
                                Additional security vetting will be conducted
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="form-section">
                    <h3 className="form-section-title">Delivery Options</h3>
                    <FormField
                      control={diplomaticForm.control}
                      name="deliveryMethod"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Secure Delivery Method</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex flex-col space-y-2"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="diplomatic_pouch" id="diplomatic_pouch" />
                                <Label htmlFor="diplomatic_pouch" className="flex items-center gap-2 cursor-pointer">
                                  <Lock className="h-4 w-4" />
                                  Diplomatic Pouch (Most Secure)
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="embassy_collection" id="embassy_collection" />
                                <Label htmlFor="embassy_collection" className="flex items-center gap-2 cursor-pointer">
                                  <Building className="h-4 w-4" />
                                  Embassy Collection
                                </Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="secure_courier" id="secure_courier" />
                                <Label htmlFor="secure_courier" className="flex items-center gap-2 cursor-pointer">
                                  <ShieldCheck className="h-4 w-4" />
                                  Secure Courier Service
                                </Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-between">
                    <div className="flex gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="government-button-secondary"
                        onClick={() => {
                          const formData = diplomaticForm.getValues();
                          generatePDF("diplomatic_passport", formData);
                        }}
                        disabled={isGeneratingPDF}
                        data-testid="button-generate-diplomatic-pdf"
                      >
                        {isGeneratingPDF ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Printer className="h-4 w-4 mr-2" />
                            Generate Diplomatic Passport
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="flex gap-4">
                      <Button type="submit" className="government-button" disabled={submitDiplomaticPassport.isPending}>
                        {submitDiplomaticPassport.isPending ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4 mr-2" />
                            Submit Diplomatic Application
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* PDF Preview Dialog */}
      <Dialog open={showPDFPreview} onOpenChange={setShowPDFPreview}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>Document Preview</DialogTitle>
            <DialogDescription>
              Review your document before downloading
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-auto">
            {previewPDFData && (
              <iframe
                src={`data:application/pdf;base64,${previewPDFData}`}
                className="w-full h-full min-h-[60vh]"
                title="PDF Preview"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPDFPreview(false)}>
              Close
            </Button>
            <Button 
              onClick={() => {
                if (selectedDocumentType) {
                  const formData = activeTab === "standard" ? standardForm.getValues() :
                                  activeTab === "refugee" ? refugeeForm.getValues() :
                                  diplomaticForm.getValues();
                  generatePDF(selectedDocumentType, formData);
                  setShowPDFPreview(false);
                }
              }}
              className="government-button"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print Queue Status */}
      <Card className="government-card mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Document Print Queue Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="print-queue">
            <div className="print-queue-header">
              Active Print Jobs
            </div>
            <div className="print-queue-item">
              <div className="flex items-center gap-3">
                <Badge className="doc-status doc-status-processing">Printing</Badge>
                <span className="font-medium">Passport - John Doe</span>
                <span className="text-sm text-muted-foreground">Queue Position: 1</span>
              </div>
              <span className="text-sm">Est. 5 min</span>
            </div>
            <div className="print-queue-item">
              <div className="flex items-center gap-3">
                <Badge className="doc-status doc-status-pending">Queued</Badge>
                <span className="font-medium">ID Card - Jane Smith</span>
                <span className="text-sm text-muted-foreground">Queue Position: 2</span>
              </div>
              <span className="text-sm">Est. 15 min</span>
            </div>
            <div className="print-queue-item">
              <div className="flex items-center gap-3">
                <Badge className="doc-status doc-status-pending">Queued</Badge>
                <span className="font-medium">Birth Certificate - Baby Johnson</span>
                <span className="text-sm text-muted-foreground">Queue Position: 3</span>
              </div>
              <span className="text-sm">Est. 25 min</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Government Disclaimer */}
      <div className="government-disclaimer mt-8">
        <p>
          © {new Date().getFullYear()} Department of Home Affairs, Republic of South Africa. 
          All rights reserved. This is an official government service portal.
        </p>
      </div>
    </div>
  );
}
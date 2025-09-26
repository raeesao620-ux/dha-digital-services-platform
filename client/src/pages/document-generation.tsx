/**
 * UNIFIED DHA DOCUMENT GENERATION INTERFACE
 * Comprehensive interface for all 21 South African DHA document types
 * with dynamic forms, preview mode, and exact design specifications
 */

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  FileText, Download, Eye, Shield, CheckCircle, QrCode, Calendar, User, Hash,
  Baby, Heart, Plane, Skull, Briefcase, CreditCard, UserCheck, Search,
  Building2, Scan, Clock, AlertTriangle, FileCheck, Camera, Upload,
  Users, Globe, Lock, ShieldCheck, Fingerprint, Award, Stamp,
  BookOpen, MapPin, Phone, Mail, Home, Star, Plus, Minus, Info,
  ExternalLink, Zap, Target, Settings, HelpCircle
} from "lucide-react";

// Import unified schemas from shared
import {
  documentGenerationRequestSchema,
  documentTypeSchemas,
  type DocumentGenerationRequest,
  type SmartIdCardData,
  type IdentityDocumentBookData,
  type TemporaryIdCertificateData,
  type SouthAfricanPassportData,
  type EmergencyTravelCertificateData,
  type RefugeeTravelDocumentData,
  type BirthCertificateData,
  type DeathCertificateData,
  type MarriageCertificateData,
  type DivorceCertificateData,
  type GeneralWorkVisaData,
  type CriticalSkillsWorkVisaData,
  type IntraCompanyTransferWorkVisaData,
  type BusinessVisaData,
  type StudyVisaPermitData,
  type VisitorVisaData,
  type MedicalTreatmentVisaData,
  type RetiredPersonVisaData,
  type ExchangeVisaData,
  type RelativesVisaData,
  type PermanentResidencePermitData,
  type CertificateOfExemptionData,
  type CertificateOfSouthAfricanCitizenshipData
} from "../../../shared/schema";

// Document type definitions
interface DocumentTypeInfo {
  type: string;
  displayName: string;
  description: string;
  category: string;
  formNumber: string;
  icon: React.ComponentType<any>;
  color: string;
  isImplemented: boolean;
}

// Icon mapping for document types from API
const ICON_MAP: Record<string, React.ComponentType<any>> = {
  CreditCard,
  BookOpen,
  FileCheck,
  Plane,
  AlertTriangle,
  Globe,
  Baby,
  Skull,
  Heart,
  Users,
  Briefcase,
  Star,
  Building2,
  Target,
  Camera,
  User,
  Home,
  Award,
  ShieldCheck
};

// Category icon mapping from API
const CATEGORY_ICON_MAP: Record<string, React.ComponentType<any>> = {
  UserCheck,
  Plane,
  FileText,
  Globe,
  Award
};

interface GenerationResult {
  success: boolean;
  documentId?: string;
  documentUrl?: string;
  verificationCode?: string;
  message?: string;
  error?: string;
  metadata?: any;
  securityFeatures?: any;
}

interface DocumentTemplate {
  id: string;
  type: string;
  name: string;
  displayName: string;
  description: string;
  category: string;
  formNumber: string;
  icon: string;
  color: string;
  isImplemented: boolean;
  requirements: string[];
  securityFeatures: string[];
  processingTime: string;
  fees: string;
}

interface TemplatesResponse {
  success: boolean;
  totalTemplates: number;
  templates: DocumentTemplate[];
  categories: Record<string, {
    name: string;
    icon: string;
    color: string;
    count: number;
  }>;
  timestamp: string;
  message: string;
}

export default function UnifiedDocumentGenerationPage() {
  const { toast } = useToast();

  // Fetch document templates from API
  const {
    data: templatesData,
    isLoading: isLoadingTemplates,
    error: templatesError
  } = useQuery<TemplatesResponse>({
    queryKey: ['/api/documents/templates'],
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // State management
  const [selectedDocumentType, setSelectedDocumentType] = useState<string | undefined>(undefined);
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [isPreviewMode, setIsPreviewMode] = useState(true);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  // Dynamic form state
  const [formData, setFormData] = useState<any>({});

  // Helper functions to work with fetched data
  const getDocumentTemplates = () => templatesData?.templates || [];
  const getCategories = () => templatesData?.categories || {};

  // Don't render the page until data is loaded to prevent SelectItem errors
  if (isLoadingTemplates) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading document templates...</p>
        </div>
      </div>
    );
  }
  const getDocumentsByCategory = (category: string) => {
    return getDocumentTemplates().filter(doc => doc.category === category);
  };
  const getSelectedDocInfo = () => {
    return getDocumentTemplates().find(doc => doc.type === selectedDocumentType) || null;
  };
  const getIconComponent = (iconName: string) => ICON_MAP[iconName] || FileText;
  const getCategoryIconComponent = (iconName: string) => CATEGORY_ICON_MAP[iconName] || FileText;

  // Document generation mutation
  const generateDocumentMutation = useMutation({
    mutationFn: async ({ documentData, preview }: { documentData: any; preview: boolean }) => {
      const response = await apiRequest(
        'POST',
        `/api/documents/generate${preview ? '?preview=true' : ''}`,
        documentData
      );
      return response.json();
    },
    onSuccess: (result: any) => {
      setGenerationResult(result);
      if (result.success) {
        toast({
          title: "Document Generated",
          description: result.message || "Document generated successfully",
          className: "border-green-500 bg-green-50"
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate document",
        variant: "destructive"
      });
    }
  });

  // OCR extraction mutation for passport auto-fill
  const extractPassportDataMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('passportImage', file);
      formData.append('targetFormType', 'unified_document');
      formData.append('enableAutoFill', 'true');

      const response = await fetch('/api/ai/passport/extract', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to extract passport data');
      }

      return response.json();
    },
    onSuccess: (result) => {
      if (result.success) {
        setExtractedData(result);
        autoFillFormFromOCR(result.autoFillData);
        toast({
          title: "Extraction Successful",
          description: `Data extracted with ${result.ocrConfidence}% confidence`,
          className: "border-green-500 bg-green-50"
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Extraction Failed",
        description: error.message || "Failed to extract passport data",
        variant: "destructive"
      });
    }
  });

  // Auto-fill form from OCR data
  const autoFillFormFromOCR = (ocrData: any) => {
    if (!ocrData) return;

    const updatedFormData = { ...formData };

    // Map OCR data to form fields based on document type
    if (ocrData.fullName) {
      updatedFormData.fullName = ocrData.fullName;
      updatedFormData.childFullName = ocrData.fullName;
      updatedFormData.holderFullName = ocrData.fullName;
    }

    if (ocrData.dateOfBirth) {
      updatedFormData.dateOfBirth = ocrData.dateOfBirth;
    }

    if (ocrData.nationality) {
      updatedFormData.nationality = ocrData.nationality;
      updatedFormData.holderNationality = ocrData.nationality;
    }

    if (ocrData.passportNumber) {
      updatedFormData.passportNumber = ocrData.passportNumber;
      updatedFormData.holderPassportNumber = ocrData.passportNumber;
    }

    setFormData(updatedFormData);
  };

  // Handle passport file upload
  const handlePassportUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File",
          description: "Please upload an image file (JPEG, PNG)",
          variant: "destructive"
        });
        return;
      }
      setPassportFile(file);
      extractPassportDataMutation.mutate(file);
    }
  };

  // Generate document
  const handleGenerateDocument = async (downloadMode = false) => {
    if (!selectedDocumentType) {
      toast({
        title: "No Document Type Selected",
        description: "Please select a document type first",
        variant: "destructive"
      });
      return;
    }

    try {
      const documentData: DocumentGenerationRequest = {
        documentType: selectedDocumentType as any,
        ...formData
      };

      // Validate the data using the appropriate schema
      const schema = documentTypeSchemas[selectedDocumentType as keyof typeof documentTypeSchemas];
      if (schema) {
        const validation = schema.safeParse(documentData);
        if (!validation.success) {
          toast({
            title: "Form Validation Error",
            description: "Please fill in all required fields correctly",
            variant: "destructive"
          });
          console.error("Validation errors:", validation.error.errors);
          return;
        }
      }

      // Generate document
      if (downloadMode) {
        // Direct download
        const response = await fetch('/api/documents/generate?download=true', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(documentData)
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `${selectedDocumentType}_${Date.now()}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        } else {
          throw new Error('Download failed');
        }
      } else {
        // Generate with metadata
        await generateDocumentMutation.mutateAsync({
          documentData,
          preview: isPreviewMode
        });
      }

    } catch (error: any) {
      toast({
        title: "Generation Error",
        description: error.message || "Failed to generate document",
        variant: "destructive"
      });
    }
  };

  // Update form data
  const updateFormField = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  // Get currently selected document info using helper function
  const selectedDocInfo = getSelectedDocInfo();

  // Handle loading state for templates
  if (isLoadingTemplates) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Loading Document Templates
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Fetching all 23 DHA document types...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Handle error state for templates
  if (templatesError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Failed to Load Document Templates
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Unable to fetch document types from the server.
              </p>
              <Button
                onClick={() => window.location.reload()}
                className="bg-green-600 hover:bg-green-700"
                data-testid="button-reload-templates"
              >
                Retry Loading
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <ShieldCheck className="h-8 w-8 text-green-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                DHA Document Generation System
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Generate all {templatesData?.totalTemplates || 23} official South African DHA documents with security features
              </p>
            </div>
          </div>

          {/* Statistics Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {Object.entries(getCategories()).filter(([key, category]) => key && key !== "" && key.trim() !== "" && category?.name).map(([key, category]) => {
              const count = getDocumentsByCategory(key).length;
              const implemented = getDocumentsByCategory(key).filter(d => d.isImplemented).length;
              const IconComponent = getCategoryIconComponent(category.icon);
              return (
                <Card key={key} className="p-4">
                  <div className="flex items-center gap-3">
                    <IconComponent className={`h-5 w-5 ${category.color}`} />
                    <div>
                      <p className="text-sm font-medium">{category.name}</p>
                      <p className="text-xs text-gray-500">{implemented}/{count} implemented</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Document Type Selector */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Document Type Selection
                </CardTitle>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Badge variant={isPreviewMode ? "default" : "secondary"}>
                    {isPreviewMode ? "Preview Mode" : "Production Mode"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsPreviewMode(!isPreviewMode)}
                    className="h-6 px-2"
                  >
                    {isPreviewMode ? <Eye className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  {/* Category Filter */}
                  <div className="mb-4">
                    <Label className="text-xs font-medium">Filter by Category</Label>
                    <Select value={selectedCategory} onValueChange={(v) => setSelectedCategory(v || undefined)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="All categories" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All categories</SelectItem>
                        {Object.entries(getCategories()).filter(([key, category]) => key && key !== "" && key.trim() !== "" && category?.name).map(([key, category]) => (
                          <SelectItem key={key} value={key}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Document Type Grid */}
                  <div className="space-y-2">
                    {getDocumentTemplates()
                      .filter(doc => !selectedCategory || selectedCategory === "all" || doc.category === selectedCategory)
                      .map((docInfo) => {
                        const IconComponent = getIconComponent(docInfo.icon);
                        const isSelected = selectedDocumentType === docInfo.type;

                        return (
                          <Card
                            key={docInfo.type}
                            className={`p-3 cursor-pointer transition-all hover:shadow-md ${
                              isSelected
                                ? 'ring-2 ring-green-500 bg-green-50 dark:bg-green-900/20'
                                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                            onClick={() => {
                              setSelectedDocumentType(docInfo.type);
                              setGenerationResult(null);
                              setFormData({});
                            }}
                            data-testid={`select-document-${docInfo.type}`}
                          >
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${docInfo.color} bg-opacity-20`}>
                                <IconComponent className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-sm font-medium truncate">
                                    {docInfo.displayName}
                                  </h4>
                                  {docInfo.isImplemented ? (
                                    <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                                  ) : (
                                    <Clock className="h-3 w-3 text-orange-500 flex-shrink-0" />
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mb-1">{docInfo.formNumber}</p>
                                <p className="text-xs text-gray-400 line-clamp-2">
                                  {docInfo.description}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-1">
                                  <Badge variant="outline" className="text-xs">
                                    {docInfo.fees}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    {docInfo.processingTime}
                                  </Badge>
                                </div>
                              </div>
                            </div>
                          </Card>
                        );
                      })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Right Panel - Dynamic Form and Results */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="form" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="form">Document Form</TabsTrigger>
                <TabsTrigger value="ocr">OCR Auto-Fill</TabsTrigger>
                <TabsTrigger value="result">Generation Result</TabsTrigger>
              </TabsList>

              {/* Document Form Tab */}
              <TabsContent value="form">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {selectedDocInfo && (() => {
                        const IconComponent = getIconComponent(selectedDocInfo.icon);
                        return <IconComponent className="h-5 w-5" />;
                      })()}
                      {selectedDocInfo ? selectedDocInfo.displayName : "Select Document Type"}
                    </CardTitle>
                    {selectedDocInfo && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Badge variant="outline">{selectedDocInfo.formNumber}</Badge>
                          <Badge variant="outline">{getCategories()[selectedDocInfo.category]?.name || selectedDocInfo.category}</Badge>
                          <Badge variant={selectedDocInfo.isImplemented ? "default" : "secondary"}>
                            {selectedDocInfo.isImplemented ? "Available" : "Coming Soon"}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">{selectedDocInfo.description}</p>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {selectedDocumentType ? (
                      <DynamicDocumentForm
                        documentType={selectedDocumentType}
                        formData={formData}
                        onUpdateField={updateFormField}
                        isImplemented={selectedDocInfo?.isImplemented || false}
                      />
                    ) : (
                      <div className="text-center py-12">
                        <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">Select a document type to begin</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* OCR Auto-Fill Tab */}
              <TabsContent value="ocr">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Scan className="h-5 w-5" />
                      Passport OCR Auto-Fill
                    </CardTitle>
                    <p className="text-sm text-gray-600">
                      Upload a passport image to automatically extract and fill form data
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                        <div className="text-center">
                          <Upload className="mx-auto h-12 w-12 text-gray-400" />
                          <div className="mt-4">
                            <Label htmlFor="passport-upload" className="cursor-pointer">
                              <span className="mt-2 block text-sm font-medium text-gray-900">
                                Upload passport image
                              </span>
                              <span className="mt-1 block text-sm text-gray-500">
                                PNG, JPG up to 10MB
                              </span>
                            </Label>
                            <Input
                              id="passport-upload"
                              type="file"
                              className="sr-only"
                              accept="image/*"
                              onChange={handlePassportUpload}
                              disabled={extractPassportDataMutation.isPending}
                            />
                          </div>
                        </div>
                      </div>

                      {extractPassportDataMutation.isPending && (
                        <div className="text-center py-4">
                          <div className="inline-flex items-center gap-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
                            <span className="text-sm text-gray-600">Extracting data...</span>
                          </div>
                        </div>
                      )}

                      {extractedData && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                          <h4 className="font-medium text-green-900 mb-2">Extracted Data</h4>
                          <div className="text-sm text-green-800 space-y-1">
                            <p><strong>Name:</strong> {extractedData.autoFillData?.fullName || 'N/A'}</p>
                            <p><strong>Date of Birth:</strong> {extractedData.autoFillData?.dateOfBirth || 'N/A'}</p>
                            <p><strong>Nationality:</strong> {extractedData.autoFillData?.nationality || 'N/A'}</p>
                            <p><strong>Passport Number:</strong> {extractedData.autoFillData?.passportNumber || 'N/A'}</p>
                            <p><strong>Confidence:</strong> {extractedData.ocrConfidence}%</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Generation Result Tab */}
              <TabsContent value="result">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileCheck className="h-5 w-5" />
                      Document Generation Result
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {generationResult ? (
                      <GenerationResultDisplay result={generationResult} />
                    ) : (
                      <div className="text-center py-12">
                        <FileCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500">No document generated yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Action Buttons */}
            {selectedDocumentType && (
              <Card className="mt-4">
                <CardContent className="pt-6">
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleGenerateDocument(false)}
                      disabled={generateDocumentMutation.isPending || !selectedDocInfo?.isImplemented}
                      className="flex-1"
                      data-testid="button-generate"
                    >
                      {generateDocumentMutation.isPending ? (
                        <div className="flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          Generating...
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {isPreviewMode ? 'Generate Preview' : 'Generate Document'}
                        </div>
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => handleGenerateDocument(true)}
                      disabled={generateDocumentMutation.isPending || !selectedDocInfo?.isImplemented}
                      data-testid="button-download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => setIsPreviewMode(!isPreviewMode)}
                      data-testid="button-toggle-preview"
                    >
                      {isPreviewMode ? <Lock className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>

                  {!selectedDocInfo?.isImplemented && (
                    <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="flex items-center gap-2 text-orange-800">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm font-medium">Coming Soon</span>
                      </div>
                      <p className="text-sm text-orange-700 mt-1">
                        This document type is not yet implemented. It will be available in a future update.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Dynamic Document Form Component
 * Renders different form fields based on selected document type
 */
interface DynamicDocumentFormProps {
  documentType: string;
  formData: any;
  onUpdateField: (field: string, value: any) => void;
  isImplemented: boolean;
}

function DynamicDocumentForm({ documentType, formData, onUpdateField, isImplemented }: DynamicDocumentFormProps) {
  if (!isImplemented) {
    return (
      <div className="text-center py-8">
        <Clock className="h-8 w-8 text-orange-500 mx-auto mb-3" />
        <p className="text-gray-600">Form fields for this document type will be available soon</p>
      </div>
    );
  }

  // Common personal information fields
  const renderPersonalFields = () => (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900 border-b pb-2">Personal Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="fullName">Full Name *</Label>
          <Input
            id="fullName"
            value={formData.fullName || ''}
            onChange={(e) => onUpdateField('fullName', e.target.value)}
            placeholder="Enter full name"
            data-testid="input-fullName"
          />
        </div>
        <div>
          <Label htmlFor="dateOfBirth">Date of Birth *</Label>
          <Input
            id="dateOfBirth"
            type="date"
            value={formData.dateOfBirth || ''}
            onChange={(e) => onUpdateField('dateOfBirth', e.target.value)}
            data-testid="input-dateOfBirth"
          />
        </div>
        <div>
          <Label htmlFor="placeOfBirth">Place of Birth</Label>
          <Input
            id="placeOfBirth"
            value={formData.placeOfBirth || ''}
            onChange={(e) => onUpdateField('placeOfBirth', e.target.value)}
            placeholder="Enter place of birth"
            data-testid="input-placeOfBirth"
          />
        </div>
        <div>
          <Label htmlFor="nationality">Nationality *</Label>
          <Input
            id="nationality"
            value={formData.nationality || ''}
            onChange={(e) => onUpdateField('nationality', e.target.value)}
            placeholder="Enter nationality"
            data-testid="input-nationality"
          />
        </div>
      </div>
    </div>
  );

  // Render specific form fields based on document type
  switch (documentType) {
    case 'smart_id_card':
    case 'identity_document_book':
      return (
        <div className="space-y-6">
          {renderPersonalFields()}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Identity Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="idNumber">ID Number *</Label>
                <Input
                  id="idNumber"
                  value={formData.idNumber || ''}
                  onChange={(e) => onUpdateField('idNumber', e.target.value)}
                  placeholder="13-digit ID number"
                  maxLength={13}
                  data-testid="input-idNumber"
                />
              </div>
              <div>
                <Label htmlFor="issuingOffice">Issuing Office</Label>
                <Input
                  id="issuingOffice"
                  value={formData.issuingOffice || ''}
                  onChange={(e) => onUpdateField('issuingOffice', e.target.value)}
                  placeholder="e.g., Cape Town Home Affairs"
                  data-testid="input-issuingOffice"
                />
              </div>
            </div>
          </div>
        </div>
      );

    case 'south_african_passport':
      return (
        <div className="space-y-6">
          {renderPersonalFields()}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Passport Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="passportNumber">Passport Number *</Label>
                <Input
                  id="passportNumber"
                  value={formData.passportNumber || ''}
                  onChange={(e) => onUpdateField('passportNumber', e.target.value)}
                  placeholder="Enter passport number"
                  data-testid="input-passportNumber"
                />
              </div>
              <div>
                <Label htmlFor="passportType">Passport Type</Label>
                <Select value={formData.passportType || undefined} onValueChange={(value) => onUpdateField('passportType', value)}>
                  <SelectTrigger data-testid="select-passportType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ordinary">Ordinary</SelectItem>
                    <SelectItem value="diplomatic">Diplomatic</SelectItem>
                    <SelectItem value="official">Official</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dateOfIssue">Date of Issue *</Label>
                <Input
                  id="dateOfIssue"
                  type="date"
                  value={formData.dateOfIssue || ''}
                  onChange={(e) => onUpdateField('dateOfIssue', e.target.value)}
                  data-testid="input-dateOfIssue"
                />
              </div>
              <div>
                <Label htmlFor="dateOfExpiry">Date of Expiry *</Label>
                <Input
                  id="dateOfExpiry"
                  type="date"
                  value={formData.dateOfExpiry || ''}
                  onChange={(e) => onUpdateField('dateOfExpiry', e.target.value)}
                  data-testid="input-dateOfExpiry"
                />
              </div>
              <div>
                <Label htmlFor="placeOfIssue">Place of Issue</Label>
                <Input
                  id="placeOfIssue"
                  value={formData.placeOfIssue || ''}
                  onChange={(e) => onUpdateField('placeOfIssue', e.target.value)}
                  placeholder="e.g., Cape Town"
                  data-testid="input-placeOfIssue"
                />
              </div>
            </div>
          </div>
        </div>
      );

    case 'birth_certificate':
      return (
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Child Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="childFullName">Child's Full Name *</Label>
                <Input
                  id="childFullName"
                  value={formData.childFullName || ''}
                  onChange={(e) => onUpdateField('childFullName', e.target.value)}
                  placeholder="Enter child's full name"
                  data-testid="input-childFullName"
                />
              </div>
              <div>
                <Label htmlFor="sex">Sex *</Label>
                <Select value={formData.sex || undefined} onValueChange={(value) => onUpdateField('sex', value)}>
                  <SelectTrigger data-testid="select-sex">
                    <SelectValue placeholder="Select sex" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={formData.dateOfBirth || ''}
                  onChange={(e) => onUpdateField('dateOfBirth', e.target.value)}
                  data-testid="input-dateOfBirth"
                />
              </div>
              <div>
                <Label htmlFor="placeOfBirth">Place of Birth *</Label>
                <Input
                  id="placeOfBirth"
                  value={formData.placeOfBirth || ''}
                  onChange={(e) => onUpdateField('placeOfBirth', e.target.value)}
                  placeholder="Enter place of birth"
                  data-testid="input-placeOfBirth"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Parents Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="motherFullName">Mother's Full Name *</Label>
                <Input
                  id="motherFullName"
                  value={formData.motherFullName || ''}
                  onChange={(e) => onUpdateField('motherFullName', e.target.value)}
                  placeholder="Enter mother's full name"
                  data-testid="input-motherFullName"
                />
              </div>
              <div>
                <Label htmlFor="motherNationality">Mother's Nationality</Label>
                <Input
                  id="motherNationality"
                  value={formData.motherNationality || ''}
                  onChange={(e) => onUpdateField('motherNationality', e.target.value)}
                  placeholder="Enter mother's nationality"
                  data-testid="input-motherNationality"
                />
              </div>
              <div>
                <Label htmlFor="fatherFullName">Father's Full Name *</Label>
                <Input
                  id="fatherFullName"
                  value={formData.fatherFullName || ''}
                  onChange={(e) => onUpdateField('fatherFullName', e.target.value)}
                  placeholder="Enter father's full name"
                  data-testid="input-fatherFullName"
                />
              </div>
              <div>
                <Label htmlFor="fatherNationality">Father's Nationality</Label>
                <Input
                  id="fatherNationality"
                  value={formData.fatherNationality || ''}
                  onChange={(e) => onUpdateField('fatherNationality', e.target.value)}
                  placeholder="Enter father's nationality"
                  data-testid="input-fatherNationality"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Registration Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="registrationNumber">Registration Number</Label>
                <Input
                  id="registrationNumber"
                  value={formData.registrationNumber || ''}
                  onChange={(e) => onUpdateField('registrationNumber', e.target.value)}
                  placeholder="Auto-generated if empty"
                  data-testid="input-registrationNumber"
                />
              </div>
              <div>
                <Label htmlFor="registrationDate">Registration Date</Label>
                <Input
                  id="registrationDate"
                  type="date"
                  value={formData.registrationDate || ''}
                  onChange={(e) => onUpdateField('registrationDate', e.target.value)}
                  data-testid="input-registrationDate"
                />
              </div>
            </div>
          </div>
        </div>
      );

    case 'marriage_certificate':
      return (
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Marriage Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="marriageDate">Marriage Date *</Label>
                <Input
                  id="marriageDate"
                  type="date"
                  value={formData.marriageDate || ''}
                  onChange={(e) => onUpdateField('marriageDate', e.target.value)}
                  data-testid="input-marriageDate"
                />
              </div>
              <div>
                <Label htmlFor="marriagePlace">Marriage Place *</Label>
                <Input
                  id="marriagePlace"
                  value={formData.marriagePlace || ''}
                  onChange={(e) => onUpdateField('marriagePlace', e.target.value)}
                  placeholder="Enter place of marriage"
                  data-testid="input-marriagePlace"
                />
              </div>
              <div>
                <Label htmlFor="marriageType">Marriage Type</Label>
                <Select value={formData.marriageType || undefined} onValueChange={(value) => onUpdateField('marriageType', value)}>
                  <SelectTrigger data-testid="select-marriageType">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="civil">Civil Marriage</SelectItem>
                    <SelectItem value="religious">Religious Marriage</SelectItem>
                    <SelectItem value="customary">Customary Marriage</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Partner 1 Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="partner1FullName">Full Name *</Label>
                <Input
                  id="partner1FullName"
                  value={formData.partner1FullName || ''}
                  onChange={(e) => onUpdateField('partner1FullName', e.target.value)}
                  placeholder="Enter partner 1 full name"
                  data-testid="input-partner1FullName"
                />
              </div>
              <div>
                <Label htmlFor="partner1Age">Age *</Label>
                <Input
                  id="partner1Age"
                  type="number"
                  min="18"
                  value={formData.partner1Age || ''}
                  onChange={(e) => onUpdateField('partner1Age', parseInt(e.target.value) || '')}
                  data-testid="input-partner1Age"
                />
              </div>
              <div>
                <Label htmlFor="partner1Nationality">Nationality</Label>
                <Input
                  id="partner1Nationality"
                  value={formData.partner1Nationality || ''}
                  onChange={(e) => onUpdateField('partner1Nationality', e.target.value)}
                  placeholder="Enter nationality"
                  data-testid="input-partner1Nationality"
                />
              </div>
              <div>
                <Label htmlFor="partner1Occupation">Occupation</Label>
                <Input
                  id="partner1Occupation"
                  value={formData.partner1Occupation || ''}
                  onChange={(e) => onUpdateField('partner1Occupation', e.target.value)}
                  placeholder="Enter occupation"
                  data-testid="input-partner1Occupation"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Partner 2 Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="partner2FullName">Full Name *</Label>
                <Input
                  id="partner2FullName"
                  value={formData.partner2FullName || ''}
                  onChange={(e) => onUpdateField('partner2FullName', e.target.value)}
                  placeholder="Enter partner 2 full name"
                  data-testid="input-partner2FullName"
                />
              </div>
              <div>
                <Label htmlFor="partner2Age">Age *</Label>
                <Input
                  id="partner2Age"
                  type="number"
                  min="18"
                  value={formData.partner2Age || ''}
                  onChange={(e) => onUpdateField('partner2Age', parseInt(e.target.value) || '')}
                  data-testid="input-partner2Age"
                />
              </div>
              <div>
                <Label htmlFor="partner2Nationality">Nationality</Label>
                <Input
                  id="partner2Nationality"
                  value={formData.partner2Nationality || ''}
                  onChange={(e) => onUpdateField('partner2Nationality', e.target.value)}
                  placeholder="Enter nationality"
                  data-testid="input-partner2Nationality"
                />
              </div>
              <div>
                <Label htmlFor="partner2Occupation">Occupation</Label>
                <Input
                  id="partner2Occupation"
                  value={formData.partner2Occupation || ''}
                  onChange={(e) => onUpdateField('partner2Occupation', e.target.value)}
                  placeholder="Enter occupation"
                  data-testid="input-partner2Occupation"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Marriage Officials and Witnesses</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="officiantName">Marriage Officer *</Label>
                <Input
                  id="officiantName"
                  value={formData.officiantName || ''}
                  onChange={(e) => onUpdateField('officiantName', e.target.value)}
                  placeholder="Enter marriage officer name"
                  data-testid="input-officiantName"
                />
              </div>
              <div>
                <Label htmlFor="witness1Name">Witness 1</Label>
                <Input
                  id="witness1Name"
                  value={formData.witness1Name || ''}
                  onChange={(e) => onUpdateField('witness1Name', e.target.value)}
                  placeholder="Enter witness 1 name"
                  data-testid="input-witness1Name"
                />
              </div>
              <div>
                <Label htmlFor="witness2Name">Witness 2</Label>
                <Input
                  id="witness2Name"
                  value={formData.witness2Name || ''}
                  onChange={(e) => onUpdateField('witness2Name', e.target.value)}
                  placeholder="Enter witness 2 name"
                  data-testid="input-witness2Name"
                />
              </div>
              <div>
                <Label htmlFor="registrationNumber">Registration Number</Label>
                <Input
                  id="registrationNumber"
                  value={formData.registrationNumber || ''}
                  onChange={(e) => onUpdateField('registrationNumber', e.target.value)}
                  placeholder="Auto-generated if empty"
                  data-testid="input-registrationNumber"
                />
              </div>
            </div>
          </div>
        </div>
      );

    case 'general_work_visa':
    case 'critical_skills_work_visa':
      return (
        <div className="space-y-6">
          {renderPersonalFields()}

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Visa Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="permitNumber">Permit Number</Label>
                <Input
                  id="permitNumber"
                  value={formData.permitNumber || ''}
                  onChange={(e) => onUpdateField('permitNumber', e.target.value)}
                  placeholder="Auto-generated if empty"
                  data-testid="input-permitNumber"
                />
              </div>
              <div>
                <Label htmlFor="validFrom">Valid From *</Label>
                <Input
                  id="validFrom"
                  type="date"
                  value={formData.validFrom || ''}
                  onChange={(e) => onUpdateField('validFrom', e.target.value)}
                  data-testid="input-validFrom"
                />
              </div>
              <div>
                <Label htmlFor="validUntil">Valid Until *</Label>
                <Input
                  id="validUntil"
                  type="date"
                  value={formData.validUntil || ''}
                  onChange={(e) => onUpdateField('validUntil', e.target.value)}
                  data-testid="input-validUntil"
                />
              </div>
            </div>
          </div>

          {documentType === 'critical_skills_work_visa' && (
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 border-b pb-2">Critical Skills Information</h3>
              <div>
                <Label htmlFor="criticalSkillArea">Critical Skill Area *</Label>
                <Select value={formData.criticalSkillArea || undefined} onValueChange={(value) => onUpdateField('criticalSkillArea', value)}>
                  <SelectTrigger data-testid="select-criticalSkillArea">
                    <SelectValue placeholder="Select critical skill area" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="engineering">Engineering</SelectItem>
                    <SelectItem value="information_technology">Information Technology</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="education">Education</SelectItem>
                    <SelectItem value="agriculture">Agriculture</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Employment Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="occupation">Occupation *</Label>
                <Input
                  id="occupation"
                  value={formData.occupation || ''}
                  onChange={(e) => onUpdateField('occupation', e.target.value)}
                  placeholder="Enter occupation"
                  data-testid="input-occupation"
                />
              </div>
              <div>
                <Label htmlFor="employer">Employer</Label>
                <Input
                  id="employer"
                  value={formData.employer || ''}
                  onChange={(e) => onUpdateField('employer', e.target.value)}
                  placeholder="Enter employer name"
                  data-testid="input-employer"
                />
              </div>
            </div>
          </div>
        </div>
      );

    case 'certificate_of_exemption':
      return (
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">District Office Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="districtOffice">District Office *</Label>
                <Input
                  id="districtOffice"
                  value={formData.districtOffice || ''}
                  onChange={(e) => onUpdateField('districtOffice', e.target.value)}
                  placeholder="e.g., ALEXANDRA"
                  data-testid="input-districtOffice"
                />
              </div>
              <div>
                <Label htmlFor="districtAddress">District Office Address *</Label>
                <Input
                  id="districtAddress"
                  value={formData.districtAddress || ''}
                  onChange={(e) => onUpdateField('districtAddress', e.target.value)}
                  placeholder="e.g., Private Bag x1, BURGERSFORT 2013"
                  data-testid="input-districtAddress"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Certificate Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="referenceNumber">Reference Number *</Label>
                <Input
                  id="referenceNumber"
                  value={formData.referenceNumber || ''}
                  onChange={(e) => onUpdateField('referenceNumber', e.target.value)}
                  placeholder="Enter reference number"
                  data-testid="input-referenceNumber"
                />
              </div>
              <div>
                <Label htmlFor="fileNumber">File Number *</Label>
                <Input
                  id="fileNumber"
                  value={formData.fileNumber || ''}
                  onChange={(e) => onUpdateField('fileNumber', e.target.value)}
                  placeholder="Enter file number"
                  data-testid="input-fileNumber"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Exemption Details</h3>
            <div>
              <Label htmlFor="exemptionText">Exemption Text *</Label>
              <Textarea
                id="exemptionText"
                value={formData.exemptionText || ''}
                onChange={(e) => onUpdateField('exemptionText', e.target.value)}
                placeholder="Enter the legal exemption text"
                rows={4}
                data-testid="input-exemptionText"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="validityPeriod">Validity Period (Optional)</Label>
                <Input
                  id="validityPeriod"
                  value={formData.validityPeriod || ''}
                  onChange={(e) => onUpdateField('validityPeriod', e.target.value)}
                  placeholder="e.g., 12 months"
                  data-testid="input-validityPeriod"
                />
              </div>
              <div>
                <Label htmlFor="issuingDate">Issuing Date *</Label>
                <Input
                  id="issuingDate"
                  type="date"
                  value={formData.issuingDate || ''}
                  onChange={(e) => onUpdateField('issuingDate', e.target.value)}
                  data-testid="input-issuingDate"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Exempted Person Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="exemptedPersonName">Full Name *</Label>
                <Input
                  id="exemptedPersonName"
                  value={formData.exemptedPersonName || ''}
                  onChange={(e) => onUpdateField('exemptedPersonName', e.target.value)}
                  placeholder="Enter full name of exempted person"
                  data-testid="input-exemptedPersonName"
                />
              </div>
              <div>
                <Label htmlFor="exemptedPersonDob">Date of Birth *</Label>
                <Input
                  id="exemptedPersonDob"
                  type="date"
                  value={formData.exemptedPersonDob || ''}
                  onChange={(e) => onUpdateField('exemptedPersonDob', e.target.value)}
                  data-testid="input-exemptedPersonDob"
                />
              </div>
              <div>
                <Label htmlFor="exemptedPersonId">Identity Number (Optional)</Label>
                <Input
                  id="exemptedPersonId"
                  value={formData.exemptedPersonId || ''}
                  onChange={(e) => onUpdateField('exemptedPersonId', e.target.value)}
                  placeholder="Enter ID number if available"
                  data-testid="input-exemptedPersonId"
                />
              </div>
              <div>
                <Label htmlFor="exemptedPersonNationality">Nationality *</Label>
                <Input
                  id="exemptedPersonNationality"
                  value={formData.exemptedPersonNationality || ''}
                  onChange={(e) => onUpdateField('exemptedPersonNationality', e.target.value)}
                  placeholder="Enter nationality"
                  data-testid="input-exemptedPersonNationality"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Authority</h3>
            <div>
              <Label htmlFor="directorGeneralName">Director-General Name *</Label>
              <Input
                id="directorGeneralName"
                value={formData.directorGeneralName || ''}
                onChange={(e) => onUpdateField('directorGeneralName', e.target.value)}
                placeholder="Enter Director-General name"
                data-testid="input-directorGeneralName"
              />
            </div>
          </div>
        </div>
      );

    case 'certificate_of_south_african_citizenship':
      return (
        <div className="space-y-6">
          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Certificate Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="certificateNumber">Certificate Number *</Label>
                <Input
                  id="certificateNumber"
                  value={formData.certificateNumber || ''}
                  onChange={(e) => onUpdateField('certificateNumber', e.target.value)}
                  placeholder="Enter certificate number"
                  data-testid="input-certificateNumber"
                />
              </div>
              <div>
                <Label htmlFor="referenceNumber">Reference Number *</Label>
                <Input
                  id="referenceNumber"
                  value={formData.referenceNumber || ''}
                  onChange={(e) => onUpdateField('referenceNumber', e.target.value)}
                  placeholder="Enter reference number"
                  data-testid="input-referenceNumber"
                />
              </div>
              <div>
                <Label htmlFor="issuingDate">Issuing Date *</Label>
                <Input
                  id="issuingDate"
                  type="date"
                  value={formData.issuingDate || ''}
                  onChange={(e) => onUpdateField('issuingDate', e.target.value)}
                  data-testid="input-issuingDate"
                />
              </div>
              <div>
                <Label htmlFor="issuingOffice">Issuing Office *</Label>
                <Input
                  id="issuingOffice"
                  value={formData.issuingOffice || ''}
                  onChange={(e) => onUpdateField('issuingOffice', e.target.value)}
                  placeholder="Enter issuing office"
                  data-testid="input-issuingOffice"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Certificate Text</h3>
            <div>
              <Label htmlFor="purposeStatement">Purpose Statement *</Label>
              <Textarea
                id="purposeStatement"
                value={formData.purposeStatement || 'This certificate is issued for the sole purpose of indicating the status of the person concerned on the date of issue'}
                onChange={(e) => onUpdateField('purposeStatement', e.target.value)}
                placeholder="Enter purpose statement"
                rows={3}
                data-testid="input-purposeStatement"
              />
            </div>
            <div>
              <Label htmlFor="citizenshipType">Citizenship Type *</Label>
              <Select
                value={formData.citizenshipType || undefined}
                onValueChange={(value) => onUpdateField('citizenshipType', value)}
                data-testid="select-citizenshipType"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select citizenship type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="birth">Birth</SelectItem>
                  <SelectItem value="descent">Descent</SelectItem>
                  <SelectItem value="naturalisation">Naturalisation</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Holder Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="holderFullName">Full Name *</Label>
                <Input
                  id="holderFullName"
                  value={formData.holderFullName || ''}
                  onChange={(e) => onUpdateField('holderFullName', e.target.value)}
                  placeholder="Enter holder's full name"
                  data-testid="input-holderFullName"
                />
              </div>
              <div>
                <Label htmlFor="holderPlaceOfBirth">Place of Birth *</Label>
                <Input
                  id="holderPlaceOfBirth"
                  value={formData.holderPlaceOfBirth || ''}
                  onChange={(e) => onUpdateField('holderPlaceOfBirth', e.target.value)}
                  placeholder="Enter place of birth"
                  data-testid="input-holderPlaceOfBirth"
                />
              </div>
              <div>
                <Label htmlFor="holderDateOfBirth">Date of Birth *</Label>
                <Input
                  id="holderDateOfBirth"
                  type="date"
                  value={formData.holderDateOfBirth || ''}
                  onChange={(e) => onUpdateField('holderDateOfBirth', e.target.value)}
                  data-testid="input-holderDateOfBirth"
                />
              </div>
              <div>
                <Label htmlFor="holderIdentityNumber">Identity Number *</Label>
                <Input
                  id="holderIdentityNumber"
                  value={formData.holderIdentityNumber || ''}
                  onChange={(e) => onUpdateField('holderIdentityNumber', e.target.value)}
                  placeholder="Enter identity number"
                  data-testid="input-holderIdentityNumber"
                />
              </div>
              <div>
                <Label htmlFor="holderGender">Gender</Label>
                <Select
                  value={formData.holderGender || undefined}
                  onValueChange={(value) => onUpdateField('holderGender', value)}
                  data-testid="select-holderGender"
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="holderParticulars">Additional Particulars</Label>
                <Input
                  id="holderParticulars"
                  value={formData.holderParticulars || ''}
                  onChange={(e) => onUpdateField('holderParticulars', e.target.value)}
                  placeholder="Enter additional particulars"
                  data-testid="input-holderParticulars"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-medium text-gray-900 border-b pb-2">Ministerial Authorization</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="byOrderOfMinister">By Order of the Minister *</Label>
                <Input
                  id="byOrderOfMinister"
                  value={formData.byOrderOfMinister || 'By order of the Minister'}
                  onChange={(e) => onUpdateField('byOrderOfMinister', e.target.value)}
                  placeholder="Enter ministerial order text"
                  data-testid="input-byOrderOfMinister"
                />
              </div>
              <div>
                <Label htmlFor="directorGeneralNameCitizenship">Director-General Name *</Label>
                <Input
                  id="directorGeneralNameCitizenship"
                  value={formData.directorGeneralNameCitizenship || ''}
                  onChange={(e) => onUpdateField('directorGeneralNameCitizenship', e.target.value)}
                  placeholder="Enter Director-General name"
                  data-testid="input-directorGeneralNameCitizenship"
                />
              </div>
            </div>
          </div>
        </div>
      );

    default:
      return (
        <div className="text-center py-8">
          <Settings className="h-8 w-8 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Form fields for this document type will be available soon</p>
        </div>
      );
  }
}

/**
 * Generation Result Display Component
 */
interface GenerationResultDisplayProps {
  result: GenerationResult;
}

function GenerationResultDisplay({ result }: GenerationResultDisplayProps) {
  if (!result.success) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-800">
          <AlertTriangle className="h-4 w-4" />
          <span className="font-medium">Generation Failed</span>
        </div>
        <p className="text-sm text-red-700 mt-1">{result.error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-green-800">
          <CheckCircle className="h-4 w-4" />
          <span className="font-medium">Document Generated Successfully</span>
        </div>
        <p className="text-sm text-green-700 mt-1">{result.message}</p>
      </div>

      {/* Document Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h4 className="font-medium mb-2">Document Details</h4>
          <div className="text-sm space-y-1">
            <p><strong>ID:</strong> {result.documentId}</p>
            <p><strong>Verification Code:</strong> {result.verificationCode}</p>
            {result.metadata?.processingTime && (
              <p><strong>Processing Time:</strong> {result.metadata.processingTime}ms</p>
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="font-medium mb-2">Security Features</h4>
          <div className="text-sm space-y-1">
            {result.securityFeatures?.enabled?.length > 0 ? (
              <p><strong>Features:</strong> {result.securityFeatures.totalCount}</p>
            ) : (
              <p>Security features applied</p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <Shield className="h-3 w-3 text-green-500" />
              <span className="text-xs text-green-600">Cryptographically secure</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        {result.documentUrl && (
          <Button
            onClick={() => window.open(result.documentUrl, '_blank')}
            className="flex items-center gap-2"
            data-testid="button-view-document"
          >
            <Eye className="h-4 w-4" />
            View Document
          </Button>
        )}

        {result.verificationCode && (
          <Button
            variant="outline"
            onClick={() => {
              navigator.clipboard.writeText(result.verificationCode!);
              // Could add a toast here
            }}
            className="flex items-center gap-2"
          >
            <Hash className="h-4 w-4" />
            Copy Verification Code
          </Button>
        )}
      </div>
    </div>
  );
}
import { useState, useRef, useCallback, useMemo, memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DocumentCardSkeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
// import { useWebSocket } from "@/hooks/useWebSocket"; // FIXED: Disabled to prevent connection errors

interface Document {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  isEncrypted: boolean;
  isVerified: boolean;
  verificationScore?: number;
  ocrText?: string;
  ocrConfidence?: number;
  processingStatus: string;
  createdAt: string;
  documentType?: string;
  extractedFields?: Record<string, any>;
  saValidationResult?: SAValidationResult;
}

interface SAValidationResult {
  isValidSADocument: boolean;
  documentCategory: 'work_permit' | 'residence_permit' | 'temporary_permit' | 'permanent_visa' | 'unknown';
  permitNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  issuingOffice?: string;
  validationErrors: string[];
  complianceScore: number;
}

interface ProcessingOptions {
  performOCR: boolean;
  verifyAuthenticity: boolean;
  extractData: boolean;
  encrypt: boolean;
  documentType: 'general' | 'work_permit' | 'residence_permit' | 'temporary_permit' | 'permanent_visa';
  enableSAValidation: boolean;
  enableFieldExtraction: boolean;
  enableWorkflowManagement: boolean;
  enablePOPIACompliance: boolean;
}

// Memoized document card for better performance
interface DocumentCardProps {
  doc: Document;
  getFileIcon: (mimeType: string) => string;
  formatFileSize: (bytes: number) => string;
  getVerificationBadge: (score?: number, isVerified?: boolean) => JSX.Element;
}

const MemoizedDocumentCard = memo(({ doc, getFileIcon, formatFileSize, getVerificationBadge }: DocumentCardProps) => {
  return (
    <div
      className="p-4 bg-muted/30 rounded-lg border border-muted"
      data-testid={`document-${doc.id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start space-x-3">
          <span className="text-2xl">{getFileIcon(doc.mimeType)}</span>
          <div>
            <div className="font-medium">{doc.filename}</div>
            <div className="text-sm text-muted-foreground">
              {formatFileSize(doc.size)} • {new Date(doc.createdAt).toLocaleString()}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {doc.isEncrypted && (
            <Badge className="bg-quantum/20 text-quantum border-quantum">
              🔐 Encrypted
            </Badge>
          )}
          {getVerificationBadge(doc.verificationScore, doc.isVerified)}
        </div>
      </div>

      {/* Document Details */}
      <div className="space-y-2">
        {doc.ocrConfidence && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">OCR Confidence:</span>
            <Badge className={
              doc.ocrConfidence >= 90 ? "security-level-1" :
              doc.ocrConfidence >= 70 ? "security-level-2" : "security-level-3"
            }>
              {doc.ocrConfidence}%
            </Badge>
          </div>
        )}
        
        {doc.verificationScore && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Verification Score:</span>
            <Badge className={
              doc.verificationScore >= 90 ? "security-level-1" :
              doc.verificationScore >= 70 ? "security-level-2" : "security-level-3"
            }>
              {doc.verificationScore}%
            </Badge>
          </div>
        )}

        {doc.extractedFields && Object.keys(doc.extractedFields).length > 0 && (
          <div className="mt-3">
            <div className="text-sm font-medium mb-2">Extracted Fields:</div>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(doc.extractedFields).slice(0, 3).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm bg-muted/50 p-2 rounded">
                  <span className="font-medium capitalize">{key.replace(/_/g, ' ')}:</span>
                  <span className="text-muted-foreground truncate ml-2">{String(value)}</span>
                </div>
              ))}
              {Object.keys(doc.extractedFields).length > 3 && (
                <div className="text-xs text-muted-foreground text-center py-1">
                  +{Object.keys(doc.extractedFields).length - 3} more fields
                </div>
              )}
            </div>
          </div>
        )}

        {/* SA Validation Results */}
        {doc.saValidationResult && (
          <div className="mt-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">SA Document Validation</span>
              <Badge className={
                doc.saValidationResult.isValidSADocument 
                  ? "security-level-1" 
                  : "security-level-3"
              }>
                {doc.saValidationResult.isValidSADocument ? "VALID" : "INVALID"}
              </Badge>
            </div>
            
            {doc.saValidationResult.isValidSADocument && (
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Document Category:</span>
                  <span className="capitalize">{doc.saValidationResult.documentCategory.replace(/_/g, ' ')}</span>
                </div>
                {doc.saValidationResult.permitNumber && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Permit Number:</span>
                    <span className="font-mono">{doc.saValidationResult.permitNumber}</span>
                  </div>
                )}
                {doc.saValidationResult.expiryDate && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Expiry Date:</span>
                    <span>{doc.saValidationResult.expiryDate}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Compliance Score:</span>
                  <Badge className={
                    doc.saValidationResult.complianceScore >= 90 ? "security-level-1" :
                    doc.saValidationResult.complianceScore >= 70 ? "security-level-2" : "security-level-3"
                  }>
                    {doc.saValidationResult.complianceScore}%
                  </Badge>
                </div>
              </div>
            )}

            {doc.saValidationResult.validationErrors.length > 0 && (
              <div className="mt-2">
                <div className="text-sm font-medium text-alert mb-1">Validation Errors:</div>
                <div className="space-y-1">
                  {doc.saValidationResult.validationErrors.slice(0, 2).map((error, index) => (
                    <div key={index} className="text-xs text-muted-foreground bg-alert/10 p-2 rounded">
                      {error}
                    </div>
                  ))}
                  {doc.saValidationResult.validationErrors.length > 2 && (
                    <div className="text-xs text-muted-foreground text-center py-1">
                      +{doc.saValidationResult.validationErrors.length - 2} more errors
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

MemoizedDocumentCard.displayName = 'MemoizedDocumentCard';

function DocumentProcessor() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingOptions, setProcessingOptions] = useState<ProcessingOptions>({
    performOCR: true,
    verifyAuthenticity: true,
    extractData: true,
    encrypt: true,
    documentType: 'general',
    enableSAValidation: true,
    enableFieldExtraction: true,
    enableWorkflowManagement: false,
    enablePOPIACompliance: true
  });
  const [processingProgress, setProcessingProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentProcessingDocument, setCurrentProcessingDocument] = useState<any>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  // FIXED: Disable WebSocket to prevent connection errors
  // const { socket } = useWebSocket();
  const socket = null; // System works without real-time updates
  const queryClient = useQueryClient();

  // Get user documents with optimized caching
  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["/api/documents"],
    queryFn: () => api.get<Document[]>("/api/documents"),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes cache
  });

  // Document upload mutation with optimized progress tracking
  const uploadMutation = useMutation({
    mutationFn: useCallback((formData: FormData) => {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setProcessingProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 500);

      return api.postFormData("/api/documents/upload", formData);
    }, []),
    onSuccess: (result) => {
      setProcessingProgress(100);
      setCurrentProcessingDocument(result);
      
      setTimeout(() => {
        setProcessingProgress(0);
        setSelectedFile(null);
        setCurrentProcessingDocument(null);
        queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      }, 2000);

      toast({
        title: "Document Processed",
        description: "Document has been successfully processed and verified",
        className: "border-secure bg-secure/10 text-secure",
      });
    },
    onError: (error: any) => {
      setProcessingProgress(0);
      setCurrentProcessingDocument(null);
      
      toast({
        title: "Processing Failed",
        description: error.response?.data?.error || "Failed to process document",
        variant: "destructive",
      });
    }
  });

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (files && files[0]) {
      const file = files[0];
      
      // Validate file type
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/tiff',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid File Type",
          description: "Please select a PDF, image, or Word document",
          variant: "destructive",
        });
        return;
      }
      
      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "File size must be less than 50MB",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedFile(file);
    }
  }, [toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
  }, [handleFileSelect]);

  const processDocument = useCallback(async () => {
    if (!selectedFile) return;

    const formData = new FormData();
    formData.append('document', selectedFile);
    formData.append('performOCR', processingOptions.performOCR.toString());
    formData.append('verifyAuthenticity', processingOptions.verifyAuthenticity.toString());
    formData.append('extractData', processingOptions.extractData.toString());
    formData.append('encrypt', processingOptions.encrypt.toString());
    formData.append('documentType', processingOptions.documentType);
    formData.append('enableSAValidation', processingOptions.enableSAValidation.toString());
    formData.append('enableFieldExtraction', processingOptions.enableFieldExtraction.toString());
    formData.append('enableWorkflowManagement', processingOptions.enableWorkflowManagement.toString());
    formData.append('enablePOPIACompliance', processingOptions.enablePOPIACompliance.toString());

    setProcessingProgress(5);
    uploadMutation.mutate(formData);
  }, [selectedFile, processingOptions, uploadMutation]);

  const getFileIcon = useCallback((mimeType: string) => {
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('image')) return '🖼️';
    if (mimeType.includes('word')) return '📝';
    return '📎';
  }, []);

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  const getVerificationBadge = useCallback((score?: number, isVerified?: boolean) => {
    if (!isVerified || score === undefined) {
      return <Badge variant="outline">Not Verified</Badge>;
    }
    
    if (score >= 90) return <Badge className="security-level-1">VERIFIED</Badge>;
    if (score >= 70) return <Badge className="security-level-2">PARTIAL</Badge>;
    return <Badge className="security-level-3">FAILED</Badge>;
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Document Upload Area */}
      <Card className="glass border-glass-border" data-testid="card-document-upload">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>📁</span>
            <span>Document Upload & Processing</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Upload Zone */}
          <div
            className={`upload-area ${isDragOver ? 'dragover' : ''} ${selectedFile ? 'border-primary' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            data-testid="upload-zone"
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileInputChange}
              accept=".pdf,.jpg,.jpeg,.png,.tiff,.docx"
              data-testid="file-input"
            />
            
            <div className="text-center">
              {selectedFile ? (
                <div className="space-y-2">
                  <span className="text-4xl">{getFileIcon(selectedFile.type)}</span>
                  <div className="font-medium">{selectedFile.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatFileSize(selectedFile.size)}
                  </div>
                </div>
              ) : (
                <>
                  <span className="text-4xl text-muted-foreground mb-4 block">☁️</span>
                  <div className="text-lg font-medium mb-2">Drop SA permit documents here</div>
                  <div className="text-sm text-muted-foreground mb-4">
                    Supports PDF, JPG, PNG, TIFF, DOCX • Optimized for SA Government Documents
                  </div>
                  <Button className="btn-enhanced bg-primary hover:bg-primary/90 text-primary-foreground">
                    <span>📂</span>
                    <span className="ml-2">Browse Files</span>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Processing Options - Memoized */}
          <Tabs defaultValue="basic" className="space-y-4">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="basic" data-testid="tab-basic-options">Basic Options</TabsTrigger>
              <TabsTrigger value="sa-permits" data-testid="tab-sa-options">SA Permit Features</TabsTrigger>
            </TabsList>
            
            <TabsContent value="basic" className="space-y-4">
              <h4 className="font-medium">Document Processing</h4>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-4 bg-muted/30 rounded-lg">
                  <Checkbox
                    id="ocr"
                    checked={processingOptions.performOCR}
                    onCheckedChange={(checked) =>
                      setProcessingOptions(prev => ({ ...prev, performOCR: checked as boolean }))
                    }
                    data-testid="checkbox-ocr"
                  />
                  <div className="flex-1">
                    <label htmlFor="ocr" className="font-medium cursor-pointer">
                      Enhanced OCR Text Extraction
                    </label>
                    <div className="text-sm text-muted-foreground">
                      SA government document-optimized OCR with field recognition
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-4 bg-muted/30 rounded-lg">
                  <Checkbox
                    id="verification"
                    checked={processingOptions.verifyAuthenticity}
                    onCheckedChange={(checked) =>
                      setProcessingOptions(prev => ({ ...prev, verifyAuthenticity: checked as boolean }))
                    }
                    data-testid="checkbox-verification"
                  />
                  <div className="flex-1">
                    <label htmlFor="verification" className="font-medium cursor-pointer">
                      Document Authenticity Verification
                    </label>
                    <div className="text-sm text-muted-foreground">
                      Verify authenticity and detect tampering using advanced algorithms
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-4 bg-muted/30 rounded-lg">
                  <Checkbox
                    id="encryption"
                    checked={processingOptions.encrypt}
                    onCheckedChange={(checked) =>
                      setProcessingOptions(prev => ({ ...prev, encrypt: checked as boolean }))
                    }
                    data-testid="checkbox-encryption"
                  />
                  <div className="flex-1">
                    <label htmlFor="encryption" className="font-medium cursor-pointer">
                      Quantum-Grade Encryption
                    </label>
                    <div className="text-sm text-muted-foreground">
                      Secure document storage with military-grade encryption
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="sa-permits" className="space-y-4">
              <div className="space-y-4">
                {/* Document Type Selection */}
                <div className="space-y-2">
                  <label className="font-medium text-sm">Document Type</label>
                  <Select 
                    value={processingOptions.documentType} 
                    onValueChange={(value: any) => setProcessingOptions(prev => ({ ...prev, documentType: value }))}
                  >
                    <SelectTrigger data-testid="select-document-type">
                      <SelectValue placeholder="Select document type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Document</SelectItem>
                      <SelectItem value="work_permit">🏢 Work Permit</SelectItem>
                      <SelectItem value="residence_permit">🏠 Residence Permit</SelectItem>
                      <SelectItem value="temporary_permit">⏱️ Temporary Permit</SelectItem>
                      <SelectItem value="permanent_visa">🇿🇦 Permanent Residence Visa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* SA-Specific Features */}
                <div className="flex items-center space-x-3 p-4 bg-muted/30 rounded-lg">
                  <Checkbox
                    id="sa-validation"
                    checked={processingOptions.enableSAValidation}
                    onCheckedChange={(checked) =>
                      setProcessingOptions(prev => ({ ...prev, enableSAValidation: checked as boolean }))
                    }
                    data-testid="checkbox-sa-validation"
                  />
                  <div className="flex-1">
                    <label htmlFor="sa-validation" className="font-medium cursor-pointer">
                      SA Government Document Validation
                    </label>
                    <div className="text-sm text-muted-foreground">
                      Validate against DHA document formats and reference numbers
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-4 bg-muted/30 rounded-lg">
                  <Checkbox
                    id="field-extraction"
                    checked={processingOptions.enableFieldExtraction}
                    onCheckedChange={(checked) =>
                      setProcessingOptions(prev => ({ ...prev, enableFieldExtraction: checked as boolean }))
                    }
                    data-testid="checkbox-field-extraction"
                  />
                  <div className="flex-1">
                    <label htmlFor="field-extraction" className="font-medium cursor-pointer">
                      Structured Field Extraction
                    </label>
                    <div className="text-sm text-muted-foreground">
                      Extract permit numbers, dates, employer details, and conditions
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-4 bg-muted/30 rounded-lg">
                  <Checkbox
                    id="workflow-management"
                    checked={processingOptions.enableWorkflowManagement}
                    onCheckedChange={(checked) =>
                      setProcessingOptions(prev => ({ ...prev, enableWorkflowManagement: checked as boolean }))
                    }
                    data-testid="checkbox-workflow-management"
                  />
                  <div className="flex-1">
                    <label htmlFor="workflow-management" className="font-medium cursor-pointer">
                      Workflow Management
                    </label>
                    <div className="text-sm text-muted-foreground">
                      Route to review queues and enable approval workflows
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 p-4 bg-muted/30 rounded-lg">
                  <Checkbox
                    id="popia-compliance"
                    checked={processingOptions.enablePOPIACompliance}
                    onCheckedChange={(checked) =>
                      setProcessingOptions(prev => ({ ...prev, enablePOPIACompliance: checked as boolean }))
                    }
                    data-testid="checkbox-popia-compliance"
                  />
                  <div className="flex-1">
                    <label htmlFor="popia-compliance" className="font-medium cursor-pointer">
                      POPIA Compliance Processing
                    </label>
                    <div className="text-sm text-muted-foreground">
                      Apply data protection measures and privacy safeguards
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* Processing Progress */}
          {processingProgress > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Processing Document...</span>
                <span className="text-sm text-muted-foreground">{processingProgress}%</span>
              </div>
              <Progress value={processingProgress} className="w-full" />
              {currentProcessingDocument && (
                <div className="text-sm text-muted-foreground">
                  {processingProgress < 30 && "Analyzing document structure..."}
                  {processingProgress >= 30 && processingProgress < 60 && "Performing OCR extraction..."}
                  {processingProgress >= 60 && processingProgress < 90 && "Verifying authenticity..."}
                  {processingProgress >= 90 && "Finalizing processing..."}
                </div>
              )}
            </div>
          )}

          {/* Process Button */}
          <Button
            onClick={processDocument}
            disabled={!selectedFile || uploadMutation.isPending}
            className="w-full security-active text-white font-semibold py-3"
            data-testid="button-process-document"
          >
            {uploadMutation.isPending ? (
              <>
                <span className="loading-spinner w-4 h-4 mr-2" />
                Processing...
              </>
            ) : (
              <>
                <span>⚙️</span>
                <span className="ml-2">Process Document</span>
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Processing Results */}
      <Card className="glass border-glass-border" data-testid="card-processing-results">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>📊</span>
            <span>Document Library</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <DocumentCardSkeleton key={i} />
              ))}
            </div>
          ) : documents.length > 0 ? (
            <div className="space-y-4">
              {documents.map((doc) => (
                <MemoizedDocumentCard
                  key={doc.id}
                  doc={doc}
                  getFileIcon={getFileIcon}
                  formatFileSize={formatFileSize}
                  getVerificationBadge={getVerificationBadge}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <span className="text-4xl block mb-4">📄</span>
              <p>No documents processed yet</p>
              <p className="text-sm mt-2">Upload your first document to get started</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Export memoized component for performance
export default memo(DocumentProcessor);

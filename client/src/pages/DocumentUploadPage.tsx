import { useState } from 'react';
import { Upload, FileText, Camera, Loader2, CheckCircle, AlertCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface DocumentAnalysisResult {
  success: boolean;
  documentType: string;
  extractedFields: Record<string, any>;
  confidence: number;
  aiAnalysis: {
    documentAuthenticity: 'authentic' | 'suspicious' | 'fraudulent' | 'inconclusive';
    qualityAssessment: 'excellent' | 'good' | 'fair' | 'poor';
    completenessScore: number;
    suggestions: string[];
    issues: string[];
    recommendedActions: string[];
  };
  autoFillData?: Record<string, any>;
  error?: string;
}

interface OCRProcessingResult {
  success: boolean;
  documentType: string;
  language: string;
  extractedFields: any[];
  fullText: string;
  confidence: number;
  validationResults: {
    formatValid: boolean;
    requiredFieldsPresent: boolean;
    dateFormatsValid: boolean;
    referenceNumbersValid: boolean;
    issuesFound: string[];
  };
  processingTime: number;
  error?: string;
}

const SUPPORTED_DOCUMENT_TYPES = [
  { value: 'passport', label: 'South African Passport', icon: '🛂' },
  { value: 'sa_id', label: 'South African ID', icon: '🆔' },
  { value: 'smart_id', label: 'Smart ID Card', icon: '💳' },
  { value: 'birth_certificate', label: 'Birth Certificate', icon: '👶' },
  { value: 'marriage_certificate', label: 'Marriage Certificate', icon: '💍' },
  { value: 'death_certificate', label: 'Death Certificate', icon: '⚰️' },
  { value: 'work_permit', label: 'Work Permit', icon: '🏢' },
  { value: 'study_permit', label: 'Study Permit', icon: '🎓' },
  { value: 'temporary_permit', label: 'Temporary Permit', icon: '📄' }
];

export default function DocumentUploadPage() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState('');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<DocumentAnalysisResult | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRProcessingResult | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      processDocument(file);
    }
  };

  const processDocument = async (file: File) => {
    if (!selectedDocumentType) {
      toast({
        title: "Document Type Required",
        description: "Please select the document type before uploading.",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResult(null);
    setOcrResult(null);

    try {
      // Unified AI-OCR processing
      setProcessingStep('Processing document with AI analysis...');
      setProgress(30);

      const formData = new FormData();
      formData.append('document', file);
      formData.append('documentType', selectedDocumentType);
      formData.append('enableAutoFill', 'true');

      const response = await fetch('/api/ai-ocr/process', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('AI-OCR processing failed');
      }

      const ocrResult = await response.json();
      
      setProcessingStep('Analysis complete!');
      setProgress(100);

      // Set both results for display
      setOcrResult(ocrResult.ocrResults);
      setResult(ocrResult);

      toast({
        title: "Document Processed Successfully!",
        description: `${file.name} analyzed with ${Math.round(ocrResult.confidence * 100)}% confidence.`
      });

    } catch (error) {
      console.error('Document processing error:', error);
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "Failed to process document",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setProcessingStep('');
    }
  };

  const handleAutoFill = () => {
    if (result?.autoFillData) {
      // Here we would integrate with the form system
      // For now, show extracted data
      toast({
        title: "Auto-Fill Ready!",
        description: "Extracted data is ready to populate your forms.",
      });
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold text-green-800 dark:text-green-400">
          🤖 AI-Assisted Document Processing
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Upload your DHA documents for intelligent form auto-fill with military-grade OCR
        </p>
      </div>

      {/* Document Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Select Document Type
          </CardTitle>
          <CardDescription>
            Choose the type of document you're uploading for optimized processing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {SUPPORTED_DOCUMENT_TYPES.map((docType) => (
              <Button
                key={docType.value}
                variant={selectedDocumentType === docType.value ? "default" : "outline"}
                className="h-16 flex flex-col items-center justify-center space-y-1"
                onClick={() => setSelectedDocumentType(docType.value)}
                data-testid={`select-doc-type-${docType.value}`}
              >
                <span className="text-xl">{docType.icon}</span>
                <span className="text-xs text-center">{docType.label}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Document Upload
          </CardTitle>
          <CardDescription>
            Drag and drop your document or click to browse (PDF, JPG, PNG supported)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed rounded-lg p-12 text-center transition-colors border-gray-300 hover:border-green-400 hover:bg-gray-50 dark:hover:bg-gray-800">
            <input 
              type="file" 
              onChange={handleFileUpload}
              accept="image/*,application/pdf"
              disabled={!selectedDocumentType || isProcessing}
              className="hidden"
              id="document-upload"
              data-testid="file-input"
            />
            {isProcessing ? (
              <div className="space-y-4">
                <Loader2 className="h-12 w-12 animate-spin mx-auto text-green-600" />
                <div className="space-y-2">
                  <p className="text-sm font-medium">{processingStep}</p>
                  <Progress value={progress} className="w-full max-w-md mx-auto" />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-center space-x-4">
                  <Upload className="h-12 w-12 text-gray-400" />
                  <Camera className="h-12 w-12 text-gray-400" />
                </div>
                <div>
                  <p className="text-lg font-medium">Upload Document for AI Processing</p>
                  <p className="text-sm text-gray-500 mt-2">
                    Supports PDF, JPG, PNG up to 10MB
                  </p>
                  {!selectedDocumentType && (
                    <p className="text-sm text-red-500 mt-2">
                      Please select document type first
                    </p>
                  )}
                  <Button 
                    onClick={() => document.getElementById('document-upload')?.click()}
                    disabled={!selectedDocumentType || isProcessing}
                    className="mt-4"
                    data-testid="upload-button"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Choose File
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Display */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              AI Analysis Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {Math.round(result.confidence * 100)}%
                </div>
                <div className="text-sm text-gray-600">OCR Confidence</div>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {result.aiAnalysis.completenessScore}%
                </div>
                <div className="text-sm text-gray-600">Completeness</div>
              </div>
              <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <Badge variant={
                  result.aiAnalysis.documentAuthenticity === 'authentic' ? 'default' :
                  result.aiAnalysis.documentAuthenticity === 'suspicious' ? 'secondary' : 'destructive'
                }>
                  {result.aiAnalysis.documentAuthenticity}
                </Badge>
                <div className="text-sm text-gray-600 mt-1">Authenticity</div>
              </div>
              <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <Badge variant={
                  result.aiAnalysis.qualityAssessment === 'excellent' ? 'default' :
                  result.aiAnalysis.qualityAssessment === 'good' ? 'secondary' : 'outline'
                }>
                  {result.aiAnalysis.qualityAssessment}
                </Badge>
                <div className="text-sm text-gray-600 mt-1">Quality</div>
              </div>
            </div>

            {/* Auto-Fill Button */}
            {result.autoFillData && (
              <div className="flex justify-center">
                <Button
                  onClick={handleAutoFill}
                  className="bg-green-600 hover:bg-green-700"
                  data-testid="button-autofill"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Auto-Fill Forms with Extracted Data
                </Button>
              </div>
            )}

            {/* Issues and Suggestions */}
            {result.aiAnalysis.issues.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Issues Found:</strong> {result.aiAnalysis.issues.join(', ')}
                </AlertDescription>
              </Alert>
            )}

            {result.aiAnalysis.suggestions.length > 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>AI Suggestions:</strong> {result.aiAnalysis.suggestions.join(' • ')}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detailed OCR Results */}
      {ocrResult && (
        <Card>
          <CardHeader>
            <CardTitle>Detailed OCR Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <strong>Document Type:</strong> {ocrResult.documentType}
              </div>
              <div>
                <strong>Language:</strong> {ocrResult.language}
              </div>
              <div>
                <strong>Processing Time:</strong> {ocrResult.processingTime}ms
              </div>
              <div>
                <strong>Format Valid:</strong> {ocrResult.validationResults.formatValid ? '✅' : '❌'}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
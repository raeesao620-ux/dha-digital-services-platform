import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import QRCode from "qrcode";
import { 
  FileText, Download, Printer, Eye, Shield, Check,
  QrCode as QrCodeIcon, Barcode, Stamp, FileCheck
} from "lucide-react";
import { 
  generateDHAReferenceNumber, 
  generateTrackingBarcode,
  formatSADate 
} from "@/lib/validators";
import { 
  SouthAfricanCoatOfArms, 
  OfficialStamp,
  GovernmentWatermark 
} from "@/components/GovernmentAssets";

interface DocumentPreviewProps {
  documentType: string;
  data: Record<string, any>;
  referenceNumber?: string;
}

export function DocumentPreview({ documentType, data, referenceNumber }: DocumentPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const [barcode] = useState(() => generateTrackingBarcode());
  const reference = referenceNumber || generateDHAReferenceNumber(documentType);
  
  useEffect(() => {
    // Generate QR code for verification
    const verificationUrl = `https://dha.gov.za/verify/${reference}`;
    QRCode.toDataURL(verificationUrl, {
      width: 150,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    }).then(url => {
      setQrCodeUrl(url);
    });
  }, [reference]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    // In a real app, this would generate a PDF
    console.log("Downloading document...");
  };

  return (
    <>
      {/* Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          
          .print-area, .print-area * {
            visibility: visible;
          }
          
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 210mm;
            min-height: 297mm;
            padding: 20mm;
            background: white;
          }
          
          .no-print {
            display: none !important;
          }
          
          .watermark-print {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-45deg);
            font-size: 120px;
            opacity: 0.05;
            z-index: -1;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 10px;
          }
          
          .government-header-print {
            border-bottom: 3px solid #007749;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          
          .document-footer-print {
            position: absolute;
            bottom: 20mm;
            left: 20mm;
            right: 20mm;
            border-top: 2px solid #007749;
            padding-top: 10px;
            font-size: 10pt;
          }
          
          @page {
            size: A4;
            margin: 0;
          }
        }
      `}</style>

      <Card className="government-card">
        <CardHeader className="no-print">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Document Preview
            </CardTitle>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={handlePrint}
                data-testid="button-print"
              >
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
              <Button 
                size="sm"
                onClick={handleDownload}
                data-testid="button-download"
              >
                <Download className="h-4 w-4 mr-1" />
                Download PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent>
          <div ref={printRef} className="print-area bg-white p-8 border-2 border-gray-200 rounded-lg relative">
            {/* Watermark for printed documents */}
            <div className="watermark-print">
              REPUBLIC OF SOUTH AFRICA
            </div>
            
            {/* Government Header */}
            <div className="government-header-print flex items-start justify-between mb-8">
              <div className="flex items-start gap-4">
                <SouthAfricanCoatOfArms className="h-20 w-20" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    REPUBLIC OF SOUTH AFRICA
                  </h1>
                  <h2 className="text-lg font-semibold text-gray-700">
                    Department of Home Affairs
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Private Bag X114, Pretoria, 0001
                  </p>
                </div>
              </div>
              
              {/* QR Code */}
              {qrCodeUrl && (
                <div className="text-center">
                  <img 
                    src={qrCodeUrl} 
                    alt="Verification QR Code"
                    className="w-24 h-24"
                  />
                  <p className="text-xs text-gray-600 mt-1">Scan to Verify</p>
                </div>
              )}
            </div>

            {/* Document Title */}
            <div className="text-center mb-8">
              <h3 className="text-xl font-bold uppercase tracking-wider">
                {documentType.replace(/_/g, ' ')}
              </h3>
              <div className="mt-2 text-sm text-gray-600">
                Reference: {reference}
              </div>
            </div>

            {/* Document Content */}
            <div className="space-y-6 mb-8">
              {/* This is where actual document content would go */}
              <div className="grid grid-cols-2 gap-6">
                {Object.entries(data).map(([key, value]) => (
                  <div key={key} className="border-b pb-2">
                    <div className="text-xs text-gray-500 uppercase tracking-wider">
                      {key.replace(/_/g, ' ')}
                    </div>
                    <div className="font-medium mt-1">
                      {value?.toString() || 'N/A'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Official Stamps Section */}
            <div className="flex justify-between items-end mt-12 mb-8">
              <div className="text-center">
                <div className="border-t-2 border-black w-48 mb-2"></div>
                <p className="text-sm">Authorized Officer</p>
                <p className="text-xs text-gray-600 mt-1">
                  Department of Home Affairs
                </p>
              </div>
              
              <div className="relative">
                <OfficialStamp 
                  office="PRETORIA"
                  date={formatSADate(new Date())}
                />
              </div>
              
              <div className="text-center">
                <div className="border-t-2 border-black w-48 mb-2"></div>
                <p className="text-sm">Date Issued</p>
                <p className="text-xs mt-1">
                  {formatSADate(new Date())}
                </p>
              </div>
            </div>

            {/* Barcode */}
            <div className="text-center mt-8">
              <div className="inline-block">
                <svg className="barcode" width="200" height="50">
                  {/* Simple barcode visualization */}
                  {barcode.split('').map((digit, index) => (
                    <rect
                      key={index}
                      x={index * 4}
                      y="10"
                      width={digit === '1' ? 3 : 1}
                      height="30"
                      fill="black"
                    />
                  ))}
                </svg>
                <p className="text-xs text-gray-600 mt-1">{barcode}</p>
              </div>
            </div>

            {/* Document Footer */}
            <div className="document-footer-print text-center text-xs text-gray-600">
              <p>
                This is an official document of the Republic of South Africa.
                Any unauthorized alteration or forgery is a criminal offense.
              </p>
              <p className="mt-2">
                For verification, visit www.dha.gov.za or call 0800 60 11 90
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

interface SecureDocumentWrapperProps {
  children: React.ReactNode;
  securityLevel?: "standard" | "enhanced" | "maximum";
  showWatermark?: boolean;
}

export function SecureDocumentWrapper({ 
  children, 
  securityLevel = "standard",
  showWatermark = true 
}: SecureDocumentWrapperProps) {
  const getSecurityFeatures = () => {
    switch (securityLevel) {
      case "maximum":
        return {
          border: "border-4 border-red-600",
          badge: "TOP SECRET",
          badgeColor: "bg-red-600"
        };
      case "enhanced":
        return {
          border: "border-2 border-orange-600",
          badge: "CONFIDENTIAL",
          badgeColor: "bg-orange-600"
        };
      default:
        return {
          border: "border-2 border-green-600",
          badge: "OFFICIAL",
          badgeColor: "bg-green-600"
        };
    }
  };

  const security = getSecurityFeatures();

  return (
    <div className={`relative ${security.border} rounded-lg p-1`}>
      {showWatermark && <GovernmentWatermark />}
      
      <div className="absolute -top-3 left-4 z-10">
        <Badge className={`${security.badgeColor} text-white text-xs px-3`}>
          {security.badge}
        </Badge>
      </div>
      
      <div className="absolute -top-3 right-4 z-10">
        <Badge className="bg-blue-600 text-white text-xs px-3 flex items-center gap-1">
          <Shield className="h-3 w-3" />
          SECURE DOCUMENT
        </Badge>
      </div>
      
      <div className="bg-white rounded-lg overflow-hidden">
        {children}
      </div>
      
      <div className="absolute bottom-2 right-2 flex items-center gap-2 text-xs text-gray-500">
        <FileCheck className="h-3 w-3" />
        <span>Digitally Secured</span>
      </div>
    </div>
  );
}

interface DocumentVerificationBannerProps {
  isVerified: boolean;
  verificationCode?: string;
  verificationDate?: Date;
}

export function DocumentVerificationBanner({ 
  isVerified, 
  verificationCode,
  verificationDate 
}: DocumentVerificationBannerProps) {
  return (
    <div className={`p-4 rounded-lg ${
      isVerified ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
    }`}>
      <div className="flex items-start gap-3">
        {isVerified ? (
          <Check className="h-5 w-5 text-green-600 mt-0.5" />
        ) : (
          <Shield className="h-5 w-5 text-red-600 mt-0.5" />
        )}
        
        <div className="flex-1">
          <h4 className={`font-semibold ${
            isVerified ? 'text-green-900' : 'text-red-900'
          }`}>
            {isVerified ? 'Document Verified' : 'Verification Required'}
          </h4>
          
          <p className={`text-sm mt-1 ${
            isVerified ? 'text-green-800' : 'text-red-800'
          }`}>
            {isVerified 
              ? 'This document has been verified as authentic by the Department of Home Affairs.'
              : 'This document requires verification. Please contact the Department of Home Affairs.'}
          </p>
          
          {isVerified && verificationCode && (
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-green-700">Verification Code:</span>
                <p className="font-mono font-medium text-green-900">{verificationCode}</p>
              </div>
              {verificationDate && (
                <div>
                  <span className="text-green-700">Verified On:</span>
                  <p className="font-medium text-green-900">
                    {formatSADate(verificationDate)}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
        
        <Button
          size="sm"
          variant={isVerified ? "outline" : "default"}
          className="flex items-center gap-1"
        >
          <QrCodeIcon className="h-4 w-4" />
          {isVerified ? 'Re-verify' : 'Verify Now'}
        </Button>
      </div>
    </div>
  );
}
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Shield, FileText, Info, AlertCircle, CheckCircle,
  Scale, Lock, Users, MessageSquare, Phone, Mail,
  ChevronRight, AlertTriangle, HelpCircle, BookOpen
} from "lucide-react";
import { POPIANotice, GovernmentDisclaimer } from "@/components/GovernmentAssets";

interface ConsentFormProps {
  onConsent: (consents: Record<string, boolean>) => void;
  requireAll?: boolean;
}

export function ConsentForm({ onConsent, requireAll = true }: ConsentFormProps) {
  const [consents, setConsents] = useState({
    dataProcessing: false,
    biometricData: false,
    verification: false,
    communication: false,
    termsAccepted: false,
    privacyAccepted: false
  });

  const allRequired = requireAll ? Object.values(consents).every(v => v) : 
    (consents.dataProcessing && consents.termsAccepted && consents.privacyAccepted);

  const handleConsentChange = (key: string, value: boolean) => {
    const updated = { ...consents, [key]: value };
    setConsents(updated);
  };

  return (
    <Card className="government-card">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Legal Consent & Authorization
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <POPIANotice />
        
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <Checkbox
                id="dataProcessing"
                checked={consents.dataProcessing}
                onCheckedChange={(checked) => handleConsentChange('dataProcessing', !!checked)}
                data-testid="checkbox-data-processing"
              />
              <div className="space-y-1">
                <Label htmlFor="dataProcessing" className="font-medium cursor-pointer">
                  Personal Information Processing *
                </Label>
                <p className="text-sm text-muted-foreground">
                  I consent to the Department of Home Affairs processing my personal information 
                  in accordance with the Protection of Personal Information Act 4 of 2013 (POPIA) 
                  for the purpose of providing government services.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="biometricData"
                checked={consents.biometricData}
                onCheckedChange={(checked) => handleConsentChange('biometricData', !!checked)}
                data-testid="checkbox-biometric"
              />
              <div className="space-y-1">
                <Label htmlFor="biometricData" className="font-medium cursor-pointer">
                  Biometric Data Collection {requireAll && '*'}
                </Label>
                <p className="text-sm text-muted-foreground">
                  I consent to the collection and processing of my biometric data (fingerprints, 
                  facial recognition) for identity verification and fraud prevention purposes.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="verification"
                checked={consents.verification}
                onCheckedChange={(checked) => handleConsentChange('verification', !!checked)}
                data-testid="checkbox-verification"
              />
              <div className="space-y-1">
                <Label htmlFor="verification" className="font-medium cursor-pointer">
                  Background Verification {requireAll && '*'}
                </Label>
                <p className="text-sm text-muted-foreground">
                  I authorize the Department to conduct background checks with relevant authorities 
                  including SAPS, Department of Justice, and credit bureaus where applicable.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="communication"
                checked={consents.communication}
                onCheckedChange={(checked) => handleConsentChange('communication', !!checked)}
                data-testid="checkbox-communication"
              />
              <div className="space-y-1">
                <Label htmlFor="communication" className="font-medium cursor-pointer">
                  Electronic Communication
                </Label>
                <p className="text-sm text-muted-foreground">
                  I consent to receive status updates and official communication via SMS and email 
                  regarding my application.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="termsAccepted"
                checked={consents.termsAccepted}
                onCheckedChange={(checked) => handleConsentChange('termsAccepted', !!checked)}
                data-testid="checkbox-terms"
              />
              <div className="space-y-1">
                <Label htmlFor="termsAccepted" className="font-medium cursor-pointer">
                  Terms of Service *
                </Label>
                <p className="text-sm text-muted-foreground">
                  I have read and accept the{' '}
                  <TermsOfService>
                    <span className="text-blue-600 underline cursor-pointer">Terms of Service</span>
                  </TermsOfService>
                  {' '}for using Department of Home Affairs online services.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Checkbox
                id="privacyAccepted"
                checked={consents.privacyAccepted}
                onCheckedChange={(checked) => handleConsentChange('privacyAccepted', !!checked)}
                data-testid="checkbox-privacy"
              />
              <div className="space-y-1">
                <Label htmlFor="privacyAccepted" className="font-medium cursor-pointer">
                  Privacy Policy *
                </Label>
                <p className="text-sm text-muted-foreground">
                  I have read and understand the{' '}
                  <PrivacyPolicy>
                    <span className="text-blue-600 underline cursor-pointer">Privacy Policy</span>
                  </PrivacyPolicy>
                  {' '}regarding the handling of my personal information.
                </p>
              </div>
            </div>
          </div>
        </div>

        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-amber-900">Important Notice</AlertTitle>
          <AlertDescription className="text-amber-800 text-sm">
            Providing false information is a criminal offense under Section 21 of the 
            Identification Act 68 of 1997 and may result in prosecution.
          </AlertDescription>
        </Alert>

        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            * Required fields
          </p>
          <Button 
            onClick={() => onConsent(consents)}
            disabled={!allRequired}
            data-testid="button-accept-consent"
          >
            Accept & Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface TermsOfServiceProps {
  children: React.ReactNode;
}

export function TermsOfService({ children }: TermsOfServiceProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Terms of Service - Department of Home Affairs
          </DialogTitle>
          <DialogDescription>
            Effective Date: {new Date().toLocaleDateString('en-ZA')}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6 text-sm">
            <section>
              <h3 className="font-semibold mb-2">1. Acceptance of Terms</h3>
              <p className="text-muted-foreground">
                By accessing and using the Department of Home Affairs online services, you accept 
                and agree to be bound by the terms and provision of this agreement. These services 
                are provided in accordance with the Electronic Communications and Transactions Act 
                25 of 2002.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">2. Service Description</h3>
              <p className="text-muted-foreground">
                The Department provides online services for application, renewal, and management of 
                official documents including but not limited to identity documents, passports, birth 
                certificates, and permits. Services are subject to verification and approval processes.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">3. User Obligations</h3>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Provide accurate, current, and complete information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Notify the Department immediately of any unauthorized use</li>
                <li>Comply with all applicable laws and regulations</li>
                <li>Not use the service for fraudulent or illegal purposes</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">4. Processing Times</h3>
              <p className="text-muted-foreground">
                Standard processing times are estimates and may vary based on application complexity, 
                verification requirements, and current workload. The Department does not guarantee 
                specific turnaround times unless explicitly stated for premium services.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">5. Fees and Payments</h3>
              <p className="text-muted-foreground">
                Fees are prescribed by regulation and are non-refundable once processing has commenced. 
                Payment must be made through approved government payment channels. Additional fees may 
                apply for expedited services.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">6. Data Protection</h3>
              <p className="text-muted-foreground">
                Personal information is processed in accordance with the Protection of Personal 
                Information Act (POPIA) and the Department's Privacy Policy. Information may be 
                shared with other government departments and law enforcement agencies as required by law.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">7. Limitation of Liability</h3>
              <p className="text-muted-foreground">
                The Department shall not be liable for any indirect, incidental, special, or 
                consequential damages arising from the use or inability to use the services. 
                The Department's total liability shall not exceed the fees paid for the specific service.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">8. Termination</h3>
              <p className="text-muted-foreground">
                The Department reserves the right to terminate or suspend access to services for 
                violation of these terms, fraudulent activity, or as required by law enforcement.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">9. Governing Law</h3>
              <p className="text-muted-foreground">
                These terms shall be governed by the laws of the Republic of South Africa. Any 
                disputes shall be subject to the exclusive jurisdiction of South African courts.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">10. Contact Information</h3>
              <p className="text-muted-foreground">
                For questions regarding these terms, contact:<br />
                Department of Home Affairs<br />
                Private Bag X114, Pretoria, 0001<br />
                Email: legal@dha.gov.za<br />
                Tel: 0800 60 11 90
              </p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface PrivacyPolicyProps {
  children: React.ReactNode;
}

export function PrivacyPolicy({ children }: PrivacyPolicyProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Privacy Policy - Department of Home Affairs
          </DialogTitle>
          <DialogDescription>
            Protection of Personal Information Act (POPIA) Compliant
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[60vh] pr-4">
          <div className="space-y-6 text-sm">
            <section>
              <h3 className="font-semibold mb-2">1. Information We Collect</h3>
              <p className="text-muted-foreground mb-2">
                The Department collects the following categories of personal information:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Identity information (name, ID number, date of birth)</li>
                <li>Contact details (address, phone, email)</li>
                <li>Biometric data (fingerprints, photographs)</li>
                <li>Employment and education history</li>
                <li>Criminal record information where applicable</li>
                <li>Immigration and travel history</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">2. Purpose of Processing</h3>
              <p className="text-muted-foreground">
                Personal information is processed for:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground mt-2">
                <li>Identity verification and document issuance</li>
                <li>National security and crime prevention</li>
                <li>Immigration control and border management</li>
                <li>Maintaining the National Population Register</li>
                <li>Statistical and research purposes</li>
                <li>Compliance with legal obligations</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">3. Information Sharing</h3>
              <p className="text-muted-foreground">
                Information may be shared with:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground mt-2">
                <li>Other government departments as required by law</li>
                <li>Law enforcement agencies for criminal investigations</li>
                <li>International organizations (Interpol, immigration authorities)</li>
                <li>Service providers under strict confidentiality agreements</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">4. Data Security</h3>
              <p className="text-muted-foreground">
                The Department implements appropriate technical and organizational measures including:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground mt-2">
                <li>Encryption of sensitive data</li>
                <li>Access controls and authentication</li>
                <li>Regular security audits and assessments</li>
                <li>Staff training on data protection</li>
                <li>Incident response procedures</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">5. Your Rights</h3>
              <p className="text-muted-foreground">
                Under POPIA, you have the right to:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-muted-foreground mt-2">
                <li>Access your personal information</li>
                <li>Request correction of inaccurate information</li>
                <li>Object to processing in certain circumstances</li>
                <li>Lodge a complaint with the Information Regulator</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold mb-2">6. Data Retention</h3>
              <p className="text-muted-foreground">
                Personal information is retained in accordance with the National Archives Act and 
                departmental retention schedules. Different categories of information have different 
                retention periods based on legal requirements.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">7. International Transfers</h3>
              <p className="text-muted-foreground">
                Personal information may be transferred internationally for immigration control, 
                document verification, and law enforcement cooperation. Such transfers are conducted 
                in accordance with applicable data protection laws.
              </p>
            </section>

            <section>
              <h3 className="font-semibold mb-2">8. Contact the Information Officer</h3>
              <p className="text-muted-foreground">
                Deputy Information Officer<br />
                Department of Home Affairs<br />
                Private Bag X114, Pretoria, 0001<br />
                Email: paia.popia@dha.gov.za<br />
                Tel: 012 406 2500
              </p>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

export function AppealProcess() {
  return (
    <Card className="government-card">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Scale className="h-5 w-5" />
          Appeal Process
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4" />
          <AlertTitle>Right to Appeal</AlertTitle>
          <AlertDescription>
            If your application has been rejected, you have the right to appeal the decision 
            within 30 days of notification.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Appeal Grounds</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              <li>Procedural irregularities in the application process</li>
              <li>New evidence not previously available</li>
              <li>Error in law or fact in the decision</li>
              <li>Unreasonable exercise of discretion</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Required Documents</h4>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              <li>Completed appeal form (DHA-109)</li>
              <li>Copy of rejection letter</li>
              <li>Supporting documentation for appeal grounds</li>
              <li>Proof of payment of appeal fee (R140)</li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold mb-2">Appeal Timeline</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Submit appeal</span>
                <span className="font-medium">Within 30 days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Acknowledgment</span>
                <span className="font-medium">7 working days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Review period</span>
                <span className="font-medium">30-60 days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Decision notification</span>
                <span className="font-medium">14 days after decision</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-4">
          <Button variant="outline" className="flex-1">
            <FileText className="h-4 w-4 mr-1" />
            Download Appeal Form
          </Button>
          <Button className="flex-1">
            <ChevronRight className="h-4 w-4 mr-1" />
            Start Appeal
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ComplaintsFeedback() {
  const [complaint, setComplaint] = useState("");
  const [category, setCategory] = useState("");

  return (
    <Card className="government-card">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Complaints & Feedback
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs defaultValue="complaint">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="complaint">Lodge Complaint</TabsTrigger>
            <TabsTrigger value="feedback">Provide Feedback</TabsTrigger>
          </TabsList>
          
          <TabsContent value="complaint" className="space-y-4">
            <div>
              <Label htmlFor="category">Complaint Category</Label>
              <select
                id="category"
                className="w-full mt-1 p-2 border rounded"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                data-testid="select-complaint-category"
              >
                <option value="">Select a category</option>
                <option value="service_delay">Service Delay</option>
                <option value="staff_conduct">Staff Conduct</option>
                <option value="incorrect_information">Incorrect Information</option>
                <option value="system_error">System Error</option>
                <option value="corruption">Corruption/Fraud</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <Label htmlFor="complaint">Complaint Details</Label>
              <Textarea
                id="complaint"
                placeholder="Please provide details of your complaint..."
                className="min-h-32 mt-1"
                value={complaint}
                onChange={(e) => setComplaint(e.target.value)}
                data-testid="textarea-complaint"
              />
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                Your complaint will be assigned a reference number and investigated within 
                21 working days. You will receive updates via SMS and email.
              </AlertDescription>
            </Alert>
          </TabsContent>
          
          <TabsContent value="feedback" className="space-y-4">
            <div>
              <Label htmlFor="feedback">Your Feedback</Label>
              <Textarea
                id="feedback"
                placeholder="We value your feedback on our services..."
                className="min-h-32 mt-1"
                data-testid="textarea-feedback"
              />
            </div>

            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 text-sm">
                Thank you for helping us improve our services. Your feedback is important to us.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        <div className="pt-2 border-t">
          <h4 className="font-semibold mb-3">Alternative Contact Methods</h4>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>Toll-free: 0800 60 11 90</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span>complaints@dha.gov.za</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span>Visit your nearest Home Affairs office</span>
            </div>
          </div>
        </div>

        <Button className="w-full" data-testid="button-submit-complaint">
          Submit
        </Button>
      </CardContent>
    </Card>
  );
}
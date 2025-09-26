import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  FileText, 
  Search, 
  Eye, 
  CheckCircle, 
  XCircle,
  Clock,
  Download,
  AlertTriangle,
  Filter
} from "lucide-react";
import AdminLayout from "@/components/admin/AdminLayout";
import { api } from "@/lib/api";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Document {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  processingStatus: string;
  isVerified?: boolean;
  verificationScore?: number;
  ocrText?: string;
  ocrConfidence?: number;
  createdAt: string;
  userId: string;
}

interface DocumentVerification {
  id: string;
  documentType: string;
  documentId: string;
  status: string;
  confidence: number;
  details: any;
  createdAt: string;
}

interface DocumentTemplate {
  id: string;
  name: string;
  type: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

export default function DocumentManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [viewDocumentDialog, setViewDocumentDialog] = useState(false);
  const { toast } = useToast();

  // Fetch documents
  const { data: documents, isLoading: documentsLoading, refetch } = useQuery<Document[]>({
    queryKey: ["/api/admin/documents", { status: statusFilter, search: searchTerm }],
  });

  // Fetch document verifications
  const { data: verifications, isLoading: verificationsLoading } = useQuery<DocumentVerification[]>({
    queryKey: ["/api/admin/document-verifications"],
  });

  // Fetch document templates
  const { data: templates, isLoading: templatesLoading } = useQuery<DocumentTemplate[]>({
    queryKey: ["/api/admin/document-templates"],
  });

  // Document verification mutation
  const verifyDocumentMutation = useMutation({
    mutationFn: async (data: { documentId: string; isApproved: boolean; notes?: string }) => {
      return api.post(`/admin/documents/${data.documentId}/verify`, {
        isApproved: data.isApproved,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      toast({
        title: "Document Verified",
        description: "Document verification status has been updated.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/documents"] });
      setViewDocumentDialog(false);
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to verify document.",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
      case "verified":
        return "text-green-600 bg-green-50";
      case "processing":
      case "pending":
        return "text-yellow-600 bg-yellow-50";
      case "failed":
      case "rejected":
        return "text-red-600 bg-red-50";
      default:
        return "text-gray-600 bg-gray-50";
    }
  };

  const getVerificationColor = (verified: boolean | undefined) => {
    if (verified === undefined) return "text-gray-600 bg-gray-50";
    return verified ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const filteredDocuments = documents?.filter(doc => {
    const matchesSearch = doc.originalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.filename.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.processingStatus === statusFilter;
    return matchesSearch && matchesStatus;
  }) || [];

  const pendingVerificationCount = documents?.filter(d => 
    d.processingStatus === "completed" && d.isVerified === undefined
  ).length || 0;

  const verifiedCount = documents?.filter(d => d.isVerified === true).length || 0;
  const rejectedCount = documents?.filter(d => d.isVerified === false).length || 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Document Management</h1>
            <p className="text-muted-foreground mt-2">
              Manage document processing, verification, and templates
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-64"
                data-testid="input-search-documents"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-border rounded-md text-sm"
              data-testid="select-status-filter"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card data-testid="card-total-documents">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{documents?.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                Documents processed
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-pending-verification">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Verification</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingVerificationCount}</div>
              <p className="text-xs text-muted-foreground">
                Awaiting review
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-verified">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verified</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{verifiedCount}</div>
              <p className="text-xs text-muted-foreground">
                Approved documents
              </p>
            </CardContent>
          </Card>

          <Card data-testid="card-rejected">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rejectedCount}</div>
              <p className="text-xs text-muted-foreground">
                Failed verification
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="documents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
            <TabsTrigger value="verification" data-testid="tab-verification">Verification Queue</TabsTrigger>
            <TabsTrigger value="templates" data-testid="tab-templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="documents">
            <Card>
              <CardHeader>
                <CardTitle>Document Library</CardTitle>
                <CardDescription>
                  All uploaded and processed documents
                </CardDescription>
              </CardHeader>
              <CardContent>
                {documentsLoading ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Document</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Verification</TableHead>
                        <TableHead>Size</TableHead>
                        <TableHead>Uploaded</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDocuments.map((document) => (
                        <TableRow key={document.id} data-testid={`document-row-${document.id}`}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{document.originalName}</div>
                              <div className="text-sm text-muted-foreground">{document.mimeType}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(document.processingStatus)}>
                              {document.processingStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {document.isVerified !== undefined ? (
                              <Badge className={getVerificationColor(document.isVerified)}>
                                {document.isVerified ? "Verified" : "Rejected"}
                              </Badge>
                            ) : (
                              <Badge variant="outline">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell>{formatFileSize(document.size)}</TableCell>
                          <TableCell>
                            {new Date(document.createdAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedDocument(document);
                                  setViewDocumentDialog(true);
                                }}
                                data-testid={`button-view-${document.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                data-testid={`button-download-${document.id}`}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="verification">
            <Card>
              <CardHeader>
                <CardTitle>Verification Queue</CardTitle>
                <CardDescription>
                  Documents awaiting manual verification
                </CardDescription>
              </CardHeader>
              <CardContent>
                {documentsLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {documents?.filter(d => d.processingStatus === "completed" && d.isVerified === undefined)
                      .map((document) => (
                        <div key={document.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{document.originalName}</h4>
                              <p className="text-sm text-muted-foreground">
                                Uploaded: {new Date(document.createdAt).toLocaleString()}
                              </p>
                              {document.ocrConfidence && (
                                <p className="text-sm text-muted-foreground">
                                  OCR Confidence: {document.ocrConfidence}%
                                </p>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedDocument(document);
                                  setViewDocumentDialog(true);
                                }}
                              >
                                Review
                              </Button>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => verifyDocumentMutation.mutate({
                                  documentId: document.id,
                                  isApproved: true,
                                })}
                                disabled={verifyDocumentMutation.isPending}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => verifyDocumentMutation.mutate({
                                  documentId: document.id,
                                  isApproved: false,
                                })}
                                disabled={verifyDocumentMutation.isPending}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    {!documents?.some(d => d.processingStatus === "completed" && d.isVerified === undefined) && (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="h-8 w-8 mx-auto mb-2" />
                        <p>No documents pending verification</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <CardTitle>Document Templates</CardTitle>
                <CardDescription>
                  Manage document generation templates
                </CardDescription>
              </CardHeader>
              <CardContent>
                {templatesLoading ? (
                  <div className="space-y-2">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted animate-pulse rounded" />
                    ))}
                  </div>
                ) : templates && templates.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {templates.map((template) => (
                      <div key={template.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{template.name}</h4>
                          <Badge variant={template.isActive ? "secondary" : "outline"}>
                            {template.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">
                          {template.description}
                        </p>
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">{template.type}</Badge>
                          <p className="text-xs text-muted-foreground">
                            {new Date(template.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2" />
                    <p>No templates available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Document View Dialog */}
        <Dialog open={viewDocumentDialog} onOpenChange={setViewDocumentDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Document Details</DialogTitle>
              <DialogDescription>
                Review document and verification details
              </DialogDescription>
            </DialogHeader>
            {selectedDocument && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Filename</label>
                    <p className="text-sm text-muted-foreground">{selectedDocument.originalName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Type</label>
                    <p className="text-sm text-muted-foreground">{selectedDocument.mimeType}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Size</label>
                    <p className="text-sm text-muted-foreground">{formatFileSize(selectedDocument.size)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <Badge className={getStatusColor(selectedDocument.processingStatus)}>
                      {selectedDocument.processingStatus}
                    </Badge>
                  </div>
                </div>

                {selectedDocument.ocrText && (
                  <div>
                    <label className="text-sm font-medium">OCR Text</label>
                    <div className="mt-2 p-3 bg-muted rounded-lg text-sm">
                      {selectedDocument.ocrText}
                    </div>
                    {selectedDocument.ocrConfidence && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Confidence: {selectedDocument.ocrConfidence}%
                      </p>
                    )}
                  </div>
                )}

                {selectedDocument.isVerified === undefined && (
                  <div className="flex space-x-2 pt-4">
                    <Button
                      onClick={() => verifyDocumentMutation.mutate({
                        documentId: selectedDocument.id,
                        isApproved: true,
                      })}
                      disabled={verifyDocumentMutation.isPending}
                      className="flex-1"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => verifyDocumentMutation.mutate({
                        documentId: selectedDocument.id,
                        isApproved: false,
                      })}
                      disabled={verifyDocumentMutation.isPending}
                      className="flex-1"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
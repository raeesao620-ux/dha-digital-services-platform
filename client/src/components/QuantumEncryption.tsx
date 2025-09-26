import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface QuantumKey {
  keyId: string;
  algorithm: string;
  entropy: number;
  expiresAt: string;
  createdAt: string;
}

interface QuantumStatus {
  activeKeys: number;
  algorithms: string[];
  averageEntropy: number;
  nextRotation: string;
  quantumReadiness: string;
  entropy?: number; // Added for explicit entropy
  keysGenerated?: number; // Added for explicit keysGenerated
}

interface EncryptionResult {
  encryptedData: string;
  keyId: string;
  algorithm: string;
}

export default function QuantumEncryption() {
  const [selectedAlgorithm, setSelectedAlgorithm] = useState("AES-256-GCM-QUANTUM");
  const [inputData, setInputData] = useState("");
  const [encryptedData, setEncryptedData] = useState("");
  const [selectedKeyId, setSelectedKeyId] = useState("");
  const [operationMode, setOperationMode] = useState<"encrypt" | "decrypt">("encrypt");

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get quantum keys
  const { data: quantumKeysData, isLoading: keysLoading } = useQuery({
    queryKey: ["/api/quantum/keys"],
    queryFn: () => api.get<QuantumKey[]>("/api/quantum/keys")
  });

  const quantumKeys = Array.isArray(quantumKeysData) ? quantumKeysData : [];

  // Get quantum system status
  const { data: quantumStatus } = useQuery({
    queryKey: ["/api/quantum/status"],
    queryFn: () => api.get<QuantumStatus>("/api/quantum/status"),
    refetchInterval: 30000
  });

  // Generate quantum key mutation
  const generateKeyMutation = useMutation({
    mutationFn: (algorithm: string) =>
      api.post("/api/quantum/keys/generate", { algorithm }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quantum/keys"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quantum/status"] });
      toast({
        title: "Quantum Key Generated",
        description: `New quantum key generated with ${selectedAlgorithm}`,
        className: "border-quantum bg-quantum/10 text-quantum",
      });
    },
    onError: () => {
      toast({
        title: "Key Generation Failed",
        description: "Failed to generate quantum key",
        variant: "destructive",
      });
    }
  });

  // Encrypt data mutation
  const encryptMutation = useMutation({
    mutationFn: (data: { data: string; keyId?: string }) =>
      api.post<EncryptionResult>("/api/quantum/encrypt", data),
    onSuccess: (result) => {
      setEncryptedData(result.encryptedData);
      setSelectedKeyId(result.keyId);
      toast({
        title: "Encryption Successful",
        description: `Data encrypted with ${result.algorithm}`,
        className: "border-secure bg-secure/10 text-secure",
      });
    },
    onError: () => {
      toast({
        title: "Encryption Failed",
        description: "Failed to encrypt data",
        variant: "destructive",
      });
    }
  });

  // Decrypt data mutation
  const decryptMutation = useMutation({
    mutationFn: (data: { encryptedData: string; keyId: string }) =>
      api.post<{ decryptedData: string }>("/api/quantum/decrypt", data),
    onSuccess: (result) => {
      setInputData(result.decryptedData);
      toast({
        title: "Decryption Successful",
        description: "Data decrypted successfully",
        className: "border-secure bg-secure/10 text-secure",
      });
    },
    onError: () => {
      toast({
        title: "Decryption Failed",
        description: "Failed to decrypt data",
        variant: "destructive",
      });
    }
  });

  const handleGenerateKey = () => {
    generateKeyMutation.mutate(selectedAlgorithm);
  };

  const handleEncryptData = () => {
    if (!inputData.trim()) {
      toast({
        title: "No Data to Encrypt",
        description: "Please enter some data to encrypt",
        variant: "destructive",
      });
      return;
    }

    encryptMutation.mutate({
      data: inputData,
      keyId: selectedKeyId || undefined
    });
  };

  const handleDecryptData = () => {
    if (!encryptedData.trim() || !selectedKeyId) {
      toast({
        title: "Missing Data",
        description: "Please provide encrypted data and select a key",
        variant: "destructive",
      });
      return;
    }

    decryptMutation.mutate({
      encryptedData,
      keyId: selectedKeyId
    });
  };

  const getEntropyBadge = (entropy: number) => {
    if (entropy >= 2048) return <Badge className="security-level-1">QUANTUM GRADE</Badge>;
    if (entropy >= 1024) return <Badge className="security-level-2">HIGH</Badge>;
    return <Badge className="security-level-3">STANDARD</Badge>;
  };

  const getReadinessBadge = (readiness: string) => {
    switch (readiness) {
      case "Quantum Ready":
        return <Badge className="security-level-1">QUANTUM READY</Badge>;
      case "Nearly Ready":
        return <Badge className="security-level-2">NEARLY READY</Badge>;
      default:
        return <Badge className="security-level-3">PREPARING</Badge>;
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Encryption Interface */}
      <Card className="quantum-encrypted glass border-glass-border" data-testid="card-quantum-encryption">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>⚛️</span>
            <span>Quantum Encryption Engine</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Algorithm Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Encryption Algorithm</label>
            <Select value={selectedAlgorithm} onValueChange={setSelectedAlgorithm}>
              <SelectTrigger data-testid="select-algorithm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AES-256-GCM-QUANTUM">AES-256-GCM (Quantum Enhanced)</SelectItem>
                <SelectItem value="ChaCha20-Poly1305-QUANTUM">ChaCha20-Poly1305 (Quantum Resistant)</SelectItem>
                <SelectItem value="Kyber-1024">Kyber-1024 (Post-Quantum)</SelectItem>
                <SelectItem value="NTRU-HRSS">NTRU-HRSS (Lattice-based)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Key Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Quantum Key</label>
            <Select value={selectedKeyId} onValueChange={setSelectedKeyId}>
              <SelectTrigger data-testid="select-key">
                <SelectValue placeholder="Select a quantum key or generate new" />
              </SelectTrigger>
              <SelectContent>
                {quantumKeys.map((key) => (
                  <SelectItem key={key.keyId} value={key.keyId}>
                    {key.keyId.slice(0, 20)}... ({key.algorithm})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={handleGenerateKey}
              disabled={generateKeyMutation.isPending}
              variant="outline"
              className="w-full border-quantum text-quantum hover:bg-quantum/10"
              data-testid="button-generate-key"
            >
              {generateKeyMutation.isPending ? (
                <>
                  <span className="loading-spinner w-4 h-4 mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <span>⚛️</span>
                  <span className="ml-2">Generate Quantum Key</span>
                </>
              )}
            </Button>
          </div>

          {/* Operation Mode Toggle */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Operation Mode</label>
            <div className="flex space-x-2">
              <Button
                onClick={() => setOperationMode("encrypt")}
                variant={operationMode === "encrypt" ? "default" : "outline"}
                className="flex-1"
                data-testid="button-mode-encrypt"
              >
                🔒 Encrypt
              </Button>
              <Button
                onClick={() => setOperationMode("decrypt")}
                variant={operationMode === "decrypt" ? "default" : "outline"}
                className="flex-1"
                data-testid="button-mode-decrypt"
              >
                🔓 Decrypt
              </Button>
            </div>
          </div>

          {/* Data Input */}
          <div className="space-y-3">
            <label className="text-sm font-medium">
              {operationMode === "encrypt" ? "Data to Encrypt" : "Data to Decrypt"}
            </label>
            <Textarea
              value={operationMode === "encrypt" ? inputData : encryptedData}
              onChange={(e) =>
                operationMode === "encrypt"
                  ? setInputData(e.target.value)
                  : setEncryptedData(e.target.value)
              }
              placeholder={
                operationMode === "encrypt"
                  ? "Enter sensitive data to encrypt..."
                  : "Paste encrypted data here..."
              }
              className="min-h-32 mono"
              data-testid="textarea-data"
            />
          </div>

          {/* Action Button */}
          <Button
            onClick={operationMode === "encrypt" ? handleEncryptData : handleDecryptData}
            disabled={
              operationMode === "encrypt"
                ? encryptMutation.isPending || !inputData.trim()
                : decryptMutation.isPending || !encryptedData.trim() || !selectedKeyId
            }
            className="w-full quantum-encrypted text-white font-semibold py-3"
            data-testid="button-execute-operation"
          >
            {operationMode === "encrypt" ? (
              encryptMutation.isPending ? (
                <>
                  <span className="loading-spinner w-4 h-4 mr-2" />
                  Encrypting...
                </>
              ) : (
                <>
                  <span>🛡️</span>
                  <span className="ml-2">Start Quantum Encryption</span>
                </>
              )
            ) : (
              decryptMutation.isPending ? (
                <>
                  <span className="loading-spinner w-4 h-4 mr-2" />
                  Decrypting...
                </>
              ) : (
                <>
                  <span>🔓</span>
                  <span className="ml-2">Decrypt Data</span>
                </>
              )
            )}
          </Button>

          {/* Result Display */}
          {((operationMode === "encrypt" && encryptedData) || (operationMode === "decrypt" && inputData)) && (
            <div className="space-y-3">
              <label className="text-sm font-medium">
                {operationMode === "encrypt" ? "Encrypted Result" : "Decrypted Result"}
              </label>
              <Textarea
                value={operationMode === "encrypt" ? encryptedData : inputData}
                readOnly
                className="min-h-32 mono bg-muted/50"
                data-testid="textarea-result"
              />
              <Button
                onClick={() => {
                  const text = operationMode === "encrypt" ? encryptedData : inputData;
                  navigator.clipboard.writeText(text);
                  toast({
                    title: "Copied to Clipboard",
                    description: "Result copied to clipboard",
                    className: "border-secure bg-secure/10 text-secure",
                  });
                }}
                variant="outline"
                size="sm"
                data-testid="button-copy-result"
              >
                📋 Copy to Clipboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quantum Status Dashboard */}
      <Card className="glass border-glass-border" data-testid="card-quantum-status">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>📊</span>
            <span>Quantum System Status</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* System Metrics */}
          {quantumStatus ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-quantum/20 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-quantum mb-1">
                  {quantumStatus.activeKeys || 0}
                </div>
                <div className="text-sm text-muted-foreground">Active Keys</div>
              </div>
              <div className="bg-secure/20 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-secure mb-1">
                  {typeof quantumStatus.entropy === 'number' && !isNaN(quantumStatus.entropy)
                    ? quantumStatus.entropy.toFixed(2)
                    : '0.00'
                  }
                </div>
                <div className="text-sm text-muted-foreground">Avg Entropy</div>
              </div>
              <div className="bg-primary/20 p-4 rounded-lg text-center">
                <div className="text-lg font-bold text-primary mb-1">
                  {quantumStatus.nextRotation || "24h"}
                </div>
                <div className="text-sm text-muted-foreground">Next Rotation</div>
              </div>
              <div className="bg-warning/20 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-warning mb-1">
                  {typeof quantumStatus.keysGenerated === 'number' && !isNaN(quantumStatus.keysGenerated)
                    ? quantumStatus.keysGenerated
                    : 0
                  }
                </div>
                <div className="text-sm text-muted-foreground">System Status</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8">
              <div className="loading-spinner w-6 h-6" />
            </div>
          )}

          {/* Active Keys */}
          <div className="space-y-3">
            <h4 className="font-medium">Active Quantum Keys</h4>
            {keysLoading ? (
              <div className="flex items-center justify-center py-4">
                <div className="loading-spinner w-4 h-4" />
              </div>
            ) : quantumKeys.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {quantumKeys.map((key) => (
                  <div
                    key={key.keyId}
                    className="p-3 bg-muted/30 rounded-lg flex items-center justify-between"
                    data-testid={`key-${key.keyId}`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-quantum">🔑</span>
                      <div>
                        <div className="text-sm font-medium mono">
                          {key.keyId.slice(0, 16)}...
                        </div>
                        <div className="text-xs text-muted-foreground">{key.algorithm}</div>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      {getEntropyBadge(key.entropy)}
                      <div className="text-xs text-muted-foreground">
                        Expires: {new Date(key.expiresAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                <p>No quantum keys available</p>
                <p className="text-sm">Generate your first quantum key above</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="space-y-3">
            <h4 className="font-medium">Quick Actions</h4>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full border-quantum text-quantum hover:bg-quantum/10"
                data-testid="button-rotate-keys"
              >
                <span>🔄</span>
                <span className="ml-2">Rotate All Keys</span>
              </Button>
              <Button
                variant="outline"
                className="w-full border-warning text-warning hover:bg-warning/10"
                data-testid="button-emergency-purge"
              >
                <span>🚨</span>
                <span className="ml-2">Emergency Key Purge</span>
              </Button>
              <Button
                variant="outline"
                className="w-full border-primary text-primary hover:bg-primary/10"
                data-testid="button-export-keys"
              >
                <span>📤</span>
                <span className="ml-2">Export Key Backup</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
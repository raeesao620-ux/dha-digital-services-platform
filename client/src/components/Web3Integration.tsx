import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Wallet, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BlockchainVerification {
  isVerified: boolean;
  transactionId?: string;
  blockNumber?: number;
  timestamp?: Date;
}

interface Web3IntegrationProps {
  documentId?: string;
  documentHash?: string;
  onVerificationComplete?: (verification: BlockchainVerification) => void;
}

/**
 * Web3 Integration Component for blockchain verification and MetaMask connectivity
 */
export function Web3Integration({ 
  documentId, 
  documentHash, 
  onVerificationComplete 
}: Web3IntegrationProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [verification, setVerification] = useState<BlockchainVerification | null>(null);
  const { toast } = useToast();

  // Check if MetaMask is available
  const isMetaMaskAvailable = typeof window !== 'undefined' && (window as any).ethereum;

  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    if (!isMetaMaskAvailable) return;

    try {
      const accounts = await (window as any).ethereum.request({ 
        method: 'eth_accounts' 
      });
      
      if (accounts.length > 0) {
        setIsConnected(true);
        setWalletAddress(accounts[0]);
      }
    } catch (error) {
      console.error('Failed to check wallet connection:', error);
    }
  };

  const connectWallet = async () => {
    if (!isMetaMaskAvailable) {
      toast({
        title: "MetaMask Not Found",
        description: "Please install MetaMask to connect your wallet",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const accounts = await (window as any).ethereum.request({
        method: 'eth_requestAccounts'
      });

      if (accounts.length > 0) {
        setIsConnected(true);
        setWalletAddress(accounts[0]);
        toast({
          title: "Wallet Connected",
          description: `Connected to ${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`,
        });
      }
    } catch (error) {
      toast({
        title: "Connection Failed",
        description: "Failed to connect to MetaMask wallet",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOnBlockchain = async () => {
    if (!documentId || !documentHash) {
      toast({
        title: "Missing Document Data",
        description: "Document ID and hash are required for blockchain verification",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      // Call our backend API to verify document on blockchain
      const response = await fetch('/api/web3/verify-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId,
          documentHash
        })
      });

      if (!response.ok) {
        throw new Error('Verification failed');
      }

      const result = await response.json();
      
      const verificationResult: BlockchainVerification = {
        isVerified: result.isValid,
        transactionId: result.blockchainRecord?.blockchainTxId,
        blockNumber: result.blockchainRecord?.blockNumber,
        timestamp: result.blockchainRecord?.timestamp ? new Date(result.blockchainRecord.timestamp) : new Date()
      };

      setVerification(verificationResult);
      onVerificationComplete?.(verificationResult);

      toast({
        title: verificationResult.isVerified ? "Document Verified" : "Verification Failed",
        description: verificationResult.isVerified 
          ? "Document authenticity confirmed on blockchain"
          : "Document could not be verified on blockchain",
        variant: verificationResult.isVerified ? "default" : "destructive"
      });

    } catch (error) {
      toast({
        title: "Verification Error",
        description: "Failed to verify document on blockchain",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const anchorToBlockchain = async () => {
    if (!documentId || !documentHash) {
      toast({
        title: "Missing Document Data",
        description: "Document ID and hash are required for blockchain anchoring",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/web3/anchor-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId,
          documentHash
        })
      });

      if (!response.ok) {
        throw new Error('Anchoring failed');
      }

      const result = await response.json();

      toast({
        title: "Document Anchored",
        description: `Document anchored to blockchain. TX: ${result.blockchainTxId?.slice(0, 10)}...`,
      });

    } catch (error) {
      toast({
        title: "Anchoring Error", 
        description: "Failed to anchor document to blockchain",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Wallet Connection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" />
            Web3 Wallet Connection
          </CardTitle>
          <CardDescription>
            Connect your wallet for blockchain verification features
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-3">
            {!isConnected ? (
              <Button 
                onClick={connectWallet} 
                disabled={isLoading || !isMetaMaskAvailable}
                className="w-full sm:w-auto"
                data-testid="button-connect-wallet"
              >
                {isLoading ? "Connecting..." : "Connect MetaMask"}
              </Button>
            ) : (
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full">
                <Badge variant="secondary" className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3" />
                  Connected
                </Badge>
                <span className="text-sm text-muted-foreground font-mono break-all">
                  {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                </span>
              </div>
            )}
            
            {!isMetaMaskAvailable && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                MetaMask not installed
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Blockchain Verification */}
      {documentId && documentHash && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <LinkIcon className="h-4 w-4" />
              Blockchain Verification
            </CardTitle>
            <CardDescription>
              Verify document authenticity using blockchain technology
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  onClick={verifyOnBlockchain}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full sm:w-auto"
                  data-testid="button-verify-blockchain"
                >
                  {isLoading ? "Verifying..." : "Verify on Blockchain"}
                </Button>
                
                <Button 
                  onClick={anchorToBlockchain}
                  disabled={isLoading}
                  className="w-full sm:w-auto"
                  data-testid="button-anchor-blockchain"
                >
                  {isLoading ? "Anchoring..." : "Anchor to Blockchain"}
                </Button>
              </div>

              {verification && (
                <div className="p-4 border rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2 mb-2">
                    {verification.isVerified ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="font-medium">
                      {verification.isVerified ? "Verified" : "Not Verified"}
                    </span>
                  </div>
                  
                  {verification.transactionId && (
                    <div className="text-sm space-y-1">
                      <div>
                        <span className="text-muted-foreground">TX ID:</span>{" "}
                        <span className="font-mono text-xs break-all">
                          {verification.transactionId}
                        </span>
                      </div>
                      {verification.blockNumber && (
                        <div>
                          <span className="text-muted-foreground">Block:</span>{" "}
                          <span className="font-mono">{verification.blockNumber}</span>
                        </div>
                      )}
                      {verification.timestamp && (
                        <div>
                          <span className="text-muted-foreground">Time:</span>{" "}
                          <span>{verification.timestamp.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Blockchain Networks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Supported Networks</CardTitle>
          <CardDescription>
            Available blockchain networks for verification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Ethereum</Badge>
            <Badge variant="outline">Polygon</Badge>
            <Badge variant="outline">Binance Smart Chain</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default Web3Integration;
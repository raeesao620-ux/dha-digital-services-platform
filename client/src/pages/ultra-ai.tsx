
import UltraAIInterface from "@/components/UltraAIInterface";
import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";

export default function UltraAIPage() {
  const { user } = useAuth();
  
  // Redirect non-Raeesa users
  if (!user || (user.email !== 'raeesa.osman@admin' && user.email !== 'admin@dha.gov.za')) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="ultra-ai-page">
      <UltraAIInterface />
    </div>
  );
}

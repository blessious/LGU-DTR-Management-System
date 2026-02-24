import { useAuth } from '@/contexts/AuthContext';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredLevel?: number;
  fallbackMessage?: string;
}

export default function ProtectedRoute({ 
  children, 
  requiredLevel = 1,
  fallbackMessage 
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, admin, hasPrivilege } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // This will be handled by the main App component
  }

  if (!hasPrivilege(requiredLevel)) {
    const defaultMessage = `Access denied. This feature requires ${getLevelText(requiredLevel)} privileges. Your current level: ${admin?.levelText}`;
    
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {fallbackMessage || defaultMessage}
            </AlertDescription>
          </Alert>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => navigate(-1)} variant="outline">
              Go Back
            </Button>
            <Button onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

// Helper function to get level text
function getLevelText(level: number): string {
  switch (level) {
    case 1: return 'Viewer';
    case 2: return 'HR';
    case 3: return 'Administrator';
    default: return 'Unknown';
  }
}
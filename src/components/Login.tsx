import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, LogIn, Clock, User, Lock, Eye, EyeOff, UserCog } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const { login } = useAuth();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password");
      return;
    }

    setIsLoggingIn(true);

    try {
      await login(username, password);
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials and try again.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGuestLogin = () => {
    setError("");
    setIsLoggingIn(true);

    setUsername("guest");
    setPassword("guest123");
    
    setTimeout(async () => {
      try {
        await login("guest", "guest123");
      } catch (err: any) {
        setError(err.message || "Guest login failed. Please try again.");
      } finally {
        setIsLoggingIn(false);
      }
    }, 500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-blue-900/20 dark:to-indigo-900/20 p-3 sm:p-4 relative overflow-hidden">
      {/* Animated Background Elements - Reduced size on mobile */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-16 w-40 h-40 sm:-top-40 sm:-right-32 sm:w-80 sm:h-80 bg-blue-200 dark:bg-blue-800/30 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
        <div className="absolute -bottom-20 -left-16 w-40 h-40 sm:-bottom-40 sm:-left-32 sm:w-80 sm:h-80 bg-indigo-200 dark:bg-indigo-800/30 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 sm:w-80 sm:h-80 bg-purple-200 dark:bg-purple-800/30 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse animation-delay-4000"></div>
      </div>

      {/* Main Login Card */}
      <div className={`relative w-full max-w-[95vw] sm:max-w-md transition-all duration-700 ease-out ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
      }`}>
        <Card className="shadow-2xl border-0 backdrop-blur-sm bg-white/90 dark:bg-gray-800/90 dark:border-gray-700 mx-auto">
          <CardHeader className="space-y-1 text-center pb-6 sm:pb-8 pt-6 sm:pt-10 px-4 sm:px-6">
            {/* Logo - Smaller on mobile */}
            <div className="mx-auto mb-4 sm:mb-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg">
                <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
              </div>
            </div>
            
            <CardTitle className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent pb-1">
              DTR Management System
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-gray-400 text-sm sm:text-base">
              
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4 sm:space-y-6 pb-6 sm:pb-8 px-4 sm:px-6">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              {error && (
                <Alert variant="destructive" className="animate-in fade-in duration-300 border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-xs sm:text-sm">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="dark:text-red-200">{error}</AlertDescription>
                </Alert>
              )}
              
              {/* Username Field */}
              <div className="space-y-2 sm:space-y-3">
                <Label htmlFor="username" className="text-xs sm:text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center gap-2">
                  <User className="w-3 h-3 sm:w-4 sm:h-4" />
                  Username
                </Label>
                <div className="relative">
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyPress={handleKeyPress}
                    required
                    disabled={isLoggingIn}
                    className="h-10 sm:h-12 pl-10 sm:pl-11 pr-3 border-slate-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all duration-200 rounded-xl text-sm sm:text-base dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    autoComplete="username"
                  />
                  <User className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-slate-400 dark:text-gray-500" />
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-2 sm:space-y-3">
                <Label htmlFor="password" className="text-xs sm:text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center gap-2">
                  <Lock className="w-3 h-3 sm:w-4 sm:h-4" />
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={handleKeyPress}
                    required
                    disabled={isLoggingIn}
                    className="h-10 sm:h-12 pl-10 sm:pl-11 pr-10 sm:pr-11 border-slate-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 transition-all duration-200 rounded-xl text-sm sm:text-base dark:bg-gray-700 dark:text-white dark:placeholder-gray-400"
                    autoComplete="current-password"
                  />
                  <Lock className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-slate-400 dark:text-gray-500" />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-400 transition-colors duration-200"
                  >
                    {showPassword ? <EyeOff className="w-3 h-3 sm:w-4 sm:h-4" /> : <Eye className="w-3 h-3 sm:w-4 sm:h-4" />}
                  </button>
                </div>
              </div>

              {/* Login Button */}
              <Button 
                type="submit" 
                className="w-full h-10 sm:h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 dark:from-blue-700 dark:to-indigo-700 dark:hover:from-blue-600 dark:hover:to-indigo-600 text-white shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl font-semibold transform hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="mr-2 sm:mr-3 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="mr-2 sm:mr-3 h-3 w-3 sm:h-4 sm:w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>

            {/* Guest Login Button */}
            <div className="text-center">
              <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400 mb-2 sm:mb-3">or</p>
              
              <Button
                type="button"
                onClick={handleGuestLogin}
                disabled={isLoggingIn}
                className="w-full h-10 sm:h-12 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 dark:from-green-600 dark:to-emerald-600 dark:hover:from-green-500 dark:hover:to-emerald-500 text-white shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl font-semibold transform hover:scale-[1.02] active:scale-[0.98] text-sm sm:text-base"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="mr-2 sm:mr-3 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                    Signing in as Guest...
                  </>
                ) : (
                  <>
                    <UserCog className="mr-2 sm:mr-3 h-3 w-3 sm:w-4 sm:h-4" />
                    Continue as Guest
                  </>
                )}
              </Button>
              
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-2 sm:mt-2 text-[10px] sm:text-xs">
                Demo access with view-only privileges
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Footer - Smaller on mobile */}
      <div className="absolute bottom-2 sm:bottom-4 left-1/2 transform -translate-x-1/2 text-center w-full px-4">
        <p className="text-xs sm:text-sm text-slate-500 dark:text-gray-400">
          Secure DTR Management System • Version 2.0
        </p>
      </div>
    </div>
  );
}
import { ReactNode, useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Clock, Users, UserCheck, Award, Shield, Monitor, LogOut, Settings, Menu, X, Loader2, Database, Download, Palette } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import axios from 'axios';

interface LayoutProps {
  children: ReactNode;
}

interface SettingsData {
  database: {
    host: string;
    database: string;
    username: string;
    port: number;
  };
  export: {
    path: string;
  };
}

type Theme = 
  | "light" 
  | "dark" 
  | "ocean" 
  | "forest" 
  | "sunset" 
  | "rose" 
  | "lavender" 
  | "slate" 
  | "crimson" 
  | "amber";

const themeOptions: { value: Theme; label: string; emoji: string }[] = [
  { value: "light", label: "Light", emoji: "☀️" },
  { value: "dark", label: "Dark", emoji: "🌙" },
  { value: "ocean", label: "Ocean", emoji: "🌊" },
  { value: "forest", label: "Forest", emoji: "🌲" },
  { value: "slate", label: "Slate", emoji: "⚡" },
  { value: "crimson", label: "Crimson", emoji: "🔥" },
  { value: "rose", label: "Rose", emoji: "🌸" },
  { value: "lavender", label: "Lavender", emoji: "💜" },
  { value: "sunset", label: "Sunset", emoji: "🌅" },
  { value: "amber", label: "Amber", emoji: "✨" },
];

export default function Layout({ children }: LayoutProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settings, setSettings] = useState({
    host: "",
    database: "",
    username: "",
    password: "",
    port: "3306",
    exportPath: "",
  });
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('theme') as Theme;
    return savedTheme && themeOptions.find(t => t.value === savedTheme) ? savedTheme : 'light';
  });
  const { logout, admin, isAuthenticated, canManageAdmins } = useAuth();
  const location = useLocation();

  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  // Define navItems AFTER canManageAdmins is available
  const navItems = [
    { to: "/", icon: Clock, label: "Dashboard" },
    { to: "/employees", icon: Users, label: "Employees" },
    { to: "/dept-heads", icon: UserCheck, label: "Dept. Heads" },
    { to: "/officials", icon: Award, label: "Officials" },
    { to: "/admins", icon: Shield, label: "Admins", show: canManageAdmins() },
    { to: "/biometrics", icon: Monitor, label: "Biometrics", show: canManageAdmins() },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Apply theme on initial load and when theme changes
  useEffect(() => {
    const root = document.documentElement;
    
    // Remove all theme classes first
    root.classList.remove(
      "dark",
      "theme-ocean",
      "theme-forest",
      "theme-sunset",
      "theme-rose",
      "theme-lavender",
      "theme-slate",
      "theme-crimson",
      "theme-amber"
    );
    
    // Apply the selected theme
    if (theme === "dark") {
      root.classList.add("dark");
    } else if (theme !== "light") {
      root.classList.add(`theme-${theme}`);
    }
    
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Load settings when dialog opens
  useEffect(() => {
    if (isSettingsOpen) {
      loadSettings();
    }
  }, [isSettingsOpen]);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const loadSettings = async () => {
    setIsLoadingSettings(true);
    try {
      const response = await axios.get<SettingsData>(`${API_URL}/api/settings`);
      const data = response.data;
      
      setSettings({
        host: data.database.host || "",
        database: data.database.database || "",
        username: data.database.username || "",
        password: "", // Don't populate password for security
        port: data.database.port?.toString() || "3306",
        exportPath: data.export.path || "exports",
      });
      
      console.log('✅ Settings loaded successfully');
    } catch (error) {
      console.error('❌ Error loading settings:', error);
      alert('Failed to load settings. Please try again.');
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const handleLogout = () => {
    if (confirm('Are you sure you want to log out?')) {
      logout();
    }
  };

  const handleSaveSettings = async () => {
    // Validate required fields
    if (!settings.host || !settings.database || !settings.username) {
      alert('Please fill in all required fields (Host, Database, Username)');
      return;
    }

    setIsSavingSettings(true);
    try {
      const response = await axios.post(`${API_URL}/api/settings`, {
        host: settings.host,
        database: settings.database,
        username: settings.username,
        password: settings.password || undefined, // Only send if provided
        port: parseInt(settings.port) || 3306,
        exportPath: settings.exportPath || 'exports'
      });

      console.log('✅ Settings saved successfully:', response.data);
      alert('Settings saved successfully! The application will use the new database configuration.');
      setIsSettingsOpen(false);
      
      // Clear password field after successful save
      setSettings(prev => ({ ...prev, password: "" }));
      
    } catch (error: any) {
      console.error('❌ Error saving settings:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.details || error.message || 'Unknown error';
      alert(`Failed to save settings: ${errorMessage}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const getPrivilegeLevelText = (level: number): string => {
    switch (level) {
      case 1: return "Viewer";
      case 2: return "HR Staff";
      case 3: return "Administrator";
      default: return "User";
    }
  };

  const getPrivilegeLevelColor = (level: number): string => {
    switch (level) {
      case 1: return "text-blue-600 bg-blue-50 border border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800";
      case 2: return "text-emerald-600 bg-emerald-50 border border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/20 dark:border-emerald-800";
      case 3: return "text-violet-600 bg-violet-50 border border-violet-200 dark:text-violet-400 dark:bg-violet-900/20 dark:border-violet-800";
      default: return "text-gray-600 bg-gray-50 border border-gray-200 dark:text-gray-400 dark:bg-gray-900/20 dark:border-gray-800";
    }
  };

  const cycleTheme = () => {
    const currentIndex = themeOptions.findIndex(t => t.value === theme);
    const nextIndex = (currentIndex + 1) % themeOptions.length;
    setTheme(themeOptions[nextIndex].value);
  };

  const getCurrentThemeOption = () => {
    return themeOptions.find(t => t.value === theme) || themeOptions[0];
  };

  const renderSettingsForm = () => (
    <div className="space-y-6 py-2">
      {isLoadingSettings ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground">Loading settings...</span>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <Database className="w-5 h-5 text-primary" />
              Database Configuration
            </h3>
            <p className="text-sm text-muted-foreground">
              Configure your database connection settings
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="host" className="text-sm font-medium text-foreground">
                Database Host <span className="text-red-500">*</span>
              </Label>
              <Input
                id="host"
                placeholder="e.g., 192.168.1.52 or localhost"
                value={settings.host}
                onChange={(e) => setSettings({...settings, host: e.target.value})}
                disabled={isSavingSettings}
                className="h-10 bg-background border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="database" className="text-sm font-medium text-foreground">
                Database Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="database"
                placeholder="e.g., bless_dtr_test"
                value={settings.database}
                onChange={(e) => setSettings({...settings, database: e.target.value})}
                disabled={isSavingSettings}
                className="h-10 bg-background border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="username" className="text-sm font-medium text-foreground">
                Database Username <span className="text-red-500">*</span>
              </Label>
              <Input
                id="username"
                placeholder="e.g., adtr"
                value={settings.username}
                onChange={(e) => setSettings({...settings, username: e.target.value})}
                disabled={isSavingSettings}
                className="h-10 bg-background border-border text-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="port" className="text-sm font-medium text-foreground">
                Database Port
              </Label>
              <Input
                id="port"
                type="number"
                placeholder="3306"
                value={settings.port}
                onChange={(e) => setSettings({...settings, port: e.target.value})}
                disabled={isSavingSettings}
                className="h-10 bg-background border-border text-foreground"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium text-foreground">
              Database Password <span className="text-xs text-muted-foreground">(leave blank to keep current)</span>
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter new password or leave blank"
              value={settings.password}
              onChange={(e) => setSettings({...settings, password: e.target.value})}
              disabled={isSavingSettings}
              className="h-10 bg-background border-border text-foreground"
            />
          </div>

          <div className="space-y-2 pt-4 border-t border-border">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <Download className="w-5 h-5 text-primary" />
              Export Settings
            </h3>
            <p className="text-sm text-muted-foreground">
              Configure where DTR files will be exported
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="exportPath" className="text-sm font-medium text-foreground">
              Export Path
            </Label>
            <Input
              id="exportPath"
              placeholder="exports"
              value={settings.exportPath}
              onChange={(e) => setSettings({...settings, exportPath: e.target.value})}
              disabled={isSavingSettings}
              className="h-10 bg-background border-border text-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Directory where DTR files will be exported
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setIsSettingsOpen(false)}
              disabled={isSavingSettings}
              className="px-6 border-border text-foreground hover:bg-accent"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSaveSettings}
              disabled={isSavingSettings}
              className="px-6 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {isSavingSettings ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Settings'
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-card border-b border-border z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="w-10 h-10 rounded-lg hover:bg-accent"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shadow-sm">
              <Clock className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-lg font-bold text-foreground">DTR System</h1>
          </div>
        </div>
      </div>

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-72 bg-card border-r border-border flex-col fixed h-full z-40">
        {/* Logo Section */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center shadow-sm">
              <Clock className="w-7 h-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">DTR Management</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Time Tracking System</p>
            </div>
          </div>
        </div>

        {/* REMOVED: User Info Section */}

      {/* Live Clock */}
      <div className="mx-4 mt-4 mb-4 p-4 bg-primary/5 rounded-xl border border-border">
        <div className="text-center">
          <p className="text-xs text-muted-foreground mb-2 font-medium">{formatDate(currentTime)}</p>
          <p className="text-2xl font-bold text-primary">
            {formatTime(currentTime)}
          </p>
        </div>
      </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 px-3 overflow-y-auto">
          <ul className="space-y-1.5">
            {navItems
              .filter(item => !item.hasOwnProperty('show') || item.show)
              .map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm scale-105"
                            : "text-foreground/80 hover:text-foreground hover:bg-accent hover:scale-105"
                        }`
                      }
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </NavLink>
                  </li>
                );
              })}
            
            {/* Settings Modal Trigger - Only for admins */}
            {canManageAdmins() && (
              <li>
                <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                  <DialogTrigger asChild>
                    <button className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-foreground/80 hover:text-foreground hover:bg-accent hover:scale-105 w-full group">
                      <Settings className="w-5 h-5 transition-transform duration-500 group-hover:rotate-180" />
                      <span className="font-medium">Settings</span>
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto bg-card border-border">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2 text-xl text-foreground">
                        <Settings className="w-6 h-6 text-primary" />
                        System Settings
                      </DialogTitle>
                      <p className="text-sm text-muted-foreground">
                        Configure database connection and export settings
                      </p>
                    </DialogHeader>
                    {renderSettingsForm()}
                  </DialogContent>
                </Dialog>
              </li>
            )}
          </ul>
        </nav>

        {/* Theme Toggle and Logout */}
        <div className="p-3 border-t border-border space-y-2">
          {/* Theme Toggle Button */}
          <Button
            variant="outline"
            onClick={cycleTheme}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border-border text-foreground hover:bg-accent h-auto"
          >
            <Palette className="w-5 h-5" />
            <span className="font-medium flex-1 text-left">Theme</span>
            <div className="flex items-center gap-2">
              <span className="text-lg">{getCurrentThemeOption().emoji}</span>
              <span className="text-sm font-medium">{getCurrentThemeOption().label}</span>
            </div>
          </Button>

          {/* Logout Button */}
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border-border text-foreground hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:border-red-800 dark:hover:text-red-400 transition-all duration-200 h-auto"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </Button>
        </div>

        {/* Version */}
        <div className="p-4 border-t border-border">
          <p className="text-xs text-muted-foreground/60 text-center font-medium">
            DTR Management System v2.0
          </p>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {isMobileMenuOpen && (
        <>
          <div 
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          
          <aside className="lg:hidden fixed left-0 top-0 bottom-0 w-72 bg-card border-r border-border shadow-xl flex-col z-50 overflow-y-auto">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center shadow-sm">
                  <Clock className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">DTR System</h1>
                  <p className="text-xs text-muted-foreground mt-0.5">Time Tracking</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-10 h-10 rounded-lg hover:bg-accent"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Mobile Navigation */}
            <nav className="flex-1 py-2 px-3">
              <ul className="space-y-1.5">
                {navItems
                  .filter(item => !item.hasOwnProperty('show') || item.show)
                  .map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                              isActive
                                ? "bg-primary text-primary-foreground shadow-sm scale-105"
                                : "text-foreground/80 hover:text-foreground hover:bg-accent hover:scale-105"
                            }`
                          }
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <Icon className="w-5 h-5" />
                          <span className="font-medium">{item.label}</span>
                        </NavLink>
                      </li>
                    );
                  })}
                
                {/* Settings Modal Trigger - Only for admins */}
                {canManageAdmins() && (
                  <li>
                    <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                      <DialogTrigger asChild>
                        <button 
                          className="flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 text-foreground/80 hover:text-foreground hover:bg-accent hover:scale-105 w-full group"
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <Settings className="w-5 h-5 transition-transform duration-500 group-hover:rotate-180" />
                          <span className="font-medium">Settings</span>
                        </button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto bg-card border-border">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2 text-xl text-foreground">
                            <Settings className="w-6 h-6 text-primary" />
                            System Settings
                          </DialogTitle>
                          <p className="text-sm text-muted-foreground">
                            Configure database connection and export settings
                          </p>
                        </DialogHeader>
                        {renderSettingsForm()}
                      </DialogContent>
                    </Dialog>
                  </li>
                )}
              </ul>
            </nav>

            {/* Mobile Theme Toggle and Logout */}
            <div className="p-3 border-t border-border space-y-2">
              {/* Theme Toggle Button - Mobile */}
              <Button
                variant="outline"
                onClick={cycleTheme}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border-border text-foreground hover:bg-accent h-auto"
              >
                <Palette className="w-5 h-5" />
                <span className="font-medium flex-1 text-left">Theme</span>
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getCurrentThemeOption().emoji}</span>
                  <span className="text-sm font-medium">{getCurrentThemeOption().label}</span>
                </div>
              </Button>

              {/* Mobile Logout Button */}
              <Button
                variant="outline"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border-border text-foreground hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:border-red-800 dark:hover:text-red-400 transition-all duration-200 h-auto"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Logout</span>
              </Button>
            </div>
          </aside>
        </>
      )}

      {/* Main Content */}
      <main className="flex-1 lg:ml-72 mt-16 lg:mt-0 min-h-screen">
        <div className="p-4 lg:p-8">
          <div className="bg-card rounded-xl border border-border shadow-sm min-h-[calc(100vh-4rem)] lg:min-h-[calc(100vh-4rem)]">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
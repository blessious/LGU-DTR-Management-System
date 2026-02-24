import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertCircle, RefreshCw, CheckCircle, X } from "lucide-react";
import { toast } from "sonner";

interface RefreshReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
  recordCount?: number;
  employeeName?: string;
}

export default function RefreshReminderModal({ 
  isOpen, 
  onClose, 
  onRefresh, 
  isRefreshing = false,
  recordCount = 0,
  employeeName
}: RefreshReminderModalProps) {
  const [showSuccess, setShowSuccess] = useState(false);
  const [autoCloseTimer, setAutoCloseTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isOpen) {
      setShowSuccess(false);
      // Set auto-close timer for 30 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 30000); // 30 seconds
      setAutoCloseTimer(timer);
    } else {
      if (autoCloseTimer) {
        clearTimeout(autoCloseTimer);
      }
    }

    return () => {
      if (autoCloseTimer) {
        clearTimeout(autoCloseTimer);
      }
    };
  }, [isOpen]);

  const handleRefresh = async () => {
    try {
      await onRefresh();
      setShowSuccess(true);
      
      // Auto close after success
      setTimeout(() => {
        handleClose();
      }, 3000);
    } catch (error) {
      // Error handling is done in the parent component
    }
  };

  const handleClose = () => {
    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
    }
    setShowSuccess(false);
    onClose();
  };

  const handleRemindLater = () => {
    toast.info("Remember to refresh DTR records later", {
      description: "Your imported records won't appear until you refresh the DTR table.",
      duration: 5000,
    });
    handleClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl flex items-center gap-2">
              {showSuccess ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              {showSuccess ? "Refresh Complete" : "Refresh Required"}
            </DialogTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="py-4">
          {showSuccess ? (
            <div className="text-center space-y-3">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
              <p className="text-lg font-medium text-green-700">DTR Refreshed Successfully!</p>
              <p className="text-sm text-gray-600">
                {employeeName ? (
                  <>DTR records for <span className="font-semibold">{employeeName}</span> have been updated.</>
                ) : (
                  "All DTR records have been updated with the latest imports."
                )}
              </p>
              <p className="text-xs text-gray-500">
                This window will close automatically...
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div className="space-y-2">
                  <p className="font-medium text-amber-800">
                    Refresh DTR Records
                  </p>
                  <p className="text-sm text-gray-600">
                    {employeeName ? (
                      <>
                        You've imported <span className="font-semibold">{recordCount} records</span> for{" "}
                        <span className="font-semibold">{employeeName}</span>. 
                        These records are in the imports table but haven't been processed into the DTR table yet.
                      </>
                    ) : (
                      <>
                        You've imported <span className="font-semibold">{recordCount} records</span>. 
                        These records are in the imports table but haven't been processed into the DTR table yet.
                      </>
                    )}
                  </p>
                  <p className="text-sm text-gray-600">
                    Click "Refresh Now" to process these records and update the attendance view.
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-800 font-medium">
                  💡 Without refreshing, imported records won't appear in the DTR table or attendance view.
                </p>
              </div>
            </div>
          )}
        </div>

        {!showSuccess && (
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleRemindLater}
              disabled={isRefreshing}
              className="flex-1"
            >
              Remind Me Later
            </Button>
            <Button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isRefreshing ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Refreshing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh Now
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
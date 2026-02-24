// AddDeptHeadModal.tsx
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus } from "lucide-react";

interface AddDeptHeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
  positions: string[];
  offices: string[];
}

export default function AddDeptHeadModal({
  isOpen,
  onClose,
  onSubmit,
  positions,
  offices
}: AddDeptHeadModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    signatory: "",
    signatorySameAsName: true,
    position: "",
    office: ""
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setFormData({
        name: "",
        signatory: "",
        signatorySameAsName: true,
        position: "",
        office: ""
      });
      setErrors({});
    }
  }, [isOpen]);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    } else if (formData.name.trim().length < 3) {
      newErrors.name = "Name must be at least 3 characters";
    } else if (!/^[a-zA-Z\s.]+$/.test(formData.name)) {
      newErrors.name = "Name can only contain letters, spaces, and periods";
    }

    // Signatory validation
    if (!formData.signatorySameAsName && !formData.signatory.trim()) {
      newErrors.signatory = "Signatory is required";
    }

    // Position validation
    if (!formData.position) {
      newErrors.position = "Position is required";
    }

    // Office validation
    if (!formData.office) {
      newErrors.office = "Office is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        ...formData,
        signatory: formData.signatorySameAsName ? formData.name : formData.signatory
      });
    } catch (error) {
      console.error("Error submitting form:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSignatorySameAsNameChange = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      signatorySameAsName: checked,
      signatory: checked ? prev.name : prev.signatory
    }));
  };

  const handleNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      name: value,
      signatory: prev.signatorySameAsName ? value : prev.signatory
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Add Department Head</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Name Field */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium text-gray-700">
              Name *
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Enter full name"
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && (
              <p className="text-red-500 text-sm">{errors.name}</p>
            )}
          </div>

          {/* Signatory Same as Name Checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="signatorySameAsName"
              checked={formData.signatorySameAsName}
              onCheckedChange={handleSignatorySameAsNameChange}
            />
            <Label htmlFor="signatorySameAsName" className="text-sm text-gray-700">
              Signatory same as name
            </Label>
          </div>

          {/* Signatory Field */}
          {!formData.signatorySameAsName && (
            <div className="space-y-2">
              <Label htmlFor="signatory" className="text-sm font-medium text-gray-700">
                Signatory *
              </Label>
              <Input
                id="signatory"
                value={formData.signatory}
                onChange={(e) => setFormData(prev => ({ ...prev, signatory: e.target.value }))}
                placeholder="Enter signatory name"
                className={errors.signatory ? "border-red-500" : ""}
              />
              {errors.signatory && (
                <p className="text-red-500 text-sm">{errors.signatory}</p>
              )}
            </div>
          )}

          {/* Position Field */}
          <div className="space-y-2">
            <Label htmlFor="position" className="text-sm font-medium text-gray-700">
              Position *
            </Label>
            <select
              id="position"
              value={formData.position}
              onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.position ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">Select position</option>
              {positions.map((position) => (
                <option key={position} value={position}>
                  {position}
                </option>
              ))}
            </select>
            {errors.position && (
              <p className="text-red-500 text-sm">{errors.position}</p>
            )}
          </div>

          {/* Office Field */}
          <div className="space-y-2">
            <Label htmlFor="office" className="text-sm font-medium text-gray-700">
              Office *
            </Label>
            <select
              id="office"
              value={formData.office}
              onChange={(e) => setFormData(prev => ({ ...prev, office: e.target.value }))}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.office ? "border-red-500" : "border-gray-300"
              }`}
            >
              <option value="">Select office</option>
              {offices.map((office) => (
                <option key={office} value={office}>
                  {office}
                </option>
              ))}
            </select>
            {errors.office && (
              <p className="text-red-500 text-sm">{errors.office}</p>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-teal-600 hover:bg-teal-700 text-white"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Department Head
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
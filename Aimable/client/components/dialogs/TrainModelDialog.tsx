import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus } from "lucide-react";

interface FormField {
  id: string;
  name: string;
  label: string;
  type: "text" | "number" | "select" | "textarea";
  value: string;
  options?: string[];
  required?: boolean;
}

interface TrainModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit?: (data: Record<string, string>) => void;
}

export function TrainModelDialog({
  open,
  onOpenChange,
  onSubmit,
}: TrainModelDialogProps) {
  const [fields, setFields] = useState<FormField[]>([
    {
      id: "1",
      name: "modelName",
      label: "Model Name",
      type: "text",
      value: "",
      required: true,
    },
    {
      id: "2",
      name: "algorithm",
      label: "Algorithm Type",
      type: "select",
      value: "",
      options: [
        "Random Forest",
        "Gradient Boosting",
        "Logistic Regression",
        "Decision Tree",
        "Neural Network",
        "SVM",
      ],
      required: true,
    },
    {
      id: "3",
      name: "trainingDataSize",
      label: "Training Data Size (%)",
      type: "number",
      value: "80",
      required: true,
    },
    {
      id: "4",
      name: "testDataSize",
      label: "Test Data Size (%)",
      type: "number",
      value: "20",
      required: true,
    },
    {
      id: "5",
      name: "epochs",
      label: "Number of Epochs",
      type: "number",
      value: "100",
      required: true,
    },
  ]);

  const [nextId, setNextId] = useState(6);

  const handleFieldChange = (id: string, value: string) => {
    setFields(
      fields.map((field) =>
        field.id === id ? { ...field, value } : field
      )
    );
  };

  const handleAddField = () => {
    const newField: FormField = {
      id: nextId.toString(),
      name: `customField_${nextId}`,
      label: "Custom Field",
      type: "text",
      value: "",
    };
    setFields([...fields, newField]);
    setNextId(nextId + 1);
  };

  const handleRemoveField = (id: string) => {
    // Don't remove the first 5 default fields
    if (parseInt(id) > 5) {
      setFields(fields.filter((field) => field.id !== id));
    }
  };

  const handleFieldLabelChange = (id: string, label: string) => {
    setFields(
      fields.map((field) =>
        field.id === id ? { ...field, label } : field
      )
    );
  };

  const handleFieldTypeChange = (id: string, type: FormField["type"]) => {
    setFields(
      fields.map((field) =>
        field.id === id ? { ...field, type } : field
      )
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    const missingRequired = fields.filter(
      (f) => f.required && !f.value.trim()
    );
    if (missingRequired.length > 0) {
      alert(
        `Please fill in all required fields: ${missingRequired.map((f) => f.label).join(", ")}`
      );
      return;
    }

    // Prepare data
    const data: Record<string, string> = {};
    fields.forEach((field) => {
      data[field.name] = field.value;
    });

    if (onSubmit) {
      onSubmit(data);
    }

    // Reset and close
    setFields([
      {
        id: "1",
        name: "modelName",
        label: "Model Name",
        type: "text",
        value: "",
        required: true,
      },
      {
        id: "2",
        name: "algorithm",
        label: "Algorithm Type",
        type: "select",
        value: "",
        options: [
          "Random Forest",
          "Gradient Boosting",
          "Logistic Regression",
          "Decision Tree",
          "Neural Network",
          "SVM",
        ],
        required: true,
      },
      {
        id: "3",
        name: "trainingDataSize",
        label: "Training Data Size (%)",
        type: "number",
        value: "80",
        required: true,
      },
      {
        id: "4",
        name: "testDataSize",
        label: "Test Data Size (%)",
        type: "number",
        value: "20",
        required: true,
      },
      {
        id: "5",
        name: "epochs",
        label: "Number of Epochs",
        type: "number",
        value: "100",
        required: true,
      },
    ]);
    setNextId(6);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Train New ML Model</DialogTitle>
          <DialogDescription>
            Configure the parameters for your new machine learning model. You can add custom fields as needed.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {/* Default Fields Section */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900">Model Configuration</h3>

            {fields.map((field) => (
              <div
                key={field.id}
                className={`space-y-2 pb-4 border-b last:border-0 ${
                  parseInt(field.id) > 5 ? "bg-blue-50 p-4 rounded-lg" : ""
                }`}
              >
                {/* Field Label Input for Custom Fields */}
                {parseInt(field.id) > 5 && (
                  <div className="flex gap-2">
                    <Input
                      name={`field-${field.id}-label`}
                      placeholder="Field name/label"
                      value={field.label}
                      onChange={(e) =>
                        handleFieldLabelChange(field.id, e.target.value)
                      }
                      className="flex-1"
                    />
                    <select
                      value={field.type}
                      onChange={(e) =>
                        handleFieldTypeChange(
                          field.id,
                          e.target.value as FormField["type"]
                        )
                      }
                      className="px-3 py-2 border rounded-md text-sm"
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="textarea">Long Text</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemoveField(field.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-md transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Display label for default fields */}
                {parseInt(field.id) <= 5 && (
                  <label className="block text-sm font-medium text-gray-700">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                )}

                {/* Render appropriate input type */}
                {field.type === "text" && (
                  <Input
                    type="text"
                    name={`field-${field.id}`}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    value={field.value}
                    onChange={(e) =>
                      handleFieldChange(field.id, e.target.value)
                    }
                    required={field.required}
                  />
                )}

                {field.type === "number" && (
                  <Input
                    type="number"
                    name={`field-${field.id}`}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    value={field.value}
                    onChange={(e) =>
                      handleFieldChange(field.id, e.target.value)
                    }
                    required={field.required}
                  />
                )}

                {field.type === "select" && field.options && (
                  <select
                    name={`field-${field.id}`}
                    value={field.value}
                    onChange={(e) =>
                      handleFieldChange(field.id, e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required={field.required}
                  >
                    <option value="">Select {field.label}</option>
                    {field.options.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                )}

                {field.type === "textarea" && (
                  <textarea
                    name={`field-${field.id}`}
                    placeholder={`Enter ${field.label.toLowerCase()}`}
                    value={field.value}
                    onChange={(e) =>
                      handleFieldChange(field.id, e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-24"
                    required={field.required}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Add Custom Field Button */}
          <button
            type="button"
            onClick={handleAddField}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition border border-indigo-200"
          >
            <Plus className="w-4 h-4" />
            Add Custom Field
          </button>

          {/* Form Actions */}
          <DialogFooter className="gap-3 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Start Training
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

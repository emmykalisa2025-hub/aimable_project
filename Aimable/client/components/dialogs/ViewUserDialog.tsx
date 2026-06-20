import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type UserRole = "admin" | "analyst" | "scientist" | "facility";

interface User {
  id: number;
  name: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  email: string;
  role: UserRole;
  status: "active" | "inactive";
  createdAt: string;
  lastLogin: string;
}

interface ViewUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

const roleLabels: Record<UserRole, string> = {
  admin: "System Administrator",
  analyst: "Fraud Analyst",
  scientist: "Data Scientist",
  facility: "Health Facility",
};

const roleDescriptions: Record<UserRole, string> = {
  admin: "Has full system access and can manage all users and configurations",
  analyst: "Can review claims, investigate fraud, and make decisions",
  scientist: "Can develop, train, and deploy ML models",
  facility: "Can submit medical claims and track their status",
};

export default function ViewUserDialog({ open, onOpenChange, user }: ViewUserDialogProps) {
  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>User Details</DialogTitle>
          <DialogDescription>View user information</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* User Name and Status */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
              Full Name
            </p>
            <p className="text-lg font-semibold text-gray-900">
              {user.name ||
                [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                user.username}
            </p>
            {user.username && (
              <p className="text-sm text-gray-500 mt-1">@{user.username}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
              Email Address
            </p>
            <p className="text-base text-gray-700">{user.email}</p>
          </div>

          {/* Role */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
              User Role
            </p>
            <div className="space-y-2">
              <p className="font-semibold text-gray-900">{roleLabels[user.role]}</p>
              <p className="text-sm text-gray-600">{roleDescriptions[user.role]}</p>
            </div>
          </div>

          {/* Status */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
              Status
            </p>
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${
                  user.status === "active" ? "bg-green-500" : "bg-gray-400"
                }`}
              ></div>
              <span
                className={`font-medium capitalize ${
                  user.status === "active" ? "text-green-700" : "text-gray-700"
                }`}
              >
                {user.status}
              </span>
            </div>
          </div>

          {/* Created At */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
              Account Created
            </p>
            <p className="text-base text-gray-700">{user.createdAt}</p>
          </div>

          {/* Last Login */}
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">
              Last Login
            </p>
            <p className="text-base text-gray-700">{user.lastLogin}</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

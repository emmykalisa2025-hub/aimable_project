import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

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

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onConfirm: () => void;
}

export default function DeleteUserDialog({
  open,
  onOpenChange,
  user,
  onConfirm,
}: DeleteUserDialogProps) {
  if (!user) return null;

  const handleConfirmDelete = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="w-5 h-5" />
            Delete User
          </DialogTitle>
          <DialogDescription>This action cannot be undone</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-700">
              Are you sure you want to delete this user? All associated data will be permanently removed.
            </p>
          </div>

          <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                User Name
              </p>
              <p className="font-medium text-gray-900">
                {user.name ||
                  [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                  user.username}
              </p>
              {user.username && (
                <p className="text-xs text-gray-500">@{user.username}</p>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1">
                Email
              </p>
              <p className="text-sm text-gray-700">{user.email}</p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-row-reverse">
          <Button
            variant="destructive"
            onClick={handleConfirmDelete}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            Delete User
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

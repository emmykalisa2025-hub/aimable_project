import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
Card,
CardContent,
CardDescription,
CardHeader,
CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEffect, useMemo, useState } from "react";
import {
Search,
Edit2,
Trash2,
Eye,
ChevronLeft,
ChevronRight,
Plus,
} from "lucide-react";
import ViewUserDialog from "@/components/dialogs/ViewUserDialog";
import EditUserDialog from "@/components/dialogs/EditUserDialog";
import DeleteUserDialog from "@/components/dialogs/DeleteUserDialog";
import AddUserDialog from "@/components/dialogs/AddUserDialog";
import { api } from "@/lib/config";

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

const roleLabels: Record<UserRole, string> = {
admin: "System Administrator",
analyst: "Fraud Analyst",
scientist: "Data Scientist",
facility: "Health Facility",
};

const roleColors: Record<UserRole, string> = {
admin: "bg-blue-100 text-blue-800",
analyst: "bg-teal-100 text-teal-800",
scientist: "bg-indigo-100 text-indigo-800",
facility: "bg-cyan-100 text-cyan-800",
};

export default function UserManagement() {
const userName = sessionStorage.getItem("userName") || "Admin";

const [searchTerm, setSearchTerm] = useState("");
const [itemsPerPage, setItemsPerPage] = useState(5);
const [currentPage, setCurrentPage] = useState(1);
const [users, setUsers] = useState<User[]>([]);
const [loading, setLoading] = useState(false);

const [addDialogOpen, setAddDialogOpen] = useState(false);
const [viewDialogOpen, setViewDialogOpen] = useState(false);
const [editDialogOpen, setEditDialogOpen] = useState(false);
const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
const [selectedUser, setSelectedUser] = useState<User | null>(null);

const getAuthHeaders = () => {
const token = sessionStorage.getItem("accessToken");

return token
  ? { Authorization: "Bearer " + token }
  : {};

};

const loadUsers = async () => {
setLoading(true);

try {
  const response = await fetch(api("/api/admin/users/"), {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    console.error("Failed to load users:", await response.text());
    return;
  }

  const data = await response.json();

  if (Array.isArray(data)) {
    setUsers(data);
  } else if (Array.isArray(data.results)) {
    setUsers(data.results);
  } else {
    setUsers([]);
  }
} catch (error) {
  console.error("Error loading users:", error);
} finally {
  setLoading(false);
}

};

useEffect(() => {
void loadUsers();
}, []);

const filteredUsers = useMemo(() => {
const term = searchTerm.toLowerCase();

return users.filter((user) => {
  const fullName =
    user.name ||
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    "";

  const username = user.username || "";

  return (
    fullName.toLowerCase().includes(term) ||
    username.toLowerCase().includes(term) ||
    user.email.toLowerCase().includes(term)
  );
});

}, [users, searchTerm]);

const totalPages = Math.max(
1,
Math.ceil(filteredUsers.length / itemsPerPage),
);

const startIndex = (currentPage - 1) * itemsPerPage;
const endIndex = startIndex + itemsPerPage;
const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

const handleSearch = (value: string) => {
setSearchTerm(value);
setCurrentPage(1);
};

const handleView = (user: User) => {
setSelectedUser(user);
setViewDialogOpen(true);
};

const handleEdit = (user: User) => {
setSelectedUser(user);
setEditDialogOpen(true);
};

const handleDelete = (user: User) => {
setSelectedUser(user);
setDeleteDialogOpen(true);
};

const handleToggleStatus = (userId: number) => {
const toggleUserStatus = async () => {
try {
const response = await fetch(
api("/api/admin/users/" + userId + "/toggle-status/"),
{
method: "POST",
headers: getAuthHeaders(),
},
);

    if (!response.ok) {
      console.error(
        "Failed to toggle user status:",
        await response.text(),
      );
      return;
    }

    const updatedUser: User = await response.json();

    setUsers((previousUsers) =>
      previousUsers.map((user) =>
        user.id === updatedUser.id ? updatedUser : user,
      ),
    );
  } catch (error) {
    console.error("Error toggling user status:", error);
  }
};

void toggleUserStatus();

};

const handleEditSubmit = (updatedUser: Partial<User>) => {
if (!selectedUser) return;

const saveUser = async () => {
  try {
    const response = await fetch(
      api("/api/admin/users/" + selectedUser.id + "/"),
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify(updatedUser),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to update user:", errorText);
      alert("Failed to update user: " + errorText);
      return;
    }

    const savedUser: User = await response.json();

    setUsers((previousUsers) =>
      previousUsers.map((user) =>
        user.id === savedUser.id ? savedUser : user,
      ),
    );

    setEditDialogOpen(false);
    setSelectedUser(null);
  } catch (error) {
    console.error("Error updating user:", error);
    alert("Unexpected error while updating user.");
  }
};

void saveUser();

};

const handleDeleteConfirm = () => {
if (!selectedUser) return;

const deleteUser = async () => {
  try {
    const response = await fetch(
      api("/api/admin/users/" + selectedUser.id + "/"),
      {
        method: "DELETE",
        headers: getAuthHeaders(),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to delete user:", errorText);
      alert("Failed to delete user: " + errorText);
      return;
    }

    setUsers((previousUsers) =>
      previousUsers.filter((user) => user.id !== selectedUser.id),
    );

    setDeleteDialogOpen(false);
    setSelectedUser(null);

    if (paginatedUsers.length === 1 && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  } catch (error) {
    console.error("Error deleting user:", error);
    alert("Unexpected error while deleting user.");
  }
};

void deleteUser();

};

const handleAddUser = (userData: {
firstName: string;
lastName: string;
username: string;
email: string;
role: UserRole;
}) => {
const createUser = async () => {
try {
const response = await fetch(api("/api/admin/users/"), {
method: "POST",
headers: {
"Content-Type": "application/json",
...getAuthHeaders(),
},
body: JSON.stringify({
firstName: userData.firstName,
lastName: userData.lastName,
username: userData.username,
name: (userData.firstName + " " + userData.lastName).trim(),
email: userData.email,
role: userData.role,
status: "active",
}),
});

    if (!response.ok) {
      let errorDetails: unknown;
      const contentType = response.headers.get("content-type") || "";

      try {
        errorDetails = contentType.includes("application/json")
          ? await response.json()
          : await response.text();
      } catch {
        errorDetails = "Unable to read the server error.";
      }

      const message =
        typeof errorDetails === "string"
          ? errorDetails
          : JSON.stringify(errorDetails, null, 2);

      console.error("Failed to create user:", errorDetails);
      alert("Failed to create user:\n" + message);
      return;
    }

    const newUser: User = await response.json();

    setUsers((previousUsers) => [newUser, ...previousUsers]);
    setAddDialogOpen(false);
  } catch (error) {
    console.error("Error creating user:", error);
    alert("Unexpected error while creating user.");
  }
};

void createUser();

};

return ( <AppLayout userRole="admin" userName={userName}> <div className="space-y-8"> <div className="flex items-center justify-between"> <div> <h1 className="text-3xl font-bold text-gray-900">
User Management </h1> <p className="mt-2 text-gray-600">
Manage system users, roles, and permissions </p> </div>

      <Button
        onClick={() => setAddDialogOpen(true)}
        className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" />
        Add User
      </Button>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Search &amp; Filter</CardTitle>
        <CardDescription>Find and manage users</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />

            <Input
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(event) => handleSearch(event.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">
            Users per page:
          </label>

          <select
            value={itemsPerPage}
            onChange={(event) => {
              setItemsPerPage(Number(event.target.value));
              setCurrentPage(1);
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
          </select>
        </div>

        <div className="text-sm text-gray-600">
          Showing {filteredUsers.length === 0 ? 0 : startIndex + 1} to{" "}
          {Math.min(endIndex, filteredUsers.length)} of{" "}
          {filteredUsers.length} users
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Users List</CardTitle>
        <CardDescription>
          {filteredUsers.length} total users
        </CardDescription>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="py-12 text-center">
            <p className="text-gray-500">Loading users...</p>
          </div>
        ) : paginatedUsers.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-gray-500">
              No users found matching your search
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Role
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Last Login
                  </th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-700">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {paginatedUsers.map((user) => (
                  <tr
                    key={user.id}
                    className="border-b border-gray-100 transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">
                        {user.name ||
                          [user.firstName, user.lastName]
                            .filter(Boolean)
                            .join(" ") ||
                          user.username}
                      </p>

                      {user.username && (
                        <p className="text-xs text-gray-500">
                          @{user.username}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600">{user.email}</p>
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={
                          "inline-block rounded-full px-3 py-1 text-xs font-semibold " +
                          roleColors[user.role]
                        }
                      >
                        {roleLabels[user.role]}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggleStatus(user.id)}
                        className={
                          "inline-block cursor-pointer rounded-full px-3 py-1 text-xs font-semibold transition-colors " +
                          (user.status === "active"
                            ? "bg-green-100 text-green-800 hover:bg-green-200"
                            : "bg-gray-100 text-gray-800 hover:bg-gray-200")
                        }
                      >
                        {user.status === "active" ? "Active" : "Inactive"}
                      </button>
                    </td>

                    <td className="px-4 py-3">
                      <p className="text-sm text-gray-600">
                        {user.lastLogin || "Never"}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleView(user)}
                          className="rounded-lg p-2 text-blue-600 transition-colors hover:bg-blue-50"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => handleEdit(user)}
                          className="rounded-lg p-2 text-green-600 transition-colors hover:bg-green-50"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>

                        <button
                          onClick={() => handleDelete(user)}
                          className="rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>

    {filteredUsers.length > 0 && (
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Page {currentPage} of {totalPages}
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((previousPage) =>
                Math.max(1, previousPage - 1),
              )
            }
            disabled={currentPage === 1}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setCurrentPage((previousPage) =>
                Math.min(totalPages, previousPage + 1),
              )
            }
            disabled={currentPage === totalPages}
            className="flex items-center gap-2"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    )}
  </div>

  <AddUserDialog
    open={addDialogOpen}
    onOpenChange={setAddDialogOpen}
    onSubmit={handleAddUser}
  />

  {selectedUser && (
    <>
      <ViewUserDialog
        open={viewDialogOpen}
        onOpenChange={setViewDialogOpen}
        user={selectedUser}
      />

      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={selectedUser}
        onSubmit={handleEditSubmit}
      />

      <DeleteUserDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        user={selectedUser}
        onConfirm={handleDeleteConfirm}
      />
    </>
  )}
</AppLayout>

);
}

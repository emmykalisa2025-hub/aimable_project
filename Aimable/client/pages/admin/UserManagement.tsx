import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useEffect, useState, useMemo } from "react";
import { Search, Edit2, Trash2, Eye, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import ViewUserDialog from "@/components/dialogs/ViewUserDialog";
import EditUserDialog from "@/components/dialogs/EditUserDialog";
import DeleteUserDialog from "@/components/dialogs/DeleteUserDialog";
import AddUserDialog from "@/components/dialogs/AddUserDialog";

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

const API_BASE_URL = "http://127.0.0.1:8000/api";

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

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const token = sessionStorage.getItem("accessToken");
        const response = await fetch(`${API_BASE_URL}/admin/users/`, {
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        });

        if (!response.ok) {
          console.error("Failed to load users", await response.text());
          return;
        }

        const data: User[] = await response.json();
        setUsers(data);
      } catch (error) {
        console.error("Error loading users", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Filter users based on search term
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const fullName =
        user.name || [user.firstName, user.lastName].filter(Boolean).join(" ") || "";
      const username = user.username || "";
      const term = searchTerm.toLowerCase();

      return (
        fullName.toLowerCase().includes(term) ||
        username.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term)
      );
    });
  }, [users, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  // Reset to first page when search term changes
  const handleSearch = (value: string) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  // Handler functions
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
    const toggle = async () => {
      try {
        const token = sessionStorage.getItem("accessToken");
        const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/toggle-status/`, {
          method: "POST",
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        });
        if (!response.ok) {
          console.error("Failed to toggle user status", await response.text());
          return;
        }
        const updatedUser: User = await response.json();
        setUsers((prev) => prev.map((u) => (u.id === updatedUser.id ? updatedUser : u)));
      } catch (error) {
        console.error("Error toggling user status", error);
      }
    };

    void toggle();
  };

  const handleEditSubmit = (updatedUser: Partial<User>) => {
    if (!selectedUser) return;

    const save = async () => {
      try {
        const token = sessionStorage.getItem("accessToken");
        const response = await fetch(`${API_BASE_URL}/admin/users/${selectedUser.id}/`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify(updatedUser),
        });

        if (!response.ok) {
          console.error("Failed to update user", await response.text());
          return;
        }

        const savedUser: User = await response.json();
        setUsers((prev) => prev.map((u) => (u.id === savedUser.id ? savedUser : u)));
        setEditDialogOpen(false);
        setSelectedUser(null);
      } catch (error) {
        console.error("Error updating user", error);
      }
    };

    void save();
  };

  const handleDeleteConfirm = () => {
    if (!selectedUser) return;

    const remove = async () => {
      try {
        const token = sessionStorage.getItem("accessToken");
        const response = await fetch(`${API_BASE_URL}/admin/users/${selectedUser.id}/`, {
          method: "DELETE",
          headers: {
            Authorization: token ? `Bearer ${token}` : "",
          },
        });

        if (!response.ok) {
          console.error("Failed to delete user", await response.text());
          return;
        }

        setUsers((prev) => prev.filter((user) => user.id !== selectedUser.id));
        setDeleteDialogOpen(false);
        setSelectedUser(null);
        if (paginatedUsers.length === 1 && currentPage > 1) {
          setCurrentPage(currentPage - 1);
        }
      } catch (error) {
        console.error("Error deleting user", error);
      }
    };

    void remove();
  };

  const handleAddUser = (userData: {
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    role: UserRole;
  }) => {
    const create = async () => {
      try {
        const token = sessionStorage.getItem("accessToken");
        console.log("[UserManagement] Creating user", {
          payload: userData,
          hasToken: Boolean(token),
        });

        const response = await fetch(`${API_BASE_URL}/admin/users/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: token ? `Bearer ${token}` : "",
          },
          body: JSON.stringify({
            firstName: userData.firstName,
            lastName: userData.lastName,
            username: userData.username,
            name: `${userData.firstName} ${userData.lastName}`.trim(),
            email: userData.email,
            role: userData.role,
            status: "active",
          }),
        });

        console.log("[UserManagement] Create user response", {
          status: response.status,
          statusText: response.statusText,
        });

        if (!response.ok) {
          let errorDetails: unknown;
          const contentType = response.headers.get("content-type") || "";
          try {
            if (contentType.includes("application/json")) {
              errorDetails = await response.json();
            } else {
              errorDetails = await response.text();
            }
          } catch (e) {
            errorDetails = "<unable to read error body>";
          }

          console.error("[UserManagement] Failed to create user", {
            status: response.status,
            error: errorDetails,
          });

          const message =
            typeof errorDetails === "string"
              ? errorDetails
              : JSON.stringify(errorDetails, null, 2);

          alert("Failed to create user. Details:\n" + message);
          return;
        }

        const newUser: User = await response.json();
        console.log("[UserManagement] User created successfully", newUser);
        setUsers((prev) => [newUser, ...prev]);
        setAddDialogOpen(false);
      } catch (error) {
        console.error("[UserManagement] Error creating user", error);
        alert("Unexpected error while creating user. Check console for details.");
      }
    };

    void create();
  };

  return (
    <AppLayout userRole="admin" userName={userName}>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
            <p className="text-gray-600 mt-2">Manage system users, roles, and permissions</p>
          </div>
          <Button
            onClick={() => setAddDialogOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add User
          </Button>
        </div>

        {/* Filters Card */}
        <Card>
          <CardHeader>
            <CardTitle>Search & Filter</CardTitle>
            <CardDescription>Find and manage users</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Bar */}
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Items Per Page */}
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">Users per page:</label>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(parseInt(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={20}>20</option>
              </select>
            </div>

            {/* Results Info */}
            <div className="text-sm text-gray-600">
              Showing {filteredUsers.length === 0 ? 0 : startIndex + 1} to{" "}
              {Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length} users
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Users List</CardTitle>
            <CardDescription>{filteredUsers.length} total users</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Loading users...</p>
              </div>
            ) : paginatedUsers.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No users found matching your search</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Name</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Email</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Role</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Last Login</th>
                      <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((user) => (
                      <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-medium text-gray-900">
                            {user.name ||
                              [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                              user.username}
                          </p>
                          {user.username && (
                            <p className="text-xs text-gray-500">@{user.username}</p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-gray-600">{user.email}</p>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${roleColors[user.role]}`}>
                            {roleLabels[user.role]}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => handleToggleStatus(user.id)}
                            className={`inline-block px-3 py-1 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                              user.status === "active"
                                ? "bg-green-100 text-green-800 hover:bg-green-200"
                                : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                            }`}
                          >
                            {user.status === "active" ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-sm text-gray-600">{user.lastLogin}</p>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleView(user)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEdit(user)}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(user)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
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

        {/* Pagination */}
        {filteredUsers.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-2"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
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

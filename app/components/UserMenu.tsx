"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { LogOut, Plus } from "lucide-react";
import CreateDocumentDialog from "@/components/ui/document-create-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UserMenuProps {
  name?: string | null;
  image?: string | null;
}

export default function UserMenu({ name, image }: UserMenuProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const handleLogout = async () => {
    try {
      toast.loading("Signing you out...", { id: "logout" });

      await authClient.signOut({
        fetchOptions: { credentials: "include" },
      });

      toast.success("You’ve been signed out successfully. See you soon!", {
        id: "logout",
      });

      // Force refresh to clear any cached session state
      window.location.href = "/login";
    } catch (err: any) {
      toast.error("Logout failed. Please try again.", { id: "logout" });
      console.error("Logout error:", err);
    }
  };

  return (
    <>
      {/* User dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="focus:outline-none">
            <Avatar className="h-9 w-9 cursor-pointer border border-white/20">
              <AvatarImage src={image || undefined} alt={name || "User"} />
              <AvatarFallback>
                {name ? name.charAt(0).toUpperCase() : "?"}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>
            <span className="block truncate max-w-[140px]">
              {name || "User"}
            </span>
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          {/* New Document */}
          <DropdownMenuItem
            onClick={() => setDialogOpen(true)}
            className="cursor-pointer flex items-center gap-2 focus:bg-neutral-500/10"
          >
            <Plus className="h-4 w-4" />
            <span>New Document</span>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {/* Logout */}
          <DropdownMenuItem
            onClick={() => setLogoutConfirmOpen(true)}
            className="cursor-pointer text-red-500 focus:text-red-600 focus:bg-red-500/10 flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Create Document Dialog */}
      <CreateDocumentDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-start">
              Are you sure?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-start">
              Are you sure you want to log out of your account? You’ll need to
              sign in again to access your documents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-row justify-end">
            <AlertDialogCancel className="cursor-pointer">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="cursor-pointer bg-red-500 text-white hover:bg-red-600"
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

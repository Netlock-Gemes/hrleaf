"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { slugExists } from "@/server/document-service";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface CreateDocumentDialogProps {
  children: React.ReactNode;
}

export default function CreateDocumentDialog({
  children,
}: CreateDocumentDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newDocName, setNewDocName] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
    setNewDocName(value);
  };

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newDocName.trim()) return;

    startTransition(async () => {
      try {
        const exists = await slugExists(newDocName.trim());

        if (exists) {
          toast.error("A document with this name already exists.");
          return;
        }

        setOpen(false);
        router.push(`/${newDocName.trim()}`);
      } catch (error) {
        console.error("Error checking document:", error);
        toast.error("Something went wrong. Please try again.");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md max-w-sm rounded-xl -mt-20 md:mt-0">
        <DialogHeader>
          <DialogTitle>Create New Document</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="flex flex-col gap-4">
          <Input
            placeholder="Enter document name"
            type="text"
            value={newDocName}
            onChange={handleChange}
            className="bg-[#181818] text-sm"
          />
          <DialogFooter>
            <Button
              type="submit"
              variant="default"
              disabled={!newDocName.trim() || isPending}
              className="bg-white"
            >
              {isPending ? (
                <span className="flex justify-center items-center gap-1">
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating
                </span>
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

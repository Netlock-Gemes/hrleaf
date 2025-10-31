"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Document } from "@/types";
import { getAllDocuments } from "@/server/document-service";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Link from "next/link";
import { Plus } from "lucide-react";

function formatDate(dateString?: string) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "numeric",
    day: "2-digit",
    // hour: "2-digit",
    // minute: "2-digit",
  }).format(date);
}

// Define the table columns
const columns: ColumnDef<Document>[] = [
  {
    accessorKey: "slug",
    header: "Slug",
    cell: ({ row }) => {
      const slug = row.original.slug;
      return (
        <Link href={`/${slug}`} className="hover:underline">
          {slug}
        </Link>
      );
    },
  },
  //   {
  //     accessorKey: "version",
  //     header: "Version",
  //   },
  {
    accessorKey: "read_only",
    header: "Locked",
    cell: ({ row }) => (row.original.read_only ? "Yes" : "No"),
  },
  //   {
  //     accessorKey: "created_at",
  //     header: "Created At",
  //     cell: ({ row }) => formatDate(row.original.created_at),
  //   },
  {
    accessorKey: "updated_at",
    header: "Modified",
    cell: ({ row }) => formatDate(row.original.updated_at),
  },
];

const Page = () => {
  const router = useRouter();
  const [data, setData] = useState<Document[]>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);

  const [globalFilter, setGlobalFilter] = useState("");
  const [newDocName, setNewDocName] = useState("");

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    enableSortingRemoval: false,
  });

  useEffect(() => {
    async function fetchDocs() {
      try {
        const docs = await getAllDocuments();
        setData(docs);
      } catch (error) {
        console.error("Error loading documents:", error);
      }
    }
    fetchDocs();
  }, []);

  const handleCreate = () => {
    if (!newDocName.trim()) return;
    router.push(`/${newDocName}`);
  };

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col py-5 px-5 md:px-0 min-h-[100svh] shadow-lg">
      {/* Header + Actions */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">All Documents</h1>

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="default" className="bg-white hover:bg-neutral-200">
              <Plus />
              <span className="hidden md:block">New Document</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md max-w-sm rounded-xl -mt-20 md:mt-0">
            <DialogHeader>
              <DialogTitle>Create New Document</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <Input
                placeholder="Enter document name"
                type="text"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
                className="bg-[#181818]"
              />
            </div>
            <DialogFooter>
              <Button
                variant="default"
                onClick={handleCreate}
                disabled={!newDocName.trim()}
                className="bg-white"
              >
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder="Search documents..."
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="bg-[#181818]"
        />
      </div>

      {/* Data Table */}
      <div className="rounded-md border bg-background">
        <Table className="overflow-hidden rounded">
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const id = header.id;
                  const headerText =
                    typeof header.column.columnDef.header === "string"
                      ? header.column.columnDef.header
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        );

                  return (
                    <TableHead
                      key={header.id}
                      className={`
              cursor-pointer select-none bg-surface-dark
              ${id === "slug" ? "md:w-[65%] w-[60%]" : ""}
              ${id === "read_only" ? "md:w-[10%] w-[10%] text-center" : ""}
              ${id === "updated_at" ? "md:w-[25%] w-[30%] text-right pr-3" : ""}
            `}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {headerText}
                      {{
                        asc: " ▲",
                        desc: " ▼",
                      }[header.column.getIsSorted() as string] ?? null}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {data.length === 0 ? (
              <>
                {[...Array(5)].map((_, i) => (
                  <TableRow
                    key={i}
                    className="animate-pulse border-b border-neutral-800/40"
                  >
                    <TableCell className="py-2.5 w-[55%]">
                      <div className="h-4 w-3/5 bg-gradient-to-r from-neutral-800/40 via-neutral-700/30 to-neutral-800/40 rounded" />
                    </TableCell>
                    <TableCell className="py-2.5 text-center w-[15%]">
                      <div className="h-4 w-10 mx-auto bg-gradient-to-r from-neutral-800/40 via-neutral-700/30 to-neutral-800/40 rounded" />
                    </TableCell>
                    <TableCell className="py-2.5 text-right pr-3 w-[30%]">
                      <div className="h-4 w-24 ml-auto bg-gradient-to-r from-neutral-800/40 via-neutral-700/30 to-neutral-800/40 rounded" />
                    </TableCell>
                  </TableRow>
                ))}
              </>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => {
                    const id = cell.column.id;
                    return (
                      <TableCell
                        key={cell.id}
                        className={`
                md:text-sm text-xs
                ${id === "slug" ? "md:w-[65%] w-[60%]" : ""}
                ${id === "read_only" ? "md:w-[10%] w-[10%] text-center" : ""}
                ${
                  id === "updated_at"
                    ? "md:w-[25%] w-[30%] text-right pr-3"
                    : ""
                }
              `}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-center text-muted-foreground py-6"
                >
                  No documents found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Page;

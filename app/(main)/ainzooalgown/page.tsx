"use client";

import React, { useEffect, useState } from "react";
import { Document } from "@/types";
import { getAllDocuments } from "@/server/document-service";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
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
import Link from "next/link";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import CreateDocumentDialog from "@/components/ui/document-create-dialog";

function formatDate(dateString?: string) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "numeric",
    day: "2-digit",
  }).format(date);
}

const columns: ColumnDef<Document>[] = [
  {
    accessorKey: "slug",
    header: "Slug",
    enableSorting: false,
    cell: ({ row }) => {
      const slug = row.original.slug;
      return (
        <Link href={`/${slug}`} className="hover:underline">
          {slug}
        </Link>
      );
    },
  },
  {
    accessorKey: "read_only",
    header: "Locked",
    enableSorting: false,
    cell: ({ row }) => (row.original.read_only ? "Yes" : "No"),
  },
  {
    accessorKey: "updated_at",
    header: "Modified",
    enableSorting: true,
    cell: ({ row }) => formatDate(row.original.updated_at),
  },
];

const Page = () => {
  const [data, setData] = useState<Document[]>([]);
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updated_at", desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pageSize, setPageSize] = useState(15);

  // Responsive page size based on screen width
  useEffect(() => {
    const handleResize = () => {
      const isDesktop = window.matchMedia("(min-width: 768px)").matches;
      setPageSize(isDesktop ? 10 : 15);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    getPaginationRowModel: getPaginationRowModel(),
    enableSortingRemoval: false,
    initialState: {
      pagination: {
        pageSize,
      },
    },
  });

  // Update page size dynamically 
  useEffect(() => {
    table.setPageSize(pageSize);
  }, [pageSize, table]);

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "");
    setGlobalFilter(value);
  };

  return (
    <div className="max-w-4xl mx-auto w-full flex flex-col pb-5 px-5 md:px-0 min-h-[80svh]">
      {/* Header + Actions */}
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl md:text-2xl font-bold">All Documents</h1>
        <CreateDocumentDialog>
          <Button variant="default" className="bg-white hover:bg-neutral-200">
            <Plus />
            <span className="hidden md:block">New Document</span>
          </Button>
        </CreateDocumentDialog>
      </div>

      {/* Search */}
      <div className="mb-4">
        <Input
          placeholder="Search documents..."
          value={globalFilter ?? ""}
          onChange={handleChange}
          className="bg-[#181818] text-sm"
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
                      className={`select-none bg-surface-dark
                          ${
                            header.column.getCanSort()
                              ? "cursor-pointer"
                              : "cursor-default"
                          }
                          ${id === "slug" ? "md:w-[65%] w-[60%]" : ""}
                          ${
                            id === "read_only"
                              ? "md:w-[10%] w-[10%] text-center"
                              : ""
                          }
                          ${
                            id === "updated_at"
                              ? "md:w-[25%] w-[30%] text-right pr-3"
                              : ""
                          }
                      `}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {headerText}
                      {header.column.id === "updated_at" &&
                        ({
                          asc: " ▲",
                          desc: " ▼",
                        }[header.column.getIsSorted() as string] ??
                          null)}
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
                        className={`md:text-sm text-xs
                            ${id === "slug" ? "md:w-[65%] w-[60%]" : ""}
                            ${
                              id === "read_only"
                                ? "md:w-[10%] w-[10%] text-center"
                                : ""
                            }
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

      {/* Pagination */}
      {data.length > 0 && (
        <div className="flex justify-between items-center mt-5 text-sm text-muted-foreground">
          <div>
            Page{" "}
            <span className="font-medium text-foreground">
              {table.getState().pagination.pageIndex + 1}
            </span>{" "}
            of{" "}
            <span className="font-medium text-foreground">
              {table.getPageCount()}
            </span>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="flex items-center gap-1 bg-background border-neutral-800 md:hover:bg-neutral-900"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="flex items-center gap-1 bg-background border-neutral-800 md:hover:bg-neutral-900"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Page;

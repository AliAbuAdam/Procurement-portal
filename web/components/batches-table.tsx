"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  ScanSearch,
} from "lucide-react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface BatchRow {
  id: string;
  supplier_id: string;
  supplier_name?: string;
  file_name: string;
  rows_total: number;
  created_by: string;
  created_at: string;
}

const COLUMN_LABELS: Record<string, string> = {
  file_name: "Файл",
  supplier_name: "Поставщик",
  rows_total: "Строк",
  created_by: "Кто",
  created_at: "Когда",
};

function makeColumns(onOpen: (id: string) => void): ColumnDef<BatchRow>[] {
  return [
    {
      accessorKey: "file_name",
      header: "Файл",
      cell: ({ row }) => (
        <span className="font-medium">{row.original.file_name}</span>
      ),
    },
    {
      accessorKey: "supplier_name",
      header: "Поставщик",
      cell: ({ row }) => row.original.supplier_name || "—",
    },
    {
      accessorKey: "rows_total",
      header: "Строк",
      cell: ({ row }) => row.original.rows_total,
    },
    {
      accessorKey: "created_by",
      header: "Кто",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.created_by}</span>
      ),
    },
    {
      accessorKey: "created_at",
      header: "Когда",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {new Date(row.original.created_at).toLocaleString("ru-RU")}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      enableHiding: false,
      cell: ({ row }) => (
        <Button
          size="icon"
          variant="ghost"
          className="size-8"
          aria-label="Анализировать"
          title="Анализировать"
          onClick={() => onOpen(row.original.id)}
        >
          <ScanSearch className="size-4" />
        </Button>
      ),
    },
  ];
}

export function BatchesTable({
  batches,
  onOpen,
}: {
  batches: BatchRow[];
  onOpen: (id: string) => void;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});

  const columns = React.useMemo(() => makeColumns(onOpen), [onOpen]);

  const table = useReactTable({
    data: batches,
    columns,
    state: { sorting, columnVisibility },
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-muted-foreground text-sm">
          Всего загрузок: {batches.length}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Columns3 />
              <span className="hidden sm:inline">Колонки</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {table
              .getAllColumns()
              .filter((c) => c.getCanHide())
              .map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={c.getIsVisible()}
                  onCheckedChange={(v) => c.toggleVisibility(!!v)}
                >
                  {COLUMN_LABELS[c.id] ?? c.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader className="bg-muted">
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="text-muted-foreground h-24 text-center"
                >
                  Пока нет загрузок.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end">
        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-2 sm:flex">
            <Label htmlFor="brows" className="text-sm font-normal">
              Строк на странице
            </Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(v) => table.setPageSize(Number(v))}
            >
              <SelectTrigger size="sm" className="w-20" id="brows">
                <SelectValue
                  placeholder={table.getState().pagination.pageSize}
                />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 50].map((n) => (
                  <SelectItem key={n} value={`${n}`}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-fit items-center justify-center text-sm font-medium">
            Стр. {table.getState().pagination.pageIndex + 1} из{" "}
            {table.getPageCount() || 1}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="hidden size-8 lg:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="hidden size-8 lg:flex"
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Package,
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

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

export interface ProductRow {
  id: string;
  name: string;
  article: string;
  image_url?: string;
  created_at: string;
}

const COLUMN_LABELS: Record<string, string> = {
  image: "Фото",
  name: "Название",
  article: "Артикул",
  created_at: "Создана",
};

const columns: ColumnDef<ProductRow>[] = [
  {
    id: "image",
    header: "",
    cell: ({ row }) => (
      <Avatar className="size-9 rounded-md">
        <AvatarImage src={row.original.image_url} alt={row.original.name} />
        <AvatarFallback className="rounded-md">
          <Package className="text-muted-foreground size-4" />
        </AvatarFallback>
      </Avatar>
    ),
    enableSorting: false,
    enableHiding: true,
  },
  {
    accessorKey: "name",
    header: "Название",
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
  },
  {
    accessorKey: "article",
    header: "Артикул",
    cell: ({ row }) => row.original.article || "—",
  },
  {
    accessorKey: "created_at",
    header: "Создана",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {new Date(row.original.created_at).toLocaleDateString("ru-RU")}
      </span>
    ),
  },
];

export function ProductsTable({ products }: { products: ProductRow[] }) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});

  const table = useReactTable({
    data: products,
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
          Всего карточек: {products.length}
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
                  Карточек пока нет.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end">
        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-2 sm:flex">
            <Label htmlFor="prows" className="text-sm font-normal">
              Строк на странице
            </Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(v) => table.setPageSize(Number(v))}
            >
              <SelectTrigger size="sm" className="w-20" id="prows">
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

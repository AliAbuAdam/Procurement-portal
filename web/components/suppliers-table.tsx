"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Pencil,
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
import { Badge } from "@/components/ui/badge";
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

export interface SupplierRow {
  id: string;
  name: string;
  type: number;
  created_at: string;
  city?: string;
  address?: string;
  logo?: string;
  status?: string;
}

const TYPE_LABEL: Record<number, string> = {
  1: "Excel/CSV",
  2: "API",
  3: "Парсинг",
};

const COLUMN_LABELS: Record<string, string> = {
  logo: "Логотип",
  name: "Название",
  type: "Тип",
  city: "Город",
  address: "Адрес",
  status: "Статус",
  created_at: "Создан",
};

function StatusBadge({ status }: { status?: string }) {
  if (status === "active")
    return (
      <Badge
        variant="outline"
        className="border-emerald-200 bg-emerald-50 text-emerald-700"
      >
        В работе
      </Badge>
    );
  if (status === "inactive")
    return (
      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
        Не работаем
      </Badge>
    );
  return (
    <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700">
      Новый
    </Badge>
  );
}

function makeColumns(
  onEdit?: (s: SupplierRow) => void,
): ColumnDef<SupplierRow>[] {
  return [
  {
    id: "logo",
    header: "",
    cell: ({ row }) => (
      <Avatar className="size-8 rounded-md">
        <AvatarImage src={row.original.logo} alt={row.original.name} />
        <AvatarFallback className="rounded-md text-xs">
          {(row.original.name || "?").slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
    ),
    enableSorting: false,
    enableHiding: true,
  },
  {
    accessorKey: "name",
    header: "Название",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
    ),
  },
  {
    accessorKey: "type",
    header: "Тип",
    cell: ({ row }) => TYPE_LABEL[row.original.type] ?? "—",
  },
  {
    accessorKey: "city",
    header: "Город",
    cell: ({ row }) => row.original.city || "—",
  },
  {
    accessorKey: "address",
    header: "Адрес",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.address || "—"}</span>
    ),
  },
  {
    accessorKey: "status",
    header: "Статус",
    cell: ({ row }) => <StatusBadge status={row.original.status} />,
  },
  {
    accessorKey: "created_at",
    header: "Создан",
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {new Date(row.original.created_at).toLocaleDateString("ru-RU")}
      </span>
    ),
  },
  ...(onEdit
    ? [
        {
          id: "actions",
          header: "",
          enableHiding: false,
          cell: ({ row }) => (
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label="Изменить"
              onClick={() => onEdit(row.original)}
            >
              <Pencil className="size-4" />
            </Button>
          ),
        } as ColumnDef<SupplierRow>,
      ]
    : []),
  ];
}

export function SuppliersTable({
  suppliers,
  onEdit,
}: {
  suppliers: SupplierRow[];
  onEdit?: (s: SupplierRow) => void;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});

  const columns = React.useMemo(() => makeColumns(onEdit), [onEdit]);

  const table = useReactTable({
    data: suppliers,
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
          Всего поставщиков: {suppliers.length}
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
                  Поставщиков пока нет.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end">
        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-2 sm:flex">
            <Label htmlFor="srows" className="text-sm font-normal">
              Строк на странице
            </Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(v) => table.setPageSize(Number(v))}
            >
              <SelectTrigger size="sm" className="w-20" id="srows">
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

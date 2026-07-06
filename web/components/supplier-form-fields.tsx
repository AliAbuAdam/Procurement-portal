"use client";

import { useRef } from "react";
import { ImagePlus } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface SupplierFormValues {
  name: string;
  type: string; // excel | api | parsing
  city: string;
  address: string;
  logo: string; // data-URL или URL
  status: string; // new | active | inactive
}

export const emptySupplierForm: SupplierFormValues = {
  name: "",
  type: "excel",
  city: "",
  address: "",
  logo: "",
  status: "new",
};

// Числовой enum типа из API -> строка для формы.
export function supplierTypeToForm(type: number): string {
  return type === 2 ? "api" : type === 3 ? "parsing" : "excel";
}

const selectCls =
  "h-9 rounded-md border border-[var(--input)] bg-transparent px-3 text-sm";

export function SupplierFormFields({
  values,
  onChange,
  idPrefix = "sf",
  vertical = false,
  logoPlaceholder = "dashed",
}: {
  values: SupplierFormValues;
  onChange: (patch: Partial<SupplierFormValues>) => void;
  idPrefix?: string;
  vertical?: boolean; // логотип сверху над полями (для узкой панели)
  logoPlaceholder?: "dashed" | "initials"; // вид пустого квадрата логотипа
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const id = (k: string) => `${idPrefix}-${k}`;

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () =>
      onChange({ logo: typeof reader.result === "string" ? reader.result : "" });
    reader.readAsDataURL(f);
  }

  return (
    <div
      className={
        vertical
          ? "flex flex-col gap-4"
          : "flex flex-wrap items-start gap-4"
      }
    >
      {/* Логотип — кликабельный квадрат */}
      <div className="flex flex-col gap-2">
        <Label>Логотип</Label>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={cn(
            "group relative flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg transition-colors",
            values.logo
              ? "border-0" // логотип есть — без рамки
              : logoPlaceholder === "initials"
                ? "bg-muted border hover:border-blue-400"
                : "text-muted-foreground border-2 border-dashed hover:border-blue-400 hover:bg-[var(--secondary)]",
          )}
        >
          {values.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={values.logo}
              alt="Логотип"
              className="absolute inset-0 size-full object-cover"
            />
          ) : logoPlaceholder === "initials" ? (
            <span className="text-muted-foreground text-lg font-medium">
              {(values.name || "?").slice(0, 2).toUpperCase()}
            </span>
          ) : (
            <ImagePlus className="size-6" />
          )}
          {/* Подсказка сменить картинку при наведении — если уже есть логотип
              или показаны инициалы (в режиме пунктирной рамки иконка и так видна). */}
          {(values.logo || logoPlaceholder === "initials") && (
            <span className="absolute inset-0 hidden items-center justify-center bg-black/40 text-white group-hover:flex">
              <ImagePlus className="size-6" />
            </span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onLogo}
          />
        </button>
      </div>

      {/* Остальные поля — справа сеткой (или снизу в вертикальном режиме) */}
      <div
        className={
          vertical
            ? "grid w-full gap-3 sm:grid-cols-2"
            : "grid min-w-64 flex-1 gap-3 sm:grid-cols-2"
        }
      >
        <div className="flex flex-col gap-2 sm:col-span-2">
          <Label htmlFor={id("name")}>Название</Label>
          <Input
            id={id("name")}
            value={values.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Напр. Фурнитор"
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={id("type")}>Тип</Label>
          <select
            id={id("type")}
            value={values.type}
            onChange={(e) => onChange({ type: e.target.value })}
            className={selectCls}
          >
            <option value="excel">Excel/CSV</option>
            <option value="api">API</option>
            <option value="parsing">Парсинг</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={id("status")}>Статус</Label>
          <select
            id={id("status")}
            value={values.status}
            onChange={(e) => onChange({ status: e.target.value })}
            className={selectCls}
          >
            <option value="new">Новый</option>
            <option value="active">В работе</option>
            <option value="inactive">Не работаем</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={id("city")}>Город</Label>
          <Input
            id={id("city")}
            value={values.city}
            onChange={(e) => onChange({ city: e.target.value })}
            placeholder="Москва"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={id("address")}>Адрес</Label>
          <Input
            id={id("address")}
            value={values.address}
            onChange={(e) => onChange({ address: e.target.value })}
            placeholder="ул. Промышленная, 1"
          />
        </div>
      </div>
    </div>
  );
}

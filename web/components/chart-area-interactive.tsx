"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import { useIsMobile } from "@/hooks/use-mobile";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export const description = "График изменения цен";

// Демо-данные генерируются на 90 дней НАЗАД от сегодняшней даты (истории цен
// пока нет — появится в фазе аналитики). Значения детерминированы (без random),
// чтобы не было расхождений при гидрации. avg — средняя цена, min — минимальная.
function buildChartData(): { date: string; avg: number; min: number }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const out: { date: string; avg: number; min: number }[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const t = 89 - i;
    const avg = Math.round(
      250 + 55 * Math.sin(t / 9) + 22 * Math.sin(t / 2.3),
    );
    const min = Math.round(avg - 40 - 15 * Math.abs(Math.sin(t / 4)));
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({ date: iso, avg, min });
  }
  return out;
}

const chartConfig = {
  price: { label: "Цена, ₽" },
  avg: { label: "Средняя цена", color: "#10b981" }, // emerald-500 — современный зелёный
  min: { label: "Минимальная цена", color: "#64748b" }, // slate-500 — спокойный серый
} satisfies ChartConfig;

const fmtDate = (value: unknown) =>
  new Date(value as string | number).toLocaleDateString("ru-RU", {
    month: "short",
    day: "numeric",
  });

export function ChartAreaInteractive() {
  const isMobile = useIsMobile();
  const [timeRange, setTimeRange] = React.useState("90d");

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d");
    }
  }, [isMobile]);

  // Данные строим один раз (на 90 дней до сегодня).
  const chartData = React.useMemo(() => buildChartData(), []);

  const filteredData = React.useMemo(() => {
    const referenceDate = new Date();
    referenceDate.setHours(0, 0, 0, 0);
    let daysToSubtract = 90;
    if (timeRange === "30d") {
      daysToSubtract = 30;
    } else if (timeRange === "7d") {
      daysToSubtract = 7;
    }
    const startDate = new Date(referenceDate);
    startDate.setDate(startDate.getDate() - daysToSubtract);
    return chartData.filter((item) => new Date(item.date) >= startDate);
  }, [chartData, timeRange]);

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>График изменения цен</CardTitle>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Средняя и минимальная цена по каталогу за последние 3 месяца
          </span>
          <span className="@[540px]/card:hidden">За 3 месяца</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">3 месяца</ToggleGroupItem>
            <ToggleGroupItem value="30d">30 дней</ToggleGroupItem>
            <ToggleGroupItem value="7d">7 дней</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Выбрать период"
            >
              <SelectValue placeholder="3 месяца" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                3 месяца
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                30 дней
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                7 дней
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillAvg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-avg)" stopOpacity={1.0} />
                <stop offset="95%" stopColor="var(--color-avg)" stopOpacity={0.1} />
              </linearGradient>
              <linearGradient id="fillMin" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-min)" stopOpacity={0.8} />
                <stop offset="95%" stopColor="var(--color-min)" stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={fmtDate}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={fmtDate}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="min"
              type="natural"
              fill="url(#fillMin)"
              stroke="var(--color-min)"
            />
            <Area
              dataKey="avg"
              type="natural"
              fill="url(#fillAvg)"
              stroke="var(--color-avg)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

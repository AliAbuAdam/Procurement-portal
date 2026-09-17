import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Camera,
  CheckCircle2,
  FolderTree,
  GitCompareArrows,
  HelpCircle,
  LogIn,
  Pencil,
  Store,
  Truck,
  UploadCloud,
} from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Статичная страница-инструкция для клиента: как проверить сервис шаг за
// шагом. Пишем по-простому, короткими фразами, с точными названиями кнопок.

const COLUMNS: { name: string; need: "обязательно" | "желательно" | "по желанию"; what: string }[] = [
  { name: "Название", need: "обязательно", what: "Как товар называется в прайсе. Строки без названия пропускаются." },
  { name: "Артикул", need: "желательно", what: "Код товара. По нему система точнее всего понимает, что товары у разных поставщиков — одинаковые." },
  { name: "Цена", need: "желательно", what: "Розничная цена." },
  { name: "Цена опт / крупный опт", need: "по желанию", what: "Оптовые цены, если поставщик их даёт." },
  { name: "Наличие / остаток", need: "по желанию", what: "Есть ли товар на складе и сколько." },
  { name: "Категория", need: "по желанию", what: "Раздел товара в прайсе поставщика." },
  { name: "Фото (ссылка)", need: "по желанию", what: "Интернет-ссылка на фотографию товара. Система сама скачает фото и поставит его на карточку." },
];

const CHECKLIST = [
  "Вошёл в систему, нашёл меню в левом нижнем углу.",
  "Создал двух поставщиков.",
  "Загрузил каждому по прайсу с пересекающимися товарами (цены разные).",
  "Нажал «Обработать автоматически», остаток разобрал вручную.",
  "В каталоге у товара видно «от X ₽» и число поставщиков.",
  "В карточке товара — таблица цен, самый дешёвый поставщик выделен.",
  "Фото подтянулись по ссылкам из прайса (или загрузил вручную).",
  "Скрыл один товар с витрины — он пропал из каталога.",
];

const FAQ = [
  {
    q: "В импорт попали не все строки",
    a: "Строки без названия товара пропускаются — это нормально. Проверьте, что колонка «Название» указана верно.",
  },
  {
    q: "Фото не появилось на карточке",
    a: "Ссылка должна вести прямо на картинку (jpg, png, webp) и начинаться с http:// или https://. Если у карточки уже есть фото, новое из прайса не добавляется — так задумано. Фото подтягиваются в течение минуты после обработки.",
  },
  {
    q: "Товара нет в каталоге",
    a: "Либо строка прайса ещё не сопоставлена (загляните в «Сопоставление»), либо товар скрыт с витрины (найдите его в «Номенклатурах» — скрытые помечены значком «скрыта»).",
  },
  {
    q: "У товара «нет предложений»",
    a: "Карточка есть, но ни одна строка прайса к ней не привязана. Привяжите строку в «Сопоставлении» — цена появится сразу.",
  },
];

function Step({
  icon,
  num,
  title,
  children,
}: {
  icon: React.ReactNode;
  num: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-[var(--border)] p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-700 dark:text-emerald-400">
          {icon}
        </span>
        <div className="flex flex-col">
          <span className="text-xs font-medium tracking-wide text-emerald-700 uppercase dark:text-emerald-400">
            {num}
          </span>
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded border border-[var(--border)] px-1.5 text-sm font-semibold whitespace-nowrap">
      {children}
    </span>
  );
}

export default function GuidePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pb-10 lg:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <BookOpen className="size-6 text-emerald-700 dark:text-emerald-400" />
          Как работать с Procurement
        </h1>
        <p className="text-[var(--muted-foreground)]">
          Вы загружаете прайс-листы поставщиков, а система собирает из них единый
          каталог товаров и показывает, у какого поставщика каждый товар дешевле.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-emerald-600/10 px-3 py-1 font-medium text-emerald-700 dark:text-emerald-400">
            Загрузили прайсы
          </span>
          <ArrowRight className="size-4 text-[var(--muted-foreground)]" />
          <span className="rounded-full bg-emerald-600/10 px-3 py-1 font-medium text-emerald-700 dark:text-emerald-400">
            Система разобрала товары
          </span>
          <ArrowRight className="size-4 text-[var(--muted-foreground)]" />
          <span className="rounded-full bg-emerald-600/10 px-3 py-1 font-medium text-emerald-700 dark:text-emerald-400">
            Смотрите каталог и сравниваете цены
          </span>
        </div>
      </div>

      <Step icon={<LogIn className="size-5" />} num="Шаг 1" title="Где что находится">
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
          <li>
            Главная страница — <b>Каталог</b>: выглядит как интернет-магазин,
            слева — категории товаров.
          </li>
          <li>
            Все рабочие разделы (Поставщики, Прайс-листы, Сопоставление и другие)
            — в меню: нажмите на <b>своё имя в левом нижнем углу</b>.
          </li>
        </ul>
      </Step>

      <Step icon={<Truck className="size-5" />} num="Шаг 2" title="Добавьте поставщика">
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
          <li>
            Меню → <Link href="/suppliers" className="text-emerald-700 underline dark:text-emerald-400">Поставщики</Link>.
          </li>
          <li>
            Впишите название (например, «Метизы-Опт») и выберите тип{" "}
            <b>Excel/CSV</b> — это значит «прайсы приходят файлами».
          </li>
          <li>Для проверки удобно завести двух поставщиков — будет что сравнивать.</li>
        </ul>
      </Step>

      <Step icon={<UploadCloud className="size-5" />} num="Шаг 3" title="Загрузите прайс-лист">
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
          <li>
            Меню → <Link href="/imports" className="text-emerald-700 underline dark:text-emerald-400">Прайс-листы</Link>.
          </li>
          <li>Выберите поставщика и перетащите файл (.xlsx или .csv) в поле загрузки.</li>
          <li>
            Нажмите <Kbd>Предпросмотр</Kbd>. Система определит, в какой колонке
            что лежит — проверьте и поправьте, если нужно.
          </li>
          <li>
            Нажмите <Kbd>Импортировать</Kbd>.
          </li>
        </ol>
        <h3 className="mt-1 font-medium">Какие колонки понимает система</h3>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Колонка</TableHead>
                <TableHead>Нужна ли</TableHead>
                <TableHead>Что это</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {COLUMNS.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-medium whitespace-nowrap">{c.name}</TableCell>
                  <TableCell
                    className={
                      c.need === "обязательно"
                        ? "font-semibold text-emerald-700 dark:text-emerald-400"
                        : "text-[var(--muted-foreground)]"
                    }
                  >
                    {c.need}
                  </TableCell>
                  <TableCell className="whitespace-normal">{c.what}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="rounded-lg bg-amber-500/10 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-300">
          Порядок и названия колонок в файле не важны — соответствие вы указываете
          на экране предпросмотра. Старый формат .xls не поддерживается —
          пересохраните файл как .xlsx.
        </p>
      </Step>

      <Step icon={<GitCompareArrows className="size-5" />} num="Шаг 4" title="Нажмите «Обработать автоматически»">
        <p className="text-sm">
          Прайс загружен, но пока это просто строки. Теперь система должна понять,
          какие строки — один и тот же товар у разных поставщиков.
        </p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
          <li>
            Меню → <Link href="/matching" className="text-emerald-700 underline dark:text-emerald-400">Сопоставление</Link>{" "}
            → выберите прайс → <Kbd>Обработать автоматически</Kbd>.
          </li>
          <li><b>Совпал артикул</b> или название очень похоже — строка привязывается к существующему товару.</li>
          <li><b>Товар явно новый</b> — создаётся новая карточка в каталоге.</li>
          <li><b>Система сомневается</b> — строка остаётся вам: под ней показаны кандидаты с процентом похожести, выберите нужного или создайте карточку.</li>
        </ul>
        <p className="rounded-lg bg-emerald-600/10 px-4 py-2.5 text-sm">
          После обработки видно итог: сколько привязано, создано и осталось на
          ручной разбор. Если в прайсе были ссылки на фото — фотографии
          подтянутся на карточки сами в течение минуты.
        </p>
      </Step>

      <Step icon={<FolderTree className="size-5" />} num="Шаг 5" title="Разложите товары по категориям">
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
          <li>
            Меню → <Link href="/categories" className="text-emerald-700 underline dark:text-emerald-400">Категории</Link> —
            создайте своё дерево разделов (например, «Ручки», «Петли», «Крепёж»).
          </li>
          <li>
            Категории поставщика можно привязать к своим — тогда новые товары
            будут раскладываться по полкам сами.
          </li>
          <li>
            Товары без категории собраны в пункте «Без категории» в каталоге —
            оттуда их можно разложить вручную.
          </li>
        </ul>
      </Step>

      <Step icon={<Store className="size-5" />} num="Шаг 6" title="Проверьте каталог и сравните цены">
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
          <li>
            Откройте <Link href="/catalog" className="text-emerald-700 underline dark:text-emerald-400">Каталог</Link>:
            работают поиск по названию и артикулу, фильтр по цене «от–до»,
            «В наличии», выбор поставщика и сортировка («Сначала дешёвые»).
          </li>
          <li>
            Нажмите на товар — откроется карточка: фото, описание, характеристики
            и <b>таблица цен всех поставщиков</b>. Самый дешёвый выделен, есть
            переключатель Розница / Опт / Крупный опт.
          </li>
          <li>
            Раздел <Link href="/compare" className="text-emerald-700 underline dark:text-emerald-400">Сравнение цен</Link> —
            то же самое в форме «выбрал товар — сравнил».
          </li>
        </ul>
      </Step>

      <Step icon={<Pencil className="size-5" />} num="Кстати" title="Карточку товара можно менять">
        <p className="text-sm">
          Меню → <Link href="/products" className="text-emerald-700 underline dark:text-emerald-400">Номенклатуры</Link>.
          У каждого товара есть две кнопки:
        </p>
        <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
          <li>
            <Camera className="inline size-4 align-text-bottom" /> <b>Фотоаппарат</b> —
            загрузить до 10 фото вручную (первое становится обложкой). Ручные фото
            система никогда не заменяет фотографиями из прайсов.
          </li>
          <li>
            <Pencil className="inline size-4 align-text-bottom" /> <b>Карандаш</b> —
            исправить название и артикул, добавить описание и характеристики
            («Материал — Сталь»), <b>скрыть товар с витрины</b> (исчезнет из
            каталога, данные сохранятся) или удалить насовсем.
          </li>
        </ul>
      </Step>

      <Step icon={<CheckCircle2 className="size-5" />} num="Тест" title="Проверка за 10 минут">
        <ul className="flex flex-col gap-1.5 text-sm">
          {CHECKLIST.map((item) => (
            <li key={item} className="flex gap-2">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
              {item}
            </li>
          ))}
        </ul>
      </Step>

      <Step icon={<HelpCircle className="size-5" />} num="Помощь" title="Если что-то не так">
        <dl className="flex flex-col gap-3 text-sm">
          {FAQ.map((f) => (
            <div key={f.q}>
              <dt className="font-semibold">{f.q}</dt>
              <dd className="ml-0 text-[var(--muted-foreground)]">{f.a}</dd>
            </div>
          ))}
        </dl>
      </Step>
    </div>
  );
}

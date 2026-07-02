// Клиент Ory Kratos (headless SDK). UI рисуем сами на shadcn — @ory/client
// отвечает только за общение с Kratos (flows, сессии).
import { Configuration, FrontendApi } from "@ory/client";

const basePath =
  process.env.NEXT_PUBLIC_KRATOS_PUBLIC_URL ?? "http://localhost:4433";

export const ory = new FrontendApi(
  new Configuration({
    basePath,
    baseOptions: {
      withCredentials: true, // куки сессии Kratos
    },
  }),
);

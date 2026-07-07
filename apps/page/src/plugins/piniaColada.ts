import { PiniaColada } from "@pinia/colada";

import type { App } from "vue";

export function installPiniaColada(app: App) {
  app.use(PiniaColada, {
    queryOptions: {
      gcTime: 5 * 60_000,
      staleTime: 30_000,
    },
  });
}

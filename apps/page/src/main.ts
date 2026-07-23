import { createApp } from "vue";
import { createPinia } from "pinia";
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";

import App from "./App.vue";
import { permissionDirective } from "./directives/permission";
import { installPiniaColada } from "./plugins/piniaColada";
import router from "./router";
import "./styles/index.css";
import { setupReleaseRecovery } from "./utils/releaseRecovery";

setupReleaseRecovery();
const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
installPiniaColada(app);
app.use(router);
app.use(ElementPlus);
app.directive("permission", permissionDirective);

app.mount("#app");

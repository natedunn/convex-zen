import { defineApp } from "convex/server";
import auth from "./zen/component/convex.config";

const app = defineApp();
app.use(auth);

export default app;

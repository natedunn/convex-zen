import { defineApp } from "convex/server";
import convexAuth from "convex-zen/convex.config";

const app = defineApp();
app.use(convexAuth);

export default app;

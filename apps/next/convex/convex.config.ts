import { defineApp } from "convex/server";
import auth from "./auth/zen/convex.config";

const app = defineApp();
app.use(auth);

export default app;

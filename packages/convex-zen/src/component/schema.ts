import { defineSchema } from "convex/server";
import { coreSchemaTables } from "./core/schemaDefinition.js";
import { schema as systemAdminSchema } from "../plugins/system-admin/schema.js";
import { schema as organizationSchema } from "../plugins/organization/schema.js";

export default defineSchema({
  ...coreSchemaTables,
  ...systemAdminSchema.tables,
  ...organizationSchema.tables,
});

import auth from "./convex.config.js";
export {
  collectPluginGatewayMetadata,
  getPluginFunctionMetadata,
  getPublicPluginFunctionArgs,
  pluginAction,
  pluginMutation,
  pluginQuery,
  PLUGIN_FUNCTION_METADATA_KEY,
} from "./plugin.js";

export function defineConvexZenComponent(_definition: unknown) {
  return auth;
}

export { auth, auth as convexAuth };

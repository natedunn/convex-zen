import auth from "./convex.config.js";
export {
  collectPluginGatewayMetadata,
  getPluginFunctionHandler,
  getPluginFunctionMetadata,
  getPublicPluginFunctionArgs,
  pluginAction,
  PLUGIN_FUNCTION_HANDLER_KEY,
  pluginMutation,
  pluginQuery,
  PLUGIN_FUNCTION_METADATA_KEY,
} from "./plugin.js";

export function defineConvexZenComponent(_definition: unknown) {
  return auth;
}

export { auth, auth as convexAuth };

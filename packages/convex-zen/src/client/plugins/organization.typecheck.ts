import { organizationPlugin } from "./organization";

organizationPlugin({
  accessControl: {
    project: ["write"],
  },
  roles: {
    owner: {
      organization: ["update"],
      project: ["write"],
    },
    admin: {
      project: ["write"],
    },
  },
});

organizationPlugin({
  accessControl: {
    project: ["write"],
  },
  roles: {
    owner: {
      // @ts-expect-error Invalid built-in organization action.
      organization: ["blah"],
    },
  },
});

organizationPlugin({
  accessControl: {
    project: ["write"],
  },
  roles: {
    owner: {
      // @ts-expect-error Invalid custom action for project.
      project: ["writer"],
    },
  },
});

organizationPlugin({
  accessControl: {
    project: ["write"],
  },
  roles: {
    owner: {
      // @ts-expect-error Invalid resource key.
      blah: ["read"],
    },
  },
});

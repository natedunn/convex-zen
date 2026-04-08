# convex-zen-system-admin

System admin plugin for `convex-zen`.

## Install

```bash
npm install convex convex-zen convex-zen-system-admin
```

## Usage

```ts
import { defineConvexZen } from "convex-zen";
import { systemAdminPlugin } from "convex-zen-system-admin";

export default defineConvexZen({
  plugins: [systemAdminPlugin()],
});
```

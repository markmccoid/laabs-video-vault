/// <reference types="vite/client" />
// Files with more than one "." (like this one and *.test.ts) aren't deployed by Convex.
export const modules = import.meta.glob(["./**/*.ts", "./**/*.js", "!./**/*.d.ts", "!./**/*.test.ts", "!./test.setup.ts"]);

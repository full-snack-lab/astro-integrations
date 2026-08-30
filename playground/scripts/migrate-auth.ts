import { auth } from "../src/auth.js";

const context = await auth.$context;
await context.runMigrations();
process.stdout.write("Better Auth SQLite migrations applied.\n");

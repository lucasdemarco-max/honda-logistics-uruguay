// Backwards-compatible entry point. Both commands use the same universal importer.
import { runCatalogSyncCli } from "./generate-catalog-data.ts";

try {
  console.log(runCatalogSyncCli(process.argv.slice(2)));
} catch (error) {
  console.error(error instanceof Error ? error.message : "No pudimos sincronizar el catálogo");
  process.exitCode = 1;
}

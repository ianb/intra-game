import { writeReports, PAGE, SUMMARY } from "./report";

// Rebuild the summary and page from the recorded YAML, with no model calls.
//   pnpm evals:report
writeReports();
console.log(`wrote ${SUMMARY} and ${PAGE}`);

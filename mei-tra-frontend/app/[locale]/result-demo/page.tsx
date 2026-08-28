import { notFound } from "next/navigation";

import { ResultDemoClient } from "./ResultDemoClient";

export const dynamic = "force-dynamic";

export default function ResultDemoPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return <ResultDemoClient />;
}

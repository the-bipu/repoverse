import { Suspense } from "react";
import CityPageClient from "@/components/CityPageClient";

export default function CityPage() {
  return (
    <Suspense
      fallback={
        <div className="wrap" style={{ padding: "60px 0", color: "#8892A6" }}>
          Loading…
        </div>
      }
    >
      <CityPageClient />
    </Suspense>
  );
}

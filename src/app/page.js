import { Suspense } from "react";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default function Page() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <Dashboard />
        </Suspense>
    );
}

import { createFileRoute } from "@tanstack/react-router";
import Layout from "@/erp/components/Layout";
import Dashboard from "@/erp/pages/Dashboard";
import { requireSession } from "@/erp/lib/require-session";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: requireSession,
  head: () => ({
    meta: [
      { title: "Dashboard — Wash ERP" },
      { name: "description", content: "Live overview of garment wash orders, WIP, deliveries and buyer analytics." },
      { property: "og:title", content: "Dashboard — Wash ERP" },
      { property: "og:description", content: "Live overview of garment wash orders, WIP, deliveries and buyer analytics." },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <Layout>
      <Dashboard />
    </Layout>
  );
}

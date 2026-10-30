import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/SiteChrome";
import { CostCalculator } from "@/components/site/CostCalculator";

export const Route = createFileRoute("/calculator")({
  head: () => ({
    meta: [
      { title: "Plot Cost Calculator & Transparent Breakdown — Sawargseema Ventures" },
      {
        name: "description",
        content:
          "Calculate estimated plot total cost with transparent breakdown of base price, stamp duty, registration fee, development charges, and maintenance corpus.",
      },
      { property: "og:title", content: "Plot Cost Calculator — Sawargseema Ventures" },
      {
        property: "og:description",
        content:
          "Transparent plot price breakdown with verified government statutory fees and venture charges.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CalculatorPage,
});

function CalculatorPage() {
  return (
    <>
      <PageHeader
        title="Plot Cost Calculator"
        sub="Transparent, itemized pricing breakdown. Base land rate, statutory government stamp duty & registration fees, development infrastructure, and society maintenance calculated automatically."
      />
      <div className="mx-auto max-w-7xl px-4 py-8">
        <CostCalculator />
      </div>
    </>
  );
}

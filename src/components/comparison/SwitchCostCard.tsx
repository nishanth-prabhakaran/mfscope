import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeftRight, Info } from "lucide-react";
import { switchCost } from "@/lib/decisions";
import { SLAB_OPTIONS, type TaxAssetClass } from "@/lib/tax";
import { fmtInr } from "@/lib/format";
import { cn } from "@/lib/utils";

const CLASS_OPTIONS: { label: string; value: TaxAssetClass }[] = [
  { label: "Equity fund", value: "equity" },
  { label: "Hybrid (equity-taxed)", value: "hybrid-equity" },
  { label: "Debt fund", value: "debt" },
  { label: "Hybrid (debt-taxed)", value: "hybrid-debt" },
  { label: "Gold / International", value: "gold-intl" },
];

export function SwitchCostCard() {
  const [currentValue, setCurrentValue] = useState(1_500_000);
  const [investedAmount, setInvestedAmount] = useState(1_000_000);
  const [holdingYears, setHoldingYears] = useState(4);
  const [assetClass, setAssetClass] = useState<TaxAssetClass>("equity");
  const [slabRate, setSlabRate] = useState(0.3);
  const [exitLoadPct, setExitLoadPct] = useState(0);
  const [currentFundReturn, setCurrentFundReturn] = useState(12);
  const [newFundReturn, setNewFundReturn] = useState(14);
  const [yearsAhead, setYearsAhead] = useState(10);

  const result = useMemo(
    () =>
      switchCost({
        currentValue,
        investedAmount,
        holdingYears,
        assetClass,
        slabRate,
        exitLoadPct,
        newFundReturn: newFundReturn / 100,
        currentFundReturn: currentFundReturn / 100,
        yearsAhead,
      }),
    [
      currentValue,
      investedAmount,
      holdingYears,
      assetClass,
      slabRate,
      exitLoadPct,
      newFundReturn,
      currentFundReturn,
      yearsAhead,
    ],
  );

  const worthIt = result.advantage > 0;

  return (
    <Card className="min-w-0 p-4 sm:p-5">
      <div className="flex gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <ArrowLeftRight className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-base font-semibold sm:text-lg">Switch Cost</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Moving to a better fund is not free. Exit load and capital gains tax leave the portfolio
            permanently, and the smaller base compounds for the rest of the holding.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Current value">
          <Input
            type="number"
            value={currentValue}
            step={50000}
            onChange={(e) => setCurrentValue(Math.max(0, Number(e.target.value) || 0))}
            className="num h-8 text-xs"
          />
        </Field>
        <Field label="Amount originally invested">
          <Input
            type="number"
            value={investedAmount}
            step={50000}
            onChange={(e) => setInvestedAmount(Math.max(0, Number(e.target.value) || 0))}
            className="num h-8 text-xs"
          />
        </Field>
        <Field label="Held so far (years)">
          <Input
            type="number"
            value={holdingYears}
            min={0}
            step={0.5}
            onChange={(e) => setHoldingYears(Math.max(0, Number(e.target.value) || 0))}
            className="num h-8 text-xs"
          />
        </Field>
        <Field label="Fund type (for tax)">
          <select
            value={assetClass}
            onChange={(e) => setAssetClass(e.target.value as TaxAssetClass)}
            className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-xs"
          >
            {CLASS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Your tax slab">
          <select
            value={slabRate}
            onChange={(e) => setSlabRate(Number(e.target.value))}
            className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-xs"
          >
            {SLAB_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Exit load (%)">
          <Input
            type="number"
            value={exitLoadPct}
            min={0}
            step={0.25}
            onChange={(e) => setExitLoadPct(Math.max(0, Number(e.target.value) || 0))}
            className="num h-8 text-xs"
          />
        </Field>
        <Field label="Current fund return (%/yr)">
          <Input
            type="number"
            value={currentFundReturn}
            step={0.5}
            onChange={(e) => setCurrentFundReturn(Number(e.target.value) || 0)}
            className="num h-8 text-xs"
          />
        </Field>
        <Field label="New fund return (%/yr)">
          <Input
            type="number"
            value={newFundReturn}
            step={0.5}
            onChange={(e) => setNewFundReturn(Number(e.target.value) || 0)}
            className="num h-8 text-xs"
          />
        </Field>
        <Field label="Years you'll stay invested">
          <Input
            type="number"
            value={yearsAhead}
            min={1}
            max={40}
            onChange={(e) => setYearsAhead(Math.min(40, Math.max(1, Number(e.target.value) || 1)))}
            className="num h-8 text-xs"
          />
        </Field>
      </div>

      <div
        className={cn(
          "mt-4 rounded-lg border p-3",
          worthIt ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5",
        )}
      >
        <p className="text-sm font-semibold">
          {worthIt ? "Switching comes out ahead" : "Staying put comes out ahead"}
        </p>
        <p className="mt-1 text-xs leading-relaxed">
          Switching costs <span className="num font-medium">{fmtInr(result.totalCost)}</span> today
          {result.exitLoad > 0 && (
            <>
              {" "}
              ({fmtInr(result.exitLoad)} exit load + {fmtInr(result.tax)} tax)
            </>
          )}
          {result.exitLoad === 0 && <> in capital gains tax</>}, leaving{" "}
          <span className="num">{fmtInr(result.amountAfterCosts)}</span> to reinvest. Over{" "}
          {yearsAhead} years that becomes{" "}
          <span className="num">{fmtInr(result.switchedValue)}</span>, against{" "}
          <span className="num">{fmtInr(result.stayValue)}</span> if you leave it alone — a
          difference of{" "}
          <span className={cn("num font-medium", worthIt ? "text-success" : "text-destructive")}>
            {result.advantage >= 0 ? "+" : ""}
            {fmtInr(result.advantage)}
          </span>
          .
        </p>
        {result.breakEvenYears != null && (
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            The new fund needs{" "}
            <span className="num font-medium text-foreground">
              {result.breakEvenYears.toFixed(1)} years
            </span>{" "}
            of that edge just to repay the switching cost. If it stops outperforming before then,
            the switch loses money.
          </p>
        )}
        <p className="mt-1.5 text-[11px] text-muted-foreground">{result.taxBasis}.</p>
      </div>

      <p className="mt-4 flex gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 h-3 w-3 shrink-0" />
        <span>
          The costs here are certain; the return difference is an assumption. Past outperformance is
          a weak guide to future outperformance, so treat the new fund's edge sceptically — that
          asymmetry is the real argument against frequent switching. Not tax advice.
        </span>
      </p>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

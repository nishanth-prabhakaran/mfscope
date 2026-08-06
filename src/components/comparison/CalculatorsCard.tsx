import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { simulateSIP, simulateLumpsum } from "@/lib/calculators";
import type { NormalizedScheme } from "@/types/mf";
import { colorFor, fmtInr, fmtPct } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface Props {
  schemes: { code: number; name: string; data: NormalizedScheme }[];
}

export function CalculatorsCard({ schemes }: Props) {
  const [monthly, setMonthly] = useState(10000);
  const [stepUp, setStepUp] = useState(0);
  const [years, setYears] = useState(5);
  const [lumpsum, setLumpsum] = useState(100000);

  const endT = useMemo(
    () => Math.min(...schemes.map((s) => s.data.rows[s.data.rows.length - 1]?.t ?? Date.now())),
    [schemes],
  );
  const startT = useMemo(() => endT - years * 365.25 * 86_400_000, [endT, years]);

  const sipRows = useMemo(() =>
    schemes.map((s, i) => ({ i, name: s.name, code: s.code, r: simulateSIP(s.data.rows, monthly, startT, endT, stepUp) })),
    [schemes, monthly, stepUp, startT, endT]);

  const lumpsumRows = useMemo(() =>
    schemes.map((s, i) => ({ i, name: s.name, code: s.code, r: simulateLumpsum(s.data.rows, lumpsum, startT) })),
    [schemes, lumpsum, startT]);

  return (
    <Card className="p-4 sm:p-5">
      <div>
        <h3 className="font-display text-base sm:text-lg font-semibold">Investment Calculators</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Backtest SIP and Lumpsum investments on real NAV history.</p>
      </div>

      <Tabs defaultValue="sip" className="mt-4">
        <TabsList>
          <TabsTrigger value="sip">SIP</TabsTrigger>
          <TabsTrigger value="lumpsum">Lumpsum</TabsTrigger>
        </TabsList>

        <TabsContent value="sip" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <NumberField label="Monthly SIP (₹)" value={monthly} onChange={setMonthly} step={1000} />
            <NumberField label="Duration (years)" value={years} onChange={setYears} step={1} min={1} max={20} />
            <NumberField label="Annual Step-Up (%)" value={stepUp} onChange={setStepUp} step={1} min={0} max={50} />
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-xs num">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="text-left font-medium py-2 pr-3">Fund</th>
                  <th className="text-right font-medium">Invested</th>
                  <th className="text-right font-medium">Current Value</th>
                  <th className="text-right font-medium">Profit</th>
                  <th className="text-right font-medium">Absolute</th>
                  <th className="text-right font-medium">XIRR</th>
                </tr>
              </thead>
              <tbody>
                {sipRows.map((row) => (
                  <tr key={row.code} className="border-b border-border/30 last:border-0">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(row.i) }} />
                        <span className="truncate max-w-[260px]">{row.name}</span>
                      </div>
                    </td>
                    <td className="text-right">{fmtInr(row.r.totalInvested)}</td>
                    <td className="text-right">{fmtInr(row.r.currentValue)}</td>
                    <td className={`text-right ${row.r.profit >= 0 ? "text-success" : "text-destructive-foreground"}`}>
                      {fmtInr(row.r.profit)}
                    </td>
                    <td className="text-right">{fmtPct(row.r.absoluteReturn)}</td>
                    <td className="text-right font-medium">{fmtPct(row.r.xirr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="lumpsum" className="mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <NumberField label="Investment (₹)" value={lumpsum} onChange={setLumpsum} step={10000} />
            <NumberField label="Years Ago" value={years} onChange={setYears} step={1} min={1} max={20} />
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-xs num">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="text-left font-medium py-2 pr-3">Fund</th>
                  <th className="text-right font-medium">Invested</th>
                  <th className="text-right font-medium">Current Value</th>
                  <th className="text-right font-medium">Absolute</th>
                  <th className="text-right font-medium">CAGR</th>
                </tr>
              </thead>
              <tbody>
                {lumpsumRows.map((row) => (
                  <tr key={row.code} className="border-b border-border/30 last:border-0">
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colorFor(row.i) }} />
                        <span className="truncate max-w-[260px]">{row.name}</span>
                      </div>
                    </td>
                    <td className="text-right">{fmtInr(row.r.invested)}</td>
                    <td className="text-right">{fmtInr(row.r.currentValue)}</td>
                    <td className={`text-right ${row.r.absoluteReturn >= 0 ? "text-success" : "text-destructive-foreground"}`}>
                      {fmtPct(row.r.absoluteReturn)}
                    </td>
                    <td className="text-right font-medium">{fmtPct(row.r.cagr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function NumberField({
  label, value, onChange, step = 1, min, max,
}: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="mt-1 h-10 num"
      />
    </div>
  );
}

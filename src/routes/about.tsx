import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DISCLAIMER } from "@/lib/rules";

export const Route = createFileRoute("/about")({ component: AboutPage });

function AboutPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 md:p-6">
      <header>
        <p className="text-xs tracking-widest text-muted-foreground uppercase">Blockchain Warriors</p>
        <h1 className="text-2xl font-medium tracking-tight">About this app</h1>
      </header>

      <Card>
        <CardContent className="space-y-3 pt-6 text-sm leading-relaxed text-muted-foreground">
          <p className="text-foreground">
            A paper desk for Bitcoin and Dogecoin. It reads live prices, maps the last push and dip, and ranks three
            ideas in each lane: long, short, and diamond hand. Each idea includes a possible Elliott Wave read — a
            count, not a certainty.
          </p>
          <p>
            Bitcoin is the leader. Dogecoin longs and diamond buys sit when Bitcoin is weak. Nothing here places a live
            order.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What the score means</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p className="text-foreground">The score is setup quality from 8 to 92. It is not a win-rate and not a prediction.</p>
          <p>
            It goes up when the map agrees: a clean push-and-dip, a stop that still makes sense, first target at least
            twice the risk, and price actually in the buy or fade zone. It goes down for chase prints, sits, and
            broken structure.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <span className="text-foreground">~70–92</span> — more of the map is lined up. Still paper. Still a stop.
            </li>
            <li>
              <span className="text-foreground">~40–69</span> — mixed. Often a wait, not a take.
            </li>
            <li>
              <span className="text-foreground">Below ~40</span> — sit. The idea is on the board so you can see why we
              are not taking it.
            </li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Long</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p className="text-foreground">A long is a bet that price goes up from the entry. You lose if it falls through the stop.</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Dip hold — buy the pullback. Possible wave 3 if the dip is a wave 2.</li>
            <li>Reclaim — buy only after the last high is taken back. Possible wave 3 confirmation.</li>
            <li>Sit — already ran. Possible late 3 / early 5. Do not chase.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Short</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p className="text-foreground">A short is a bet that price goes down from the entry. You lose if it rallies through the stop.</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Fade the high — last high fails. Possible finished wave 5.</li>
            <li>Dip break — short only after support gives way. Possible invalid bullish count.</li>
            <li>Sit — the dip still holds. Possible live wave 3. Do not fade it.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Diamond hand — accumulate</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p className="text-foreground">
            Not a swing. A bag. Buy only when price tags a target. If it never tags, you do not buy.
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Buy target 1 — first dip. Possible wave 2.</li>
            <li>Buy target 2 — deeper dip. Possible deep wave 2. Second lot only.</li>
            <li>Buy target 3 — washout at the origin. If that floor breaks, the bullish count is invalid.</li>
          </ol>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Disclaimer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>{DISCLAIMER}</p>
          <p>
            Simulated fills ignore slippage, liquidity, fees, and outages. You should not treat any pitch, score, or
            wave count as a recommendation to buy, sell, or hold any asset. If you choose to trade elsewhere with real
            money, that activity is entirely your own.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

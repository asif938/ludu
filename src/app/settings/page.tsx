"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type {
  ConsecutiveOneCapPerMatchConfig,
  DiceRulesConfig,
  FiveTurnOneRestrictionPerMatchConfig,
  GuaranteeWindowConfig,
} from "@/lib/game/diceRules";

/**
 * Not linked from anywhere in the game UI by design — reachable only by
 * typing /settings directly. Edits here apply globally (not per-room) and
 * take effect on the very next dice roll across all matches in progress.
 */
export default function DiceRulesSettingsPage() {
  const [config, setConfig] = useState<DiceRulesConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/dice-rules")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setConfig(data.config);
      })
      .catch(() => {
        if (!cancelled) setLoadError("Could not load the current dice rules.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/dice-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Save failed.");
      setConfig(data.config);
      toast.success("Dice rules saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/dice-rules", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? "Reset failed.");
      setConfig(data.config);
      toast.success("Dice rules reset to defaults.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setSaving(false);
    }
  }

  function updatePerMatchStage(
    stage: "firstToken" | "secondToken",
    matchType: "quick" | "normal",
    next: GuaranteeWindowConfig,
  ) {
    setConfig((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        sixGuarantee: {
          ...prev.sixGuarantee,
          [stage]: { ...prev.sixGuarantee[stage], [matchType]: next },
        },
      };
    });
  }

  function updateNormalOnlyStage(stage: "thirdToken" | "fourthToken", next: GuaranteeWindowConfig) {
    setConfig((prev) => (prev ? { ...prev, sixGuarantee: { ...prev.sixGuarantee, [stage]: { normal: next } } } : prev));
  }

  function updateOneCap(matchType: "quick" | "normal", next: ConsecutiveOneCapPerMatchConfig) {
    setConfig((prev) =>
      prev ? { ...prev, consecutiveOneCap: { ...prev.consecutiveOneCap, [matchType]: next } } : prev,
    );
  }

  function updateFiveTurn(matchType: "quick" | "normal", next: FiveTurnOneRestrictionPerMatchConfig) {
    setConfig((prev) =>
      prev
        ? { ...prev, fiveTurnOneRestriction: { ...prev.fiveTurnOneRestriction, [matchType]: next } }
        : prev,
    );
  }

  if (loading) {
    return (
      <main className="flex flex-1 items-center justify-center p-10 text-muted-foreground">
        Loading dice rules…
      </main>
    );
  }

  if (loadError || !config) {
    return (
      <main className="flex flex-1 items-center justify-center p-10 text-destructive">
        {loadError ?? "Settings unavailable."}
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Dice rules</h1>
          <p className="text-sm text-muted-foreground">
            Every dice-related rule the engine applies on top of a fair 1-6 roll, configurable
            separately for Quick (2-token) and Normal (4-token) matches. Changes apply globally,
            immediately, to every match already in progress.
          </p>
        </header>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Six-guarantee: releasing tokens from the yard</h2>
          <p className="text-sm text-muted-foreground">
            Which stage below is active is recalculated automatically from how many of a
            player&apos;s tokens are currently outside the yard — including after a capture sends
            one back home. That recalculation isn&apos;t a toggle; it just decides which of the
            four windows applies at any given moment.
          </p>

          <StageCard
            title="1st token"
            description="Starts as soon as every token is back in the yard."
            quick={config.sixGuarantee.firstToken.quick}
            normal={config.sixGuarantee.firstToken.normal}
            onChangeQuick={(next) => updatePerMatchStage("firstToken", "quick", next)}
            onChangeNormal={(next) => updatePerMatchStage("firstToken", "normal", next)}
          />
          <StageCard
            title="2nd token"
            description="Starts once the 1st token has left the yard."
            quick={config.sixGuarantee.secondToken.quick}
            normal={config.sixGuarantee.secondToken.normal}
            onChangeQuick={(next) => updatePerMatchStage("secondToken", "quick", next)}
            onChangeNormal={(next) => updatePerMatchStage("secondToken", "normal", next)}
          />
          <StageCard
            title="3rd token — Normal match only"
            description="Starts once the 2nd token has left the yard. A Quick match only has 2 tokens, so this never applies there."
            normal={config.sixGuarantee.thirdToken.normal}
            onChangeNormal={(next) => updateNormalOnlyStage("thirdToken", next)}
          />
          <StageCard
            title="4th token — Normal match only"
            description="Starts once the 3rd token has left the yard."
            normal={config.sixGuarantee.fourthToken.normal}
            onChangeNormal={(next) => updateNormalOnlyStage("fourthToken", next)}
          />
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Consecutive-1 cap</h2>
          <p className="text-sm text-muted-foreground">
            Blocks a 1 once the player has just rolled it this many times in a row; the dice fall
            back to a fair 2-6 for that one roll.
          </p>
          <Card>
            <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
              <OneCapColumn
                matchLabel="Quick match"
                value={config.consecutiveOneCap.quick}
                onChange={(next) => updateOneCap("quick", next)}
              />
              <OneCapColumn
                matchLabel="Normal match"
                value={config.consecutiveOneCap.normal}
                onChange={(next) => updateOneCap("normal", next)}
              />
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Five-turn 1 restriction</h2>
          <p className="text-sm text-muted-foreground">
            After any 1, blocks another 1 for the player&apos;s next several turns (dice fall back
            to 2-6), so a 1 can land at most once in that span.
          </p>
          <Card>
            <CardContent className="grid gap-3 pt-4 sm:grid-cols-2">
              <FiveTurnColumn
                matchLabel="Quick match"
                value={config.fiveTurnOneRestriction.quick}
                onChange={(next) => updateFiveTurn("quick", next)}
              />
              <FiveTurnColumn
                matchLabel="Normal match"
                value={config.fiveTurnOneRestriction.normal}
                onChange={(next) => updateFiveTurn("normal", next)}
              />
            </CardContent>
          </Card>
        </section>

        <footer className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:justify-between">
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="outline" disabled={saving}>
                  Reset to defaults
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset every dice rule to its default?</AlertDialogTitle>
                <AlertDialogDescription>
                  This discards every change on this page and restores the original windows and
                  limits. It applies immediately, globally.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </footer>
      </div>
    </main>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label className="text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const parsed = Number(e.target.value);
          if (Number.isNaN(parsed)) return;
          onChange(Math.min(max, Math.max(min, Math.round(parsed))));
        }}
        className="w-20"
      />
    </div>
  );
}

function GuaranteeColumn({
  matchLabel,
  value,
  onChange,
}: {
  matchLabel: string;
  value: GuaranteeWindowConfig;
  onChange: (next: GuaranteeWindowConfig) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{matchLabel}</span>
        <Switch checked={value.enabled} onCheckedChange={(enabled) => onChange({ ...value, enabled })} />
      </div>
      <NumberField
        label="Grace turns"
        value={value.grace}
        min={0}
        max={20}
        disabled={!value.enabled}
        onChange={(grace) => onChange({ ...value, grace })}
      />
      <NumberField
        label="Guarantee window"
        value={value.guarantee}
        min={1}
        max={20}
        disabled={!value.enabled}
        onChange={(guarantee) => onChange({ ...value, guarantee })}
      />
    </div>
  );
}

function StageCard({
  title,
  description,
  quick,
  normal,
  onChangeQuick,
  onChangeNormal,
}: {
  title: string;
  description: string;
  quick?: GuaranteeWindowConfig;
  normal: GuaranteeWindowConfig;
  onChangeQuick?: (next: GuaranteeWindowConfig) => void;
  onChangeNormal: (next: GuaranteeWindowConfig) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={`grid gap-3 ${quick ? "sm:grid-cols-2" : ""}`}>
        {quick && onChangeQuick && (
          <GuaranteeColumn matchLabel="Quick match (2 tokens)" value={quick} onChange={onChangeQuick} />
        )}
        <GuaranteeColumn matchLabel="Normal match (4 tokens)" value={normal} onChange={onChangeNormal} />
      </CardContent>
    </Card>
  );
}

function OneCapColumn({
  matchLabel,
  value,
  onChange,
}: {
  matchLabel: string;
  value: ConsecutiveOneCapPerMatchConfig;
  onChange: (next: ConsecutiveOneCapPerMatchConfig) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{matchLabel}</span>
        <Switch checked={value.enabled} onCheckedChange={(enabled) => onChange({ ...value, enabled })} />
      </div>
      <NumberField
        label="Max consecutive 1s allowed"
        value={value.maxConsecutive}
        min={1}
        max={10}
        disabled={!value.enabled}
        onChange={(maxConsecutive) => onChange({ ...value, maxConsecutive })}
      />
    </div>
  );
}

function FiveTurnColumn({
  matchLabel,
  value,
  onChange,
}: {
  matchLabel: string;
  value: FiveTurnOneRestrictionPerMatchConfig;
  onChange: (next: FiveTurnOneRestrictionPerMatchConfig) => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{matchLabel}</span>
        <Switch checked={value.enabled} onCheckedChange={(enabled) => onChange({ ...value, enabled })} />
      </div>
      <NumberField
        label="Blocked turns after a 1"
        value={value.blockTurnsAfterOne}
        min={0}
        max={20}
        disabled={!value.enabled}
        onChange={(blockTurnsAfterOne) => onChange({ ...value, blockTurnsAfterOne })}
      />
    </div>
  );
}

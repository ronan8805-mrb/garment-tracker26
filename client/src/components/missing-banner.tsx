import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";

/** Dashboard strip showing how many garments are missing, linking to the Missing tab */
export function MissingBanner({ count, days }: { count?: number; days?: number }) {
  if (count === undefined) return null;
  const has = count > 0;
  return (
    <Link href="/missing">
      <Card
        className={`cursor-pointer transition-colors ${
          has ? "border-destructive/50 bg-destructive/5 hover:bg-destructive/10" : "hover:bg-muted/50"
        }`}
      >
        <CardContent className="flex items-center gap-3 py-4">
          {has ? (
            <AlertTriangle className="w-5 h-5 text-destructive" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          )}
          <div className="flex-1">
            <p className="font-medium">
              {has ? `${count} garment${count === 1 ? "" : "s"} missing` : "No missing garments"}
            </p>
            <p className="text-sm text-muted-foreground">Not scanned for {days ?? 28} days or more</p>
          </div>
          <ArrowRight className="w-4 h-4 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export type ProvisionMode = "password" | "invite";

export interface ProvisionFormValue {
  email: string;
  displayName: string;
  mode: ProvisionMode;
  password?: string;
}

export function ProvisionFields({
  value,
  onChange,
  disabled,
}: {
  value: ProvisionFormValue;
  onChange: (v: ProvisionFormValue) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <Label htmlFor="pv-name">Display name</Label>
          <Input
            id="pv-name"
            value={value.displayName}
            onChange={(e) => onChange({ ...value, displayName: e.target.value })}
            disabled={disabled}
          />
        </div>
        <div>
          <Label htmlFor="pv-email">Email</Label>
          <Input
            id="pv-email"
            type="email"
            value={value.email}
            onChange={(e) => onChange({ ...value, email: e.target.value })}
            disabled={disabled}
          />
        </div>
      </div>
      <Tabs
        value={value.mode}
        onValueChange={(v) => onChange({ ...value, mode: v as ProvisionMode })}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="password">Set password</TabsTrigger>
          <TabsTrigger value="invite">Send invite email</TabsTrigger>
        </TabsList>
        <TabsContent value="password" className="mt-3">
          <Label htmlFor="pv-pw">Temporary password</Label>
          <Input
            id="pv-pw"
            type="text"
            placeholder="At least 6 characters"
            value={value.password ?? ""}
            onChange={(e) => onChange({ ...value, password: e.target.value })}
            disabled={disabled}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Share this with the user — they can change it after first login.
          </p>
        </TabsContent>
        <TabsContent value="invite" className="mt-3 text-xs text-muted-foreground">
          The user receives an invite email with a link to set their password
          and log in.
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function SubmitButton({
  busy,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <Button type="submit" disabled={busy || rest.disabled} {...rest}>
      {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </Button>
  );
}

export function useProvisionState(): [
  ProvisionFormValue,
  (v: ProvisionFormValue) => void,
  () => void,
] {
  const [v, setV] = useState<ProvisionFormValue>({
    email: "",
    displayName: "",
    mode: "password",
    password: "",
  });
  return [v, setV, () => setV({ email: "", displayName: "", mode: "password", password: "" })];
}

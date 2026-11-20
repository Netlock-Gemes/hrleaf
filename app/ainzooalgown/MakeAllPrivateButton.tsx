"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { makeAllPrivateAction } from "@/server/admin-actions";

/** Temporary: one click makes every note "Only me". */
export default function MakeAllPrivateButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() => {
        if (!confirm("Make every note Only me? Members will lose access to all notes.")) return;
        start(async () => {
          const res = await makeAllPrivateAction();
          if (res.ok) toast.success(res.message);
          else toast.error(res.message);
        });
      }}
    >
      {pending ? "Working…" : "Make all Only me"}
    </Button>
  );
}

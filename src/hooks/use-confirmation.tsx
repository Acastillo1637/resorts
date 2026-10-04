import { useEffect, useState } from "react";
import { createConfirmation, type ConfirmationState } from "@/lib/confirmation";
import { errorMensaje } from "@/lib/booking";
import { ConfirmationModal } from "@/components/ConfirmationModal";
export function useConfirmation() {
  const [state, setState] = useState<ConfirmationState | null>(null);
  const [controller] = useState(() => createConfirmation(setState, errorMensaje));
  useEffect(() => () => controller.cancel(), [controller]);
  return {
    confirm: controller.ask,
    dialog: (
      <ConfirmationModal state={state} cancel={controller.cancel} submit={controller.submit} />
    ),
  };
}

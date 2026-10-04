export interface ConfirmationOptions {
  title: string;
  message: string;
  label: string;
  destructive?: boolean;
}
export interface ConfirmationState {
  options: ConfirmationOptions;
  busy: boolean;
  error: string;
}
export const cancellationConfirmation: ConfirmationOptions = {
  title: "Cancelar reserva",
  message: "¿Estás seguro de que deseas cancelar esta reserva?",
  label: "CANCELAR RESERVA",
  destructive: true,
};
export function createConfirmation(
  publish: (state: ConfirmationState | null) => void,
  message: (error: unknown) => string,
) {
  let pending: {
    options: ConfirmationOptions;
    action: () => Promise<void>;
    resolve: (ok: boolean) => void;
  } | null = null;
  let busy = false;
  return {
    ask(options: ConfirmationOptions, action: () => Promise<void>) {
      if (pending) return Promise.resolve(false);
      return new Promise<boolean>((resolve) => {
        pending = { options, action, resolve };
        publish({ options, busy: false, error: "" });
      });
    },
    cancel() {
      if (!pending || busy) return;
      const task = pending;
      pending = null;
      publish(null);
      task.resolve(false);
    },
    async submit() {
      if (!pending || busy) return;
      const task = pending;
      busy = true;
      publish({ options: task.options, busy: true, error: "" });
      try {
        await task.action();
        pending = null;
        publish(null);
        task.resolve(true);
      } catch (error) {
        publish({ options: task.options, busy: false, error: message(error) });
      } finally {
        busy = false;
      }
    },
  };
}

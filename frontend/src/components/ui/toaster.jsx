import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";
export function Toaster() {
  const { toasts } = useToast();
  return <ToastProvider>{toasts.map(function({ id, title, description, action, ...props }) {
    const isDestructive = props.variant === "destructive";
    const isWarning = props.variant === "warning";
    const duration = isDestructive ? 9e3 : isWarning ? 6e3 : props.duration || 2e3;
    const showClose = isDestructive || isWarning;
    return <Toast key={id} {...props} duration={duration}><div className="grid gap-1">{title && <ToastTitle>{title}</ToastTitle>}{description && <ToastDescription>{description}</ToastDescription>}</div>{action}{showClose && <ToastClose />}</Toast>;
  })}<ToastViewport /></ToastProvider>;
}

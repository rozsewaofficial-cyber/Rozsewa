import { useTheme } from "@/context/ThemeContext";
import { Toaster as Sonner, toast } from "sonner";
const originalSuccess = toast.success;
const originalError = toast.error;
const originalInfo = toast.info;
const originalWarning = toast.warning;
toast.success = (message, options) => originalSuccess(message, { duration: 2e3, ...options });
toast.info = (message, options) => originalInfo(message, { duration: 2e3, ...options });
toast.warning = (message, options) => originalWarning(message, { duration: 6e3, ...options });
toast.error = (message, options) => originalError(message, { duration: 9e3, ...options });
const Toaster = ({ ...props }) => {
  const { theme = "light" } = useTheme();
  return <Sonner
    theme={theme}
    className="toaster group"
    closeButton={true}
    duration={2e3}
    toastOptions={{
      classNames: {
        toast: "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
        description: "group-[.toast]:text-muted-foreground",
        actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
        cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground"
      }
    }}
    {...props}
  />;
};
export { Toaster, toast };

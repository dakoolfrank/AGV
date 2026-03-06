"use client";

import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      position="top-center"
      richColors
      closeButton
      expand
      duration={6000}
      toastOptions={{ 
        classNames: { 
          toast: "z-[99999]",
          title: "text-sm font-semibold",
          description: "text-sm opacity-90",
          actionButton: "bg-primary text-primary-foreground",
          cancelButton: "bg-muted text-muted-foreground",
        } 
      }}
      {...props}
    />
  );
};

export { Toaster };

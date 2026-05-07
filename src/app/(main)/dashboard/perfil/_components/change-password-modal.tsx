"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Key, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordChecklist } from "@/components/password-checklist";
import { changePassword, verifyCurrentPassword } from "../_actions/change-password";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "La contraseña actual es requerida."),
  newPassword: z.string()
    .min(8, "Mínimo 8 caracteres.")
    .regex(/[A-Z]/, "Debe contener al menos una letra mayúscula.")
    .regex(/[a-z]/, "Debe contener al menos una letra minúscula.")
    .regex(/[0-9]/, "Debe contener al menos un número.")
    .regex(/[^A-Za-z0-9]/, "Debe contener al menos un carácter especial (!@#$%^&*…)."),
  confirmPassword: z.string()
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden.",
  path: ["confirmPassword"],
});

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

export function ChangePasswordModal() {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    trigger,
    getValues,
    watch,
    formState: { errors },
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ChangePasswordFormValues) => {
    setIsLoading(true);
    
    try {
      const formData = new FormData();
      formData.append("currentPassword", data.currentPassword);
      formData.append("newPassword", data.newPassword);
      formData.append("confirmPassword", data.confirmPassword);

      const result = await changePassword(formData);

      if (result.success) {
        toast.success("Contraseña actualizada con éxito.");
        setOpen(false);
        reset();
      } else {
        toast.error(result.error || "Ocurrió un error.");
      }
    } catch (error) {
      toast.error("Error al comunicarse con el servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    const isValid = await trigger("currentPassword");
    if (!isValid) return;

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("currentPassword", getValues("currentPassword"));
      
      const result = await verifyCurrentPassword(formData);

      if (result.success) {
        setIsVerified(true);
        toast.success("Contraseña verificada correctamente.");
      } else {
        toast.error(result.error || "La contraseña actual es incorrecta.");
      }
    } catch (error) {
      toast.error("Error al comunicarse con el servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVerified) {
      handleVerify();
    } else {
      handleSubmit(onSubmit)(e);
    }
  };

  const newPasswordValue = watch("newPassword") ?? "";

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && isLoading) return; // Prevent closing while loading
    setOpen(newOpen);
    if (!newOpen) {
      reset(); // Reset form when closing
      setIsVerified(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full gap-2">
          <Key className="h-4 w-4" /> Cambiar Contraseña
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle>Cambiar Contraseña</DialogTitle>
          <DialogDescription>
            Ingresa tu contraseña actual y define una nueva.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleFormSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Contraseña Actual</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type="password"
                placeholder="••••••••"
                {...register("currentPassword")}
                disabled={isLoading || isVerified}
              />
              {isVerified && (
                <CheckCircle2 className="absolute right-3 top-2.5 h-4 w-4 text-green-600 dark:text-green-500" />
              )}
            </div>
            {errors.currentPassword && (
              <p className="text-sm text-destructive">{errors.currentPassword.message}</p>
            )}
          </div>
          
          {isVerified && (
            <>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nueva Contraseña</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••••"
                  {...register("newPassword")}
                  disabled={isLoading}
                />
                {errors.newPassword ? (
                  <p className="text-sm text-destructive">{errors.newPassword.message}</p>
                ) : (
                  <PasswordChecklist password={newPasswordValue} />
                )}
                {!newPasswordValue && (
                  <p className="text-xs text-muted-foreground">
                    Debe tener mayúscula, minúscula, número y símbolo especial.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nueva Contraseña</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  {...register("confirmPassword")}
                  disabled={isLoading}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                )}
              </div>
            </>
          )}

          <div className="pt-4 flex justify-end gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            {!isVerified ? (
              <Button type="button" onClick={handleVerify} disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verificar Contraseña
              </Button>
            ) : (
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar Cambios
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

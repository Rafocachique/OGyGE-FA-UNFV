
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { UserCircle, Image as ImageIcon, LoaderCircle, Trash2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";
import { useAuth } from "@/hooks/use-auth";
import { doc, updateDoc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function SettingsPage() {
  const { toast } = useToast();
  const { appUser } = useAuth();
  const isAdmin = appUser?.roles.includes('admin');

  // State for Appearance section
  const [appTitle, setAppTitle] = useState("Gestion de Tesis de Grados y Titulos -FA");
  const [previewUrl, setPreviewUrl] = useState<string | null>("/unfv-logo.png");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loginPreviewUrl, setLoginPreviewUrl] = useState<string | null>(null);
  const [loginImageFile, setLoginImageFile] = useState<File | null>(null);

  // State for Profile section
  const [profileName, setProfileName] = useState("");
  const [profileLastName, setProfileLastName] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingAppearance, setIsSavingAppearance] = useState(false);


  useEffect(() => {
    // Load appearance settings from Firestore
    const fetchConfig = async () => {
        const configRef = doc(db, "appConfig", "main");
        const docSnap = await getDoc(configRef);
        if (docSnap.exists()) {
            const data = docSnap.data();
            setAppTitle(data.appTitle || "Gestion de Tesis de Grados y Titulos -FA");
            setPreviewUrl(data.appLogoUrl || "/unfv-logo.png");
            setLoginPreviewUrl(data.loginImageUrl || null);
        }
    };
    
    if (isAdmin) {
        fetchConfig();
    }

    // Load profile settings
    if (appUser) {
      setProfileName(appUser.nombre);
      setProfileLastName(appUser.apellidos);
    }
  }, [appUser, isAdmin]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'login') => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        if (type === 'logo') {
            setLogoFile(file);
            setPreviewUrl(result);
        } else {
            setLoginImageFile(file);
            setLoginPreviewUrl(result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLoginImage = () => {
    setLoginImageFile(null);
    setLoginPreviewUrl(null);
  }

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
  }

  const handleAppearanceSaveChanges = async () => {
    if (!isAdmin) return;
    setIsSavingAppearance(true);
    const configRef = doc(db, "appConfig", "main");
    try {
        let logoUrlToSave = previewUrl;
        let loginImageUrlToSave = loginPreviewUrl;

        if (logoFile) {
            logoUrlToSave = await fileToDataUrl(logoFile);
        }
        if (loginImageFile) {
            loginImageUrlToSave = await fileToDataUrl(loginImageFile);
        }
        
        await setDoc(configRef, {
            appTitle: appTitle,
            appLogoUrl: logoUrlToSave,
            loginImageUrl: loginImageUrlToSave,
        }, { merge: true });

        toast({
            title: "Ajustes guardados",
            description: "La apariencia de la aplicación ha sido actualizada para todos los usuarios.",
        });
    } catch (error) {
        toast({
            variant: "destructive",
            title: "Error",
            description: "No se pudieron guardar los cambios de apariencia en la base de datos.",
        });
        console.error(error);
    } finally {
        setIsSavingAppearance(false);
    }
};

  const handleProfileSaveChanges = async () => {
    if (!appUser) return;
    setIsSavingProfile(true);

    try {
        const userRef = doc(db, "users", appUser.uid);
        await updateDoc(userRef, {
            nombre: profileName,
            apellidos: profileLastName
        });

        toast({
            title: "Perfil Actualizado",
            description: "Tu nombre y apellidos han sido actualizados."
        });

    } catch (error) {
        toast({
            variant: "destructive",
            title: "Error al actualizar perfil",
            description: "No se pudieron guardar los cambios en la base de datos.",
        });
        console.error(error);
    } finally {
        setIsSavingProfile(false);
    }
  };


  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold font-headline">Ajustes</h1>
        <p className="text-muted-foreground">
          Gestione la configuración de su cuenta y las preferencias de la aplicación.
        </p>
      </div>
      <Separator />

      {isAdmin && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ImageIcon className="w-6 h-6 text-primary" />
              <CardTitle>Apariencia</CardTitle>
            </div>
            <CardDescription>
              Personalice el logo y el título de la aplicación. Estos cambios serán visibles para todos los usuarios.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="appTitle">Título de la Aplicación</Label>
              <Input id="appTitle" value={appTitle} onChange={(e) => setAppTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUpload">Logo de la Aplicación</Label>
              <Input id="logoUpload" type="file" accept="image/png, image/jpeg, image/svg+xml" onChange={(e) => handleFileChange(e, 'logo')} />
              <p className="text-sm text-muted-foreground">
                Sube una imagen para el logo. Recomendado: formato PNG con fondo transparente.
              </p>
            </div>
            {previewUrl && (
              <div className="space-y-2">
                <Label>Vista Previa del Logo</Label>
                <div className="relative w-48 h-16 bg-muted rounded-md flex items-center justify-center">
                  <Image src={previewUrl} alt="Vista previa del logo" layout="fill" objectFit="contain" />
                </div>
              </div>
            )}
            <Separator />
            <div className="space-y-2">
                <h4 className="font-medium">Apariencia de Inicio de Sesión</h4>
                <Label htmlFor="loginImageUpload">Imagen de Fondo del Login</Label>
                 <div className="flex gap-2">
                    <Input id="loginImageUpload" type="file" accept="image/png, image/jpeg" onChange={(e) => handleFileChange(e, 'login')} />
                    <Button variant="outline" size="icon" onClick={handleRemoveLoginImage} aria-label="Eliminar imagen de login">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Sube una imagen para la pantalla de inicio de sesión. Recomendado: resolución 1920x1080.
                </p>
            </div>
            {loginPreviewUrl ? (
              <div className="space-y-2">
                <Label>Vista Previa de la Imagen de Login</Label>
                <div className="relative w-full aspect-video bg-muted rounded-md flex items-center justify-center">
                  <Image src={loginPreviewUrl} alt="Vista previa de la imagen de login" layout="fill" objectFit="cover" className="rounded-md" />
                </div>
              </div>
            ) : (
                <div className="text-sm text-muted-foreground p-4 border-2 border-dashed rounded-md text-center">
                    No hay imagen de fondo seleccionada. Se usará la imagen por defecto.
                </div>
            )}

            <Button onClick={handleAppearanceSaveChanges} disabled={isSavingAppearance}>
                  {isSavingAppearance ? (
                      <>
                      <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                      </>
                  ) : (
                      "Guardar Cambios de Apariencia"
                  )}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <UserCircle className="w-6 h-6 text-primary" />
            <CardTitle>Perfil</CardTitle>
          </div>
          <CardDescription>
            Esta información se mostrará públicamente en el sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input id="name" value={profileName} onChange={(e) => setProfileName(e.target.value)} />
            </div>
            <div className="space-y-2">
                <Label htmlFor="lastName">Apellidos</Label>
                <Input id="lastName" value={profileLastName} onChange={(e) => setProfileLastName(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Correo Electrónico</Label>
            <Input id="email" type="email" value={appUser?.correo || ""} disabled />
          </div>
          <Button onClick={handleProfileSaveChanges} disabled={isSavingProfile}>
             {isSavingProfile ? (
              <>
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
                "Guardar Cambios de Perfil"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

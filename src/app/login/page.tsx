"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { app, db } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookOpenCheck, LoaderCircle, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, onSnapshot } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginImageUrl, setLoginImageUrl] = useState("https://picsum.photos/seed/login/1920/1080");
  const router = useRouter();
  const { toast } = useToast();
  const auth = getAuth(app);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const configRef = doc(db, "appConfig", "main");
    const unsubscribe = onSnapshot(configRef, (docSnap) => {
        if (docSnap.exists() && docSnap.data().loginImageUrl) {
            setLoginImageUrl(docSnap.data().loginImageUrl);
        } else {
            setLoginImageUrl("https://picsum.photos/seed/login/1920/1080");
        }
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.toLowerCase(), password);
      // The useEffect hook will handle the redirect on successful login
    } catch (error: any) {
      let title = "Error de autenticación";
      let description = "Ocurrió un error inesperado. Por favor, inténtelo de nuevo.";

      if (error?.code === 'auth/invalid-credential') {
          description = "El correo o la contraseña son incorrectos. Por favor, verifique sus credenciales.";
      } else {
        console.error("Error al iniciar sesión:", error);
      }
      
      toast({
        variant: "destructive",
        title: title,
        description: description,
      });
      setLoading(false);
    }
  };
  
  return (
    <div className="w-full lg:grid lg:min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center py-12">
        <div className="mx-auto grid w-[350px] gap-6">
          <div className="grid gap-2 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <BookOpenCheck className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold font-headline">Gestión de Tesis</h1>
            </div>
            <p className="text-balance text-muted-foreground">
              Bienvenido al sistema de la Oficina de Grados y Gestión del Egresado - UNFV.
            </p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Iniciar Sesión</CardTitle>
              <CardDescription>
                Ingrese su correo electrónico para acceder a su cuenta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin}>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Correo Electrónico</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="nombre@unfv.edu.pe"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={authLoading || loading}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <div className="relative">
                      <Input 
                        id="password" 
                        type={showPassword ? 'text' : 'password'}
                        required 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-10"
                        disabled={authLoading || loading}
                      />
                       <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        <span className="sr-only">{showPassword ? 'Ocultar' : 'Mostrar'} contraseña</span>
                      </Button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={authLoading || loading}>
                    {loading ? (
                      <>
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                        Ingresando...
                      </>
                    ) : (
                      "Ingresar"
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="hidden bg-muted lg:block">
        <Image
          src={loginImageUrl}
          alt="Imagen de fondo de la página de inicio de sesión"
          width="1920"
          height="1080"
          className="h-full w-full object-cover dark:brightness-[0.4]"
          data-ai-hint="university library"
        />
      </div>
    </div>
  );
}

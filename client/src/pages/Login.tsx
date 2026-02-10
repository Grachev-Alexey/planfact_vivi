import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Login() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left: Branding */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-primary text-primary-foreground relative overflow-hidden">
        <div className="relative z-10">
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center font-bold text-2xl mb-8 font-display">
            V
          </div>
          <h1 className="text-5xl font-bold font-display mb-4">
            Финансы под контролем
          </h1>
          <p className="text-xl opacity-90 font-light">
            Управляйте сетью студий ViVi эффективно. Прозрачный учет, понятные отчеты, рост прибыли.
          </p>
        </div>
        
        <div className="relative z-10 text-sm opacity-60">
          © {new Date().getFullYear()} ViVi Finance. All rights reserved.
        </div>

        {/* Abstract shapes */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-black/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
      </div>

      {/* Right: Login */}
      <div className="flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-bold tracking-tight font-display">Вход в систему</h2>
            <p className="text-muted-foreground">Используйте корпоративный аккаунт для доступа</p>
          </div>

          <Card className="border-border/50 shadow-lg">
            <CardContent className="pt-6">
              <Button 
                className="w-full py-6 text-lg font-medium bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5"
                onClick={() => window.location.href = "/api/login"}
              >
                Войти через Replit
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

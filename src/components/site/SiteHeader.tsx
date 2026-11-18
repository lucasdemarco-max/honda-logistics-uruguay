import { Link } from "@tanstack/react-router";
import { LayoutDashboard, LogOut, Menu, ShoppingCart, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Logo } from "./Logo";
import { useCart } from "@/lib/cart";
import { useAccess, useAuth, useSignOut } from "@/lib/auth";

export const NAV = [
  { to: "/catalogo", label: "Catálogo" },
  { to: "/marcas", label: "Marcas Asociadas" },
  { to: "/seguimiento", label: "Seguimiento" },
  { to: "/presupuestos", label: "Presupuestos" },
  { to: "/envios", label: "Envíos y pagos" },
] as const;

function AccountControls() {
  const { user, ready } = useAuth();
  const { data: access } = useAccess();
  const signOut = useSignOut();
  if (!ready) return <div className="h-9 w-24" aria-hidden />;
  if (!user)
    return (
      <Button asChild size="sm" variant="ink-outline">
        <Link to="/auth" search={{}}>
          <User /> Ingresar
        </Link>
      </Button>
    );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="ink-outline" aria-label="Menú de cuenta">
          <User /> <span className="hidden max-w-32 truncate sm:inline">{access?.profile?.full_name || "Mi cuenta"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate text-xs font-normal text-muted-foreground">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/cuenta">
            <User /> Mi cuenta
          </Link>
        </DropdownMenuItem>
        {access?.isStaff && (
          <DropdownMenuItem asChild>
            <Link to="/admin">
              <LayoutDashboard /> Panel administrativo
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut /> Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SiteHeader() {
  const { totals, hydrated } = useCart();
  return (
    <header className="sticky top-0 z-40 border-b border-ink-border bg-ink text-ink-foreground">
      <div className="stripe-band h-1 opacity-90" aria-hidden />
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Logo inverted />
        <nav aria-label="Principal" className="ml-6 hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink-foreground"
              activeProps={{ className: "text-ink-foreground bg-ink-foreground/10" }}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild size="sm" variant="ink-outline" className="relative">
            <Link to="/carrito" aria-label={`Carrito, ${hydrated ? totals.units : 0} artículos`}>
              <ShoppingCart />
              <span className="hidden sm:inline">Carrito</span>
              {hydrated && totals.units > 0 && (
                <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                  {totals.units}
                </span>
              )}
            </Link>
          </Button>
          <AccountControls />
          <Sheet>
            <SheetTrigger asChild>
              <Button size="icon" variant="ink-outline" className="lg:hidden" aria-label="Abrir menú">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetHeader>
                <SheetTitle className="font-display uppercase tracking-wide">Menú</SheetTitle>
              </SheetHeader>
              <nav aria-label="Móvil" className="mt-4 flex flex-col gap-1 px-4">
                <Link to="/" className="rounded px-3 py-2.5 font-medium hover:bg-muted">Inicio</Link>
                {NAV.map((n) => (
                  <Link key={n.to} to={n.to} className="rounded px-3 py-2.5 font-medium hover:bg-muted" activeProps={{ className: "bg-accent text-accent-foreground" }}>
                    {n.label}
                  </Link>
                ))}
                <Link to="/cuenta" className="rounded px-3 py-2.5 font-medium hover:bg-muted">Mi cuenta</Link>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

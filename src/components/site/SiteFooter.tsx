import { Link } from "@tanstack/react-router";
import { Logo } from "./Logo";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-ink-border bg-ink text-ink-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4 lg:px-8">
        <div className="md:col-span-2">
          <Logo inverted />
          <div className="mt-5 max-w-md space-y-3 text-sm text-ink-muted">
            <h2 className="text-lg font-semibold text-ink-foreground">Honda Logistics</h2>
            <p>Lunes a Viernes de 8:15 a 17:00 hs.</p>
            <address className="not-italic">
              Av. Giannattasio esq. Melchora Cuenca, Ciudad de la Costa, Canelones, Uruguay
            </address>
            <p>Tel. 2600 1212* int. 6</p>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <li><a href="tel:+59826001212" className="hover:text-primary">2600 1212</a></li>
              <li><a href="mailto:info@hondauruguay.com" className="hover:text-primary">Enviar mail</a></li>
              <li>
                <a
                  href="https://www.google.com/maps/place/Honda+Uruguay+Autom%C3%B3viles+-+Repuestos/data=!4m2!3m1!1s0x0:0x702d6e3430bd9aba?sa=X&ved=1t:2428&ictx=111"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary"
                >
                  Cómo llegar
                </a>
              </li>
            </ul>
          </div>
          <p className="mt-4 text-xs text-ink-muted">
            Honda Logistics es una empresa independiente. Las marcas mencionadas pertenecen a sus respectivos titulares.
          </p>
        </div>
        <div>
          <h2 className="eyebrow mb-3 text-ink-muted">Tienda</h2>
          <ul className="space-y-2 text-sm">
            <li><Link to="/catalogo" className="hover:text-primary">Catálogo de repuestos</Link></li>
            <li><Link to="/marcas" className="hover:text-primary">Marcas Asociadas</Link></li>
            <li><Link to="/carrito" className="hover:text-primary">Carrito</Link></li>
            <li><Link to="/envios" className="hover:text-primary">Envíos y formas de pago</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="eyebrow mb-3 text-ink-muted">Clientes</h2>
          <ul className="space-y-2 text-sm">
            <li><Link to="/seguimiento" className="hover:text-primary">Seguimiento de casos</Link></li>
            <li><Link to="/presupuestos" className="hover:text-primary">Presupuestos por chasis</Link></li>
            <li><Link to="/auth" search={{ modo: "registro" }} className="hover:text-primary">Registrarse</Link></li>
            <li><Link to="/cuenta" className="hover:text-primary">Mi cuenta</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-4 text-xs text-ink-muted sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} Honda Logistics · Uruguay</span>
          <span>Precios en pesos uruguayos (UYU)</span>
        </div>
      </div>
    </footer>
  );
}

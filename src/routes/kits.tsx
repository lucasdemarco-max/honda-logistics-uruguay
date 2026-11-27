import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/site/PageHeader";
import kitCatalog from "@/data/kits.json";
import { formatUYU } from "@/lib/format";
import { getHondaProductPhoto } from "@/lib/product-photos";

export const Route = createFileRoute("/kits")({
  head: () => ({ meta: [{ title: "KITS por modelo — Honda Logistics" }] }),
  component: Kits,
});

function Kits() {
  const [platform, setPlatform] = useState("");
  const [selectedKit, setSelectedKit] = useState<number | null>(null);
  const model = kitCatalog.models.find((entry) => entry.name === platform);
  const kit = selectedKit === null ? undefined : model?.kits[selectedKit];

  return (
    <>
      <PageHeader
        eyebrow="Catálogo Honda Logistics"
        title="KITS"
        description="Elegí tu modelo para consultar los kits de servicio y auxiliares, sus años de utilización y sus componentes."
      />
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        <section aria-labelledby="kit-models-title">
          <h2 id="kit-models-title" className="mb-4 text-2xl font-bold">Elegí tu modelo Honda</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {kitCatalog.models.map(({ name }) => {
              const slug = name.replace(/ e:HEV$/i, "").replace(/^CIVIC TYPE R$/i, "TYPE-R").toLowerCase();
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={platform === name}
                  onClick={() => { setPlatform(name); setSelectedKit(null); }}
                  className="overflow-hidden rounded-lg border bg-white transition hover:border-primary aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary"
                >
                  <img
                    src={`/images/models/${slug}.webp`}
                    alt=""
                    width={320}
                    height={180}
                    loading="lazy"
                    className="aspect-video w-full object-contain p-2"
                  />
                  <span className="block border-t px-2 py-3 text-sm font-semibold">{name}</span>
                </button>
              );
            })}
          </div>
        </section>

        {model && (
          <section aria-labelledby="kit-groups-title" className="rounded-lg border bg-card p-4 sm:p-6">
            <h2 id="kit-groups-title" className="text-2xl font-bold">Kits para {model.name}</h2>
            <label htmlFor="kit-group" className="mt-4 block text-sm font-semibold">Nomenclatura del kit y años de utilización</label>
            <select
              id="kit-group"
              className="mt-2 w-full max-w-2xl rounded-md border bg-background p-3 text-sm"
              value={selectedKit ?? ""}
              onChange={(event) => setSelectedKit(event.target.value === "" ? null : Number(event.target.value))}
            >
              <option value="">Seleccioná un kit</option>
              <optgroup label="Kits de Servicio">
                {model.kits.map((option, index) => option.kind === "Servicio" && (
                  <option key={index} value={index}>{option.name} · {option.years}</option>
                ))}
              </optgroup>
              {model.kits.some((option) => option.kind === "Auxiliar") && (
                <optgroup label="Kits Auxiliares">
                  {model.kits.map((option, index) => option.kind === "Auxiliar" && (
                    <option key={index} value={index}>{option.name} · {option.years}</option>
                  ))}
                </optgroup>
              )}
            </select>

            {kit && (
              <div className="mt-6" aria-live="polite">
                <h3 className="text-xl font-semibold">{kit.name}</h3>
                <p className="mb-4 text-sm text-muted-foreground">Años de utilización {kit.years}</p>
                <div className="overflow-x-auto rounded-md border" tabIndex={0} role="region" aria-label="Componentes del kit">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th scope="col" className="px-3 py-3">Código de Pieza</th>
                        <th scope="col" className="px-3 py-3">Descripción</th>
                        <th scope="col" className="px-3 py-3 text-right">Qty x Kit</th>
                        <th scope="col" className="px-3 py-3 text-right">Precio Unitario</th>
                        <th scope="col" className="px-3 py-3 text-right">Precio Final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kit.components.map((id, index) => {
                        const part = kitCatalog.components[id];
                        const photo = getHondaProductPhoto(part.code);
                        return (
                          <tr key={index} className="border-t">
                            <td className="px-3 py-3 font-mono">{part.code}</td>
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-3">
                                {photo && <img src={photo.url} alt="" width={56} height={48} loading="lazy" className="h-12 w-14 rounded bg-white object-contain" />}
                                {part.description || "—"}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">{part.quantity ?? "—"}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{formatUYU(part.unitPrice)}</td>
                            <td className="px-3 py-3 text-right tabular-nums">{formatUYU(part.finalPrice)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </>
  );
}
